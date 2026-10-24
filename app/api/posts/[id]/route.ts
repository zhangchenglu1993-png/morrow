import { deletePost } from "@/lib/content-service";
import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = await deletePost(auth.session.user.id, id);
  if (!result.ok) return errorResponse(result.error ?? "删除失败。");
  return jsonResponse({ ok: true });
}
