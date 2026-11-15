import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkSeen } from "@/components/mark-seen";
import { PostCard } from "@/components/post-card";
import { getCurrentUser } from "@/lib/auth";
import { getPostsByAuthors } from "@/lib/queries";
import { getFamiliarPeople } from "@/lib/relationships";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const people = getFamiliarPeople(user.id);
  const posts = getPostsByAuthors(
    people.map((person) => person.id),
    user.id,
    10
  );

  return (
    <div className="narrow-page">
      <MarkSeen endpoint="/api/people/seen" />
      <p className="page-kicker">People you know</p>
      <h1 className="page-title">同行者</h1>
      <p className="page-subtitle">
        一起做过事、互相邀请、或彼此回应过的人。这里没有推荐，只按最近的内容时间排列。
      </p>

      {people.length > 0 ? (
        <>
          <div className="people-grid">
            {people.map((person) => (
              <Link className="person-card" href={`/profile/${person.id}`} key={person.id}>
                <span className="person-avatar" aria-hidden="true">
                  {person.avatarEmoji}
                </span>
                <span className="person-body">
                  <strong>
                    {person.displayName}
                    {person.hasNew ? <span className="new-dot" aria-label="有新内容" /> : null}
                  </strong>
                  <small>{person.latestPost ? person.latestPost.body : "还没有公开记录"}</small>
                </span>
                {person.latestPost ? (
                  <span className="person-time">
                    {formatDateTime(person.latestPost.createdAt)}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>

          <section className="section" aria-labelledby="people-feed-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recent from people you know</p>
                <h2 id="people-feed-title">同行者最近的记录</h2>
                <p>只按时间倒序，最多十条。看完这些，就去过今天的生活吧。</p>
              </div>
            </div>
            {posts.length > 0 ? (
              <div className="feed">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} currentUserId={user.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>同行者还没有公开记录。</h3>
                <p>等他们写下今天的一件小事，就会出现在这里。</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="empty-state">
          <h3>还没有同行者。</h3>
          <p>邀请一位你信任的人，或者一起参加一件小事。熟悉的人会在这里慢慢出现。</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/invites">
              去邀请
            </Link>
            <Link className="button button-ghost" href="/together">
              一起做件小事
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
