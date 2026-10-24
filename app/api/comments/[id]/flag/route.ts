import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { flagComment } from "@/lib/feedback-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = flagComment(auth.session.user.id, id);
  if (!result.ok) return errorResponse(result.error ?? "反馈失败。");
  return jsonResponse({ ok: true });
}
