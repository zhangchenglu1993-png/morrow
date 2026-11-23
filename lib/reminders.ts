import { getDb } from "./db";
import { sendEmail } from "./mail";
import { formatDateTime } from "./time";

export type ReminderKind = "day" | "hour";

export type DueReminder = {
  gatheringId: string;
  userId: string;
  email: string;
  displayName: string;
  title: string;
  place: string;
  startsAt: string;
  kind: ReminderKind;
};

const WINDOWS: Array<{ kind: ReminderKind; fromMs: number; toMs: number }> = [
  { kind: "day", fromMs: 20 * 3_600_000, toMs: 26 * 3_600_000 },
  { kind: "hour", fromMs: 45 * 60_000, toMs: 2 * 3_600_000 }
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[character] ?? character;
  });
}

export function findDueReminders(now = new Date()): DueReminder[] {
  const db = getDb();
  const results: DueReminder[] = [];

  for (const window of WINDOWS) {
    const from = new Date(now.getTime() + window.fromMs).toISOString();
    const to = new Date(now.getTime() + window.toMs).toISOString();
    const rows = db
      .prepare(
        `SELECT g.id AS gathering_id, g.title, g.place, g.starts_at,
                u.id AS user_id, u.email, u.display_name
         FROM gatherings g
         JOIN gathering_attendees a ON a.gathering_id = g.id
         JOIN users u ON u.id = a.user_id
         WHERE g.status = 'open'
           AND g.memory_post_id IS NULL
           AND g.starts_at >= ?
           AND g.starts_at <= ?
           AND NOT EXISTS (
             SELECT 1 FROM gathering_reminders r
             WHERE r.gathering_id = g.id AND r.user_id = u.id AND r.kind = ?
           )
         ORDER BY g.starts_at ASC`
      )
      .all(from, to, window.kind) as Array<{
      gathering_id: string;
      title: string;
      place: string;
      starts_at: string;
      user_id: string;
      email: string;
      display_name: string;
    }>;

    for (const row of rows) {
      results.push({
        gatheringId: row.gathering_id,
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        title: row.title,
        place: row.place,
        startsAt: row.starts_at,
        kind: window.kind
      });
    }
  }

  return results;
}

export function markReminderSent(
  gatheringId: string,
  userId: string,
  kind: ReminderKind
): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO gathering_reminders
        (gathering_id, user_id, kind, sent_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(gatheringId, userId, kind, new Date().toISOString());
}

export async function sendGatheringReminders(
  now = new Date()
): Promise<{ sent: number; failed: number }> {
  const due = findDueReminders(now);
  const appUrl = (process.env.MORROW_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    const when = formatDateTime(reminder.startsAt);
    const subject =
      reminder.kind === "day"
        ? `还有一天：${reminder.title}`
        : `就快开始了：${reminder.title}`;
    const html = `<p>${escapeHtml(reminder.displayName)}，提醒你一下：</p>
<p><strong>${escapeHtml(reminder.title)}</strong><br>${escapeHtml(when)}${
      reminder.place ? ` · ${escapeHtml(reminder.place)}` : ""
    }</p>
<p><a href="${appUrl}/together">打开 Morrow 看看</a></p>`;
    const ok = await sendEmail({ to: reminder.email, subject, html });
    if (ok) {
      markReminderSent(reminder.gatheringId, reminder.userId, reminder.kind);
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { sent, failed };
}
