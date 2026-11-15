import { requireMutationAuth, errorResponse, jsonResponse } from "@/lib/api";
import { createInvitationForUser } from "@/lib/invites";
import { rateLimit } from "@/lib/rate-limit";
import { parseJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimit(request, "invite-create", 30, 60 * 60_000);
  if (!limited.allowed) {
    return errorResponse("生成邀请码过于频繁，请稍后再试。", 429, {
      "Retry-After": String(limited.retryAfterSeconds)
    });
  }

  const body = parseJson<{ daysValid?: number }>(await request.text()) ?? {};
  const days = Math.min(30, Math.max(1, Number(body.daysValid) || 7));
  const invitation = createInvitationForUser(auth.session.user, days);

  if (!invitation.ok) {
    return errorResponse(
      `你已持有 ${invitation.active} 个未使用的邀请码。等其中一份被使用或过期后，就可以生成新的邀请。`,
      409
    );
  }

  return jsonResponse(invitation);
}
