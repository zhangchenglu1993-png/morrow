import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = {
  title: {
    default: "Morrow · 点滴美好",
    template: "%s · Morrow"
  },
  description: "把今天的美好，留给明天。",
  robots: {
    index: false,
    follow: false,
    nocache: true
  },
  icons: {
    icon: "/favicon.svg"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/" aria-label="Morrow 首页">
              <span className="brand-mark" aria-hidden="true">
                <span className="brand-sun" />
                <span className="brand-leaf" />
              </span>
              <span>
                <strong>Morrow</strong>
                <small>点滴美好</small>
              </span>
            </Link>
            <nav className="nav-links" aria-label="主要导航">
              <Link href="/">广场</Link>
              <Link href="/leaderboard">爵位榜</Link>
              <Link href="/governance">共同治理</Link>
              {user ? <Link href="/private">私密区</Link> : null}
              {user?.role === "owner" ? <Link href="/admin/invites">邀请</Link> : null}
            </nav>
            <div className="header-actions">
              {user ? (
                <>
                  <Link className="user-chip" href={`/profile/${user.id}`}>
                    <span aria-hidden="true">{user.avatarEmoji}</span>
                    <span>{user.displayName}</span>
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link className="button button-ghost button-small" href="/login">
                    登录
                  </Link>
                  <Link className="button button-primary button-small" href="/register">
                    接受邀请
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <span>Morrow · 点滴美好</span>
          <span>Small joys, kept for tomorrow.</span>
          <span>真实记录，共同守护。</span>
        </footer>
      </body>
    </html>
  );
}
