import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { setReaction } from "@/lib/feedback-service";
import type { ReactionType } from "@/lib/constants";
import { parseJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body = parseJson<{ type?: ReactionType }>(await request.text());
  if (!body?.type) return errorResponse("请选择表情。");
  const result = setReaction(auth.session.user.id, id, body.type);
  if (!result.ok) return errorResponse(result.error ?? "操作失败。");
  return jsonResponse({ ok: true });
}
