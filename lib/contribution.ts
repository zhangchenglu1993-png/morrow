import { getDb, getSettingNumber } from "./db";
import { DEFAULT_RULES } from "./constants";
import { randomToken } from "./security";
import { rankForPoints, type RankState } from "./ranks";

type AwardInput = {
  userId: string;
  kind: string;
  sourceId: string;
  points: number;
  postId?: string | null;
  perDayCap?: number;
};

export function awardContribution(input: AwardInput): void {
  if (input.points <= 0) return;
  const db = getDb();
  const dailyCap = getSettingNumber(
    "daily_contribution_cap",
    DEFAULT_RULES.dailyContributionCap
  );
  const spentRow = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS total
       FROM contribution_events
       WHERE user_id = ? AND active = 1
         AND date(created_at, '+8 hours') = date('now', '+8 hours')`
    )
    .get(input.userId) as { total: number };
  const remaining = Math.max(0, dailyCap - Number(spentRow.total));
  if (remaining === 0) return;

  if (input.perDayCap) {
    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM contribution_events
         WHERE user_id = ? AND kind = ? AND active = 1
           AND date(created_at, '+8 hours') = date('now', '+8 hours')`
      )
      .get(input.userId, input.kind) as { count: number };
    if (Number(countRow.count) >= input.perDayCap) return;
  }

  const points = Math.min(input.points, remaining);
  db.prepare(
    `INSERT OR IGNORE INTO contribution_events
      (id, user_id, kind, source_id, post_id, points, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    randomToken(12),
    input.userId,
    input.kind,
    input.sourceId,
    input.postId ?? null,
    points,
    new Date().toISOString()
  );
}

export function deactivatePostContribution(postId: string): void {
  getDb()
    .prepare("UPDATE contribution_events SET active = 0 WHERE post_id = ?")
    .run(postId);
}

export function deactivateContributionSource(
  userId: string,
  kind: string,
  sourceId: string
): void {
  getDb()
    .prepare(
      "UPDATE contribution_events SET active = 0 WHERE user_id = ? AND kind = ? AND source_id = ?"
    )
    .run(userId, kind, sourceId);
}

export function getUserPoints(userId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COALESCE(SUM(points), 0) AS total FROM contribution_events WHERE user_id = ? AND active = 1"
    )
    .get(userId) as { total: number };
  return Number(row.total);
}

export function getUserRank(userId: string): { points: number; rank: RankState } {
  const points = getUserPoints(userId);
  return { points, rank: rankForPoints(points) };
}

export type LeaderboardEntry = {
  id: string;
  displayName: string;
  avatarEmoji: string;
  points: number;
  level: number;
  title: string;
  progress: number;
  nextTitle: string | null;
  pointsToNext: number;
};

export function getLeaderboard(limit = 100): LeaderboardEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.display_name, u.avatar_emoji,
              COALESCE(SUM(CASE WHEN c.active = 1 THEN c.points ELSE 0 END), 0) AS points
       FROM users u
       LEFT JOIN contribution_events c ON c.user_id = u.id
       WHERE u.email_verified = 1
       GROUP BY u.id
       ORDER BY points DESC, u.created_at ASC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    display_name: string;
    avatar_emoji: string;
    points: number;
  }>;

  return rows.map((row) => {
    const rank = rankForPoints(Number(row.points));
    return {
      id: row.id,
      displayName: row.display_name,
      avatarEmoji: row.avatar_emoji,
      points: Number(row.points),
      level: rank.current.level,
      title: rank.current.title,
      progress: rank.progress,
      nextTitle: rank.next?.title ?? null,
      pointsToNext: rank.pointsToNext
    };
  });
}
