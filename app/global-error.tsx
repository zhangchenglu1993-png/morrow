"use client";

import Link from "next/link";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="error-page">
          <p className="eyebrow">Something went quiet</p>
          <h1>这里暂时没有回应。</h1>
          <p>页面遇到了一点问题。你的私密记录不会受到影响。</p>
          <button className="button button-primary" type="button" onClick={reset}>
            再试一次
          </button>
          <p>
            <Link href="/">回到广场</Link>
          </p>
        </div>
      </body>
    </html>
  );
}
