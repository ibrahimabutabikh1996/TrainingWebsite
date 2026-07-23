"use client";

import React from "react";
import "../crm.css";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

export default function AdminModal({ isOpen, onClose, title, icon = "info", children, footer, maxWidth = 600 }: AdminModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{ 
      position: "fixed", inset: 0, zIndex: 9999, 
      backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", 
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24 
    }}>
      <div className="crm-glass-panel" style={{ width: "100%", maxWidth, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--admin-card-border)", backgroundColor: "var(--bg2)", flexShrink: 0 }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: "var(--admin-primary)" }}>{icon}</span>
            {title}
          </h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--admin-outline)", cursor: "pointer" }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }} className="custom-scrollbar">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--admin-card-border)", backgroundColor: "var(--bg2)", flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            {footer}
          </div>
        )}

      </div>
    </div>
  );
}
