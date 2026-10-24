"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CommentView } from "@/lib/queries";
import { mutationFetch, readApiError } from "@/lib/client";
import { formatDateTime } from "@/lib/time";

type Props = {
  postId: string;
  comments: CommentView[];
  currentUserId: string | null;
};

export function CommentSection({ postId, comments, currentUserId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2800);
    return () => clearTimeout(timer);
  }, [message]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const response = await mutationFetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function flag(commentId: string) {
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    try {
      const response = await mutationFetch(`/api/comments/${commentId}/flag`, {
        method: "POST"
      });
      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }
      setMessage("这条评论已交给社区共同判断。");
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    }
  }

  function startPress(commentId: string) {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => void flag(commentId), 700);
  }

  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  return (
    <section className="comments-card" aria-labelledby="comments-title">
      <h2 id="comments-title">真实回应 · {comments.length}</h2>
      {comments.length > 0 ? (
        <div className="comment-list">
          {comments.map((comment) => (
            <article
              className="comment-item"
              key={comment.id}
              tabIndex={0}
              onPointerDown={() => startPress(comment.id)}
              onPointerUp={clearPress}
              onPointerLeave={clearPress}
              onPointerCancel={clearPress}
              onContextMenu={(event) => {
                event.preventDefault();
                void flag(comment.id);
              }}
              onKeyDown={(event) => {
                if (event.shiftKey && event.key === "F10") {
                  event.preventDefault();
                  void flag(comment.id);
                }
              }}
              aria-label={`${comment.author.displayName} 的评论`}
            >
              <span className="comment-avatar" aria-hidden="true">
                {comment.author.avatarEmoji}
              </span>
              <div>
                <div className="comment-head">
                  <strong>{comment.author.displayName}</strong>
                  <span>
                    第 {comment.author.level} 级 · {comment.author.title}
                  </span>
                  <span>{formatDateTime(comment.createdAt)}</span>
                </div>
                <p className="comment-body">{comment.body}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="field-hint">还没有评论。留下第一句真诚的回应。</p>
      )}

      {currentUserId ? (
        <form className="comment-form" onSubmit={(event) => void submit(event)}>
          <textarea
            value={body}
            maxLength={500}
            placeholder="写下真实、温柔的回应…"
            aria-label="评论内容"
            onChange={(event) => setBody(event.target.value)}
          />
          <button className="button button-primary" type="submit" disabled={busy || !body.trim()}>
            {busy ? "发送中…" : "回应"}
          </button>
        </form>
      ) : (
        <p className="field-hint">
          登录后可以回应。评论支持文字和表情，不支持外部链接。
        </p>
      )}
      <p className="field-hint">长按评论，可把它交给社区共同判断。</p>
      {message ? <div className="toast" role="status">{message}</div> : null}
    </section>
  );
}
