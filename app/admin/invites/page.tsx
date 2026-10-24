import { redirect } from "next/navigation";
import { InviteManager } from "@/components/invite-manager";
import { getCurrentUser } from "@/lib/auth";
import { listInvitations } from "@/lib/invites";
import { getAdminStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminInvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/");
  const invitations = listInvitations();
  const stats = getAdminStats();
  return (
    <div className="narrow-page">
      <p className="page-kicker">Steward tools</p>
      <h1 className="page-title">邀请与成员</h1>
      <p className="page-subtitle">
        产品负责人只承担技术运营和邀请职责，不拥有内容隐藏、下架或修改成员内容的权力。
      </p>
      <div className="proposal-meta" style={{ marginBottom: 24 }}>
        <span>已验证成员：{stats.users}</span>
        <span>公开内容：{stats.posts}</span>
        <span>社区隐藏：{stats.hidden}</span>
      </div>
      <InviteManager invitations={invitations} />
    </div>
  );
}
