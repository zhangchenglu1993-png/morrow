import { randomUUID } from "node:crypto";
import { awardContribution } from "./contribution";
import { getDb, withTransaction } from "./db";

export const GATHERING_POINTS = {
  host: 10,
  attendee: 5
} as const;

export type GatheringPerson = {
  id: string;
  displayName: string;
  avatarEmoji: string;
};

export type GatheringView = {
  id: string;
  title: string;
  note: string;
  place: string;
  startsAt: string;
  capacity: number | null;
  createdAt: string;
  author: GatheringPerson;
  attendees: GatheringPerson[];
  isAttending: boolean;
  memory: { postId: string; body: string; createdAt: string } | null;
};

export type GatheringInput = {
  title: string;
  note: string;
  place: string;
  startsAt: string;
  capacity: number | null;
};

type GatheringRow = {
  id: string;
  title: string;
  note: string;
  place: string;
  starts_at: string;
  capacity: number | null;
  memory_post_id: string | null;
  created_at: string;
  author_id: string;
  display_name: string;
  avatar_emoji: string;
};

const GATHERING_SELECT = `
  SELECT g.id, g.title, g.note, g.place, g.starts_at, g.capacity,
         g.memory_post_id, g.created_at,
         u.id AS author_id, u.display_name, u.avatar_emoji
  FROM gatherings g
  JOIN users u ON u.id = g.author_id
  WHERE g.status = 'open'
`;

function attendeesFor(
  gatheringIds: string[]
): Map<string, GatheringPerson[]> {
  const result = new Map<string, GatheringPerson[]>();
  if (gatheringIds.length === 0) return result;
  const placeholders = gatheringIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT a.gathering_id, u.id, u.display_name, u.avatar_emoji
       FROM gathering_attendees a
       JOIN users u ON u.id = a.user_id
       WHERE a.gathering_id IN (${placeholders})
       ORDER BY a.created_at ASC`
    )
    .all(...gatheringIds) as Array<{
    gathering_id: string;
    id: string;
    display_name: string;
    avatar_emoji: string;
  }>;
  for (const row of rows) {
    const list = result.get(row.gathering_id) ?? [];
    list.push({
      id: row.id,
      displayName: row.display_name,
      avatarEmoji: row.avatar_emoji
    });
    result.set(row.gathering_id, list);
  }
  return result;
}

function memoryFor(postId: string | null) {
  if (!postId) return null;
  const row = getDb()
    .prepare("SELECT id, body, created_at, status FROM posts WHERE id = ?")
    .get(postId) as
    | { id: string; body: string; created_at: string; status: string }
    | undefined;
  if (!row || row.status === "deleted") return null;
  return { postId: row.id, body: row.body, createdAt: row.created_at };
}

function toView(
  row: GatheringRow,
  attendees: GatheringPerson[],
  viewerId: string | null
): GatheringView {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    place: row.place,
    startsAt: row.starts_at,
    capacity: row.capacity === null ? null : Number(row.capacity),
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      displayName: row.display_name,
      avatarEmoji: row.avatar_emoji
    },
    attendees,
    isAttending: viewerId ? attendees.some((person) => person.id === viewerId) : false,
    memory: memoryFor(row.memory_post_id)
  };
}

function viewsFor(rows: GatheringRow[], viewerId: string | null): GatheringView[] {
  const attendees = attendeesFor(rows.map((row) => row.id));
  return rows.map((row) =>
    toView(row, attendees.get(row.id) ?? [], viewerId)
  );
}

export function createGathering(
  userId: string,
  input: GatheringInput
): { ok: true; id: string } | { ok: false; error: string } {
  const title = input.title.trim();
  const note = input.note.trim();
  const place = input.place.trim();

  if (title.length < 1 || title.length > 40) {
    return { ok: false, error: "请用 1–40 个字说明想一起做什么。" };
  }
  if (note.length > 300) return { ok: false, error: "补充说明最多 300 字。" };
  if (place.length > 40) return { ok: false, error: "地点最多 40 个字。" };

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "请选择一个小事发生的时间。" };
  }
  const now = Date.now();
  if (startsAt.getTime() < now + 5 * 60_000) {
    return { ok: false, error: "时间需要至少安排在今天之后 5 分钟。" };
  }
  if (startsAt.getTime() > now + 90 * 86_400_000) {
    return { ok: false, error: "先约定 90 天以内的相聚吧。" };
  }

  let capacity: number | null = null;
  if (input.capacity !== null && input.capacity !== undefined) {
    capacity = Number(input.capacity);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 12) {
      return { ok: false, error: "人数上限需要在 2–12 人之间。" };
    }
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  withTransaction((db) => {
    db.prepare(
      `INSERT INTO gatherings
        (id, author_id, title, note, place, starts_at, capacity, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      id,
      userId,
      title,
      note,
      place,
      startsAt.toISOString(),
      capacity,
      createdAt
    );
    db.prepare(
      `INSERT INTO gathering_attendees (gathering_id, user_id, created_at)
       VALUES (?, ?, ?)`
    ).run(id, userId, createdAt);
  });

  return { ok: true, id };
}

export function joinGathering(
  userId: string,
  gatheringId: string
): { ok: true } | { ok: false; error: string } {
  return withTransaction((db) => {
    const row = db
      .prepare(
        `SELECT starts_at, capacity, memory_post_id
         FROM gatherings WHERE id = ? AND status = 'open'`
      )
      .get(gatheringId) as
      | { starts_at: string; capacity: number | null; memory_post_id: string | null }
      | undefined;
    if (!row) return { ok: false, error: "这件小事不存在或已经取消。" } as const;
    if (row.memory_post_id) {
      return { ok: false, error: "这次相聚已经留下了记录，不能再报名。" } as const;
    }
    if (new Date(row.starts_at).getTime() <= Date.now()) {
      return { ok: false, error: "这件小事已经开始，报名已经结束。" } as const;
    }

    const existing = db
      .prepare(
        "SELECT 1 FROM gathering_attendees WHERE gathering_id = ? AND user_id = ?"
      )
      .get(gatheringId, userId);
    if (existing) return { ok: true } as const;

    if (row.capacity !== null) {
      const countRow = db
        .prepare(
          "SELECT COUNT(*) AS count FROM gathering_attendees WHERE gathering_id = ?"
        )
        .get(gatheringId) as { count: number };
      if (Number(countRow.count) >= Number(row.capacity)) {
        return { ok: false, error: "这次相聚的人数已经满了。" } as const;
      }
    }

    db.prepare(
      `INSERT INTO gathering_attendees (gathering_id, user_id, created_at)
       VALUES (?, ?, ?)`
    ).run(gatheringId, userId, new Date().toISOString());
    return { ok: true } as const;
  });
}

export function leaveGathering(
  userId: string,
  gatheringId: string
): { ok: true } | { ok: false; error: string } {
  const row = getDb()
    .prepare(
      "SELECT author_id, starts_at FROM gatherings WHERE id = ? AND status = 'open'"
    )
    .get(gatheringId) as
    | { author_id: string; starts_at: string }
    | undefined;
  if (!row) return { ok: false, error: "这件小事不存在或已经取消。" };
  if (row.author_id === userId) {
    return { ok: false, error: "发起人不能退出自己发起的小事，可以直接取消。" };
  }
  if (new Date(row.starts_at).getTime() <= Date.now()) {
    return { ok: false, error: "这件小事已经开始，不能取消报名。" };
  }
  getDb()
    .prepare(
      "DELETE FROM gathering_attendees WHERE gathering_id = ? AND user_id = ?"
    )
    .run(gatheringId, userId);
  return { ok: true };
}

export function cancelGathering(
  userId: string,
  gatheringId: string
): { ok: true } | { ok: false; error: string } {
  const row = getDb()
    .prepare("SELECT author_id, memory_post_id FROM gatherings WHERE id = ?")
    .get(gatheringId) as
    | { author_id: string; memory_post_id: string | null }
    | undefined;
  if (!row) return { ok: false, error: "这件小事不存在。" };
  if (row.author_id !== userId) {
    return { ok: false, error: "只有发起人可以取消这次邀约。" };
  }
  if (row.memory_post_id) {
    return { ok: false, error: "这次相聚已经留下了记录，不需要再取消。" };
  }
  getDb()
    .prepare("UPDATE gatherings SET status = 'cancelled' WHERE id = ?")
    .run(gatheringId);
  return { ok: true };
}

export function recordGatheringMemory(
  userId: string,
  gatheringId: string,
  body: string
): { ok: true; postId: string } | { ok: false; error: string } {
  const text = body.trim();
  if (text.length < 1) return { ok: false, error: "写下一句话，再留下这次相聚。" };
  if (text.length > 1000) return { ok: false, error: "共同记忆最多 1,000 字。" };

  const row = getDb()
    .prepare(
      `SELECT author_id, starts_at, memory_post_id, status
       FROM gatherings WHERE id = ?`
    )
    .get(gatheringId) as
    | {
        author_id: string;
        starts_at: string;
        memory_post_id: string | null;
        status: string;
      }
    | undefined;
  if (!row || row.status !== "open") {
    return { ok: false, error: "这件小事不存在或已经取消。" };
  }
  if (row.memory_post_id) {
    return { ok: false, error: "这次相聚已经留下记录了。" };
  }
  const participant = getDb()
    .prepare(
      "SELECT 1 FROM gathering_attendees WHERE gathering_id = ? AND user_id = ?"
    )
    .get(gatheringId, userId);
  if (!participant) {
    return { ok: false, error: "只有参与这次相聚的人可以留下共同记忆。" };
  }
  if (new Date(row.starts_at).getTime() > Date.now()) {
    return { ok: false, error: "等这件小事发生之后，再来留下记录吧。" };
  }

  const postId = randomUUID();
  const now = new Date().toISOString();
  withTransaction((db) => {
    db.prepare(
      `INSERT INTO posts (id, author_id, body, prompt_day, status, created_at)
       VALUES (?, ?, ?, NULL, 'public', ?)`
    ).run(postId, userId, text, now);
    db.prepare(
      "UPDATE gatherings SET memory_post_id = ? WHERE id = ?"
    ).run(postId, gatheringId);
  });

  const attendeeRows = getDb()
    .prepare(
      "SELECT user_id FROM gathering_attendees WHERE gathering_id = ?"
    )
    .all(gatheringId) as Array<{ user_id: string }>;

  awardContribution({
    userId: row.author_id,
    kind: "gather_host",
    sourceId: gatheringId,
    postId,
    points: GATHERING_POINTS.host
  });
  for (const attendee of attendeeRows) {
    if (attendee.user_id === row.author_id) continue;
    awardContribution({
      userId: attendee.user_id,
      kind: "gather_attend",
      sourceId: gatheringId,
      postId,
      points: GATHERING_POINTS.attendee
    });
  }

  return { ok: true, postId };
}

export function listGatherings(viewerId: string | null): {
  upcoming: GatheringView[];
  past: GatheringView[];
} {
  const now = new Date().toISOString();
  const upcomingRows = getDb()
    .prepare(`${GATHERING_SELECT} AND g.starts_at >= ? ORDER BY g.starts_at ASC LIMIT 30`)
    .all(now) as GatheringRow[];
  const pastRows = getDb()
    .prepare(`${GATHERING_SELECT} AND g.starts_at < ? ORDER BY g.starts_at DESC LIMIT 12`)
    .all(now) as GatheringRow[];
  return {
    upcoming: viewsFor(upcomingRows, viewerId),
    past: viewsFor(pastRows, viewerId)
  };
}

export function getNextGathering(viewerId: string | null): GatheringView | null {
  const row = getDb()
    .prepare(
      `${GATHERING_SELECT} AND g.starts_at >= ? ORDER BY g.starts_at ASC LIMIT 1`
    )
    .get(new Date().toISOString()) as GatheringRow | undefined;
  if (!row) return null;
  return viewsFor([row], viewerId)[0];
}

export function getGatheringPassport(userId: string): {
  count: number;
  recent: Array<{ id: string; title: string; startsAt: string }>;
} {
  const countRow = getDb()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM gathering_attendees a
       JOIN gatherings g ON g.id = a.gathering_id
       WHERE a.user_id = ? AND g.memory_post_id IS NOT NULL AND g.status = 'open'`
    )
    .get(userId) as { count: number };
  const rows = getDb()
    .prepare(
      `SELECT g.id, g.title, g.starts_at
       FROM gathering_attendees a
       JOIN gatherings g ON g.id = a.gathering_id
       WHERE a.user_id = ? AND g.memory_post_id IS NOT NULL AND g.status = 'open'
       ORDER BY g.starts_at DESC
       LIMIT 6`
    )
    .all(userId) as Array<{ id: string; title: string; starts_at: string }>;
  return {
    count: Number(countRow.count),
    recent: rows.map((row) => ({
      id: row.id,
      title: row.title,
      startsAt: row.starts_at
    }))
  };
}
