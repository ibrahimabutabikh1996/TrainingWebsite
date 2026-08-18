"use client";

import { useEffect } from "react";

/* Depth on the landing page, from a single scroll pass.
 *
 * The shape of this deserves an explanation, because the obvious ways to build
 * a parallax page are all unavailable here.
 *
 * `background-attachment: fixed` is out: iOS Safari does not implement it and
 * paints the layer as though it scrolled. A `perspective` container is worse —
 * `perspective`, `transform` and `filter` each make an element a containing
 * block for `position: fixed` descendants, and this page has three of those
 * inside the wrapper: the navigation bar, the drawer overlay, and the scroll
 * follower. Wrapping the page would unpin all three.
 *
 * So no layer here is positioned by this file. Every layer is a normal element
 * that reads a custom property out of its own stylesheet:
 *
 *     transform: translate3d(0, var(--py, 0px), 0);
 *
 * and all this does is write `--py`. A custom property is not a transform, so
 * nothing gains a containing block, nothing is unpinned, and a layer that also
 * wants a hover scale composes the two itself rather than fighting for the
 * single `transform` slot.
 *
 * Layers declare themselves in the markup:
 *
 *   data-parallax="0.06"      travel per pixel of scroll — the only required one
 *   data-parallax-max="20"    clamp, in pixels. A photograph drifting inside a
 *                             clipped frame has only so much room before the
 *                             frame shows through; this is that room.
 *   data-parallax-scroll      measure from the top of the document rather than
 *                             from the element's own centre (see below)
 *   data-parallax-fade        also write `--pfade`, 1 to 0 as the element leaves
 *   data-parallax-desktop     sit still on a phone
 *
 * Two ways of measuring, because the hero and everything below it are different
 * problems. A mid-page layer is measured from its own centre against the centre
 * of the viewport: it reads zero as it passes the middle of the screen and
 * drifts either side of that, which is what gives the effect its symmetry. The
 * hero is already on screen when the page loads, so the same formula would give
 * it a non-zero offset before the reader has scrolled at all — a nudge out of
 * place on arrival. Anchored to the scroll position it reads exactly zero at
 * the top of the document, which is where it was designed to sit.
 */

type Layer = {
  el: HTMLElement;
  speed: number;
  max: number;
  fromScroll: boolean;
  fade: boolean;
  desktopOnly: boolean;
};

/* Below this the effect is halved rather than dropped. A phone is where most of
   this site is read, and a page that goes flat on the small screen is not the
   page that was asked for — but a phone also has the least to spend on it. */
const SMALL_SCREEN = "(max-width: 900px)";
const SMALL_SCREEN_STRENGTH = 0.5;

/* What a layer travels when it does not say. */
const DEFAULT_MAX = 60;

/**
 * Drives every `[data-parallax]` layer inside the landing page.
 *
 * `contentKey` re-reads the markup when it changes. The testimonials section is
 * rendered only once the coach has written one, so the set of layers on the
 * page is not fixed at mount — and the content manager's live preview swaps the
 * page's content while it is open. Re-querying on the same value the rest of
 * the page re-renders from keeps the two in step.
 */
export function useParallax(contentKey?: unknown): void {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smallScreen = window.matchMedia(SMALL_SCREEN);

    const layers: Layer[] = Array.from(
      document.querySelectorAll<HTMLElement>("[data-parallax]"),
    ).map((el) => ({
      el,
      speed: Number(el.dataset.parallax) || 0,
      max: Number(el.dataset.parallaxMax) || DEFAULT_MAX,
      fromScroll: el.dataset.parallaxScroll !== undefined,
      fade: el.dataset.parallaxFade !== undefined,
      desktopOnly: el.dataset.parallaxDesktop !== undefined,
    }));

    if (layers.length === 0) return;

    /* Back to the stylesheet's own resting values. The fallbacks in
       `var(--py, 0px)` do the rest, so removing the property is the whole of
       "turn it off" — there is no second set of rules to keep in sync. */
    const clear = () => {
      for (const { el } of layers) {
        el.style.removeProperty("--py");
        el.style.removeProperty("--pfade");
      }
    };

    let frame = 0;

    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const isSmall = smallScreen.matches;
      const strength = isSmall ? SMALL_SCREEN_STRENGTH : 1;
      const scrolled = window.scrollY;

      /* Every rectangle is read before anything is written. Interleaving the
         two makes the browser recompute layout once per element instead of
         once per frame, which is the difference between this being free and
         this being the reason the page stutters. */
      const rects = layers.map((layer) => layer.el.getBoundingClientRect());

      layers.forEach((layer, i) => {
        const rect = rects[i];
        const { el } = layer;

        /* A section the coach has switched off is `display: none`, and a box
           with no height is precisely what that reports here — so the check
           that keeps a hidden section from being moved is the same one that
           keeps an empty one from being measured. Clearing rather than
           skipping means nothing stale is left behind for when it comes back.

           This is also why the file measures with `getBoundingClientRect` and
           never `offsetTop`: that one is relative to the nearest positioned
           ancestor, so it silently changes meaning the moment anything above
           the element gains `position: relative`. */
        if (rect.height === 0 || (layer.desktopOnly && isSmall)) {
          el.style.removeProperty("--py");
          el.style.removeProperty("--pfade");
          return;
        }

        /* Nothing is written for a layer that is nowhere near the screen.
           Writing a custom property costs a style recalculation on that element
           whether or not anyone can see the result, and most of the time most
           of this page is thousands of pixels away — measured, writing all
           nineteen every frame instead of the three or four in view was the
           single largest cost this file added.

           The value is left where it was rather than cleared. It is off screen
           either way, and the margin below is wide enough that a layer is being
           updated again well before it comes back into view. */
        if (rect.bottom < -viewport || rect.top > viewport * 2) return;

        const distance = layer.fromScroll
          ? scrolled
          : -(rect.top + rect.height / 2 - viewport / 2);

        const travel = distance * layer.speed * strength;
        const y = Math.min(layer.max, Math.max(-layer.max, travel));
        el.style.setProperty("--py", `${y.toFixed(2)}px`);

        if (layer.fade) {
          /* Full strength until the element's top passes the top of the
             screen, then out over the next half screen. */
          const gone = Math.min(Math.max(-rect.top / (viewport * 0.5), 0), 1);
          el.style.setProperty("--pfade", (1 - gone).toFixed(3));
        }
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    let running = false;

    const start = () => {
      if (running) return;
      running = true;
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      schedule();
    };

    const stop = () => {
      if (!running) return;
      running = false;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    /* Someone who has asked their system for less movement gets none of this,
       and gets that answer again the moment they change their mind — the
       setting can be turned on while the page is open, and a page that only
       read it at mount would carry on moving until reloaded. */
    const applyMotionPreference = () => {
      if (reduceMotion.matches) {
        stop();
        clear();
      } else {
        start();
      }
    };

    applyMotionPreference();
    reduceMotion.addEventListener("change", applyMotionPreference);

    return () => {
      reduceMotion.removeEventListener("change", applyMotionPreference);
      stop();
      clear();
    };
  }, [contentKey]);
}
