import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const row = getDb().prepare("SELECT 1 AS ok").get() as { ok: number };
  return Response.json(
    { ok: row.ok === 1, service: "morrow", time: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    }
  );
}
