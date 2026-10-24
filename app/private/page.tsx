import { redirect } from "next/navigation";
import { PrivateJournal } from "@/components/private-journal";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrivatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="private-shell">
      <p className="page-kicker">A room with no audience</p>
      <h1 className="page-title">只属于你的安静角落</h1>
      <p className="page-subtitle">
        有些话还没想好要不要说，有些感受只需要被自己听见。这里不参与广场、精选或爵位。
      </p>
      <PrivateJournal />
    </div>
  );
}
