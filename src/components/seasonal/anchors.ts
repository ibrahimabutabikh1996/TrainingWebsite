"use client";
import { useEffect, useState, type RefObject } from "react";

/* Two hooks for decorations that sit on elements other components own — the
 * logo, a button, a card — without touching those components.
 *
 * The decoration is portalled into the element's own parent (or the element
 * itself, where nothing inside it is rewritten) and positioned absolutely over
 * it, so it scrolls, sticks and slides with it, and stacks exactly where it
 * does. Nothing here is ever portalled into an element carrying `data-i18n`:
 * the landing page's DOM pass sets their `textContent`, which would wipe it. */

/* Whether React has hydrated this server-rendered node yet. React tags every
   node it has claimed with a `__reactFiber$…` key, and claims a parent only
   after all of its children — so a tagged container is one whose children
   React has already counted. Portalling into an untagged one adds a child
   React does not expect, which fails hydration and rebuilds the whole page
   (seen on /admin, where this layer can resolve before the panel hydrates). */
function isHydrated(el: Element | null): boolean {
  if (!el) return false;
  for (const k in el) if (k.startsWith("__reactFiber$")) return true;
  return false;
}

/**
 * Every element matching `selector` whose portal container — `containerOf`,
 * the element's parent by default — React has hydrated, kept current as the
 * page changes.
 */
export function useMatchingElements(
  selector: string,
  containerOf: (el: HTMLElement) => Element | null = (el) => el.parentElement
): HTMLElement[] {
  const [found, setFound] = useState<HTMLElement[]>([]);

  useEffect(() => {
    let raf = 0;
    let retry = 0;
    let tries = 0;
    const scan = () => {
      raf = 0;
      const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const next = all.filter((el) => isHydrated(containerOf(el)));
      setFound((prev) =>
        prev.length === next.length && prev.every((el, i) => el === next[i]) ? prev : next
      );
      /* Hydration changes no DOM, so nothing below announces it: look again
         shortly while anything is still waiting (for at most ~15s). */
      window.clearTimeout(retry);
      if (next.length === all.length) tries = 0;
      else if (++tries < 30) retry = window.setTimeout(schedule, 500);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(scan);
    };
    schedule();
    // Dashboards draw their header after a fetch; a client navigation swaps the page.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(retry);
    };
    // `containerOf` is a fixed function per caller; the selector is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector]);

  return found;
}

/* A stable React key per element, so a decoration stays with its element when
   the list of matches changes order. */
const keys = new WeakMap<Element, string>();
let nextKey = 0;
export function keyOf(el: Element): string {
  let k = keys.get(el);
  if (!k) keys.set(el, (k = `a${++nextKey}`));
  return k;
}

export type Box ={ left: number; top: number; width: number; height: number };

/**
 * Where `target` sits inside the containing block of `ref`'s element — the
 * `left/top/width/height` that put an absolutely positioned overlay exactly on
 * it. `null` while the target is not drawn (display: none, zero size).
 */
export function useAnchoredBox(target: HTMLElement, ref: RefObject<HTMLElement | null>): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const overlay = ref.current;
    if (!overlay) return;
    let raf = 0;

    const measure = () => {
      raf = 0;
      const t = target.getBoundingClientRect();
      if (!target.isConnected || t.width === 0 || t.height === 0) {
        setBox(null);
        return;
      }
      const cb = overlay.offsetParent as HTMLElement | null;
      let left = t.left + window.scrollX;
      let top = t.top + window.scrollY;
      if (cb) {
        const c = cb.getBoundingClientRect();
        left = t.left - c.left - cb.clientLeft + cb.scrollLeft;
        top = t.top - c.top - cb.clientTop + cb.scrollTop;
      }
      const next = { left, top, width: t.width, height: t.height };
      setBox((prev) =>
        prev &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next
      );
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(target);
    if (target.parentElement) ro.observe(target.parentElement);
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("load", schedule);
    /* An entrance that scales or slides the target (the promotional window
       grows in) moves it without resizing anything: measure again once it
       has landed, rather than waiting for the next tick. */
    window.addEventListener("animationend", schedule);
    /* Layout that moves the target without resizing it or its parent (a
       sibling's text arriving, a section opening above). Not a mutation
       observer on `style`: the landing page's parallax rewrites styles every
       scroll frame, and this would measure on each of them. */
    const tick = window.setInterval(schedule, 1500);
    return () => {
      ro.disconnect();
      window.clearInterval(tick);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", schedule);
      window.removeEventListener("animationend", schedule);
    };
  }, [target, ref]);

  return box;
}
