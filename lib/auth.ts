import { cookies } from "next/headers";
import { hashToken, randomToken } from "./security";
import { getDb } from "./db";

export { hashToken, hashPassword, verifyPassword, validatePassword, randomToken } from "./security";

export const SESSION_COOKIE = "morrow_session";
export const CSRF_COOKIE = "morrow_csrf";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarEmoji: string;
  role: "owner" | "member";
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type ActiveSession = {
  csrfToken: string;
  user: SessionUser;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}


export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const token = randomToken();
  const csrfToken = randomToken(24);
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    randomToken(12),
    userId,
    hashToken(token),
    csrfToken,
    expiresAt.toISOString(),
    now.toISOString()
  );
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(
    now.toISOString(),
    userId
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
  cookieStore.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb()
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(hashToken(token));
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getDb()
    .prepare(
      `SELECT
         s.csrf_token,
         s.expires_at,
         u.id,
         u.email,
         u.display_name,
         u.avatar_emoji,
         u.role,
         u.email_verified,
         u.created_at,
         u.last_login_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as
    | {
        csrf_token: string;
        expires_at: string;
        id: string;
        email: string;
        display_name: string;
        avatar_emoji: string;
        role: "owner" | "member";
        email_verified: number;
        created_at: string;
        last_login_at: string | null;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    return null;
  }

  return {
    csrfToken: row.csrf_token,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarEmoji: row.avatar_emoji,
      role: row.role,
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at
    }
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getActiveSession())?.user ?? null;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

export function hasValidCsrf(request: Request, session: ActiveSession): boolean {
  const header = request.headers.get("x-csrf-token");
  return Boolean(header) && header === session.csrfToken && sameOrigin(request);
}
