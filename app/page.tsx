import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { getActiveSession } from "@/lib/auth";
import {
  getAdminStats,
  getCurrentPrompt,
  getFeaturedToday,
  getFeed
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getActiveSession();
  const viewerId = session?.user.id ?? null;
  const [feed, featured, prompt, stats] = [
    getFeed(viewerId),
    getFeaturedToday(viewerId),
    getCurrentPrompt(),
    getAdminStats()
  ];
  const rest = feed.filter((post) => post.id !== featured?.id);

  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="hero-kicker">Morrow · 点滴美好</p>
          <h1>
            让每一个
            <br />
            微小的幸福
            <br />
            <span>有处安放。</span>
          </h1>
          <p className="hero-tagline">
            这里没有广告、新闻和政治，只留下真实生活里被看见的美好。
            从今天的一件小事开始，把它留给明天。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={viewerId ? "/compose" : "/register"}>
              {viewerId ? "记录此刻" : "接受邀请，开始记录"}
            </Link>
            <Link className="button button-ghost" href="/governance">
              看见共同治理
            </Link>
          </div>
        </div>
        <aside className="hero-side">
          <p>Small joys, kept for tomorrow.</p>
          <strong>把今天的美好，留给明天。</strong>
          <p>
            公开广场对所有人可见；发布与互动只属于受邀成员。每个人的幸福不一样，但都值得被认真看见。
          </p>
          <div className="hero-stats">
            <div>
              <strong>{stats.users}</strong>
              <span>位同行者</span>
            </div>
            <div>
              <strong>{stats.posts}</strong>
              <span>份美好</span>
            </div>
            <div>
              <strong>30</strong>
              <span>天共同练习</span>
            </div>
          </div>
        </aside>
      </section>

      {featured ? (
        <section className="section" aria-labelledby="featured-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Community selected</p>
              <h2 id="featured-title">今日精选</h2>
              <p>由今天获得最多喜欢与笑脸的内容自然产生。</p>
            </div>
          </div>
          <div className="featured-shell">
            <span className="featured-label">✦ 今日共同看见</span>
            <PostCard post={featured} currentUserId={viewerId} featured />
          </div>
        </section>
      ) : (
        <section className="section">
          <div className="empty-state">
            <p className="eyebrow">今日精选</p>
            <h3>今天的第一份美好，还在等你写下。</h3>
            <p>当有人分享、有人回应，今日精选会从真实反馈中自然出现。</p>
            <Link className="button button-sun" href={viewerId ? "/compose" : "/register"}>
              {viewerId ? "记录今天" : "先看看如何加入"}
            </Link>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="prompt-title">
        <div className="prompt-card">
          <div>
            <p className="eyebrow">第 {prompt.day} 天 · {prompt.theme}</p>
            <h2 id="prompt-title">{prompt.question}</h2>
            <p>每日问题只负责引导。你也可以自由记录与问题无关的小确幸。</p>
          </div>
          <Link className="button button-sun" href={viewerId ? "/compose" : "/register"}>
            {viewerId ? "回应今天" : "加入后回应"}
          </Link>
        </div>
      </section>

      <section className="section" aria-labelledby="feed-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The living plaza</p>
            <h2 id="feed-title">正在发生的美好</h2>
            <p>单列阅读，让每一份真实都被认真看见。</p>
          </div>
          {viewerId ? (
            <Link href="/compose">留下此刻 →</Link>
          ) : (
            <Link href="/login">成员登录 →</Link>
          )}
        </div>
        {rest.length > 0 ? (
          <div className="feed">
            {rest.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={viewerId} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>{stats.posts > 0 ? "今天的美好已经在上方被看见。" : "广场还很安静。"}</h3>
            <p>
              {stats.posts > 0
                ? "等下一份真实的生活片段出现，再来坐一会儿。"
                : "第一批受邀成员写下的文字、照片和视频，会在这里慢慢汇成一条河。"}
            </p>
            <Link className="button button-ghost" href="/register">
              使用邀请码加入
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
