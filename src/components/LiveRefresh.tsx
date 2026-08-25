"use client";

import { useRouter } from "next/navigation";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

/**
 * Keeps a server-rendered page current without a reload.
 *
 * Drop it anywhere on a page whose data comes from server components and it
 * calls `router.refresh()` when that data changes. Renders nothing.
 *
 *   <LiveRefresh scope="profile" id={profile.id} />   one trainee's screen
 *   <LiveRefresh scope="panel" />                     the coach's own screens
 *
 * `router.refresh()` re-runs the server components and reconciles the result
 * into the page that is already there. It is not a reload: the scroll position
 * stays, open dialogs stay open, and client state — a half-typed search box, a
 * selected tab — survives, because those components are not remounted. That is
 * the whole reason this is the mechanism and `location.reload()` is not.
 *
 * Not for pages where the coach is composing something. The programme builder,
 * the diet builder and the content manager hold unsaved work in client state
 * that is seeded from server props, and a refresh arriving mid-edit is a class
 * of bug not worth inviting for a screen nobody is watching for changes anyway.
 */
export default function LiveRefresh({
  scope,
  id,
  enabled = true,
}: {
  scope: "me" | "profile" | "panel";
  id?: string;
  enabled?: boolean;
}) {
  const router = useRouter();
  useLiveRefresh({ scope, id, enabled }, () => router.refresh());
  return null;
}
