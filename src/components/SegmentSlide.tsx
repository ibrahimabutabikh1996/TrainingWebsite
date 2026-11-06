"use client";

import { useEffect } from "react";

/* The selected look of a segmented control slides from the old choice to the
 * new one instead of jumping.
 *
 * Mounted once in the root layout, like GlassPointer, so no screen had to
 * change. At rest nothing here exists: the selected button paints its own lit
 * look, exactly as before. Only while the selection moves (--dur-slow) does
 * the track carry a `::before` pill that wears the new button's look and
 * travels from the old button to the new one; then it goes and the real button
 * takes over. That is why resizing, wrapping, scrolling tracks and per-item
 * tones (training days, staff levels) need nothing special.
 *
 *   data-seg-slide     on the track while its pill is showing
 *   data-seg-instant   on the track for the one frame the pill is placed
 *   data-seg-pos       on a track that was `position: static`, while sliding
 *   data-seg-snap      on the new button: its own transitions are off, so its
 *                      look can be read at its final value
 *   data-seg-arriving  on the new button: its fill is hidden under the pill
 *   --seg-*            the pill's box and look, on the track
 *
 * Positions are offsetLeft/Top, physical pixels in the track's own frame, and
 * the pill sits at physical `left: 0; top: 0` — the same frame — so RTL and a
 * scrolled track need no correction. Data attributes, not classes: React
 * rewrites `className` whenever a selected class changes and would drop ours.
 *
 * The styles are the "Sliding selection" block in src/styles/lit/primitives.css.
 * Off entirely under reduced motion: the switch stays instant.
 */

/** Tracks whose selection slides — kept in step with primitives.css. */
const TRACK =
  ".ui-segment, .co-segment, .ex-segment, .diet-segment, .sa-segments, " +
  ".chl-tabs, .dplan-tabs, .cms-sidebar, .staff-segment, .wl-days";

/** What "selected" looks like on an item, in any of the tracks above. */
const ACTIVE =
  '[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], .is-active, .active';

const ARIA = ["aria-pressed", "aria-selected", "aria-checked"];

/** Did this attribute's old value mean "selected"? */
const wasActive = (r: MutationRecord) =>
  r.attributeName === "class"
    ? (r.oldValue ?? "").split(/\s+/).some((c) => c === "is-active" || c === "active")
    : r.oldValue === "true";

type Box = { x: number; y: number; w: number; h: number };

const boxOf = (el: HTMLElement): Box => ({
  x: el.offsetLeft,
  y: el.offsetTop,
  w: el.offsetWidth,
  h: el.offsetHeight,
});

const setBox = (track: HTMLElement, b: Box) => {
  track.style.setProperty("--seg-x", `${b.x}px`);
  track.style.setProperty("--seg-y", `${b.y}px`);
  track.style.setProperty("--seg-w", `${b.w}px`);
  track.style.setProperty("--seg-h", `${b.h}px`);
};

/** Where the pill is now, mid-flight — so a second quick click starts there. */
const pillBox = (track: HTMLElement): Box | null => {
  const cs = getComputedStyle(track, "::before");
  const m = cs.transform.match(/matrix\(([^)]+)\)/);
  if (!m) return null;
  const v = m[1].split(",").map(Number);
  return { x: v[4], y: v[5], w: parseFloat(cs.width), h: parseFloat(cs.height) };
};

const LOOK: [string, keyof CSSStyleDeclaration][] = [
  ["--seg-bgc", "backgroundColor"],
  ["--seg-bgi", "backgroundImage"],
  ["--seg-bgo", "backgroundOrigin"],
  ["--seg-bgcl", "backgroundClip"],
  ["--seg-bgp", "backgroundPosition"],
  ["--seg-bgs", "backgroundSize"],
  ["--seg-bgr", "backgroundRepeat"],
  ["--seg-bw", "borderTopWidth"],
  ["--seg-bc", "borderTopColor"],
  ["--seg-r", "borderTopLeftRadius"],
  ["--seg-sh", "boxShadow"],
];

const ATTRS = ["data-seg-slide", "data-seg-instant", "data-seg-pos"];
const ITEM_ATTRS = ["data-seg-snap", "data-seg-arriving"];
const SEG_VARS = ["--seg-x", "--seg-y", "--seg-w", "--seg-h", ...LOOK.map(([v]) => v)];

export default function SegmentSlide() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /** The item each sliding track is heading to, and a token for its run. */
    const arriving = new WeakMap<HTMLElement, HTMLElement>();
    const runs = new WeakMap<HTMLElement, number>();
    let seq = 0;

    const finish = (track: HTMLElement, run: number) => {
      if (runs.get(track) !== run) return;
      runs.delete(track);
      const to = arriving.get(track);
      arriving.delete(track);
      /* The fill comes back while the item's transitions are still off, so
         it appears at once rather than fading in over the pill's hand-off. */
      to?.removeAttribute("data-seg-arriving");
      if (to) void to.offsetWidth;
      to?.removeAttribute("data-seg-snap");
      ATTRS.forEach((a) => track.removeAttribute(a));
      SEG_VARS.forEach((v) => track.style.removeProperty(v));
    };

    const slide = (track: HTMLElement, from: HTMLElement, to: HTMLElement) => {
      const midFlight = track.hasAttribute("data-seg-slide") ? pillBox(track) : null;

      const prev = arriving.get(track);
      if (prev && prev !== to) ITEM_ATTRS.forEach((a) => prev.removeAttribute(a));

      /* Read the new item's look at its final value, before hiding it. */
      to.setAttribute("data-seg-snap", "");
      const cs = getComputedStyle(to);
      LOOK.forEach(([v, p]) => track.style.setProperty(v, String(cs[p])));

      if (getComputedStyle(track).position === "static") track.setAttribute("data-seg-pos", "");

      track.setAttribute("data-seg-instant", "");
      track.setAttribute("data-seg-slide", "");
      setBox(track, midFlight ?? boxOf(from));
      to.setAttribute("data-seg-arriving", "");
      arriving.set(track, to);
      void track.offsetWidth;

      track.removeAttribute("data-seg-instant");
      setBox(track, boxOf(to));

      const run = ++seq;
      runs.set(track, run);
      const ms = parseFloat(getComputedStyle(track, "::before").transitionDuration) * 1000 || 0;
      window.setTimeout(() => finish(track, run), ms + 60);
    };

    const onEnd = (e: TransitionEvent) => {
      if (e.pseudoElement !== "::before" || e.propertyName !== "transform") return;
      const track = e.target as HTMLElement;
      const run = runs.get(track);
      if (run !== undefined) finish(track, run);
    };

    const observer = new MutationObserver((records) => {
      /* One React commit can flip several attributes on two items; collect the
         item that stopped being selected, per track, then act once. */
      const left = new Map<HTMLElement, HTMLElement>();
      for (const r of records) {
        const item = r.target as HTMLElement;
        const track = item.parentElement;
        if (!track?.matches(TRACK)) continue;
        if (wasActive(r) && !item.matches(ACTIVE)) left.set(track, item);
      }
      left.forEach((from, track) => {
        const to = Array.from(track.children).find((c) => c.matches(ACTIVE)) as HTMLElement | undefined;
        if (to && to !== from && from.isConnected) slide(track, from, to);
      });
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [...ARIA, "class"],
    });
    document.addEventListener("transitionend", onEnd);
    return () => {
      observer.disconnect();
      document.removeEventListener("transitionend", onEnd);
    };
  }, []);

  return null;
}
