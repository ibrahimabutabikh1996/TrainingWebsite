"use client";

import { useEffect } from "react";

/**
 * Nothing on a preview may be operated.
 *
 * A preview route renders the real components, so every link and every form on
 * it is the real link and the real form. One click and the coach is no longer
 * looking at their draft — the window has navigated somewhere else and the
 * draft it was showing is gone with it. On the sign-in preview it was worse
 * than that: the form authenticated.
 *
 * Three ways in, all closed:
 *
 *   click     the obvious one, and `auxclick` with it — the middle button
 *             follows a link without ever firing `click`.
 *   Enter/Space  how a link or a button is reached from the keyboard, which a
 *             click handler alone does not see.
 *   submit    a form can be submitted without either.
 *
 * The promotional window is the single exemption, and it has to be. It covers
 * the page and locks scrolling behind it exactly as it does for a visitor, and
 * a visitor can close it; blocked along with everything else it would end the
 * preview at the moment it appeared — and it has a tab of its own in the
 * content manager, so it is a thing the coach previews on purpose. The preview
 * bar is exempt for the same reason: it is not part of the page being
 * previewed, and its close button is the way out.
 *
 * This began as an effect inside `LandingClient` and covered only the home
 * page. It is a hook so the sign-in preview shares the one implementation
 * rather than a second copy that would drift — the semantics below are that
 * effect's, unchanged, plus `auxclick`.
 *
 * Presentation only. It runs in the coach's own browser on an admin-guarded
 * route, and nothing anywhere trusts it: it keeps a preview from wandering off,
 * it is not a permission check.
 *
 * @param enabled            the route knows it is a preview.
 * @param alsoOnSearchFlag   additionally arm when the URL carries
 *   `?preview=true`. The landing page reads its draft on that flag as well as
 *   on the prop, and the two must arm together — a page that renders the draft
 *   but leaves its links live is the worst of both. Only the landing page has
 *   that legacy path; nothing opens it any more (the content manager opens
 *   `/cms-preview`), and it is worth removing on its own, deliberately, rather
 *   than as a side effect of moving this code. The sign-in screen no longer has
 *   it at all — see the note on `LoginScreen`.
 *
 *   Read inside the effect, never during render: the server has no location,
 *   and reading one during render is how a hydration mismatch starts.
 */
export function usePreviewGuard(enabled: boolean, alsoOnSearchFlag = false) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const armed =
      enabled ||
      (alsoOnSearchFlag && window.location.search.includes("preview=true"));
    if (!armed) return;

    const operable = (target: EventTarget | null) =>
      target instanceof Element &&
      target.closest(".promo-popup-overlay, .cms-preview-bar") !== null;

    const blockPointer = (e: MouseEvent) => {
      if (operable(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const blockKeys = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (operable(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const blockSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Capture phase to intercept before any other listener
    document.addEventListener("click", blockPointer, true);
    document.addEventListener("auxclick", blockPointer, true);
    document.addEventListener("keydown", blockKeys, true);
    document.addEventListener("submit", blockSubmit, true);
    return () => {
      document.removeEventListener("click", blockPointer, true);
      document.removeEventListener("auxclick", blockPointer, true);
      document.removeEventListener("keydown", blockKeys, true);
      document.removeEventListener("submit", blockSubmit, true);
    };
  }, [enabled, alsoOnSearchFlag]);
}
