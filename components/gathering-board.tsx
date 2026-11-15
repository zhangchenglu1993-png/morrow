"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutationFetch, readApiError } from "@/lib/client";
import { formatDateTime } from "@/lib/time";
import type { GatheringView } from "@/lib/gatherings";

type Props = {
  upcoming: GatheringView[];
  past: GatheringView[];
  viewerId: string;
  passport: {
    count: number;
    recent: Array<{ id: string; title: string; startsAt: string }>;
  };
};

function defaultStart(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function MemoryForm({
  gatheringId,
  onDone
}: {
  gatheringId: string;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await mutationFetch(`/api/gatherings/${gatheringId}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text })
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setText("");
      onDone();
    } catch {
      setError("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="gather-memory-form" onSubmit={(event) => void submit(event)}>
      <label htmlFor={`memory-${gatheringId}`}>留下这次的美好</label>
      <textarea
        id={`memory-${gatheringId}`}
        rows={3}
        maxLength={1000}
        value={text}
        placeholder="今天一起做了什么？哪一刻让你觉得值得记住？"
        onChange={(event) => setText(event.target.value)}
      />
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button-sun button-small" type="submit" disabled={busy}>
        {busy ? "保存中…" : "留下共同记忆"}
      </button>
    </form>
  );
}

export function GatheringBoard({ upcoming, past, viewerId, passport }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [place, setPlace] = useState("");
  const [capacity, setCapacity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await mutationFetch("/api/gatherings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          place,
          note,
          startsAt: new Date(startsAt).toISOString(),
          capacity: capacity ? Number(capacity) : null
        })
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setTitle("");
      setPlace("");
      setNote("");
      setCapacity("");
      setStartsAt(defaultStart());
      setMessage("这件小事已经说定了。等同行的人来回应。");
      router.refresh();
    } catch {
      setError("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function toggleJoin(gathering: GatheringView) {
    setError(null);
    setMessage(null);
    try {
      const response = await mutationFetch(`/api/gatherings/${gathering.id}/join`, {
        method: gathering.isAttending ? "DELETE" : "POST"
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      router.refresh();
    } catch {
      setError("网络没有连上，请稍后再试。");
    }
  }

  async function cancelGathering(gatheringId: string) {
    if (!window.confirm("确定要取消这次小事吗？已经报名的人会看不到它。")) return;
    setError(null);
    try {
      const response = await mutationFetch(`/api/gatherings/${gatheringId}/cancel`, {
        method: "POST"
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      router.refresh();
    } catch {
      setError("网络没有连上，请稍后再试。");
    }
  }

  return (
    <div className="form-stack">
      <section className="proposal-card">
        <p className="eyebrow">Start something small</p>
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>发起一件小事</h2>
        <p className="field-hint">
          一件具体、轻松、能真正发生的事。发起并留下记录后计入爵位，参加也算一次真实贡献。
        </p>
        <form className="form-stack" onSubmit={(event) => void create(event)}>
          <div className="field">
            <label htmlFor="gather-title">想一起做什么</label>
            <input
              id="gather-title"
              maxLength={40}
              value={title}
              placeholder="例：周六傍晚去江边散步"
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="gather-row">
            <div className="field">
              <label htmlFor="gather-time">什么时候</label>
              <input
                id="gather-time"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="gather-capacity">人数上限</label>
              <select
                id="gather-capacity"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              >
                <option value="">不限</option>
                <option value="2">2 人</option>
                <option value="3">3 人</option>
                <option value="4">4 人</option>
                <option value="6">6 人</option>
                <option value="8">8 人</option>
                <option value="12">12 人</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="gather-place">在哪里</label>
            <input
              id="gather-place"
              maxLength={40}
              value={place}
              placeholder="例：滨江步道入口，或先写个大概"
              onChange={(event) => setPlace(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="gather-note">补充一句</label>
            <textarea
              id="gather-note"
              rows={2}
              maxLength={300}
              value={note}
              placeholder="可以带什么、怎么找到你，或者一句期待。"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "正在说定…" : "发起这件小事"}
          </button>
        </form>
      </section>

      <section className="proposal-card">
        <p className="eyebrow">Next</p>
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>
          接下来要发生的小事
        </h2>
        {upcoming.length > 0 ? (
          <div className="gather-list">
            {upcoming.map((gathering) => (
              <article className="gather-card" key={gathering.id}>
                <div className="gather-head">
                  <div>
                    <h3>{gathering.title}</h3>
                    <p className="gather-meta">
                      {formatDateTime(gathering.startsAt)}
                      {gathering.place ? ` · ${gathering.place}` : ""}
                      {gathering.capacity ? ` · ${gathering.attendees.length}/${gathering.capacity} 人` : ""}
                    </p>
                  </div>
                  <span className="gather-author">
                    {gathering.author.avatarEmoji} {gathering.author.displayName}
                  </span>
                </div>
                {gathering.note ? <p className="gather-note">{gathering.note}</p> : null}
                <div className="gather-people">
                  <span>谁会去：</span>
                  {gathering.attendees.map((person) => (
                    <span className="gather-person" key={person.id}>
                      {person.avatarEmoji} {person.displayName}
                    </span>
                  ))}
                </div>
                <div className="gather-actions">
                  {gathering.author.id === viewerId ? (
                    <button
                      className="button button-ghost button-small"
                      type="button"
                      onClick={() => void cancelGathering(gathering.id)}
                    >
                      取消这次小事
                    </button>
                  ) : (
                    <button
                      className={
                        gathering.isAttending
                          ? "button button-ghost button-small"
                          : "button button-sun button-small"
                      }
                      type="button"
                      onClick={() => void toggleJoin(gathering)}
                    >
                      {gathering.isAttending ? "不去了" : "我也去"}
                    </button>
                  )}
                  {gathering.isAttending ? (
                    <span className="field-hint">已经把你算进这次相聚。</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="field-hint">
            这周还没有约定。发起第一件小事，给熟悉的人一个见面的理由。
          </p>
        )}
      </section>

      {past.length > 0 ? (
        <section className="proposal-card">
          <p className="eyebrow">Remembered</p>
          <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>
            已经发生的小事
          </h2>
          <div className="gather-list">
            {past.map((gathering) => (
              <article className="gather-card" key={gathering.id}>
                <div className="gather-head">
                  <div>
                    <h3>{gathering.title}</h3>
                    <p className="gather-meta">
                      {formatDateTime(gathering.startsAt)}
                      {gathering.place ? ` · ${gathering.place}` : ""}
                      {` · ${gathering.attendees.length} 人参加`}
                    </p>
                  </div>
                  <span className="gather-author">
                    {gathering.author.avatarEmoji} {gathering.author.displayName}
                  </span>
                </div>
                {gathering.memory ? (
                  <div className="gather-memory">
                    <p>{gathering.memory.body}</p>
                    <Link href={`/p/${gathering.memory.postId}`}>看见这条记录 →</Link>
                  </div>
                ) : gathering.isAttending ? (
                  <MemoryForm gatheringId={gathering.id} onDone={() => router.refresh()} />
                ) : (
                  <p className="field-hint">这次相聚还没有留下记录。</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {passport.recent.length > 0 ? (
        <section className="proposal-card">
          <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>
            我的小事护照
          </h2>
          <p className="field-hint">
            已经留下 {passport.count} 次真实的相聚。它们属于你，不需要向谁证明。
          </p>
          <div className="stamp-row">
            {passport.recent.map((item) => (
              <span className="stamp" key={item.id}>
                {item.title}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
