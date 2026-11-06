import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authGuard";
import { pendingCount } from "@/app/admin/challenges/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* GET /api/challenges/pending — how many submissions wait on this session.
   The number on the panel's "التحديات" link; a staff member counts only the
   trainees the coach gave them. */
export async function GET() {
  const auth = await requireAdmin("challenges.view");
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    { pending: await pendingCount(auth.session) },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
