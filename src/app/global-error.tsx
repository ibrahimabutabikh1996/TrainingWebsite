"use client";

import { useEffect } from "react";
import "./globals.css";
import "./boundaries.css";

/* The last boundary: a failure in the root layout itself.
 *
 * `error.tsx` sits inside the layout, so it cannot catch a layout that threw on
 * the way to rendering it. This one replaces the whole document, which is why
 * it carries its own `<html>` and `<body>` — and why it imports `globals.css`
 * rather than inheriting it. Without that import the tokens are undefined and
 * every `var(--bg)` in `boundaries.css` resolves to nothing: black text on a
 * transparent ground, which is the screen this exists to avoid.
 *
 * `lang` and `dir` are repeated here for the same reason. Nothing else sets
 * them at this point, and an Arabic sentence rendered left-to-right is the
 * detail that makes a broken page look abandoned rather than merely broken.
 *
 * There is no "try again" that reaches further than this one: `reset()` is the
 * only recovery available, because there is no parent left to fall back to. No
 * `<Link>` either — the router lives in the tree that just failed, so the way
 * home is a plain anchor and a fresh document request.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[boundary] root layout error:", error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="boundary">
          <div className="boundary-content">
            <p className="boundary-code">!</p>
            <h1 className="boundary-title">تعذّر تحميل الموقع</h1>
            <p className="boundary-text">
              حدث خطأ منع تحميل الصفحة بالكامل. أعد المحاولة، وإن استمر الأمر
              تواصل مع الكابتن إبراهيم واذكر له الرمز أدناه.
            </p>
            {error.digest && <p className="boundary-digest">{error.digest}</p>}
            <div className="boundary-actions">
              <button type="button" onClick={reset} className="boundary-btn">
                إعادة المحاولة
              </button>
              <a href="/" className="boundary-btn boundary-btn--ghost">
                الصفحة الرئيسية
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
