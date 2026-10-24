import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { castVote, type VoteChoice } from "@/lib/governance";
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
  const body = parseJson<{ choice?: VoteChoice }>(await request.text());
  if (!body?.choice) return errorResponse("请选择投票选项。");
  const result = castVote(auth.session.user.id, id, body.choice);
  if (!result.ok) return errorResponse(result.error ?? "投票失败。");
  return jsonResponse({ ok: true });
}
