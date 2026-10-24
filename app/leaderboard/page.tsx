import Link from "next/link";
import { getActiveSession } from "@/lib/auth";
import { getLeaderboard, getUserRank } from "@/lib/contribution";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await getActiveSession();
  const leaderboard = getLeaderboard();
  const myRank = session ? getUserRank(session.user.id) : null;

  return (
    <div className="narrow-page">
      <p className="page-kicker">The roll of companions</p>
      <h1 className="page-title">二十等爵 · 爵位榜</h1>
      <p className="page-subtitle">
        这里记录长期真实的参与和共同维护。榜上不公开贡献分数，也不存在购买、加速或付费等级。
      </p>

      {session && myRank ? (
        <div className="proposal-card" style={{ marginBottom: 24 }}>
          <div className="author-line">
            <strong>{session.user.displayName}</strong>
            <span className="rank-pill">
              第 {myRank.rank.current.level} 级 · {myRank.rank.current.title}
            </span>
          </div>
          <div className="progress-track" aria-label="个人晋升进度">
            <div className="progress-fill" style={{ width: `${myRank.rank.progress * 100}%` }} />
          </div>
          <p className="field-hint">
            {myRank.rank.next
              ? `距离「${myRank.rank.next.title}」还需要 ${myRank.rank.pointsToNext} 点有效贡献。`
              : "你已经抵达当前最高爵位。"}
          </p>
        </div>
      ) : null}

      {leaderboard.length > 0 ? (
        <div className="leader-list">
          {leaderboard.map((entry, index) => (
            <Link
              className={`leader-row${index < 3 ? " top" : ""}`}
              href={`/profile/${entry.id}`}
              key={entry.id}
            >
              <span className="leader-position">{index + 1}</span>
              <span className="leader-name">
                <span aria-hidden="true">{entry.avatarEmoji}</span>
                <span>{entry.displayName}</span>
              </span>
              <span className="leader-rank">
                第 {entry.level} 级 · {entry.title}
                <small>
                  {entry.nextTitle
                    ? `距 ${entry.nextTitle} 还有 ${entry.pointsToNext} 点`
                    : "当前最高爵位"}
                </small>
                <span className="progress-track" aria-hidden="true">
                  <span className="progress-fill" style={{ width: `${entry.progress * 100}%` }} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>爵位榜还在等待第一位同行者。</h3>
          <p>当受邀成员开始真实发布、互动和参与治理，这里会留下共同成长的轨迹。</p>
        </div>
      )}
    </div>
  );
}
