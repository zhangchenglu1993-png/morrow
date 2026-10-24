"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutationFetch, readApiError } from "@/lib/client";
import { formatDateTime } from "@/lib/time";
import type { InvitationRow } from "@/lib/invites";

export function InviteManager({ invitations }: { invitations: InvitationRow[] }) {
  const router = useRouter();
  const [daysValid, setDaysValid] = useState(7);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      router.refresh();
    } catch {
      setMessage("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!newCode) return;
    await navigator.clipboard.writeText(newCode);
    setMessage("邀请码已复制。它只能使用一次。");
  }

  return (
    <div className="form-stack">
      <section className="proposal-card">
        <p className="eyebrow">Invite only</p>
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>生成一次性邀请码</h2>
        <p className="field-hint">
          邀请码默认 7 天有效，使用一次后立即失效。只有产品负责人可以生成。
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
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void create()}>
          {busy ? "生成中…" : "生成邀请码"}
        </button>
        {newCode ? (
          <div className="invite-code">
            <span>{newCode}</span>
            <button className="button button-ghost button-small" type="button" onClick={() => void copy()}>
              复制
            </button>
          </div>
        ) : null}
        {message ? <p className="form-success">{message}</p> : null}
      </section>

      <section className="proposal-card">
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)", fontSize: "1.4rem" }}>邀请记录</h2>
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
                    <td>
                      {invitation.used_by
                        ? "已使用"
                        : new Date(invitation.expires_at).getTime() <= Date.now()
                          ? "已过期"
                          : "可使用"}
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
    </div>
  );
}
