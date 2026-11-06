"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { deleteSubscriberAction } from "@/app/admin/profile/actions";
import { Icon } from "@/components/Icon";

export default function DeleteSubscriberZone({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      toast.error("يرجى إدخال كلمة المرور");
      return;
    }

    setIsLoading(true);
    try {
      /* Only the password travels now. Who is deleting is read from the session
         on the server — sending a username from here meant the browser chose
         which account the password would be checked against. */
      const res = await deleteSubscriberAction(profileId, adminPassword);
      if (res.success) {
        toast.success("تم حذف المشترك بنجاح");
        router.push("/admin");
      } else {
        toast.error(res.error || "حدث خطأ أثناء الحذف");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="crm-modal-section ui-card"
      style={{
        padding: "28px",
        borderInlineStart: "5px solid var(--error)",
        marginTop: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h3 className="admin-card-header" style={{ color: "var(--error-text)", display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>
            <Icon name="warning" /> حذف المشترك
          </h3>

        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="ui-btn ui-btn--secondary ui-btn--danger"
          style={{ color: "var(--error-text)" }}
        >
          <Icon name="delete_forever" /> حذف المشترك نهائياً
        </button>
      </div>

      {isOpen && (
        <form
          onSubmit={handleDelete}
          style={{
            background: "var(--bg3)",
            padding: "20px 24px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
              للتأكيد، يرجى إدخال كلمة مرور حسابك (المدرب):
            </label>
            <div style={{ position: "relative", maxWidth: "400px" }}>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="كلمة المرور الخاصة بك"
                className="ui-field-control"
                style={{ paddingInlineStart: "40px" }}
                required
              />
              <Icon
                name="lock"
                style={{
                  position: "absolute",
                  top: "50%",
                  right: "14px",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setAdminPassword("");
              }}
              className="crm-btn-secondary"
              style={{ padding: "10px 20px" }}
              disabled={isLoading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="ui-btn ui-btn--primary ui-btn--danger"
              disabled={isLoading}
            >
              {isLoading ? "جاري الحذف..." : "تأكيد الحذف نهائياً"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
