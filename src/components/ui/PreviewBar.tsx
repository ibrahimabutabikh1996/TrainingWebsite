"use client";

/**
 * The one thing on a preview route that a visitor does not get.
 *
 * It floats, so the page underneath keeps the exact layout it will have once
 * published — and it exists because a tab showing the real page with a draft
 * applied is otherwise indistinguishable from the live site, which is exactly
 * the confusion the sign-in preview used to cause: it opened the working
 * `/login`, said nothing, and offered no way back.
 *
 * Shared rather than written twice. It began as markup inside `LandingClient`,
 * and the sign-in preview needs the identical bar; a second copy is a second
 * thing to keep in step, and the two would have drifted the first time either
 * the wording or the close button changed. Its styles moved to `globals.css`
 * for the same reason — `login.css` does not load the landing stylesheet.
 */
export function PreviewBar() {
  return (
    <div className="cms-preview-bar" role="status">
      <span className="cms-preview-dot" aria-hidden="true" />
      <span className="cms-preview-text">
        وضع المعاينة — هكذا ستظهر الصفحة للزائر بعد النشر
      </span>
      <button
        type="button"
        className="cms-preview-close"
        onClick={() => window.close()}
      >
        إغلاق
      </button>
    </div>
  );
}
