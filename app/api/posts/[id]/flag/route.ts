import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { flagPost } from "@/lib/feedback-service";
import type { FeedbackReason } from "@/lib/constants";
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
  const body = parseJson<{ reasons?: FeedbackReason[] }>(await request.text());
  const result = flagPost(auth.session.user.id, id, body?.reasons ?? []);
  if (!result.ok) return errorResponse(result.error ?? "操作失败。");
  return jsonResponse({ ok: true });
}
