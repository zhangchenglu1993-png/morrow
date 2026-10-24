import { redirect } from "next/navigation";
import { Composer } from "@/components/composer";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentPrompt } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prompt = getCurrentPrompt();
  return (
    <div className="composer-page">
      <p className="page-kicker">A moment worth keeping</p>
      <h1 className="page-title">留下一份真实的美好</h1>
      <p className="page-subtitle">
        不需要完整，也不需要漂亮。只要它是真的，就已经值得被留下。
      </p>
      <Composer promptDay={prompt.day} promptQuestion={prompt.question} />
    </div>
  );
}
