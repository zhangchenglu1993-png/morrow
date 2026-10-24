import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

test("database feedback flow hides exactly at the community threshold", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "morrow-test-"));
  process.env.MORROW_DB_PATH = path.join(tempDir, "morrow.db");
  try {
    const { getDb } = await import("../lib/db.js");
    const { setReaction } = await import("../lib/feedback-service.js");
    const db = getDb();
    const now = new Date().toISOString();
    const users = Array.from({ length: 11 }, (_, index) => {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO users
          (id, email, password_hash, password_salt, display_name, avatar_emoji,
           role, email_verified, accepted_covenant, created_at, last_login_at)
         VALUES (?, ?, 'hash', 'salt', ?, '🌱', 'member', 1, 1, ?, ?)`
      ).run(id, `user${index}@example.com`, `成员${index}`, now, now);
      return id;
    });
    const postId = randomUUID();
    db.prepare(
      `INSERT INTO posts (id, author_id, body, status, created_at)
       VALUES (?, ?, '今天有一束光。', 'public', ?)`
    ).run(postId, users[0], now);

    for (let index = 1; index <= 8; index += 1) {
      setReaction(users[index], postId, "smile");
    }
    let row = db.prepare("SELECT status FROM posts WHERE id = ?").get(postId) as {
      status: string;
    };
    assert.equal(row.status, "public");

    setReaction(users[9], postId, "cry");
    row = db.prepare("SELECT status FROM posts WHERE id = ?").get(postId) as {
      status: string;
    };
    assert.equal(row.status, "public");

    setReaction(users[10], postId, "cry");
    row = db.prepare("SELECT status FROM posts WHERE id = ?").get(postId) as {
      status: string;
    };
    assert.equal(row.status, "hidden");
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
