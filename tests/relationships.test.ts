import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

test("familiar people, inbox, and participation stay chronological and explicit", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "morrow-relations-"));
  process.env.MORROW_DB_PATH = path.join(tempDir, "morrow.db");
  try {
    const { getDb } = await import("../lib/db.js");
    const {
      getFamiliarPeople,
      getInbox,
      getParticipation,
      markInboxSeen,
      markPeopleSeen,
      markPostSeen
    } = await import("../lib/relationships.js");

    const db = getDb();
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    const insertUser = db.prepare(
      `INSERT INTO users
        (id, email, password_hash, password_salt, display_name, avatar_emoji,
         role, email_verified, accepted_covenant, created_at)
       VALUES (?, ?, 'hash', 'salt', ?, '🌱', 'member', 1, 1, ?)`
    );
    const alice = randomUUID();
    const bob = randomUUID();
    const carol = randomUUID();
    insertUser.run(alice, "alice@example.com", "阿岚", minutesAgo(120));
    insertUser.run(bob, "bob@example.com", "小禾", minutesAgo(120));
    insertUser.run(carol, "carol@example.com", "陌生人", minutesAgo(120));

    db.prepare(
      `INSERT INTO invitations
        (id, code_hash, code_prefix, created_by, expires_at, used_by, used_at, created_at)
       VALUES (?, ?, 'MORROW-BOBS', ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      randomUUID(),
      alice,
      minutesAgo(-600),
      bob,
      minutesAgo(110),
      minutesAgo(110)
    );

    const gatheringId = randomUUID();
    db.prepare(
      `INSERT INTO gatherings
        (id, author_id, title, note, place, starts_at, capacity, status, created_at)
       VALUES (?, ?, '一起散步', '', '江边', ?, NULL, 'open', ?)`
    ).run(gatheringId, alice, minutesAgo(-60), minutesAgo(100));
    const addAttendee = db.prepare(
      "INSERT INTO gathering_attendees (gathering_id, user_id, created_at) VALUES (?, ?, ?)"
    );
    addAttendee.run(gatheringId, alice, minutesAgo(100));
    addAttendee.run(gatheringId, bob, minutesAgo(99));

    const postA = randomUUID();
    const postB = randomUUID();
    db.prepare(
      `INSERT INTO posts (id, author_id, body, status, created_at)
       VALUES (?, ?, '阿岚今天的记录', 'public', ?)`
    ).run(postA, alice, minutesAgo(30));
    db.prepare(
      `INSERT INTO posts (id, author_id, body, status, created_at)
       VALUES (?, ?, '小禾今天的记录', 'public', ?)`
    ).run(postB, bob, minutesAgo(28));

    const insertComment = db.prepare(
      `INSERT INTO comments (id, post_id, author_id, body, status, created_at)
       VALUES (?, ?, ?, ?, 'public', ?)`
    );
    insertComment.run(randomUUID(), postB, alice, "我也想去。", minutesAgo(20));
    insertComment.run(randomUUID(), postA, bob, "今天的光很好。", minutesAgo(19));

    const people = getFamiliarPeople(alice);
    assert.equal(people.length, 1);
    assert.equal(people[0].id, bob);
    assert.equal(people[0].latestPost?.id, postB);
    assert.equal(people[0].hasNew, true);
    markPeopleSeen(alice, minutesAgo(25));
    assert.equal(getFamiliarPeople(alice)[0].hasNew, false);

    // 陌生人不出现在同行者里，即使广场对所有人可见。
    const carolSees = getFamiliarPeople(carol);
    assert.equal(carolSees.length, 0);

    let inbox = getInbox(alice);
    assert.equal(inbox.unreadCount, 1);
    assert.equal(inbox.items[0].reason, "post");
    assert.equal(inbox.items[0].postId, postA);
    markInboxSeen(alice, minutesAgo(18));
    assert.equal(getInbox(alice).unreadCount, 0);
    insertComment.run(randomUUID(), postA, bob, "下次一起去。", minutesAgo(17));
    assert.equal(getInbox(alice).unreadCount, 1);

    let participation = getParticipation(alice);
    assert.equal(participation.length, 1);
    assert.equal(participation[0].postId, postB);
    assert.equal(participation[0].newCommentCount, 0);

    insertComment.run(randomUUID(), postB, bob, "好啊，周六见。", minutesAgo(16));
    participation = getParticipation(alice);
    assert.equal(participation[0].newCommentCount, 1);

    markPostSeen(alice, postB, minutesAgo(15));
    participation = getParticipation(alice);
    assert.equal(participation[0].newCommentCount, 0);
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
