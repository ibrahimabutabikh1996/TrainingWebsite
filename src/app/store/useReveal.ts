"use client";

import { useEffect } from "react";

/* Adds `is-visible` to every `.st-reveal` inside the page as it scrolls into
 * view, once. The stylesheet hides them only under `.st-js` — set here — so
 * without the script, or under reduced motion, everything is simply shown. */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("st-js");
    const items = Array.from(document.querySelectorAll<HTMLElement>(".st-reveal:not(.is-visible)"));
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
