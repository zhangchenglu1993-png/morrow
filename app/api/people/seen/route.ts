import { jsonResponse, requireMutationAuth } from "@/lib/api";
import { markPeopleSeen } from "@/lib/relationships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  markPeopleSeen(auth.session.user.id);
  return jsonResponse({ ok: true });
}
