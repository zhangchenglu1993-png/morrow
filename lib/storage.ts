import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm"
};

export type StoredMedia = {
  id: string;
  storageKey: string;
  mimeType: string;
  size: number;
  kind: "image" | "video";
};

function uploadDirectory(): string {
  return process.env.MORROW_UPLOAD_DIR
    ? path.resolve(process.env.MORROW_UPLOAD_DIR)
    : path.join(process.cwd(), "data", "uploads");
}

function hasValidSignature(kind: "image" | "video", mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mimeType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  if (kind === "video") {
    return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  }
  return false;
}

export async function storeUploads(files: File[]): Promise<StoredMedia[]> {
  const actualFiles = files.filter((file) => file.size > 0);
  if (actualFiles.length === 0) return [];
  const images = actualFiles.filter((file) => file.type.startsWith("image/"));
  const videos = actualFiles.filter((file) => file.type.startsWith("video/"));
  if (images.length !== actualFiles.length - videos.length) {
    throw new Error("上传文件必须全部是图片或视频。");
  }
  if (images.length > 6) throw new Error("每篇内容最多上传 6 张图片。");
  if (videos.length > 1) throw new Error("每篇内容最多上传 1 个视频。");
  if (images.length > 0 && videos.length > 0) {
    throw new Error("一条内容不能同时包含图片和视频。");
  }

  await mkdir(uploadDirectory(), { recursive: true });
  const stored: StoredMedia[] = [];
  try {
    for (const file of actualFiles) {
      const mimeType = file.type;
      const extension = MIME_EXTENSION[mimeType];
      if (!extension) throw new Error("只支持 JPG、PNG、WebP、MP4 或 WebM 文件。");
      const kind = mimeType.startsWith("image/") ? "image" : "video";
      const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      if (file.size > max) {
        throw new Error(kind === "image" ? "单张图片不能超过 15 MB。" : "视频不能超过 100 MB。");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasValidSignature(kind, mimeType, bytes)) {
        throw new Error("文件内容与格式不匹配。");
      }
      const id = randomUUID();
      const storageKey = `${id}.${extension}`;
      await writeFile(path.join(/* turbopackIgnore: true */ uploadDirectory(), storageKey), bytes);
      stored.push({ id, storageKey, mimeType, size: file.size, kind });
    }
    return stored;
  } catch (error) {
    await Promise.all(stored.map((item) => unlinkMedia(item.storageKey)));
    throw error;
  }
}

export async function unlinkMedia(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(uploadDirectory(), storageKey));
  } catch {
    // A failed cleanup must not mask the original request error.
  }
}

export async function readStoredMedia(storageKey: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path.join(uploadDirectory(), storageKey)));
}
