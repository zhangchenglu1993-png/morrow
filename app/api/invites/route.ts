import { requireMutationAuth, errorResponse, jsonResponse } from "@/lib/api";
import { createInvitation } from "@/lib/invites";
import { parseJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.session.user.role !== "owner") {
    return errorResponse("只有产品负责人可以生成邀请码。", 403);
  }
  const body = parseJson<{ daysValid?: number }>(await request.text()) ?? {};
  const days = Math.min(30, Math.max(1, Number(body.daysValid) || 7));
  const invitation = createInvitation(auth.session.user.id, days);
  return jsonResponse({ ok: true, ...invitation });
}
