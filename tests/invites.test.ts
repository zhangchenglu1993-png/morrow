import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

test("members invite up to the active limit and a used code frees a slot", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "morrow-invite-"));
  process.env.MORROW_DB_PATH = path.join(tempDir, "morrow.db");
  try {
    const { getDb } = await import("../lib/db.js");
    const {
      MEMBER_ACTIVE_INVITE_LIMIT,
      consumeInvitation,
      countActiveInvitations,
      createInvitationForUser,
      listAllInvitationsForOwner,
      listInvitationsByCreator,
      listInvitees
    } = await import("../lib/invites.js");

    const db = getDb();
    const now = new Date().toISOString();
    const insertUser = db.prepare(
      `INSERT INTO users
        (id, email, password_hash, password_salt, display_name, avatar_emoji,
         role, email_verified, accepted_covenant, created_at)
       VALUES (?, ?, 'hash', 'salt', ?, '🌱', ?, 1, 1, ?)`
    );

    const memberId = randomUUID();
    insertUser.run(memberId, "member@example.com", "成员", "member", now);
    const guestId = randomUUID();
    insertUser.run(guestId, "guest@example.com", "同行者", "member", now);
    const ownerId = randomUUID();
    insertUser.run(ownerId, "owner@example.com", "发起人", "owner", now);

    const member = { id: memberId, role: "member" as const };
    const codes: string[] = [];
    for (let index = 0; index < MEMBER_ACTIVE_INVITE_LIMIT; index += 1) {
      const issued = createInvitationForUser(member, 7);
      assert.equal(issued.ok, true);
      if (!issued.ok) throw new Error("expected invitation to be issued");
      codes.push(issued.code);
    }
    assert.equal(countActiveInvitations(memberId), MEMBER_ACTIVE_INVITE_LIMIT);

    const blocked = createInvitationForUser(member, 7);
    assert.equal(blocked.ok, false);
    assert.equal(countActiveInvitations(memberId), MEMBER_ACTIVE_INVITE_LIMIT);

    // 一份邀请被使用后，持有名额立即释放。
    assert.equal(consumeInvitation(codes[0], guestId), true);
    assert.equal(countActiveInvitations(memberId), MEMBER_ACTIVE_INVITE_LIMIT - 1);
    assert.equal(createInvitationForUser(member, 7).ok, true);

    const invitees = listInvitees(memberId);
    assert.equal(invitees.length, 1);
    assert.equal(invitees[0].displayName, "同行者");
    assert.equal(invitees[0].id, guestId);
    assert.equal(listInvitationsByCreator(memberId).length, MEMBER_ACTIVE_INVITE_LIMIT + 1);

    // 产品负责人不受持有上限约束。
    for (let index = 0; index < MEMBER_ACTIVE_INVITE_LIMIT + 2; index += 1) {
      assert.equal(createInvitationForUser({ id: ownerId, role: "owner" }, 7).ok, true);
    }
    const all = listAllInvitationsForOwner();
    assert.equal(all.length, MEMBER_ACTIVE_INVITE_LIMIT * 2 + 3);
    assert.equal(all.filter((row) => row.creatorName === "发起人").length, MEMBER_ACTIVE_INVITE_LIMIT + 2);
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
