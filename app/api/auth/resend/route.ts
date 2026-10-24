import { randomUUID } from "node:crypto";
import { errorResponse, jsonResponse } from "@/lib/api";
import { hashToken, normalizeEmail, randomToken, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail, parseJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("请求来源无效。", 403);
  const limited = rateLimit(request, "resend", 5, 60 * 60_000);
  if (!limited.allowed) {
    return errorResponse("请求过于频繁，请稍后再试。", 429, {
      "Retry-After": String(limited.retryAfterSeconds)
    });
  }

  const body = parseJson<{ email?: string }>(await request.text());
  const email = normalizeEmail(body?.email ?? "");
  if (!isValidEmail(email)) return errorResponse("请输入有效的邮箱地址。");

  const row = getDb()
    .prepare("SELECT id, email_verified FROM users WHERE email = ?")
    .get(email) as { id: string; email_verified: number } | undefined;
  if (!row || row.email_verified) {
    return jsonResponse({
      ok: true,
      message: "如果这个邮箱仍在等待验证，我们已经发送了新的验证邮件。"
    });
  }

  const token = randomToken();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      "UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND kind = 'verify' AND used_at IS NULL"
    )
    .run(now, row.id);
  getDb()
    .prepare(
      `INSERT INTO email_tokens (id, user_id, token_hash, kind, expires_at, created_at)
       VALUES (?, ?, ?, 'verify', ?, ?)`
    )
    .run(
      randomUUID(),
      row.id,
      hashToken(token),
      new Date(Date.now() + 86_400_000).toISOString(),
      now
    );
  const mail = await sendVerificationEmail(email, token);
  return jsonResponse({
    ok: true,
    message: "如果这个邮箱仍在等待验证，我们已经发送了新的验证邮件。",
    devVerifyUrl: mail.devUrl
  });
}
