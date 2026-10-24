import { createPost } from "@/lib/content-service";
import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("无法读取发布内容。");
  }

  const files = form
    .getAll("media")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const rawPromptDay = String(form.get("promptDay") ?? "").trim();
  const result = await createPost({
    userId: auth.session.user.id,
    body: String(form.get("body") ?? ""),
    promptDay: rawPromptDay ? Number(rawPromptDay) : null,
    files,
    originalityConfirmed: String(form.get("originalityConfirmed") ?? "") === "true"
  });

  if (!result.ok) return errorResponse(result.error);
  return jsonResponse({ ok: true, postId: result.postId }, 201);
}
