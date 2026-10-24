import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-page">
      <p className="eyebrow">Not found</p>
      <h1>这一页不在这里。</h1>
      <p>它可能已经被作者删除，或被社区反馈隐藏。</p>
      <Link className="button button-primary" href="/">
        回到广场
      </Link>
    </div>
  );
}
