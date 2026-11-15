import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// 旧入口保留为跳转：成员与产品负责人现在共用 /invites 页面。
export default function AdminInvitesPage() {
  redirect("/invites");
}
