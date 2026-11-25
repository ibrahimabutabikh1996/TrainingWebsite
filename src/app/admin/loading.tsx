import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import SeasonalLoader from "@/components/seasonal/SeasonalLoader";

export default function AdminLoading() {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column",
      justifyContent: "center", 
      alignItems: "center", 
      height: "100%", 
      width: "100%", 
      minHeight: "60vh",
      gap: "16px"
    }}>
      {/* At Christmas the logo sits inside a wreath; otherwise it is drawn alone. */}
      <SeasonalLoader>
      <img
        src={optimizedSrc("/images/logo/vLogo.png", 384)}
        srcSet={optimizedSrcSet("/images/logo/vLogo.png", [256, 384])}
        sizes="180px"
        alt="Loading..."
        className="loading-vlogo"
        style={{ maxWidth: "180px" }}
      />
      </SeasonalLoader>
      <p style={{ color: "var(--admin-outline)", fontSize: "0.95rem", fontWeight: 500 }}>
        جاري التحميل...
      </p>
    </div>
  );
}
