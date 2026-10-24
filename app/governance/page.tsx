import { getActiveSession } from "@/lib/auth";
import { getUserRank } from "@/lib/contribution";
import { getCurrentRuleSnapshot, getProposals } from "@/lib/governance";
import { ProposalCard, ProposalComposer } from "@/components/governance";

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const session = await getActiveSession();
  const viewerId = session?.user.id ?? null;
  const proposals = getProposals(viewerId);
  const currentUserLevel = viewerId ? getUserRank(viewerId).rank.current.level : 0;
  const rules = getCurrentRuleSnapshot();

  return (
    <div className="narrow-page">
      <p className="page-kicker">Shared stewardship</p>
      <h1 className="page-title">共同治理</h1>
      <p className="page-subtitle">
        平台不替成员裁决。普通规则一人一票，重大方向由高等级成员加权投票；所有过程公开留痕。
      </p>

      <section className="proposal-card" style={{ marginBottom: 24 }}>
        <div className="section-heading" style={{ marginBottom: 14 }}>
          <div>
            <p className="eyebrow">Current rules</p>
            <h2 style={{ fontSize: "1.4rem" }}>此刻执行的社区规则</h2>
          </div>
        </div>
        <div className="proposal-meta">
          <span>最少反馈人数：{rules.minFeedbackParticipants}</span>
          <span>负向隐藏比例：{rules.negativeHidePercent}%</span>
          <span>评论隐藏反馈：{rules.commentHideFlags} 人</span>
          <span>每日贡献上限：{rules.dailyContributionCap}</span>
          <span>当前合格投票人：{rules.eligibleVoters}</span>
        </div>
      </section>

      {session ? (
        <div className="governance-grid" style={{ marginBottom: 28 }}>
          <ProposalComposer />
        </div>
      ) : (
        <p className="form-success">登录后可以提出、联署和投票。游客可以阅读全部提案。</p>
      )}

      {proposals.length > 0 ? (
        <div className="governance-grid">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              currentUserId={viewerId}
              currentUserLevel={currentUserLevel}
              eligibleVoters={rules.eligibleVoters}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>还没有规则提案。</h3>
          <p>第一条提案可以由任何受邀成员发起。达到联署后，它会进入公开讨论。</p>
        </div>
      )}
    </div>
  );
}
