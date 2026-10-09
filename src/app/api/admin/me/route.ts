import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authGuard";

/* What the panel's navigation should draw for whoever is signed in: everything
   for the coach, a staff member's own grant otherwise. Drawing only — every
   screen and action behind those links checks for itself. */
export async function GET() {
  const auth = await requireAdmin("any");
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      isOwner: auth.session.isAdmin,
      permissions: auth.session.isAdmin ? [] : (auth.session.permissions ?? []),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
