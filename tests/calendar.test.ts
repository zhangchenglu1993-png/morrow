import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

test("calendar todos and reminders follow joined gatherings", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "morrow-calendar-"));
  process.env.MORROW_DB_PATH = path.join(tempDir, "morrow.db");
  try {
    const { getDb } = await import("../lib/db.js");
    const {
      listGatheringsBetween,
      listMyPendingMemories,
      listMyUpcomingGatherings
    } = await import("../lib/gatherings.js");
    const { findDueReminders, markReminderSent } = await import("../lib/reminders.js");

    const db = getDb();
    const now = new Date();
    const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
    const insertUser = db.prepare(
      `INSERT INTO users
        (id, email, password_hash, password_salt, display_name, avatar_emoji,
         role, email_verified, accepted_covenant, created_at)
       VALUES (?, ?, 'hash', 'salt', ?, '🌱', 'member', 1, 1, ?)`
    );
    const host = randomUUID();
    const guest = randomUUID();
    const outsider = randomUUID();
    insertUser.run(host, "host@example.com", "发起人", now.toISOString());
    insertUser.run(guest, "guest@example.com", "同行者", now.toISOString());
    insertUser.run(outsider, "outsider@example.com", "旁观者", now.toISOString());

    const insertGathering = db.prepare(
      `INSERT INTO gatherings
        (id, author_id, title, note, place, starts_at, capacity, status, created_at)
       VALUES (?, ?, ?, '', ?, ?, NULL, 'open', ?)`
    );
    const attend = db.prepare(
      "INSERT INTO gathering_attendees (gathering_id, user_id, created_at) VALUES (?, ?, ?)"
    );

    const g1 = randomUUID();
    insertGathering.run(g1, host, "一起散步", "江边", at(3 * 86_400_000), now.toISOString());
    attend.run(g1, host, now.toISOString());
    attend.run(g1, guest, now.toISOString());

    const g2 = randomUUID();
    insertGathering.run(g2, host, "一起喝咖啡", "街角", at(5 * 86_400_000), now.toISOString());
    attend.run(g2, host, now.toISOString());

    let upcoming = listMyUpcomingGatherings(guest);
    assert.equal(upcoming.length, 1);
    assert.equal(upcoming[0].id, g1);
    assert.equal(listMyUpcomingGatherings(outsider).length, 0);

    const month = listGatheringsBetween(at(0), at(6 * 86_400_000), guest);
    assert.equal(month.length, 2);

    db.prepare("UPDATE gatherings SET starts_at = ? WHERE id = ?").run(
      at(-3_600_000),
      g1
    );
    const pending = listMyPendingMemories(guest);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, g1);
    assert.equal(listMyPendingMemories(outsider).length, 0);

    const g3 = randomUUID();
    insertGathering.run(g3, host, "明天的小事", "公园", at(24 * 3_600_000), now.toISOString());
    attend.run(g3, guest, now.toISOString());
    attend.run(g3, outsider, now.toISOString());

    const due = findDueReminders(now).filter((item) => item.gatheringId === g3);
    assert.equal(due.length, 2);
    assert.equal(due[0].kind, "day");
    assert.equal(due[0].email, "guest@example.com");

    markReminderSent(g3, guest, "day");
    const afterMark = findDueReminders(now).filter(
      (item) => item.gatheringId === g3 && item.userId === guest
    );
    assert.equal(afterMark.length, 0);

    const g4 = randomUUID();
    insertGathering.run(g4, host, "一小时后的小事", "楼下", at(3_600_000), now.toISOString());
    attend.run(g4, guest, now.toISOString());
    const hourDue = findDueReminders(now).filter((item) => item.gatheringId === g4);
    assert.equal(hourDue.length, 1);
    assert.equal(hourDue[0].kind, "hour");
  } finally {
    try {
      const { getDb } = await import("../lib/db.js");
      getDb().close();
    } catch {
      // The test assertions have already run; cleanup is best-effort.
    }
    delete process.env.MORROW_DB_PATH;
    if (path.resolve(tempDir).startsWith(path.resolve(os.tmpdir()))) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
});
