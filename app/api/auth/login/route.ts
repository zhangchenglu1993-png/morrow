import { getDb } from "@/lib/db";
import { createSession, normalizeEmail, sameOrigin, verifyPassword } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail, parseJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginBody = { email?: string; password?: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("请求来源无效。", 403);
  const limited = rateLimit(request, "login", 20, 15 * 60_000);
  if (!limited.allowed) {
    return errorResponse("尝试次数过多，请稍后再试。", 429, {
      "Retry-After": String(limited.retryAfterSeconds)
    });
  }
  const body = parseJson<LoginBody>(await request.text());
  if (!body) return errorResponse("登录信息格式不正确。");

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!isValidEmail(email) || !password) return errorResponse("邮箱或密码错误。", 401);

  const row = getDb()
    .prepare(
      `SELECT id, password_hash, password_salt, email_verified
       FROM users WHERE email = ?`
    )
    .get(email) as
    | {
        id: string;
        password_hash: string;
        password_salt: string;
        email_verified: number;
      }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
    return errorResponse("邮箱或密码错误。", 401);
  }
  if (!row.email_verified) {
    return errorResponse("请先完成邮箱验证。", 403);
  }

  await createSession(row.id);
  return jsonResponse({ ok: true });
}
