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
  /** Raise this only to stack one of these over another — the course library
   *  opens a video player on top of the course it belongs to. Left alone, every
   *  dialog sits on the same layer and order is decided by the DOM, which is
   *  not a thing to leave to chance once two of them can be open at once. */
  zIndex?: number;
}

export default function AdminModal({ isOpen, onClose, title, icon = "info", children, footer, maxWidth = 600, zIndex = 9999 }: AdminModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, bottom: "72px", left: 0, right: 0, zIndex,
      backgroundColor: "var(--overlay-scrim)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-8) var(--space-6)"
    }}>
      {/* `maxHeight: 100%` rather than a viewport unit, and the distinction is
          the whole reason this used to sit against the top of the screen.
          The overlay above stops 72px short of the bottom to clear the nav bar
          and adds its own padding, so what is actually free is 100vh - 136px.
          A panel capped at 90vh was being measured against something else
          entirely: it only fitted on a screen taller than 1200px, and on
          everything shorter it overflowed a centred flex box at both ends —
          clipped by the top of the browser, over the nav bar at the bottom.
          A percentage resolves against the overlay, so it cannot outgrow it. */}
      <div className="crm-glass-panel" style={{ width: "100%", maxWidth, maxHeight: "100%", display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--bg2)", borderRadius: "var(--radius-xl)", boxShadow: "var(--elev-3)", border: "1px solid var(--border)" }}>

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
