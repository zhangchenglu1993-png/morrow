import { createReadStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { getActiveSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WIDTH = 1600;
const CACHE_SECONDS = 31_536_000;

function uploadDirectory(): string {
  return process.env.MORROW_UPLOAD_DIR
    ? path.resolve(process.env.MORROW_UPLOAD_DIR)
    : path.join(process.cwd(), "data", "uploads");
}

function baseHeaders(
  mimeType: string,
  cacheControl: string,
  etag: string
): Record<string, string> {
  return {
    "Content-Type": mimeType,
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Content-Security-Policy": "default-src 'none'; sandbox"
  };
}

function streamWithRange(
  fullPath: string,
  size: number,
  request: Request,
  headers: Record<string, string>
): Response {
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start <= end && start < size) {
        const stream = createReadStream(fullPath, { start, end });
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            ...headers,
            "Accept-Ranges": "bytes",
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${size}`
          }
        });
      }
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` }
      });
    }
  }

  const stream = createReadStream(fullPath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      ...headers,
      "Accept-Ranges": "bytes",
      "Content-Length": String(size)
    }
  });
}

async function resizedImage(
  id: string,
  fullPath: string,
  requestUrl: URL,
  accept: string
): Promise<{ path: string; mimeType: string; width: number }> {
  const requested = Number(requestUrl.searchParams.get("w"));
  const width =
    Number.isFinite(requested) && requested >= 320 && requested <= 2000
      ? Math.round(requested)
      : MAX_WIDTH;
  const useWebp = accept.includes("image/webp");
  const extension = useWebp ? "webp" : "jpg";
  const mimeType = useWebp ? "image/webp" : "image/jpeg";

  const directory = path.join(uploadDirectory(), ".derived");
  const target = path.join(directory, `${id}-${width}.${extension}`);
  try {
    await stat(target);
    return { path: target, mimeType, width };
  } catch {
    // 还没有生成过，继续生成。
  }

  await mkdir(directory, { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  const pipeline = sharp(fullPath)
    .rotate()
    .resize({ width, withoutEnlargement: true });
  if (useWebp) {
    await pipeline.webp({ quality: 80 }).toFile(temporary);
  } else {
    await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(temporary);
  }
  await rename(temporary, target);
  return { path: target, mimeType, width };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const row = getDb()
    .prepare(
      `SELECT m.storage_key, m.mime_type, m.size, m.kind, p.author_id, p.status
       FROM media_assets m
       JOIN posts p ON p.id = m.post_id
       WHERE m.id = ?`
    )
    .get(id) as
    | {
        storage_key: string;
        mime_type: string;
        size: number;
        kind: "image" | "video";
        author_id: string;
        status: string;
      }
    | undefined;
  if (!row) return new Response("Not found", { status: 404 });

  if (row.status !== "public") {
    const session = await getActiveSession();
    if (!session || session.user.id !== row.author_id) {
      return new Response("Not found", { status: 404 });
    }
  }

  const fullPath = path.join(uploadDirectory(), row.storage_key);
  let originalStat;
  try {
    originalStat = await stat(fullPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const cacheControl =
    row.status === "public"
      ? `private, max-age=${CACHE_SECONDS}, immutable`
      : "private, no-store";

  if (row.kind === "image") {
    const accept = request.headers.get("accept") ?? "";
    const url = new URL(request.url);
    try {
      const derivative = await resizedImage(id, fullPath, url, accept);
      const derivativeStat = await stat(derivative.path);
      const etag = `"${id}-${derivative.width}-${derivativeStat.size}"`;
      const headers = {
        ...baseHeaders(derivative.mimeType, cacheControl, etag),
        Vary: "Accept"
      };
      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers });
      }
      return streamWithRange(derivative.path, derivativeStat.size, request, headers);
    } catch {
      // 图片处理失败时退回原图。
    }
  }

  const etag = `"${id}-${originalStat.size}-${Math.floor(originalStat.mtimeMs)}"`;
  const headers = baseHeaders(row.mime_type, cacheControl, etag);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return streamWithRange(fullPath, originalStat.size, request, headers);
}
