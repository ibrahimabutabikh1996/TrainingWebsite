"use client";

/* What the browser is allowed to believe about who is signed in: the username,
 * and nothing else.
 *
 * This is for drawing the interface — "sign out" instead of "sign in", the
 * coach's link instead of the trainee's. It is read from a plain cookie that
 * anyone can edit, and editing it gains nothing at all: the session cookie the
 * server actually checks is httpOnly and signed, and every page, route and
 * action re-derives identity from that instead.
 *
 * So: never gate anything on these. If a decision matters, it belongs on the
 * server, where `@/lib/authGuard` can answer it.
 */

import { useSyncExternalStore } from "react";
import { USER_HINT_COOKIE } from "@/lib/sessionCookies";
import { isAdminUsername } from "@/lib/adminUsernames";

export { isAdminUsername };

/** The signed-in username as far as the browser can tell, or null. */
export function currentUsername(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${USER_HINT_COOKIE}=`));
  if (!match) return null;

  const raw = match.slice(USER_HINT_COOKIE.length + 1);
  if (!raw) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/** Whether the interface should show the coach's panel. Cosmetic only. */
export function looksLikeAdmin(): boolean {
  return isAdminUsername(currentUsername());
}

/* ------------------------------------------------------------------ *
 * Reading it from a component
 * ------------------------------------------------------------------ */

/* A cookie fires no event when it changes, so signing out has to say so. The
   alternative — each screen copying the value into state inside an effect — is
   what these pages used to do with localStorage, and it renders once with the
   wrong answer every time. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Call after signing out, so anything showing the username stops showing it. */
export function notifySessionChanged(): void {
  listeners.forEach((notify) => notify());
}

/**
 * The signed-in username, as a hook.
 *
 * The server snapshot is null so the server render and the first client render
 * agree — the cookie is not readable during SSR, and claiming otherwise is a
 * hydration mismatch.
 */
export function useCurrentUsername(): string | null {
  return useSyncExternalStore(subscribe, currentUsername, () => null);
}
