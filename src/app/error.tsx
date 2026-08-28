"use client";

import Link from "next/link";
import { useEffect } from "react";
import "./boundaries.css";

/* What a thrown error renders instead of a blank page.
 *
 * Without this file an exception in any server component took the whole route
 * to Next's default error screen — in production, the words "Application error:
 * a client-side exception has occurred", in English, on white. The person
 * reading it cannot tell whether to try again, sign in again, or give up.
 *
 * `reset()` re-renders the segment that failed. It is offered first because a
 * good share of what reaches here is transient — a database connection that was
 * not available for a moment, a query that timed out — and pressing it costs
 * nothing when it is not.
 *
 * The message is deliberately the same whatever went wrong. `error.message` is
 * written for whoever wrote the code, and on a production build it is a
 * minified string that would tell a trainee nothing while telling a stranger
 * something about the internals.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* The server has already logged this with the same digest; this is the
       browser's half, so a fault that only reproduces on someone else's device
       leaves a trace there too. */
    console.error("[boundary] route error:", error);
  }, [error]);

  return (
    <div className="boundary">
      <div className="boundary-content">
        <p className="boundary-code">!</p>
        <h1 className="boundary-title">حدث خطأ غير متوقع</h1>
        <p className="boundary-text">
          تعذّر عرض هذه الصفحة. جرّب إعادة المحاولة — أغلب هذه الأخطاء مؤقتة. إن
          تكرر الأمر، تواصل مع الكابتن إبراهيم واذكر له الرمز أدناه.
        </p>
        {/* Only when Next produced one. It is the single string that ties this
            screen to a line in the server log. */}
        {error.digest && <p className="boundary-digest">{error.digest}</p>}
        <div className="boundary-actions">
          <button type="button" onClick={reset} className="boundary-btn">
            إعادة المحاولة
          </button>
          <Link href="/" className="boundary-btn boundary-btn--ghost">
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
