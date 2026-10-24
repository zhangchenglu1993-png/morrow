import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { getActiveSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/queries";
import { RANKS } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getActiveSession();
  const viewerId = session?.user.id ?? null;
  const profile = getUserProfile(id, viewerId);
  if (!profile) notFound();
  const isMe = viewerId === id;
  const currentLevel = profile.user.rank.current.level;

  return (
    <div className="page">
      <section className="profile-hero">
        <span className="profile-avatar" aria-hidden="true">
          {profile.user.avatarEmoji}
        </span>
        <div>
          <h1>{profile.user.displayName}</h1>
          <p>
            {profile.user.role === "owner" ? "共同起点 · " : ""}
            在 Morrow 留下的真实生活，与共同成长的轨迹。
          </p>
          <div className="progress-track" aria-label="当前爵位进度">
            <div
              className="progress-fill"
              style={{ width: `${profile.user.rank.progress * 100}%` }}
            />
          </div>
          <p className="field-hint">
            {profile.user.rank.next
              ? `距离「${profile.user.rank.next.title}」还有 ${profile.user.rank.pointsToNext} 点有效贡献。`
              : "已抵达当前最高爵位。"}
          </p>
        </div>
        <span className="rank-pill">
          第 {currentLevel} 级 · {profile.user.rank.current.title}
        </span>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Twenty ranks</p>
            <h2>二十等爵成长地图</h2>
            <p>每一级都来自真实发布、真实反馈与共同维护。</p>
          </div>
          {isMe ? <Link href="/private">回到私密区 →</Link> : null}
        </div>
        <div className="rank-map" aria-label="二十等爵成长地图">
          {RANKS.map((rank) => (
            <div
              className={`rank-step${rank.level === currentLevel ? " current" : ""}${
                rank.level < currentLevel ? " reached" : ""
              }`}
              key={rank.level}
            >
              <strong>{rank.title}</strong>
              <span>第 {rank.level} 级</span>
              {rank.privilege ? <span>{rank.privilege}</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Living record</p>
            <h2>{isMe ? "我留下的美好" : "TA 留下的美好"}</h2>
            <p>{profile.posts.length} 条公开或仅本人可见的记录。</p>
          </div>
          {isMe ? <Link href="/compose">记录此刻 →</Link> : null}
        </div>
        {profile.posts.length > 0 ? (
          <div className="feed">
            {profile.posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={viewerId} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>还没有留下内容。</h3>
            <p>真实的生活不需要排场，一件小事就已经足够。</p>
            {isMe ? (
              <Link className="button button-primary" href="/compose">
                记录第一份美好
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
