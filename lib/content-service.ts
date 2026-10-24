import { randomUUID } from "node:crypto";
import { getDb, withTransaction } from "./db";
import { awardContribution } from "./contribution";
import { storeUploads, unlinkMedia, type StoredMedia } from "./storage";

export type NewPostInput = {
  userId: string;
  body: string;
  promptDay: number | null;
  files: File[];
  originalityConfirmed: boolean;
};

export async function createPost(
  input: NewPostInput
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const body = input.body.trim();
  if (!input.originalityConfirmed) {
    return { ok: false, error: "请确认内容来自你的真实生活，且没有使用 AI 生成。" };
  }
  if (body.length > 2000) return { ok: false, error: "正文最多 2,000 字。" };
  if (input.files.length === 0 && !body) {
    return { ok: false, error: "请写下文字，或至少选择一张图片/一个视频。" };
  }
  if (input.promptDay !== null && (input.promptDay < 1 || input.promptDay > 30)) {
    return { ok: false, error: "每日问题的顺序无效。" };
  }

  let stored: StoredMedia[] = [];
  try {
    stored = await storeUploads(input.files);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "文件上传失败。"
    };
  }

  const postId = randomUUID();
  try {
    withTransaction((db) => {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO posts (id, author_id, body, prompt_day, status, created_at)
         VALUES (?, ?, ?, ?, 'public', ?)`
      ).run(postId, input.userId, body, input.promptDay, now);
      const insertMedia = db.prepare(
        `INSERT INTO media_assets
          (id, post_id, storage_key, mime_type, size, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const media of stored) {
        insertMedia.run(
          media.id,
          postId,
          media.storageKey,
          media.mimeType,
          media.size,
          media.kind,
          now
        );
      }
    });
  } catch (error) {
    await Promise.all(stored.map((item) => unlinkMedia(item.storageKey)));
    throw error;
  }

  awardContribution({
    userId: input.userId,
    kind: "post",
    sourceId: postId,
    postId,
    points: 5,
    perDayCap: 2
  });
  if (input.promptDay) {
    awardContribution({
      userId: input.userId,
      kind: "prompt_bonus",
      sourceId: postId,
      postId,
      points: 3,
      perDayCap: 1
    });
  }
  return { ok: true, postId };
}

export async function deletePost(
  userId: string,
  postId: string
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const row = db
    .prepare("SELECT author_id FROM posts WHERE id = ? AND status != 'deleted'")
    .get(postId) as { author_id: string } | undefined;
  if (!row) return { ok: false, error: "内容不存在。" };
  if (row.author_id !== userId) return { ok: false, error: "只能删除自己的内容。" };
  const media = db
    .prepare("SELECT storage_key FROM media_assets WHERE post_id = ?")
    .all(postId) as Array<{ storage_key: string }>;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE contribution_events SET active = 0 WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  await Promise.all(media.map((item) => unlinkMedia(item.storage_key)));
  return { ok: true };
}
