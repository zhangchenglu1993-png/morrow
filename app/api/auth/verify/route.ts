import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.redirect(new URL("/login?verify_error=1", url.origin));
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, used_at
       FROM email_tokens
       WHERE token_hash = ? AND kind = 'verify'`
    )
    .get(hashToken(token)) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;

  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return NextResponse.redirect(new URL("/login?verify_error=1", url.origin));
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE email_tokens SET used_at = ? WHERE id = ?").run(now, row.id);
  db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);
  return NextResponse.redirect(new URL("/login?verified=1", url.origin));
}
