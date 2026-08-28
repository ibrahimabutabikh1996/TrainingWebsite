"use client";

import { useSyncExternalStore } from "react";
import AdminModal from "@/app/admin/components/AdminModal";
import {
  getConfirmRequest,
  getServerConfirmRequest,
  settleConfirm,
  subscribeToConfirm,
} from "@/lib/confirmDialog";

/**
 * The one dialog every "are you sure?" in the panel goes through.
 *
 * Mounted once by the admin layout, the way `UploadProgressWindow` is mounted
 * once by the root layout, and renders nothing at all until something asks a
 * question. Built on `AdminModal` so it inherits the dialog the rest of the
 * panel already uses — the clearance from the browser edge and the nav bar, the
 * ground, the rule above the buttons — rather than becoming a fourth thing that
 * looks nearly like the others.
 *
 * Closing by the X or the backdrop answers "no". That is the safe reading of an
 * unanswered question, and it is what `window.confirm` did when it was
 * dismissed.
 */
export function ConfirmDialog() {
  const request = useSyncExternalStore(
    subscribeToConfirm,
    getConfirmRequest,
    getServerConfirmRequest
  );

  if (!request) return null;

  const { message, title, confirmLabel, cancelLabel, danger } = request;

  return (
    <AdminModal
      /* Keyed on the request, so a fresh question never inherits the previous
         one's DOM — and its scroll position with it. */
      key={request.id}
      isOpen
      onClose={() => settleConfirm(false)}
      title={title ?? (danger ? "تأكيد الحذف" : "تأكيد")}
      icon={danger ? "delete" : "info"}
      maxWidth={440}
      zIndex={10001}
      footer={
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          <button
            type="button"
            onClick={() => settleConfirm(false)}
            className="crm-btn-secondary"
            style={{ flex: 1 }}
          >
            {cancelLabel ?? "تراجع"}
          </button>
          <button
            type="button"
            onClick={() => settleConfirm(true)}
            className="crm-btn-primary"
            style={danger ? { flex: 1, background: "var(--error)", color: "var(--text-inverse)" } : { flex: 1 }}
          >
            {confirmLabel ?? (danger ? "نعم، احذف" : "متابعة")}
          </button>
        </div>
      }
    >
      <div style={{ padding: 24, textAlign: "center", direction: "rtl" }}>
        <p style={{ margin: 0, color: "var(--admin-on-surface)", fontSize: "1rem", lineHeight: 1.7 }}>
          {message}
        </p>
        {danger && (
          <p style={{ margin: "16px 0 0", color: "var(--error-text)", fontSize: "0.85rem" }}>
            لا يمكن التراجع عن هذا الإجراء.
          </p>
        )}
      </div>
    </AdminModal>
  );
}
