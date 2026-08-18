import React from "react";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";

export default function Loading() {
  return (
    <div className="global-loading-container">
      <div className="loading-content">
        <img
        src={optimizedSrc("/images/logo/vLogo.png", 384)}
        srcSet={optimizedSrcSet("/images/logo/vLogo.png", [256, 384])}
        sizes="180px"
        alt="Loading..."
        className="loading-vlogo"
      />
        <h2 className="loading-text">جاري التحميل...</h2>
      </div>

      <style>{`
        .global-loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100%;
          background-color: var(--background, #0A121A);
          font-family: 'Cairo', sans-serif;
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .loading-text {
          color: var(--primary, #60A5FA);
          font-size: 1.5rem;
          letter-spacing: 1px;
          animation: pulse-text 2s ease-in-out infinite;
          margin: 0;
        }

        @keyframes pulse-text {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
