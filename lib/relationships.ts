import { getDb } from "./db";

// 熟人是固定、可解释的三种关系，不做推荐评分，也不做排序加权：
// 1. 一起参加过同一件小事；2. 邀请关系；3. 互相评论过。
const FAMILIAR_CTE = `
WITH fam AS (
  SELECT u.id, u.display_name, u.avatar_emoji
  FROM users u
  WHERE u.id <> ?
    AND (
      EXISTS (
        SELECT 1
        FROM gathering_attendees mine
        JOIN gathering_attendees theirs ON theirs.gathering_id = mine.gathering_id
        WHERE mine.user_id = ? AND theirs.user_id = u.id
      )
      OR EXISTS (
        SELECT 1 FROM invitations i
        WHERE (i.used_by = ? AND i.created_by = u.id)
           OR (i.created_by = ? AND i.used_by = u.id)
      )
      OR (
        EXISTS (
          SELECT 1 FROM comments c
          JOIN posts p ON p.id = c.post_id
          WHERE c.author_id = ? AND p.author_id = u.id AND c.status = 'public'
        )
        AND EXISTS (
          SELECT 1 FROM comments c2
          JOIN posts p2 ON p2.id = c2.post_id
          WHERE c2.author_id = u.id AND p2.author_id = ? AND c2.status = 'public'
        )
      )
    )
)`;

export type FamiliarPerson = {
  id: string;
  displayName: string;
  avatarEmoji: string;
  latestPost: { id: string; body: string; createdAt: string } | null;
  hasNew: boolean;
};

export type InboxItem = {
  commentId: string;
  postId: string;
  body: string;
  createdAt: string;
  isUnread: boolean;
  reason: "post" | "thread";
  author: { id: string; displayName: string; avatarEmoji: string };
  postExcerpt: string;
};

export type ParticipationItem = {
  postId: string;
  excerpt: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarEmoji: string };
  newCommentCount: number;
  lastCommentAt: string | null;
};

function excerpt(value: string, length = 90): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function seenTimestamp(viewerId: string, column: "inbox_seen_at" | "people_seen_at"): string {
  const row = getDb()
    .prepare(
      `SELECT s.${column} AS seen, u.created_at AS created
       FROM users u
       LEFT JOIN user_seen s ON s.user_id = u.id
       WHERE u.id = ?`
    )
    .get(viewerId) as { seen: string | null; created: string } | undefined;
  return row?.seen ?? row?.created ?? new Date(0).toISOString();
}

export function getFamiliarAuthorIds(viewerId: string): string[] {
  const rows = getDb()
    .prepare(`${FAMILIAR_CTE} SELECT id FROM fam ORDER BY display_name ASC`)
    .all(viewerId, viewerId, viewerId, viewerId, viewerId, viewerId) as Array<{
    id: string;
  }>;
  return rows.map((row) => row.id);
}

export function getFamiliarPeople(viewerId: string): FamiliarPerson[] {
  const seenAt = seenTimestamp(viewerId, "people_seen_at");
  const rows = getDb()
    .prepare(
      `${FAMILIAR_CTE}
       SELECT fam.id, fam.display_name, fam.avatar_emoji,
              p.id AS post_id, p.body AS post_body, p.created_at AS post_created_at
       FROM fam
       LEFT JOIN posts p ON p.id = (
         SELECT id FROM posts
         WHERE author_id = fam.id AND status = 'public'
         ORDER BY created_at DESC
         LIMIT 1
       )
       ORDER BY (p.created_at IS NULL) ASC, p.created_at DESC, fam.display_name ASC`
    )
    .all(viewerId, viewerId, viewerId, viewerId, viewerId, viewerId) as Array<{
    id: string;
    display_name: string;
    avatar_emoji: string;
    post_id: string | null;
    post_body: string | null;
    post_created_at: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    latestPost:
      row.post_id && row.post_created_at
        ? {
            id: row.post_id,
            body: excerpt(row.post_body ?? "", 60),
            createdAt: row.post_created_at
          }
        : null,
    hasNew: Boolean(row.post_created_at && row.post_created_at > seenAt)
  }));
}

export function getInbox(viewerId: string): {
  items: InboxItem[];
  unreadCount: number;
} {
  const db = getDb();
  const seenAt = seenTimestamp(viewerId, "inbox_seen_at");
  const rows = db
    .prepare(
      `SELECT c.id AS comment_id, c.post_id, c.body, c.created_at,
              u.id AS author_id, u.display_name, u.avatar_emoji,
              p.body AS post_body, p.author_id AS post_author_id
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       JOIN users u ON u.id = c.author_id
       WHERE c.status = 'public' AND p.status = 'public'
         AND c.author_id <> ?
         AND (
           p.author_id = ?
           OR EXISTS (
             SELECT 1 FROM comments mine
             WHERE mine.post_id = c.post_id
               AND mine.author_id = ?
               AND mine.status = 'public'
           )
         )
       ORDER BY c.created_at DESC
       LIMIT 50`
    )
    .all(viewerId, viewerId, viewerId) as Array<{
    comment_id: string;
    post_id: string;
    body: string;
    created_at: string;
    author_id: string;
    display_name: string;
    avatar_emoji: string;
    post_body: string;
    post_author_id: string;
  }>;

  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       WHERE c.status = 'public' AND p.status = 'public'
         AND c.author_id <> ?
         AND c.created_at > ?
         AND (
           p.author_id = ?
           OR EXISTS (
             SELECT 1 FROM comments mine
             WHERE mine.post_id = c.post_id
               AND mine.author_id = ?
               AND mine.status = 'public'
           )
         )`
    )
    .get(viewerId, seenAt, viewerId, viewerId) as { count: number };

  return {
    unreadCount: Number(countRow.count),
    items: rows.map((row) => ({
      commentId: row.comment_id,
      postId: row.post_id,
      body: excerpt(row.body, 140),
      createdAt: row.created_at,
      isUnread: row.created_at > seenAt,
      reason: row.post_author_id === viewerId ? "post" : "thread",
      author: {
        id: row.author_id,
        displayName: row.display_name,
        avatarEmoji: row.avatar_emoji
      },
      postExcerpt: excerpt(row.post_body, 70)
    }))
  };
}

export function getInboxUnreadCount(viewerId: string): number {
  const seenAt = seenTimestamp(viewerId, "inbox_seen_at");
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       WHERE c.status = 'public' AND p.status = 'public'
         AND c.author_id <> ?
         AND c.created_at > ?
         AND (
           p.author_id = ?
           OR EXISTS (
             SELECT 1 FROM comments mine
             WHERE mine.post_id = c.post_id
               AND mine.author_id = ?
               AND mine.status = 'public'
           )
         )`
    )
    .get(viewerId, seenAt, viewerId, viewerId) as { count: number };
  return Number(row.count);
}

export function getParticipation(viewerId: string): ParticipationItem[] {
  const db = getDb();
  const userRow = db
    .prepare("SELECT created_at FROM users WHERE id = ?")
    .get(viewerId) as { created_at: string } | undefined;
  const fallback = userRow?.created_at ?? new Date(0).toISOString();
  const rows = db
    .prepare(
      `SELECT p.id AS post_id, p.body, p.created_at,
              u.id AS author_id, u.display_name, u.avatar_emoji,
              (
                SELECT COUNT(*) FROM comments c
                WHERE c.post_id = p.id AND c.status = 'public'
                  AND c.author_id <> ?
                  AND c.created_at > COALESCE(v.seen_at, ?)
              ) AS new_count,
              (
                SELECT MAX(c.created_at) FROM comments c
                WHERE c.post_id = p.id AND c.status = 'public'
              ) AS last_comment_at
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_visits v ON v.post_id = p.id AND v.user_id = ?
       WHERE p.status = 'public' AND p.author_id <> ?
         AND EXISTS (
           SELECT 1 FROM comments mine
           WHERE mine.post_id = p.id
             AND mine.author_id = ?
             AND mine.status = 'public'
         )
       ORDER BY last_comment_at DESC
       LIMIT 20`
    )
    .all(viewerId, fallback, viewerId, viewerId, viewerId) as Array<{
    post_id: string;
    body: string;
    created_at: string;
    author_id: string;
    display_name: string;
    avatar_emoji: string;
    new_count: number;
    last_comment_at: string | null;
  }>;
  return rows.map((row) => ({
    postId: row.post_id,
    excerpt: excerpt(row.body, 80),
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      displayName: row.display_name,
      avatarEmoji: row.avatar_emoji
    },
    newCommentCount: Number(row.new_count),
    lastCommentAt: row.last_comment_at
  }));
}

export function markInboxSeen(
  viewerId: string,
  at = new Date().toISOString()
): void {
  getDb()
    .prepare(
      `INSERT INTO user_seen (user_id, inbox_seen_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET inbox_seen_at = excluded.inbox_seen_at`
    )
    .run(viewerId, at);
}

export function markPeopleSeen(
  viewerId: string,
  at = new Date().toISOString()
): void {
  getDb()
    .prepare(
      `INSERT INTO user_seen (user_id, people_seen_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET people_seen_at = excluded.people_seen_at`
    )
    .run(viewerId, at);
}

export function markPostSeen(
  viewerId: string,
  postId: string,
  at = new Date().toISOString()
): void {
  getDb()
    .prepare(
      `INSERT INTO post_visits (user_id, post_id, seen_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, post_id) DO UPDATE SET seen_at = excluded.seen_at`
    )
    .run(viewerId, postId, at);
}
