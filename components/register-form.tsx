"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COVENANT_ITEMS } from "@/lib/constants";
import { mutationFetch, readApiError } from "@/lib/client";

const AVATARS = ["🌱", "🌻", "🌿", "🌞", "🌙", "🐚", "🕊️", "🍊"];

type RegisterResponse = {
  ok?: boolean;
  message?: string;
  devVerifyUrl?: string | null;
  error?: string;
};

export function RegisterForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("🌱");
  const [covenant, setCovenant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisterResponse | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await mutationFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          email,
          password,
          displayName,
          avatarEmoji,
          covenant
        })
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setSuccess((await response.json()) as RegisterResponse);
    } catch {
      setError("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <section className="auth-card">
        <p className="eyebrow">Almost there</p>
        <h2>只差一封验证邮件</h2>
        <p>
          账号已经创建。验证邮箱后，就可以进入公开广场、发布自己的美好，并与成员共同维护这里。
        </p>
        {success.devVerifyUrl ? (
          <>
            <p className="form-success">当前是本地开发环境，可以直接打开下面的验证链接。</p>
            <a className="button button-primary" href={success.devVerifyUrl}>
              验证邮箱并继续
            </a>
          </>
        ) : (
          <p className="form-success">请查收验证邮件，再回到这里登录。</p>
        )}
        <p className="auth-switch">
          <Link href="/login">前往登录</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <h2>接受邀请</h2>
      <p>邀请码只使用一次。进入前，请先同意这里珍惜的东西。</p>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="inviteCode">邀请码</label>
          <input
            id="inviteCode"
            value={inviteCode}
            placeholder="MORROW-XXXX-XXXX"
            autoComplete="one-time-code"
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <span className="field-hint">至少 8 个字符。</span>
        </div>
        <div className="field">
          <label htmlFor="displayName">昵称</label>
          <input
            id="displayName"
            maxLength={24}
            value={displayName}
            placeholder="你希望被怎样称呼？"
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <span className="field-label">选择一个头像</span>
          <div className="avatar-picker" role="group" aria-label="头像选择">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={avatarEmoji === emoji ? "selected" : ""}
                aria-pressed={avatarEmoji === emoji}
                onClick={() => setAvatarEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">共同约定</span>
          <ul className="covenant-list">
            {COVENANT_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={covenant}
            onChange={(event) => setCovenant(event.target.checked)}
          />
          我已阅读并愿意遵守以上共同约定。
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={busy || !covenant}>
          {busy ? "正在创建…" : "带着邀请码加入"}
        </button>
      </form>
      <p className="auth-switch">
        已经有账号？ <Link href="/login">登录</Link>
      </p>
    </section>
  );
}
