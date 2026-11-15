import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

test("gatherings enforce capacity, memory, and real-world contribution", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "morrow-gather-"));
  process.env.MORROW_DB_PATH = path.join(tempDir, "morrow.db");
  try {
    const { getDb } = await import("../lib/db.js");
    const {
      cancelGathering,
      createGathering,
      getGatheringPassport,
      joinGathering,
      leaveGathering,
      listGatherings,
      recordGatheringMemory
    } = await import("../lib/gatherings.js");
    const { getUserPoints } = await import("../lib/contribution.js");

    const db = getDb();
    const now = new Date().toISOString();
    const insertUser = db.prepare(
      `INSERT INTO users
        (id, email, password_hash, password_salt, display_name, avatar_emoji,
         role, email_verified, accepted_covenant, created_at)
       VALUES (?, ?, 'hash', 'salt', ?, '🌱', 'member', 1, 1, ?)`
    );
    const hostId = randomUUID();
    insertUser.run(hostId, "host@example.com", "发起人", now);
    const guestId = randomUUID();
    insertUser.run(guestId, "guest@example.com", "同行者", now);
    const thirdId = randomUUID();
    insertUser.run(thirdId, "third@example.com", "第三位", now);

    const startsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const created = createGathering(hostId, {
      title: "周六傍晚去江边散步",
      note: "带一杯热茶。",
      place: "滨江步道",
      startsAt,
      capacity: 2
    });
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error("expected gathering creation");
    const gatheringId = created.id;

    let lists = listGatherings(guestId);
    assert.equal(lists.upcoming.length, 1);
    assert.equal(lists.upcoming[0].attendees.length, 1);
    assert.equal(lists.upcoming[0].isAttending, false);

    assert.equal(joinGathering(guestId, gatheringId).ok, true);
    const full = joinGathering(thirdId, gatheringId);
    assert.equal(full.ok, false);

    lists = listGatherings(guestId);
    assert.equal(lists.upcoming[0].attendees.length, 2);
    assert.equal(lists.upcoming[0].isAttending, true);

    // 没发生之前不能写共同记忆。
    const early = recordGatheringMemory(guestId, gatheringId, "已经发生了");
    assert.equal(early.ok, false);

    // 把时间放到过去，模拟这次相聚已经发生。
    db.prepare("UPDATE gatherings SET starts_at = ? WHERE id = ?").run(
      new Date(Date.now() - 60_000).toISOString(),
      gatheringId
    );

    const memory = recordGatheringMemory(guestId, gatheringId, "江边的风很轻，我们走了很久。");
    assert.equal(memory.ok, true);
    if (!memory.ok) throw new Error("expected memory to be recorded");

    const again = recordGatheringMemory(hostId, gatheringId, "再来一次");
    assert.equal(again.ok, false);

    assert.equal(getUserPoints(hostId), 10);
    assert.equal(getUserPoints(guestId), 5);
    assert.equal(getGatheringPassport(hostId).count, 1);
    assert.equal(getGatheringPassport(guestId).count, 1);

    lists = listGatherings(hostId);
    assert.equal(lists.upcoming.length, 0);
    assert.equal(lists.past.length, 1);
    assert.equal(lists.past[0].memory?.postId, memory.postId);

    // 未发生的邀约可以退出、可以取消。
    const second = createGathering(hostId, {
      title: "一起去喝咖啡",
      note: "",
      place: "街角",
      startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      capacity: null
    });
    assert.equal(second.ok, true);
    if (!second.ok) throw new Error("expected second gathering");
    assert.equal(joinGathering(guestId, second.id).ok, true);
    assert.equal(leaveGathering(guestId, second.id).ok, true);
    assert.equal(leaveGathering(hostId, second.id).ok, false);
    assert.equal(cancelGathering(guestId, second.id).ok, false);
    assert.equal(cancelGathering(hostId, second.id).ok, true);

    // 已取消的邀约不再出现在列表里。
    const afterCancel = listGatherings(guestId);
    assert.equal(afterCancel.upcoming.length, 0);
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
