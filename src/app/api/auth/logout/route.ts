import { NextResponse } from "next/server";
import { endSession } from "@/lib/authGuard";

export const dynamic = "force-dynamic";

/* Signing out is now a server matter: the session cookie is httpOnly, so the
   browser cannot clear it on its own the way it used to clear `localStorage`.
 *
 * No auth check — asking to be signed out is not a privileged request, and
 * refusing it for an already-expired cookie would leave the stale hint cookie
 * behind on exactly the visitors who most need it gone. */
export async function POST() {
  await endSession();
  return NextResponse.json({ success: true });
}
