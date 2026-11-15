import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { joinGathering, leaveGathering } from "@/lib/gatherings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = joinGathering(auth.session.user.id, id);
  if (!result.ok) return errorResponse(result.error);
  return jsonResponse({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = leaveGathering(auth.session.user.id, id);
  if (!result.ok) return errorResponse(result.error);
  return jsonResponse({ ok: true });
}
