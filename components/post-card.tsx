"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FEEDBACK_REASONS,
  REACTIONS,
  type FeedbackReason,
  type ReactionType
} from "@/lib/constants";
import { formatDateTime } from "@/lib/time";
import { promptForDay } from "@/lib/prompts";
import { mutationFetch, readApiError } from "@/lib/client";
import type { PostView } from "@/lib/queries";

type Props = {
  post: PostView;
  currentUserId: string | null;
  featured?: boolean;
  showLink?: boolean;
};

export function PostCard({ post, currentUserId, featured, showLink = true }: Props) {
  const router = useRouter();
  const [busyReaction, setBusyReaction] = useState<ReactionType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [submittingFlag, setSubmittingFlag] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const isAuthor = currentUserId === post.author.id;
  const prompt = promptForDay(post.promptDay ?? 1);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2800);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  function requireLogin(): boolean {
    if (currentUserId) return true;
    router.push("/login");
    return false;
  }

  async function react(type: ReactionType) {
    if (!requireLogin()) return;
    setBusyReaction(type);
    try {
      const response = await mutationFetch(`/api/posts/${post.id}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    } finally {
      setBusyReaction(null);
    }
  }

  function startPress(event: React.PointerEvent) {
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setMenuOpen(true), 600);
  }

  function movePress(event: React.PointerEvent) {
    if (!pressOrigin.current) return;
    const distance = Math.hypot(
      event.clientX - pressOrigin.current.x,
      event.clientY - pressOrigin.current.y
    );
    if (distance > 8) clearPress();
  }

  function clearPress() {
    pressOrigin.current = null;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function toggleReason(reason: FeedbackReason) {
    setReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason]
    );
  }

  async function submitFlag() {
    if (!requireLogin()) return;
    if (reasons.length === 0) {
      setMessage("请选择至少一个反馈原因。");
      return;
    }
    setSubmittingFlag(true);
    try {
      const response = await mutationFetch(`/api/posts/${post.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons })
      });
      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }
      setMenuOpen(false);
      setReasons([]);
      setMessage("反馈已交给社区共同判断。");
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    } finally {
      setSubmittingFlag(false);
    }
  }

  async function deletePost() {
    if (!isAuthor) return;
    if (!window.confirm("确定删除这条内容吗？删除后无法恢复。")) return;
    const response = await mutationFetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage(await readApiError(response));
      return;
    }
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  const mediaClass = post.media.length === 1 ? "media-grid single" : "media-grid";

  return (
    <article
      className={`post-card${featured ? " featured" : ""}`}
      tabIndex={0}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.shiftKey && event.key === "F10") {
          event.preventDefault();
          setMenuOpen(true);
        }
      }}
      aria-label={`${post.author.displayName} 发布的美好时刻`}
    >
      <div
        className="post-press-zone"
        onPointerDown={startPress}
        onPointerUp={clearPress}
        onPointerMove={movePress}
        onPointerCancel={clearPress}
        onPointerLeave={clearPress}
      >
        <header className="post-head">
          <Link
            className="avatar"
            href={`/profile/${post.author.id}`}
            aria-label={`查看 ${post.author.displayName} 的主页`}
          >
            {post.author.avatarEmoji}
          </Link>
          <div className="post-author">
            <div className="author-line">
              <Link href={`/profile/${post.author.id}`}>
                <strong>{post.author.displayName}</strong>
              </Link>
              <span className="rank-pill">
                第 {post.author.rank.current.level} 级 · {post.author.rank.current.title}
              </span>
            </div>
            <p className="post-time">{formatDateTime(post.createdAt)}</p>
          </div>
        </header>

        {post.promptDay ? (
          <p className="post-prompt">回应第 {post.promptDay} 天 · {prompt.question}</p>
        ) : null}

        {post.status === "hidden" ? (
          <p className="hidden-banner">这条内容已由社区反馈隐藏，仅你可见。</p>
        ) : null}

        {post.body ? <div className="post-body">{post.body}</div> : null}
      </div>

      {post.media.length > 0 ? (
        <div className={mediaClass}>
          {post.media.map((media) =>
            media.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={media.id}
                src={`/api/media/${media.id}`}
                alt={`${post.author.displayName} 分享的照片`}
                loading="lazy"
              />
            ) : (
              <video
                key={media.id}
                src={`/api/media/${media.id}`}
                controls
                playsInline
                preload="metadata"
              />
            )
          )}
        </div>
      ) : null}

      <div className="post-actions" aria-label="内容反馈">
        <div className="reaction-row">
          {REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              className={`reaction-button${post.myReaction === reaction.type ? " selected" : ""}`}
              type="button"
              aria-label={`${reaction.label}，${post.reactionCounts[reaction.type]} 人`}
              aria-pressed={post.myReaction === reaction.type}
              disabled={busyReaction !== null || post.status === "hidden"}
              onClick={() => void react(reaction.type)}
            >
              <span className="reaction-icon" aria-hidden="true">
                {reaction.emoji}
              </span>
              <span className="reaction-count">{post.reactionCounts[reaction.type]}</span>
            </button>
          ))}
        </div>
        {showLink ? (
          <Link className="post-meta-link" href={`/p/${post.id}`}>
            评论 {post.commentCount}
          </Link>
        ) : null}
      </div>

      {menuOpen ? (
        <div
          className="action-backdrop"
          role="presentation"
          onClick={() => setMenuOpen(false)}
        >
          <section
            className="action-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`feedback-${post.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={`feedback-${post.id}`}>交给社区共同判断</h3>
            <p>反馈不展示你的身份。达到社区比例后，内容会自动隐藏。</p>
            <div className="reason-list">
              {FEEDBACK_REASONS.map((reason) => (
                <label className="reason-option" key={reason.value}>
                  <input
                    type="checkbox"
                    checked={reasons.includes(reason.value)}
                    onChange={() => toggleReason(reason.value)}
                  />
                  {reason.label}
                </label>
              ))}
            </div>
            <div className="sheet-actions">
              {isAuthor ? (
                <button className="button button-danger button-small" type="button" onClick={() => void deletePost()}>
                  删除内容
                </button>
              ) : null}
              <button className="button button-ghost button-small" type="button" onClick={() => setMenuOpen(false)}>
                取消
              </button>
              <button
                className="button button-primary button-small"
                type="button"
                disabled={submittingFlag}
                onClick={() => void submitFlag()}
              >
                {submittingFlag ? "提交中…" : "提交反馈"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {message ? <div className="toast" role="status">{message}</div> : null}
    </article>
  );
}
