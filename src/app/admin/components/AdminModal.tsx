"use client";

import React from "react";
import { Icon, type IconName } from "@/components/Icon";
import "../crm.css";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

export default function AdminModal({ isOpen, onClose, title, icon = "info", children, footer, maxWidth = 600 }: AdminModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, bottom: "72px", left: 0, right: 0, zIndex: 9999,
      backgroundColor: "var(--overlay-scrim)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)"
    }}>
      <div className="crm-glass-panel" style={{ width: "100%", maxWidth, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--bg2)", borderRadius: "var(--radius-xl)", boxShadow: "var(--elev-3)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)", margin: 0, display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text)" }}>
            <Icon name={icon} style={{ color: "var(--primary)" }} />
            {title}
          </h3>
          <button onClick={onClose} aria-label="إغلاق" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-1)", borderRadius: "var(--radius-sm)" }}>
            <Icon name="close" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }} className="custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{ padding: "var(--space-4) var(--space-6)", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            {footer}
          </div>
        )}

      </div>
    </div>
  );
}
