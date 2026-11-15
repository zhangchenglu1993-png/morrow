import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { createGathering } from "@/lib/gatherings";
import { parseJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  title?: string;
  note?: string;
  place?: string;
  startsAt?: string;
  capacity?: number | null;
};

export async function POST(request: Request) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;

  const body = parseJson<CreateBody>(await request.text());
  if (!body) return errorResponse("邀约信息格式不正确。");

  const result = createGathering(auth.session.user.id, {
    title: body.title ?? "",
    note: body.note ?? "",
    place: body.place ?? "",
    startsAt: body.startsAt ?? "",
    capacity: body.capacity ?? null
  });

  if (!result.ok) return errorResponse(result.error);
  return jsonResponse({ ok: true, id: result.id }, 201);
}
