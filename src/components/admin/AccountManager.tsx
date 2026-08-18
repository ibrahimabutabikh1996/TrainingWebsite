"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { isSubscriptionExpired, daysRemaining } from "@/lib/subscription";
import { Icon } from "@/components/Icon";
import { formatTimestamp } from "@/lib/trainingDates";

interface AccountManagerProps {
  profileId: string;
  existingAccount: {
    username: string;
    created_at?: string | null;
    activation_date?: string | null;
    subscription_ends_at?: string | null;
    renewals?: { date: string, label: string }[];
    is_suspended?: boolean;
  } | null;
}

export default function AccountManager({ profileId, existingAccount: initialAccount }: AccountManagerProps) {
  const [account, setAccount] = useState(initialAccount);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const renewals = initialAccount?.renewals ?? [];

  /* Held in state so the toggle can flip it straight away rather than waiting
     for the server round trip, but it still has to follow the prop when the
     page revalidates. React's recipe for state that follows a prop: remember
     the prop this was derived from, and adjust during the render that brings a
     new one. It used to be an effect, which showed the stale badge for a render
     first. */
  const suspendedProp = initialAccount?.is_suspended ?? false;
  const [isSuspended, setIsSuspended] = useState(suspendedProp);
  const [syncedWith, setSyncedWith] = useState(suspendedProp);

  if (suspendedProp !== syncedWith) {
    setSyncedWith(suspendedProp);
    setIsSuspended(suspendedProp);
  }

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isSuspendLoading, setIsSuspendLoading] = useState(false);

  const handleToggleSuspend = async () => {
    if (!confirm(isSuspended ? "هل أنت متأكد من تفعيل الحساب؟" : "هل أنت متأكد من تعطيل الحساب؟")) return;
    setIsSuspendLoading(true);
    try {
      const res = await fetch("/api/admin/suspend-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, isSuspended: !isSuspended }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsSuspended(data.is_suspended);
        toast.success(data.is_suspended ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
      } else {
        toast.error(data.error || "حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsSuspendLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setIsPasswordLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("تم تغيير كلمة المرور بنجاح");
        setIsChangingPassword(false);
        setNewPassword("");
      } else {
        toast.error(data.error || "حدث خطأ");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsPasswordLoading(false);
    }
  };
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    if (password.length < 8) {
      toast.error("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId,
          username,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "حدث خطأ أثناء إنشاء الحساب");
        return;
      }

      toast.success("تم إنشاء الحساب بنجاح!");
      setAccount({ username: data.username });
      setIsSuspended(true);
      setIsCreating(false);
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };


  if (account) {
    const baseDate = account.activation_date || account.created_at || new Date().toISOString();
    const effectiveEndsAt = account.subscription_ends_at || new Date(new Date(baseDate).getTime() + 30 * 86400000).toISOString();
    const isExpired = isSubscriptionExpired(effectiveEndsAt);
    const remaining = daysRemaining(effectiveEndsAt);

    const statusBg = isSuspended
      ? "color-mix(in srgb, #f59e0b 15%, transparent)"
      : isExpired
      ? "color-mix(in srgb, #ef4444 15%, transparent)"
      : "color-mix(in srgb, #10b981 15%, transparent)";
      
    const statusColor = isSuspended ? "#f59e0b" : isExpired ? "#ef4444" : "#10b981";
    const statusText = isSuspended
      ? "حساب موقوف إدارياً"
      : isExpired
      ? "حساب معطل (انتهت الـ 30 يوماً)"
      : "حساب المشترك فعّال ونشط";
    const statusIcon = isSuspended ? "block" : isExpired ? "warning" : "verified_user";

    const activationDateFormatted = account.activation_date
      ? formatTimestamp(account.activation_date)
      : account.created_at
      ? formatTimestamp(account.created_at)
      : "--";

    return (
      <div
        className="crm-modal-section"
        style={{
          background: "var(--bg2, #0F0F0F)",
          padding: "28px",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border, rgba(255,255,255,0.08))",
          borderInlineStart: `5px solid ${statusColor}`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Top Header & Quick Actions Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            paddingBottom: "20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "var(--radius-lg)",
                background: statusBg,
                color: statusColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                flexShrink: 0,
                boxShadow: `0 4px 16px ${statusBg}`,
              }}
            >
              <Icon name={statusIcon} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "var(--text)" }}>
                  إدارة حساب الدخول والصلاحية
                </h3>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: statusColor,
                    background: statusBg,
                    padding: "4px 14px",
                    borderRadius: "var(--radius-pill)",
                    border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
                  }}
                >
                  <Icon name={isSuspended ? "block" : isExpired ? "error_outline" : "check_circle"} style={{ fontSize: "15px" }} />
                  {statusText}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => setIsChangingPassword(!isChangingPassword)}
              className="crm-btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                fontSize: "0.92rem",
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
                background: isChangingPassword ? "var(--bg3)" : "transparent",
              }}
            >
              <Icon name="lock" style={{ fontSize: "18px", color: "var(--primary)" }} />
              <span>تغيير كلمة المرور</span>
            </button>
            <button
              onClick={handleToggleSuspend}
              disabled={isSuspendLoading}
              className="crm-btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                fontSize: "0.92rem",
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
                color: isSuspended ? "#10b981" : "#ef4444",
                borderColor: isSuspended ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
              }}
            >
              <Icon name={isSuspended ? "check_circle" : "block"} style={{ fontSize: "18px" }} />
              <span>{isSuspendLoading ? "جاري التمكين..." : isSuspended ? "تفعيل الحساب" : "تعطيل الحساب"}</span>
            </button>
          </div>
        </div>

        {/* Change Password Form Drawer */}
        {isChangingPassword && (
          <form
            onSubmit={handleChangePassword}
            style={{
              background: "var(--bg3, #141414)",
              padding: "20px 24px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              display: "flex",
              gap: "16px",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 280px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
                كلمة المرور الجديدة للمشترك ({account.username})
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور قوية (8 أحرف على الأقل)"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    paddingInlineEnd: "40px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--bg2)",
                    color: "var(--text)",
                    fontSize: "0.95rem",
                  }}
                  required
                  minLength={8}
                />
                <Icon
                  name="lock"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "14px",
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
                  setIsChangingPassword(false);
                  setNewPassword("");
                }}
                className="crm-btn-secondary"
                style={{ padding: "12px 20px", borderRadius: "var(--radius-md)", height: "fit-content" }}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isPasswordLoading}
                className="crm-btn-primary"
                style={{ padding: "12px 28px", borderRadius: "var(--radius-md)", fontWeight: 700, height: "fit-content" }}
              >
                {isPasswordLoading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
              </button>
            </div>
          </form>
        )}

        {/* 2-Column Info Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          
          {/* Card 1: Username & Access Details */}
          <div
            style={{
              background: "var(--bg3, #141414)",
              padding: "22px",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 42, height: 42, borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                <Icon name="person" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>بيانات الدخول (اسم المستخدم)</h4>
              </div>
            </div>

            <div
              style={{
                background: "var(--bg2, #080808)",
                padding: "14px 18px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 600 }}>اسم المستخدم:</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary, #C9A84C)", letterSpacing: "0.5px" }}>
                {account.username}
              </span>
            </div>
          </div>

          {/* Card 2: Validity & Time Horizon */}
          <div
            style={{
              background: "var(--bg3, #141414)",
              padding: "22px",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 42, height: 42, borderRadius: "var(--radius-lg)", background: isExpired ? "color-mix(in srgb, #ef4444 15%, transparent)" : "color-mix(in srgb, #10b981 15%, transparent)", color: isExpired ? "#ef4444" : "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                <Icon name="schedule" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>صلاحية والوقت المتبقي للاشتراك</h4>
              </div>
            </div>

            <div
              style={{
                background: "var(--bg2, #080808)",
                padding: "14px 18px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 600 }}>حالة الصلاحية:</span>
              {effectiveEndsAt ? (
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    color: isExpired ? "#ef4444" : "#10b981",
                  }}
                >
                  {isExpired
                    ? `انتهى في ${formatTimestamp(effectiveEndsAt)}`
                    : `ينتهي في ${formatTimestamp(effectiveEndsAt)}${
                        remaining !== null ? ` (${remaining} يوماً متبقي)` : ""
                      }`}
                </span>
              ) : (
                <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>في انتظار التفعيل</span>
              )}
            </div>
          </div>
        </div>

        {/* Renewals & Activations Grid */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <Icon name="calendar_month" style={{ color: "var(--primary)", fontSize: "22px" }} />
            <h5 style={{ margin: 0, color: "var(--text)", fontSize: "1.1rem", fontWeight: 800 }}>
              سجل التفعيلات وتواريخ الاشتراك
            </h5>
            <span style={{ fontSize: "0.85rem", background: "var(--bg3)", padding: "2px 12px", borderRadius: "var(--radius-pill)", color: "var(--text-muted)" }}>
              {1 + renewals.length} تفعيل
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {/* Activation Month Card */}
            <div
              style={{
                background: "var(--bg3, #141414)",
                padding: "16px 20px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: 0, right: 0, width: "4px", height: "100%", background: "var(--primary)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text)", fontWeight: 700, fontSize: "0.98rem" }}>
                <Icon name="calendar_today" style={{ color: "var(--primary)", fontSize: "20px" }} />
                <span>الشهر الأول (تاريخ التفعيل)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginInlineStart: "28px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>التاريخ:</span>
                <span style={{ fontWeight: 800, color: "var(--text)", fontSize: "1rem", letterSpacing: "0.5px" }}>
                  {activationDateFormatted}
                </span>
              </div>
            </div>

            {/* Subsequent renewals */}
            {renewals.map((r, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--bg3, #141414)",
                  padding: "16px 20px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", top: 0, right: 0, width: "4px", height: "100%", background: "#10b981" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text)", fontWeight: 700, fontSize: "0.98rem" }}>
                  <Icon name="calendar_today" style={{ color: "#10b981", fontSize: "20px" }} />
                  <span>{r.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginInlineStart: "28px" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>التاريخ:</span>
                  <span style={{ fontWeight: 800, color: "var(--text)", fontSize: "1rem", letterSpacing: "0.5px" }}>
                    {formatTimestamp(r.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: "var(--radius-lg)", border: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCreating ? '24px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Icon name="person_add" style={{ color: 'var(--text-muted)', fontSize: '28px' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>حساب المشترك</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>لم يتم إنشاء حساب دخول لهذا المشترك بعد.</p>
          </div>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="crm-btn-primary"
            style={{ padding: '8px 20px', borderRadius: "var(--radius-sm)" }}
          >
            إنشاء حساب
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreateAccount} style={{ background: 'var(--bg3)', padding: '20px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>اسم المستخدم</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: ahmed123"
                style={{ width: '100%', padding: '10px 14px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>كلمة المرور</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة مرور قوية (8 أحرف على الأقل)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: "var(--radius-sm)", border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
                required
                minLength={8}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button 
              type="button"
              onClick={() => setIsCreating(false)}
              style={{ padding: '10px 20px', borderRadius: "var(--radius-sm)", background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
              disabled={isLoading}
            >
              إلغاء
            </button>
            <button 
              type="submit"
              className="crm-btn-primary"
              style={{ padding: '10px 24px', borderRadius: "var(--radius-sm)" }}
              disabled={isLoading}
            >
              {isLoading ? "جاري الإنشاء..." : "حفظ الحساب"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
