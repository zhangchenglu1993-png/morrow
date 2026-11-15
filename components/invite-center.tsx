"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutationFetch, readApiError } from "@/lib/client";
import { formatDateTime } from "@/lib/time";
import type { AdminInvitationRow, InvitationRow, InviteeRow } from "@/lib/invites";

type Props = {
  invitations: InvitationRow[];
  invitees: InviteeRow[];
  activeCount: number;
  limit: number | null;
  isOwner: boolean;
  allInvitations: AdminInvitationRow[];
};

function statusOf(invitation: InvitationRow): string {
  if (invitation.used_by) return "已使用";
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return "已过期";
  return "可使用";
}

function inviteLink(code: string): string {
  return `${window.location.origin}/register?code=${encodeURIComponent(code)}`;
}

export function InviteCenter({
  invitations,
  invitees,
  activeCount,
  limit,
  isOwner,
  allInvitations
}: Props) {
  const router = useRouter();
  const [daysValid, setDaysValid] = useState(7);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const remaining = limit === null ? null : Math.max(0, limit - activeCount);
  const atLimit = remaining !== null && remaining <= 0;

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await mutationFetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysValid })
      });
      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }
      const data = (await response.json()) as { code: string };
      setNewCode(data.code);
      setMessage("邀请码已生成。它只能使用一次。");
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, note: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(note);
    } catch {
      setMessage("浏览器没有允许自动复制，请长按或手动选中复制。");
    }
  }

  async function share() {
    if (!newCode) return;
    const url = inviteLink(newCode);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Morrow · 点滴美好",
          text: "我在 Morrow 记录生活里的小美好，邀请你一起。",
          url
        });
        return;
      }
      await copy(url, "邀请链接已复制，发给想邀请的人就好。");
    } catch {
      // 取消系统分享时不提示。
    }
  }

  return (
    <div className="form-stack">
      <section className="proposal-card">
        <p className="eyebrow">Invite only</p>
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>生成一次性邀请码</h2>
        <p className="field-hint">
          {isOwner
            ? "你是产品负责人，可以随时生成邀请码，用于首批成员入场和运营兜底。"
            : `每位成员同时最多持有 ${limit} 个未使用的邀请码。其中一份被使用或过期后，就可以再生成新的。`}
        </p>
        <div className="field" style={{ maxWidth: 200 }}>
          <label htmlFor="days">有效期（天）</label>
          <input
            id="days"
            type="number"
            min={1}
            max={30}
            value={daysValid}
            onChange={(event) => setDaysValid(Number(event.target.value))}
          />
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || atLimit}
          onClick={() => void create()}
        >
          {busy ? "生成中…" : atLimit ? "已达持有上限" : "生成邀请码"}
        </button>
        {atLimit ? (
          <p className="field-hint">
            你已持有 {activeCount} 个未使用的邀请码，等其中一份被使用或过期后就能再生成。
          </p>
        ) : null}
        {newCode ? (
          <div className="invite-share">
            <div className="invite-code">
              <span>{newCode}</span>
              <button
                className="button button-ghost button-small"
                type="button"
                onClick={() => void copy(newCode, "邀请码已复制。它只能使用一次。")}
              >
                复制邀请码
              </button>
            </div>
            <div className="invite-actions">
              <button
                className="button button-sun button-small"
                type="button"
                onClick={() => void copy(inviteLink(newCode), "邀请链接已复制。")}
              >
                复制邀请链接
              </button>
              <button className="button button-ghost button-small" type="button" onClick={() => void share()}>
                分享给朋友
              </button>
            </div>
          </div>
        ) : null}
        {message ? <p className="form-success">{message}</p> : null}
      </section>

      <section className="proposal-card">
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>我的邀请码</h2>
        {invitations.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>前缀</th>
                  <th>创建时间</th>
                  <th>过期时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.code_prefix}••••</td>
                    <td>{formatDateTime(invitation.created_at)}</td>
                    <td>{formatDateTime(invitation.expires_at)}</td>
                    <td>{statusOf(invitation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="field-hint">还没有生成过邀请码。</p>
        )}
      </section>

      <section className="proposal-card">
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>
          通过我的邀请加入
        </h2>
        {invitees.length > 0 ? (
          <ul className="invitee-list">
            {invitees.map((invitee) => (
              <li key={invitee.id}>
                <span className="invitee-avatar" aria-hidden="true">
                  {invitee.avatarEmoji}
                </span>
                <span className="invitee-name">
                  <Link href={`/profile/${invitee.id}`}>{invitee.displayName}</Link>
                  <small>{formatDateTime(invitee.joinedAt)} 加入</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-hint">
            还没有人通过你的邀请加入。把链接发给一位你信任的朋友，就是一次真实的相遇。
          </p>
        )}
      </section>

      {isOwner ? (
        <section className="proposal-card">
          <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>全部邀请记录</h2>
          <p className="field-hint">
            这里只看得到邀请关系，看不到成员的内容。产品负责人不拥有隐藏、下架或修改成员内容的权力。
          </p>
          {allInvitations.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>前缀</th>
                    <th>创建人</th>
                    <th>创建时间</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {allInvitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td>{invitation.code_prefix}••••</td>
                      <td>{invitation.creatorName}</td>
                      <td>{formatDateTime(invitation.created_at)}</td>
                      <td>
                        {invitation.usedByName
                          ? `${invitation.usedByName} 已加入`
                          : statusOf(invitation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="field-hint">还没有生成邀请码。</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
