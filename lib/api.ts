import { getActiveSession, hasValidCsrf, type ActiveSession } from "./auth";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
} as const;

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return Response.json(data, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders }
  });
}

export function errorResponse(
  message: string,
  status = 400,
  extraHeaders: Record<string, string> = {}
): Response {
  return jsonResponse({ ok: false, error: message }, status, extraHeaders);
}

export type MutationAuthResult =
  | { ok: true; session: ActiveSession }
  | { ok: false; response: Response };

export async function requireMutationAuth(
  request: Request
): Promise<MutationAuthResult> {
  const session = await getActiveSession();
  if (!session) {
    return { ok: false, response: errorResponse("请先登录。", 401) };
  }
  if (!session.user.emailVerified) {
    return { ok: false, response: errorResponse("请先验证邮箱。", 403) };
  }
  if (!hasValidCsrf(request, session)) {
    return { ok: false, response: errorResponse("请求校验失败，请刷新页面重试。", 403) };
  }
  return { ok: true, session };
}
