import { randomUUID } from "node:crypto";
import { getDb, withTransaction } from "@/lib/db";
import { hashPassword, hashToken, normalizeEmail, randomToken, validatePassword } from "@/lib/auth";
import { findInvitation } from "@/lib/invites";
import { errorResponse, jsonResponse } from "@/lib/api";
import { cleanDisplayName, cleanEmoji, isValidEmail, parseJson } from "@/lib/validation";
import { sameOrigin } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegisterBody = {
  inviteCode?: string;
  email?: string;
  password?: string;
  displayName?: string;
  avatarEmoji?: string;
  covenant?: boolean;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("请求来源无效。", 403);
  const limited = rateLimit(request, "register", 10, 60 * 60_000);
  if (!limited.allowed) {
    return errorResponse("注册尝试过多，请稍后再试。", 429, {
      "Retry-After": String(limited.retryAfterSeconds)
    });
  }
  const body = parseJson<RegisterBody>(await request.text());
  if (!body) return errorResponse("注册信息格式不正确。");

  const inviteCode = body.inviteCode?.trim() ?? "";
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const displayName = cleanDisplayName(body.displayName ?? "");
  const avatarEmoji = cleanEmoji(body.avatarEmoji ?? "🌱");

  if (!inviteCode) return errorResponse("请输入邀请码。");
  if (!isValidEmail(email)) return errorResponse("请输入有效的邮箱地址。");
  const passwordError = validatePassword(password);
  if (passwordError) return errorResponse(passwordError);
  if (displayName.length < 1) return errorResponse("请输入昵称。");
  if (!body.covenant) return errorResponse("需要同意共同约定后才能加入。");

  const invitation = findInvitation(inviteCode);
  if (!invitation) return errorResponse("邀请码不存在。");
  if (invitation.used_by) return errorResponse("这个邀请码已经被使用。");
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return errorResponse("这个邀请码已经过期。");
  }

  const userId = randomUUID();
  const { hash, salt } = hashPassword(password);
  let consumed = false;

  try {
    withTransaction((db) => {
      const existing = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(email) as { id: string } | undefined;
      if (existing) throw new Error("EMAIL_EXISTS");
      db.prepare(
        `INSERT INTO users
          (id, email, password_hash, password_salt, display_name, avatar_emoji,
           role, email_verified, accepted_covenant, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'member', 0, 1, ?)`
      ).run(
        userId,
        email,
        hash,
        salt,
        displayName,
        avatarEmoji,
        new Date().toISOString()
      );
      const result = db
        .prepare(
          `UPDATE invitations SET used_by = ?, used_at = ?
           WHERE id = ? AND used_by IS NULL AND expires_at > ?`
        )
        .run(userId, new Date().toISOString(), invitation.id, new Date().toISOString());
      if (Number(result.changes) !== 1) throw new Error("INVITE_CONSUMED");
    });
    consumed = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "EMAIL_EXISTS") return errorResponse("这个邮箱已经注册。");
    if (message === "INVITE_CONSUMED") return errorResponse("邀请码已经失效。");
    throw error;
  }

  if (!consumed) return errorResponse("注册失败，请重试。");

  const verifyToken = randomToken();
  getDb()
    .prepare(
      `INSERT INTO email_tokens
        (id, user_id, token_hash, kind, expires_at, created_at)
       VALUES (?, ?, ?, 'verify', ?, ?)`
    )
    .run(
      randomUUID(),
      userId,
      hashToken(verifyToken),
      new Date(Date.now() + 86_400_000).toISOString(),
      new Date().toISOString()
    );

  const mail = await sendVerificationEmail(email, verifyToken);
  return jsonResponse({
    ok: true,
    message: "账号已创建，请验证邮箱。",
    devVerifyUrl: mail.devUrl
  });
}
