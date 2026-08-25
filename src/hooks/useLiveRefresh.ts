"use client";

import { useEffect, useRef } from "react";
import { LIVE_POLL_MS, LIVE_BACKOFF_MAX_MS } from "@/lib/livePoll";

/**
 * Runs `onChange` when the data behind the page has moved.
 *
 * Asks `/api/live` for a fingerprint on a timer and compares it with the last
 * one seen. The first answer is the baseline and never fires — a page that has
 * just rendered is already current, and refreshing it on arrival would make
 * every visit flicker.
 *
 * The callback is held in a ref rather than listed as a dependency. A caller
 * writing `useLiveRefresh({ scope: "me" }, () => reload())` passes a new
 * function on every render, and depending on it would tear the timer down and
 * build it again each time — a poller that resets before it ever fires.
 *
 * Three things keep it quiet, and they matter on a small server:
 *
 *   hidden tabs   a page nobody is looking at asks nothing, and checks once on
 *                 the way back so the answer is current the moment it is seen
 *   backoff       a failed poll doubles the wait, to a minute, and resets on the
 *                 first success. A restarting or recompiling server is not
 *                 helped by every open tab asking again immediately
 *   one in flight the next poll is scheduled when the last one lands, never on a
 *                 fixed drumbeat, so a slow answer cannot pile requests up
 *
 * A failure is not an event. The page keeps showing what it has, which is what
 * it would have shown anyway without any of this.
 */
export function useLiveRefresh(
  options: { scope: "me" | "profile" | "panel"; id?: string; enabled?: boolean },
  onChange: () => void
) {
  const { scope, id, enabled = true } = options;

  const onChangeRef = useRef(onChange);
  /* Assigned in an effect, not during render: a ref written while rendering is
     a side effect in the render phase, and React is right to object. The effect
     has no dependency list on purpose — it runs after every render, which is
     exactly when the latest callback should be recorded. */
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;
    if (scope === "profile" && !id) return;

    const url = `/api/live?scope=${encodeURIComponent(scope)}${id ? `&id=${encodeURIComponent(id)}` : ""}`;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let seen: string | null = null;
    let wait = LIVE_POLL_MS;

    const schedule = (ms: number) => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms);
    };

    async function run() {
      if (stopped) return;

      /* Nothing to do for a tab in the background. Re-armed rather than
         abandoned, because `visibilitychange` is the thing that wakes it. */
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        schedule(wait);
        return;
      }

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body: unknown = await res.json();
        const v =
          body && typeof body === "object" && typeof (body as { v?: unknown }).v === "string"
            ? (body as { v: string }).v
            : null;
        if (v === null) throw new Error("malformed");

        wait = LIVE_POLL_MS;

        if (seen === null) {
          seen = v; // baseline
        } else if (seen !== v) {
          seen = v;
          if (!stopped) onChangeRef.current();
        }
      } catch {
        /* Silent on purpose. This is a background convenience, and a console
           full of red from a poller is how real errors get missed. */
        wait = Math.min(wait * 2, LIVE_BACKOFF_MAX_MS);
      }

      schedule(wait);
    }

    /* Coming back to the tab is the moment the answer matters most, so ask at
       once rather than waiting out whatever remained of the interval. */
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule(0);
    };
    document.addEventListener("visibilitychange", onVisible);

    schedule(0);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [scope, id, enabled]);
}
