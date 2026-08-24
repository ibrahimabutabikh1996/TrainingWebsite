"use client";

import React from "react";
import { Icon, type IconName } from "@/components/Icon";
import "../crm.css";
import { Overlay } from "@/components/ui/Overlay";

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

  /* Everything a phone needs to say about this dialog is said in crm.css, under
     `.admin-modal-scrim`. The inset, the padding, the header and footer gutters
     and the close button's target were inline values, and an inline value is
     the one thing a media query cannot reach — so on a 320px screen the scrim
     spent 48px of the width on padding, stopped 72px short of a bar that is
     64px tall there, and left the close button at 28px. */
  return (
    <Overlay>
      <div className="admin-modal-scrim" style={{
        zIndex,
        backgroundColor: "var(--overlay-scrim)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        {/* `maxHeight: 100%` rather than a viewport unit, and the distinction is
            the whole reason this used to sit against the top of the screen.
            The scrim above stops short of the bottom to clear the nav bar and
            adds its own padding, so what is free is a good deal less than the
            viewport — and how much less now depends on the screen, since both
            figures are breakpoint- and safe-area-aware in crm.css.
            A panel capped at 90vh was being measured against something else
            entirely: it only fitted on a screen taller than 1200px, and on
            everything shorter it overflowed a centred flex box at both ends —
            clipped by the top of the browser, over the nav bar at the bottom.
            A percentage resolves against the overlay, so it cannot outgrow it. */}
        <div className="crm-glass-panel" style={{ width: "100%", maxWidth, maxHeight: "100%", display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--bg2)", borderRadius: "var(--radius-xl)", boxShadow: "var(--elev-3)", border: "1px solid var(--border)" }}>

          {/* Header */}
          <div className="admin-modal-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)", margin: 0, display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text)", minWidth: 0 }}>
              <Icon name={icon} style={{ color: "var(--primary)" }} />
              {title}
            </h3>
            <button onClick={onClose} aria-label="إغلاق" className="admin-modal-close" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)" }}>
              <Icon name="close" />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }} className="custom-scrollbar">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="admin-modal-foot" style={{ borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              {footer}
            </div>
          )}

        </div>
      </div>
    </Overlay>
  );
}
