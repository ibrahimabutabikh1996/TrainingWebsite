"use client";

import { useSyncExternalStore } from "react";

/* Reading the clock during a render.
 *
 * `Date.now()` called straight from a component body makes that render
 * non-idempotent: React may render the same component twice and get two
 * answers, which is what `react-hooks/purity` objects to. The clock is an
 * external mutable source, and `useSyncExternalStore` is the hook for reading
 * one safely — provided the snapshot it returns is stable between calls, or
 * React re-renders forever chasing a value that never settles.
 *
 * So the snapshot is held still and refreshed at most once a minute. Everything
 * this feeds — days since a subscription started, whether it has run out — moves
 * in days, so a clock that is up to a minute stale gives the same answer as one
 * that is not, and a component that renders three times in a tick sees one time
 * rather than three.
 *
 * Nothing subscribes: no re-render is scheduled when the minute rolls over, and
 * none is wanted. The next render for any other reason reads the newer value.
 */

let snapshot = 0;
const REFRESH_MS = 60_000;

function getSnapshot(): number {
  const now = Date.now();
  if (now - snapshot > REFRESH_MS) snapshot = now;
  return snapshot;
}

/* The server has its own clock and its own render; pinning the server snapshot
   to 0 would date every subscription to 1970 in the server-rendered HTML. These
   callers are all client components whose first paint is on the client. */
const getServerSnapshot = getSnapshot;

const subscribe = () => () => {};

/** Unix milliseconds, stable within a render and refreshed at most once a minute. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
