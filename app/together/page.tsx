import { redirect } from "next/navigation";
import { GatheringBoard } from "@/components/gathering-board";
import { getCurrentUser } from "@/lib/auth";
import { getGatheringPassport, listGatherings } from "@/lib/gatherings";

export const dynamic = "force-dynamic";

export default async function TogetherPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { upcoming, past } = listGatherings(user.id);
  const passport = getGatheringPassport(user.id);

  return (
    <div className="narrow-page">
      <p className="page-kicker">Do something together</p>
      <h1 className="page-title">一起做件小事</h1>
      <p className="page-subtitle">
        不必等到正式聚会。散步、看展、喝一杯咖啡，约上熟悉的人，把线上的相伴变成真实的相见。
      </p>
      <div className="proposal-meta" style={{ marginBottom: 24 }}>
        <span>接下来：{upcoming.length} 件小事</span>
        <span>我的小事护照：{passport.count} 次</span>
      </div>
      <GatheringBoard
        upcoming={upcoming}
        past={past}
        viewerId={user.id}
        passport={passport}
      />
    </div>
  );
}
