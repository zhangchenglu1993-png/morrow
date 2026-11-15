import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { recordGatheringMemory } from "@/lib/gatherings";
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
  if (!body) return errorResponse("请写下这次的美好。");
  const result = recordGatheringMemory(
    auth.session.user.id,
    id,
    body.body ?? ""
  );
  if (!result.ok) return errorResponse(result.error);
  return jsonResponse({ ok: true, postId: result.postId }, 201);
}
