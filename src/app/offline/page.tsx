import Link from "next/link";
import { optimizedSrc } from "@/lib/imageOptim";
import "../boundaries.css";

/* What the installed app shows when there is no connection at all.
 *
 * The service worker (`public/sw.js`) stores this page when it installs and
 * hands it back for any page the network cannot reach. Static on purpose: it is
 * fetched once, ahead of time, and must not depend on the database or a
 * session. A single `src` rather than a `srcSet`, so the worker knows exactly
 * which image address to keep.
 */
export const metadata = {
  title: "لا يوجد اتصال",
  robots: { index: false },
};

export default function Offline() {
  return (
    <div className="boundary">
      <div className="boundary-content">
        <img
          src={optimizedSrc("/images/logo/vLogo.png", 384)}
          alt=""
          className="boundary-logo"
        />
        <h1 className="boundary-title">لا يوجد اتصال بالإنترنت</h1>
        <p className="boundary-text">
          تعذّر تحميل الصفحة لأن الجهاز غير متصل. تأكد من الاتصال ثم أعد المحاولة.
        </p>
        <div className="boundary-actions">
          <Link href="/" className="boundary-btn">
            إعادة المحاولة
          </Link>
        </div>
      </div>
    </div>
  );
}
