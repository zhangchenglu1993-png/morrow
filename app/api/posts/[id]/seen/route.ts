import { jsonResponse, requireMutationAuth } from "@/lib/api";
import { markPostSeen } from "@/lib/relationships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  markPostSeen(auth.session.user.id, id);
  return jsonResponse({ ok: true });
}
