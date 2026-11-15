import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkSeen } from "@/components/mark-seen";
import { getCurrentUser } from "@/lib/auth";
import { getInbox, getParticipation } from "@/lib/relationships";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { items, unreadCount } = getInbox(user.id);
  const participation = getParticipation(user.id);

  return (
    <div className="narrow-page">
      <MarkSeen endpoint="/api/inbox/seen" />
      <p className="page-kicker">Responses</p>
      <h1 className="page-title">回应</h1>
      <p className="page-subtitle">
        有人回应了你的记录，或回应了你参与过的记录。这里只收评论，不推送，也不打扰。
      </p>
      <div className="proposal-meta" style={{ marginBottom: 24 }}>
        <span>{unreadCount > 0 ? `${unreadCount} 条新回应` : "没有新回应"}</span>
        <span>参与过的记录：{participation.length} 条</span>
      </div>

      <div className="form-stack">
        <section className="proposal-card">
          <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>
            最近回应
          </h2>
          {items.length > 0 ? (
            <ul className="inbox-list">
              {items.map((item) => (
                <li
                  className={item.isUnread ? "inbox-item unread" : "inbox-item"}
                  key={item.commentId}
                >
                  <span className="inbox-avatar" aria-hidden="true">
                    {item.author.avatarEmoji}
                  </span>
                  <div>
                    <p className="inbox-head">
                      <strong>{item.author.displayName}</strong>
                      {item.reason === "post" ? " 回应了你的记录" : " 回应了你参与过的记录"}
                      <span className="inbox-time">{formatDateTime(item.createdAt)}</span>
                    </p>
                    <p className="inbox-body">{item.body}</p>
                    <p className="inbox-post">「{item.postExcerpt}」</p>
                    <Link href={`/p/${item.postId}`}>去看看并回应 →</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">
              还没有人回应。去广场看看，或给同行者的记录留一句话。
            </p>
          )}
        </section>

        <section className="proposal-card">
          <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>
            我参与过的
          </h2>
          {participation.length > 0 ? (
            <ul className="inbox-list">
              {participation.map((item) => (
                <li className="inbox-item" key={item.postId}>
                  <span className="inbox-avatar" aria-hidden="true">
                    {item.author.avatarEmoji}
                  </span>
                  <div>
                    <p className="inbox-head">
                      <strong>{item.author.displayName}</strong> 的记录
                      {item.newCommentCount > 0 ? (
                        <span className="new-pill">{item.newCommentCount} 条新回应</span>
                      ) : null}
                    </p>
                    <p className="inbox-post">「{item.excerpt}」</p>
                    <Link href={`/p/${item.postId}`}>回去看看 →</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">你还没有评论过别人的记录。</p>
          )}
        </section>
      </div>
    </div>
  );
}
