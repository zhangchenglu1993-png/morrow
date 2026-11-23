import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { getInboxUnreadCount } from "@/lib/relationships";
import { LogoutButton } from "@/components/logout-button";
import { InstallPrompt } from "@/components/install-prompt";
import { PwaRegister } from "@/components/pwa-register";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Morrow",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#F7F3E8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const inboxUnread = user ? getInboxUnreadCount(user.id) : 0;
  const icpNumber = process.env.MORROW_ICP_NUMBER?.trim() ?? "";
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
              {user ? <Link href="/together">一起</Link> : null}
              {user ? <Link href="/calendar">日历</Link> : null}
              <Link href="/leaderboard">爵位榜</Link>
              <Link href="/governance">共同治理</Link>
              {user ? <Link href="/private">私密区</Link> : null}
              {user ? <Link href="/invites">邀请</Link> : null}
              {user ? <Link href="/people">同行者</Link> : null}
              {user ? (
                <Link href="/inbox">
                  回应
                  {inboxUnread > 0 ? <span className="nav-badge">{inboxUnread}</span> : null}
                </Link>
              ) : null}
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
          {icpNumber ? (
            <a
              className="icp-link"
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {icpNumber}
            </a>
          ) : null}
        </footer>
        <PwaRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
