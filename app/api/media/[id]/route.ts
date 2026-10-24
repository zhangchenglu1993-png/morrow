import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getActiveSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uploadDirectory(): string {
  return process.env.MORROW_UPLOAD_DIR
    ? path.resolve(process.env.MORROW_UPLOAD_DIR)
    : path.join(process.cwd(), "data", "uploads");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const row = getDb()
    .prepare(
      `SELECT m.storage_key, m.mime_type, m.size, p.author_id, p.status
       FROM media_assets m
       JOIN posts p ON p.id = m.post_id
       WHERE m.id = ?`
    )
    .get(id) as
    | {
        storage_key: string;
        mime_type: string;
        size: number;
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
  let fileStat;
  try {
    fileStat = await stat(fullPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": row.mime_type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Content-Security-Policy": "default-src 'none'; sandbox"
  };

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
      if (start <= end && start < fileStat.size) {
        const stream = createReadStream(fullPath, { start, end });
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            ...headers,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${fileStat.size}`
          }
        });
      }
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileStat.size}` }
      });
    }
  }

  const stream = createReadStream(fullPath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      ...headers,
      "Content-Length": String(fileStat.size)
    }
  });
}
