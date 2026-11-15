import { redirect } from "next/navigation";
import { InviteCenter } from "@/components/invite-center";
import { getCurrentUser } from "@/lib/auth";
import {
  MEMBER_ACTIVE_INVITE_LIMIT,
  countActiveInvitations,
  listAllInvitationsForOwner,
  listInvitationsByCreator,
  listInvitees
} from "@/lib/invites";
import { getAdminStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isOwner = user.role === "owner";
  const invitations = listInvitationsByCreator(user.id);
  const invitees = listInvitees(user.id);
  const activeCount = countActiveInvitations(user.id);
  const allInvitations = isOwner ? listAllInvitationsForOwner() : [];
  const stats = isOwner ? getAdminStats() : null;

  return (
    <div className="narrow-page">
      <p className="page-kicker">Grow together</p>
      <h1 className="page-title">邀请同行者</h1>
      <p className="page-subtitle">
        Morrow 只通过真实的人与人相遇。邀请你信任的人，也来这里留下自己的生活。
      </p>
      <div className="proposal-meta" style={{ marginBottom: 24 }}>
        <span>我已邀请加入：{invitees.length} 位</span>
        {isOwner ? (
          <span>已验证成员：{stats?.users ?? 0}</span>
        ) : (
          <span>
            可生成邀请码：{Math.max(0, MEMBER_ACTIVE_INVITE_LIMIT - activeCount)} /{" "}
            {MEMBER_ACTIVE_INVITE_LIMIT}
          </span>
        )}
      </div>
      <InviteCenter
        invitations={invitations}
        invitees={invitees}
        activeCount={activeCount}
        limit={isOwner ? null : MEMBER_ACTIVE_INVITE_LIMIT}
        isOwner={isOwner}
        allInvitations={allInvitations}
      />
    </div>
  );
}
