import { getDb, getSettingNumber, getSettingNumber as numberSetting } from "./db";
import { DEFAULT_RULES, type ReactionType } from "./constants";
import { getUserPoints } from "./contribution";
import { rankForPoints, type RankState } from "./ranks";
import { DAILY_PROMPTS, promptForDay } from "./prompts";
import { shanghaiDayKey } from "./time";
import { calculateVisibility, type FeedbackEntry } from "./feedback";

export type AuthorView = {
  id: string;
  displayName: string;
  avatarEmoji: string;
  role: "owner" | "member";
  points: number;
  rank: RankState;
};

export type MediaView = {
  id: string;
  kind: "image" | "video";
  mimeType: string;
};

export type PostView = {
  id: string;
  body: string;
  promptDay: number | null;
  status: "public" | "hidden";
  createdAt: string;
  author: AuthorView;
  media: MediaView[];
  reactionCounts: Record<ReactionType | "positive" | "participants" | "negative", number>;
  myReaction: ReactionType | null;
  commentCount: number;
};

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarEmoji: string;
    level: number;
    title: string;
  };
};

type UserRow = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  role: "owner" | "member";
};

function authorView(row: UserRow): AuthorView {
  const points = getUserPoints(row.id);
  return {
    id: row.id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    role: row.role,
    points,
    rank: rankForPoints(points)
  };
}

function feedbackEntries(postId: string): FeedbackEntry[] {
  const db = getDb();
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
  return [...entries.values()];
}

export function postFeedback(postId: string) {
  return calculateVisibility(
    feedbackEntries(postId),
    getSettingNumber("min_feedback_participants", DEFAULT_RULES.minFeedbackParticipants),
    getSettingNumber("negative_hide_ratio", DEFAULT_RULES.negativeHideRatio)
  );
}

function buildPost(
  row: {
    id: string;
    body: string;
    prompt_day: number | null;
    status: "public" | "hidden";
    created_at: string;
    author_id: string;
    display_name: string;
    avatar_emoji: string;
    role: "owner" | "member";
  },
  viewerId?: string | null
): PostView {
  const db = getDb();
  const media = db
    .prepare(
      "SELECT id, kind, mime_type FROM media_assets WHERE post_id = ? ORDER BY created_at ASC"
    )
    .all(row.id) as Array<{ id: string; kind: "image" | "video"; mime_type: string }>;
  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN type = 'love' THEN 1 ELSE 0 END) AS love,
         SUM(CASE WHEN type = 'smile' THEN 1 ELSE 0 END) AS smile,
         SUM(CASE WHEN type = 'calm' THEN 1 ELSE 0 END) AS calm,
         SUM(CASE WHEN type = 'cry' THEN 1 ELSE 0 END) AS cry
       FROM reactions WHERE post_id = ?`
    )
    .get(row.id) as { love: number; smile: number; calm: number; cry: number };
  const commentCount = db
    .prepare(
      "SELECT COUNT(*) AS count FROM comments WHERE post_id = ? AND status = 'public'"
    )
    .get(row.id) as { count: number };
  const snapshot = postFeedback(row.id);
  const myReaction = viewerId
    ? ((db
        .prepare("SELECT type FROM reactions WHERE post_id = ? AND user_id = ?")
        .get(row.id, viewerId) as { type: ReactionType } | undefined)?.type ?? null)
    : null;

  return {
    id: row.id,
    body: row.body,
    promptDay: row.prompt_day,
    status: row.status,
    createdAt: row.created_at,
    author: authorView({
      id: row.author_id,
      display_name: row.display_name,
      avatar_emoji: row.avatar_emoji,
      role: row.role
    }),
    media: media.map((item) => ({
      id: item.id,
      kind: item.kind,
      mimeType: item.mime_type
    })),
    reactionCounts: {
      love: Number(counts.love ?? 0),
      smile: Number(counts.smile ?? 0),
      calm: Number(counts.calm ?? 0),
      cry: Number(counts.cry ?? 0),
      positive: Number(counts.love ?? 0) + Number(counts.smile ?? 0),
      participants: snapshot.participants,
      negative: snapshot.negative
    },
    myReaction,
    commentCount: Number(commentCount.count)
  };
}

export function getFeed(viewerId?: string | null, limit = DEFAULT_RULES.feedPageSize): PostView[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.body, p.prompt_day, p.status, p.created_at, p.author_id,
              u.display_name, u.avatar_emoji, u.role
       FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.status = 'public'
       ORDER BY p.created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    body: string;
    prompt_day: number | null;
    status: "public" | "hidden";
    created_at: string;
    author_id: string;
    display_name: string;
    avatar_emoji: string;
    role: "owner" | "member";
  }>;
  return rows.map((row) => buildPost(row, viewerId));
}

export function getPost(
  postId: string,
  viewerId?: string | null
): PostView | null {
  const row = getDb()
    .prepare(
      `SELECT p.id, p.body, p.prompt_day, p.status, p.created_at, p.author_id,
              u.display_name, u.avatar_emoji, u.role
       FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.id = ?
         AND (p.status = 'public' OR (p.author_id = ? AND p.status = 'hidden'))`
    )
    .get(postId, viewerId ?? "") as
    | {
        id: string;
        body: string;
        prompt_day: number | null;
        status: "public" | "hidden";
        created_at: string;
        author_id: string;
        display_name: string;
        avatar_emoji: string;
        role: "owner" | "member";
      }
    | undefined;
  return row ? buildPost(row, viewerId) : null;
}

export function getFeaturedToday(viewerId?: string | null): PostView | null {
  const row = getDb()
    .prepare(
      `SELECT p.id
       FROM posts p
       JOIN reactions r ON r.post_id = p.id AND r.type IN ('love', 'smile')
       WHERE p.status = 'public'
         AND date(p.created_at, '+8 hours') = date('now', '+8 hours')
       GROUP BY p.id
       ORDER BY COUNT(r.user_id) DESC, p.created_at ASC
       LIMIT 1`
    )
    .get() as { id: string } | undefined;
  return row ? getPost(row.id, viewerId) : null;
}

export function getCurrentPrompt(): { day: number; theme: string; question: string } {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'launch_date'")
    .get() as { value: string } | undefined;
  const launch = row?.value ?? shanghaiDayKey();
  const launchDate = new Date(`${launch}T00:00:00+08:00`);
  const diff = Math.max(0, Math.floor((Date.now() - launchDate.getTime()) / 86_400_000));
  return promptForDay(diff + 1);
}

export function getPromptByDay(day: number | null) {
  if (!day) return null;
  return promptForDay(day);
}

export function getComments(postId: string): CommentView[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.body, c.created_at, u.id AS author_id,
              u.display_name, u.avatar_emoji
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = ? AND c.status = 'public'
       ORDER BY c.created_at ASC`
    )
    .all(postId) as Array<{
    id: string;
    body: string;
    created_at: string;
    author_id: string;
    display_name: string;
    avatar_emoji: string;
  }>;
  return rows.map((row) => {
    const rank = rankForPoints(getUserPoints(row.author_id));
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        displayName: row.display_name,
        avatarEmoji: row.avatar_emoji,
        level: rank.current.level,
        title: rank.current.title
      }
    };
  });
}

export function getUserProfile(userId: string, viewerId?: string | null) {
  const row = getDb()
    .prepare(
      `SELECT id, display_name, avatar_emoji, role, created_at, email_verified
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
        id: string;
        display_name: string;
        avatar_emoji: string;
        role: "owner" | "member";
        created_at: string;
        email_verified: number;
      }
    | undefined;
  if (!row || !row.email_verified) return null;
  const posts = getDb()
    .prepare(
      `SELECT p.id, p.body, p.prompt_day, p.status, p.created_at, p.author_id,
              u.display_name, u.avatar_emoji, u.role
       FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.author_id = ?
         AND (p.status = 'public' OR (p.author_id = ? AND p.status = 'hidden'))
       ORDER BY p.created_at DESC`
    )
    .all(userId, viewerId ?? "") as Array<{
    id: string;
    body: string;
    prompt_day: number | null;
    status: "public" | "hidden";
    created_at: string;
    author_id: string;
    display_name: string;
    avatar_emoji: string;
    role: "owner" | "member";
  }>;
  const author = authorView({
    id: row.id,
    display_name: row.display_name,
    avatar_emoji: row.avatar_emoji,
    role: row.role
  });
  return {
    user: author,
    createdAt: row.created_at,
    posts: posts.map((post) => buildPost(post, viewerId))
  };
}

export function getAdminStats() {
  const db = getDb();
  const userCount = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE email_verified = 1")
    .get() as { count: number };
  const postCount = db
    .prepare("SELECT COUNT(*) AS count FROM posts WHERE status = 'public'")
    .get() as { count: number };
  const hiddenCount = db
    .prepare("SELECT COUNT(*) AS count FROM posts WHERE status = 'hidden'")
    .get() as { count: number };
  return {
    users: Number(userCount.count),
    posts: Number(postCount.count),
    hidden: Number(hiddenCount.count)
  };
}
