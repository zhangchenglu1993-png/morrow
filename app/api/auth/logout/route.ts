import { clearSession, sameOrigin } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("请求来源无效。", 403);
  await clearSession();
  return jsonResponse({ ok: true });
}
