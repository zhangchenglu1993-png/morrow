"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutationFetch, readApiError } from "@/lib/client";

export function LoginForm({ verified, verifyError }: { verified: boolean; verifyError: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await mutationFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络没有连上，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!email) {
      setError("请先填写注册邮箱。");
      return;
    }
    setResendBusy(true);
    setResendMessage(null);
    try {
      const response = await mutationFetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const data = (await response.json()) as {
        message?: string;
        devVerifyUrl?: string | null;
      };
      setResendMessage(data.message ?? "验证邮件已重新发送。");
      setDevVerifyUrl(data.devVerifyUrl ?? null);
    } catch {
      setError("网络没有连上，请稍后再试。");
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <>
      <div className="auth-aside">
        <p className="hero-kicker">Welcome back</p>
        <h1>
          回到
          <br />
          点滴美好。
        </h1>
        <p>灯光还在，广场也还在。回来看看今天被认真留下的生活。</p>
      </div>
      <section className="auth-card">
        <h2>成员登录</h2>
        <p>用邀请时登记的邮箱进入。</p>
        {verified ? <p className="form-success">邮箱验证完成，现在可以登录了。</p> : null}
        {verifyError ? (
          <p className="form-error">验证链接无效或已过期，请重新获取。</p>
        ) : null}
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "验证中…" : "进入 Morrow"}
          </button>
        </form>
        <div style={{ marginTop: 16 }}>
          <button
            className="text-button"
            type="button"
            disabled={resendBusy}
            onClick={() => void resendVerification()}
          >
            {resendBusy ? "正在重新发送…" : "没有收到验证邮件？重新发送"}
          </button>
          {resendMessage ? <p className="form-success">{resendMessage}</p> : null}
          {devVerifyUrl ? (
            <a className="button button-ghost button-small" href={devVerifyUrl}>
              打开本地验证链接
            </a>
          ) : null}
        </div>
        <p className="auth-switch">
          还没有邀请码？ <Link href="/">先看看广场</Link>
        </p>
      </section>
    </>
  );
}
