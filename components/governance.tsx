"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { mutationFetch, readApiError } from "@/lib/client";
import {
  SETTING_OPTIONS,
  type ProposalKind,
  type ProposalView,
  type VoteChoice
} from "@/lib/governance-shared";
import { formatDateTime } from "@/lib/time";

const STATUS_LABEL: Record<ProposalView["status"], string> = {
  collecting: "征集聚同",
  discussion: "讨论中",
  voting: "投票中",
  passed: "已通过",
  rejected: "未通过"
};

export function ProposalComposer() {
  const router = useRouter();
  const [kind, setKind] = useState<ProposalKind>("normal");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [settingKey, setSettingKey] = useState("");
  const [settingValue, setSettingValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await mutationFetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          body,
          settingKey: settingKey || null,
          settingValue: settingValue || null
        })
      });
      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }
      setTitle("");
      setBody("");
      setSettingKey("");
      setSettingValue("");
      setMessage("提案已提交。达到联署人数后进入讨论。");
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="proposal-card form-stack" onSubmit={(event) => void submit(event)}>
      <div>
        <p className="eyebrow">Your voice belongs here</p>
        <h2 style={{ margin: 0, fontFamily: "var(--serif)" }}>提出一条共同规则</h2>
        <p className="field-hint">所有人都能参与讨论；真正生效前需要社区联署和投票。</p>
      </div>
      <div className="field">
        <label htmlFor="proposal-kind">提案类型</label>
        <select
          id="proposal-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as ProposalKind)}
        >
          <option value="normal">普通规则 · 一人一票</option>
          <option value="major">重大方向 · 高等级加权</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="proposal-title">标题</label>
        <input
          id="proposal-title"
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：把内容隐藏门槛调整为 12 人"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="proposal-body">说明与理由</label>
        <textarea
          id="proposal-body"
          maxLength={3000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="说清楚希望改变什么、为什么改变，以及可能带来的影响。"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="setting-key">可自动执行的规则项（可选）</label>
        <select
          id="setting-key"
          value={settingKey}
          onChange={(event) => setSettingKey(event.target.value)}
        >
          <option value="">仅形成社区决定，不自动改参数</option>
          {SETTING_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {settingKey ? (
        <div className="field">
          <label htmlFor="setting-value">新的数值</label>
          <input
            id="setting-value"
            type="number"
            value={settingValue}
            onChange={(event) => setSettingValue(event.target.value)}
            required
          />
          <span className="field-hint">
            {settingKey === "negative_hide_ratio_percent"
              ? "填写百分比数字，例如 20。"
              : "填写整数数值。"}
          </span>
        </div>
      ) : null}
      {message ? <p className="form-success">{message}</p> : null}
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "提交中…" : "提交提案"}
      </button>
    </form>
  );
}

export function ProposalCard({
  proposal,
  currentUserId,
  currentUserLevel,
  eligibleVoters
}: {
  proposal: ProposalView;
  currentUserId: string | null;
  currentUserLevel: number;
  eligibleVoters: number;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const quorum = Math.max(1, Math.ceil(eligibleVoters * 0.5));

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2800);
    return () => clearTimeout(timer);
  }, [message]);

  async function mutate(url: string, init: RequestInit) {
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const response = await mutationFetch(url, init);
      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function vote(choice: VoteChoice) {
    await mutate(`/api/proposals/${proposal.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice })
    });
  }

  async function endorse() {
    await mutate(`/api/proposals/${proposal.id}/endorse`, { method: "POST" });
  }

  async function closeDiscussion() {
    await mutate(`/api/proposals/${proposal.id}/close-discussion`, { method: "POST" });
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    await mutate(`/api/proposals/${proposal.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment })
    });
    setComment("");
  }

  return (
    <article className="proposal-card">
      <div className="proposal-head">
        <div>
          <p className="eyebrow">{proposal.kind === "normal" ? "普通规则" : "重大方向"}</p>
          <h2>{proposal.title}</h2>
        </div>
        <span className="proposal-status">{STATUS_LABEL[proposal.status]}</span>
      </div>
      <p className="proposal-body">{proposal.body}</p>
      {proposal.settingKey ? (
        <p className="field-hint">
          可执行变更：{SETTING_OPTIONS.find((item) => item.key === proposal.settingKey)?.label} →{" "}
          {proposal.settingKey === "negative_hide_ratio_percent"
            ? `${Math.round(Number(proposal.settingValue) * 100)}%`
            : proposal.settingValue}
        </p>
      ) : null}
      <div className="proposal-meta">
        <span>{proposal.author.avatarEmoji} {proposal.author.displayName}</span>
        <span>第 {proposal.author.level} 级 · {proposal.author.title}</span>
        <span>联署 {proposal.endorsements}/{proposal.requiredEndorsements}</span>
        <span>投票法定人数 {quorum}</span>
        {proposal.discussionEndsAt && proposal.status === "discussion" ? (
          <span>讨论至 {formatDateTime(proposal.discussionEndsAt)}</span>
        ) : null}
        {proposal.voteEndsAt && proposal.status === "voting" ? (
          <span>投票至 {formatDateTime(proposal.voteEndsAt)}</span>
        ) : null}
      </div>

      {proposal.status === "collecting" && currentUserId && !proposal.myEndorsement ? (
        <div className="vote-row">
          <button className="button button-ghost button-small" type="button" disabled={busy} onClick={() => void endorse()}>
            联署这条提案
          </button>
        </div>
      ) : null}

      {proposal.status === "discussion" && currentUserId && currentUserLevel >= 17 ? (
        <div className="vote-row">
          <button className="button button-ghost button-small" type="button" disabled={busy} onClick={() => void closeDiscussion()}>
            主持并结束讨论，进入投票
          </button>
        </div>
      ) : null}

      {proposal.status === "voting" ? (
        <div className="vote-row">
          {(["yes", "no", "abstain"] as VoteChoice[]).map((choice) => (
            <button
              key={choice}
              className={`button button-small ${proposal.myVote === choice ? "button-primary selected" : "button-ghost"}`}
              type="button"
              disabled={busy}
              onClick={() => void vote(choice)}
            >
              {choice === "yes" ? "赞成" : choice === "no" ? "反对" : "弃权"}
            </button>
          ))}
          <span className="field-hint">
            当前：赞成 {proposal.votes.yes} · 反对 {proposal.votes.no} · 已投 {proposal.votes.voters}
          </span>
        </div>
      ) : null}

      {proposal.comments.length > 0 ? (
        <div className="comment-list" style={{ marginTop: 18 }}>
          {proposal.comments.map((item) => (
            <div className="comment-item" key={item.id}>
              <span className="comment-avatar" aria-hidden="true">{item.authorEmoji}</span>
              <div>
                <div className="comment-head">
                  <strong>{item.authorName}</strong>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
                <p className="comment-body">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {currentUserId && ["collecting", "discussion", "voting"].includes(proposal.status) ? (
        <form className="comment-form" onSubmit={(event) => void submitComment(event)}>
          <textarea
            value={comment}
            maxLength={800}
            placeholder="补充事实、顾虑或修改建议…"
            aria-label="提案讨论"
            onChange={(event) => setComment(event.target.value)}
          />
          <button className="button button-ghost" type="submit" disabled={busy || !comment.trim()}>
            发言
          </button>
        </form>
      ) : null}
      {message ? <p className="form-error">{message}</p> : null}
    </article>
  );
}
