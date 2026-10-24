import { errorResponse, jsonResponse, requireMutationAuth } from "@/lib/api";
import { createProposal, SETTING_OPTIONS, type ProposalKind, type SettingKey } from "@/lib/governance";
import { parseJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  kind?: ProposalKind;
  title?: string;
  body?: string;
  settingKey?: string | null;
  settingValue?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireMutationAuth(request);
  if (!auth.ok) return auth.response;
  const data = parseJson<Body>(await request.text());
  if (!data) return errorResponse("提案格式不正确。");
  if (data.kind !== "normal" && data.kind !== "major") {
    return errorResponse("请选择提案类型。");
  }
  const settingKey =
    data.settingKey && SETTING_OPTIONS.some((option) => option.key === data.settingKey)
      ? (data.settingKey as SettingKey)
      : null;
  const result = createProposal({
    userId: auth.session.user.id,
    kind: data.kind,
    title: data.title ?? "",
    body: data.body ?? "",
    settingKey,
    settingValue: data.settingValue ?? null
  });
  if (!result.ok) return errorResponse(result.error ?? "创建提案失败。");
  return jsonResponse({ ok: true, id: result.id }, 201);
}
