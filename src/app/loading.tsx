import React from "react";

export default function Loading() {
  return (
    <div className="global-loading-container">
      <div className="loading-content">
        <div className="primary-spinner"></div>
        <h2 className="loading-text">جاري التحميل...</h2>
      </div>

      <style>{`
        .global-loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100%;
          background-color: #0F172A;
          font-family: 'Amiri', serif;
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .primary-spinner {
          width: 64px;
          height: 64px;
          border: 4px solid rgba(96, 165, 250, 0.18);
          border-top-color: #60A5FA;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          box-shadow: 0 0 20px rgba(96, 165, 250, 0.2);
        }

        .loading-text {
          color: #60A5FA;
          font-size: 1.5rem;
          letter-spacing: 1px;
          animation: pulse-text 2s ease-in-out infinite;
          margin: 0;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse-text {
          0%, 100% {
            opacity: 1;
            text-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
          }
          50% {
            opacity: 0.5;
            text-shadow: 0 0 0px rgba(96, 165, 250, 0);
          }
        }
      `}</style>
    </div>
  );
}
