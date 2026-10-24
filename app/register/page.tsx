import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const query = await searchParams;
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <p className="hero-kicker">An invitation to notice</p>
        <h1>
          世界很吵，
          <br />
          这里可以先
          <br />
          安静一点。
        </h1>
        <p>
          你收到的不只是一个账号邀请，而是一份共同约定：只记录真实生活，只留下美好，也愿意和所有人一起守护它。
        </p>
      </aside>
      <RegisterForm initialCode={(query.code ?? "").toUpperCase()} />
    </div>
  );
}
