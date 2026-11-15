import { jsonResponse, requireMutationAuth } from "@/lib/api";
import { markInboxSeen } from "@/lib/relationships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  markInboxSeen(auth.session.user.id);
  return jsonResponse({ ok: true });
}
