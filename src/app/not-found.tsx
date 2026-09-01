import Link from "next/link";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import "./boundaries.css";

/* What an unrecognised address answers with.
 *
 * There was no such file, so every mistyped URL on a site that is Arabic
 * throughout reached Next's built-in page: English, left-to-right, on a white
 * ground, with no logo, no navigation and no way back other than the browser's
 * own button. It also renders identically for a visitor who followed a stale
 * link and for one poking at addresses, which is correct — this says nothing
 * about whether the path exists for somebody else.
 *
 * A server component: nothing here needs the browser, and a 404 should not wait
 * on JavaScript to say what it is.
 */
export const metadata = {
  title: "الصفحة غير موجودة",
};

export default function NotFound() {
  return (
    <div className="boundary">
      <div className="boundary-content">
        <img
          src={optimizedSrc("/images/logo/vLogo.png", 384)}
          srcSet={optimizedSrcSet("/images/logo/vLogo.png", [256, 384])}
          sizes="120px"
          alt=""
          className="boundary-logo"
        />
        <p className="boundary-code">404</p>
        <h1 className="boundary-title">الصفحة غير موجودة</h1>
        <p className="boundary-text">
          الرابط الذي فتحته غير صحيح، أو أن الصفحة نُقلت أو حُذفت. تأكد من العنوان
          أو ارجع إلى الصفحة الرئيسية.
        </p>
        <div className="boundary-actions">
          <Link href="/" className="boundary-btn">
            الصفحة الرئيسية
          </Link>
          {/* Both destinations, because the two kinds of visitor who land here
              want different ones: someone signed in wants their own screen, and
              /dashboard sends the coach on to /admin by itself. */}
          <Link href="/dashboard" className="boundary-btn boundary-btn--ghost">
            حسابي
          </Link>
        </div>
      </div>
    </div>
  );
}
