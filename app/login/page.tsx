import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ verified?: string; verify_error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const query = await searchParams;
  return (
    <div className="auth-page">
      <LoginForm
        verified={query.verified === "1"}
        verifyError={query.verify_error === "1"}
      />
    </div>
  );
}
