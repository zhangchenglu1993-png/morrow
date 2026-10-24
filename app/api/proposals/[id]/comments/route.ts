import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { addProposalComment } from "@/lib/governance";
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
  const body = parseJson<{ body?: string }>(await request.text());
  const result = addProposalComment(auth.session.user.id, id, body?.body ?? "");
  if (!result.ok) return errorResponse(result.error ?? "讨论发送失败。");
  return jsonResponse({ ok: true }, 201);
}
