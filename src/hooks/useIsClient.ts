"use client";

import { useSyncExternalStore } from "react";

/* "Has this rendered in a browser yet?" — for the two or three places that need
 * `document` before they can render at all, portals above all.
 *
 * The usual spelling is `useState(false)` plus `useEffect(() => setMounted(true))`,
 * which works but sets state synchronously from an effect to describe something
 * that was already true by the time the effect ran. `useSyncExternalStore` says
 * the same thing in the shape React provides for it: the server snapshot is
 * false, the client snapshot is true, and the switch happens as part of
 * hydration rather than as an extra render afterwards.
 */

const subscribe = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
