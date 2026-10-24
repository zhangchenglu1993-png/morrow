import { getDb, getSettingNumber, withTransaction } from "./db";
import { DEFAULT_RULES, REACTION_TYPES, type FeedbackReason, type ReactionType } from "./constants";
import { calculateVisibility, shouldHideComment, type FeedbackEntry } from "./feedback";
import { awardContribution, deactivateContributionSource, deactivatePostContribution } from "./contribution";
import { rankForPoints } from "./ranks";
import { getUserPoints } from "./contribution";

export function recomputePostVisibility(postId: string): boolean {
  return withTransaction((db) => {
    const post = db
      .prepare("SELECT id, status, author_id FROM posts WHERE id = ?")
      .get(postId) as { id: string; status: string; author_id: string } | undefined;
    if (!post || post.status !== "public") return false;

    const reactions = db
      .prepare("SELECT user_id, type FROM reactions WHERE post_id = ?")
      .all(postId) as Array<{ user_id: string; type: ReactionType }>;
    const flags = db
      .prepare("SELECT user_id FROM post_flags WHERE post_id = ?")
      .all(postId) as Array<{ user_id: string }>;
    const entries = new Map<string, FeedbackEntry>();
    for (const reaction of reactions) {
      entries.set(reaction.user_id, {
        userId: reaction.user_id,
        reaction: reaction.type,
        flagged: false
      });
    }
    for (const flag of flags) {
      const existing = entries.get(flag.user_id);
      entries.set(flag.user_id, {
        userId: flag.user_id,
        reaction: existing?.reaction ?? null,
        flagged: true
      });
    }

    const snapshot = calculateVisibility(
      [...entries.values()],
      getSettingNumber("min_feedback_participants", DEFAULT_RULES.minFeedbackParticipants),
      getSettingNumber("negative_hide_ratio", DEFAULT_RULES.negativeHideRatio)
    );
    if (!snapshot.shouldHide) return false;

    db.prepare("UPDATE posts SET status = 'hidden', hidden_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      postId
    );
    db.prepare("UPDATE contribution_events SET active = 0 WHERE post_id = ?").run(postId);
    return true;
  });
}

export function setReaction(
  userId: string,
  postId: string,
  type: ReactionType
): { ok: boolean; error?: string } {
  if (!REACTION_TYPES.includes(type)) return { ok: false, error: "未知的表情。" };
  const db = getDb();
  const post = db
    .prepare("SELECT id, author_id, status FROM posts WHERE id = ?")
    .get(postId) as { id: string; author_id: string; status: string } | undefined;
  if (!post || post.status !== "public") return { ok: false, error: "这条内容已不可互动。" };

  const current = db
    .prepare("SELECT type FROM reactions WHERE post_id = ? AND user_id = ?")
    .get(postId, userId) as { type: ReactionType } | undefined;
  if (current?.type === type) {
    db.prepare("DELETE FROM reactions WHERE post_id = ? AND user_id = ?").run(postId, userId);
  } else {
    db.prepare(
      `INSERT INTO reactions (post_id, user_id, type, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(post_id, user_id) DO UPDATE SET type = excluded.type, updated_at = excluded.updated_at`
    ).run(postId, userId, type, new Date().toISOString());
  }

  awardContribution({
    userId,
    kind: "feedback_given",
    sourceId: `post:${postId}`,
    postId,
    points: 1,
    perDayCap: 5
  });

  if (post.author_id !== userId) {
    const nowPositive = current?.type !== type ? type === "love" || type === "smile" : false;
    if (nowPositive) {
      awardContribution({
        userId: post.author_id,
        kind: "reaction_received",
        sourceId: `${postId}:${userId}`,
        postId,
        points: 1
      });
    } else {
      deactivateContributionSource(
        post.author_id,
        "reaction_received",
        `${postId}:${userId}`
      );
    }
  }

  recomputePostVisibility(postId);
  return { ok: true };
}

export function flagPost(
  userId: string,
  postId: string,
  reasons: FeedbackReason[]
): { ok: boolean; error?: string } {
  const cleanReasons = [...new Set(reasons)].filter((reason) =>
    ["ai", "fake", "illegal", "negative"].includes(reason)
  );
  if (cleanReasons.length === 0) return { ok: false, error: "请选择反馈原因。" };
  const db = getDb();
  const post = db
    .prepare("SELECT id, status FROM posts WHERE id = ?")
    .get(postId) as { id: string; status: string } | undefined;
  if (!post || post.status !== "public") return { ok: false, error: "这条内容已不可互动。" };

  db.prepare(
    `INSERT INTO post_flags (post_id, user_id, reasons, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(post_id, user_id) DO UPDATE SET reasons = excluded.reasons`
  ).run(postId, userId, JSON.stringify(cleanReasons), new Date().toISOString());

  awardContribution({
    userId,
    kind: "feedback_given",
    sourceId: `post:${postId}`,
    postId,
    points: 1,
    perDayCap: 5
  });
  recomputePostVisibility(postId);
  return { ok: true };
}

export function createComment(
  userId: string,
  postId: string,
  body: string
): { ok: boolean; error?: string; id?: string } {
  const text = body.trim();
  if (!text) return { ok: false, error: "评论不能为空。" };
  if (text.length > 500) return { ok: false, error: "评论最多 500 字。" };
  if (/https?:\/\/|www\./i.test(text)) return { ok: false, error: "评论中不能包含外部链接。" };
  const db = getDb();
  const post = db
    .prepare("SELECT id, author_id, status FROM posts WHERE id = ?")
    .get(postId) as { id: string; author_id: string; status: string } | undefined;
  if (!post || post.status !== "public") return { ok: false, error: "这条内容已不可评论。" };

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO comments (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, postId, userId, text, new Date().toISOString());

  awardContribution({
    userId,
    kind: "comment_given",
    sourceId: id,
    postId,
    points: 1,
    perDayCap: 5
  });
  if (post.author_id !== userId) {
    awardContribution({
      userId: post.author_id,
      kind: "comment_received",
      sourceId: id,
      postId,
      points: 1
    });
  }
  return { ok: true, id };
}

export function flagComment(
  userId: string,
  commentId: string
): { ok: boolean; error?: string } {
  const db = getDb();
  const comment = db
    .prepare(
      `SELECT c.id, c.post_id, c.status, p.status AS post_status
       FROM comments c JOIN posts p ON p.id = c.post_id
       WHERE c.id = ?`
    )
    .get(commentId) as
    | { id: string; post_id: string; status: string; post_status: string }
    | undefined;
  if (!comment || comment.status !== "public" || comment.post_status !== "public") {
    return { ok: false, error: "这条评论已不可反馈。" };
  }
  db.prepare(
    "INSERT OR IGNORE INTO comment_flags (comment_id, user_id, created_at) VALUES (?, ?, ?)"
  ).run(commentId, userId, new Date().toISOString());
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM comment_flags WHERE comment_id = ?")
    .get(commentId) as { count: number };
  if (
    shouldHideComment(
      Number(count.count),
      getSettingNumber("comment_hide_flags", DEFAULT_RULES.commentHideFlags)
    )
  ) {
    db.prepare("UPDATE comments SET status = 'hidden', hidden_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      commentId
    );
  }
  return { ok: true };
}

export function getPostFeedbackSnapshot(postId: string) {
  const db = getDb();
  const reactions = db
    .prepare("SELECT user_id, type FROM reactions WHERE post_id = ?")
    .all(postId) as Array<{ user_id: string; type: ReactionType }>;
  const flags = db
    .prepare("SELECT user_id FROM post_flags WHERE post_id = ?")
    .all(postId) as Array<{ user_id: string }>;
  return calculateVisibility(
    [
      ...reactions.map((row) => ({
        userId: row.user_id,
        reaction: row.type,
        flagged: false
      })),
      ...flags.map((row) => ({
        userId: row.user_id,
        reaction: null,
        flagged: true
      }))
    ],
    getSettingNumber("min_feedback_participants", DEFAULT_RULES.minFeedbackParticipants),
    getSettingNumber("negative_hide_ratio", DEFAULT_RULES.negativeHideRatio)
  );
}

export function getCommentAuthorLevel(userId: string): number {
  return rankForPoints(getUserPoints(userId)).current.level;
}
