"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { isSubscriptionExpired, daysRemaining } from "@/lib/subscription";

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
  /* Read straight off the props rather than held in state. As state seeded
     from a prop they never updated when the parent re-rendered with fresh
     values — React keeps the first initialiser — and nothing here ever set
     them, since suspending and renewing happen on the trainees list. */
  const renewals = initialAccount?.renewals ?? [];
  const isSuspended = initialAccount?.is_suspended ?? false;
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور");
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
      setIsCreating(false);
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };


  if (account) {
    /* Read from the stored end date. This used to start from activation_date
       while /api/profile started from accounts.created_at, so the coach and the
       trainee could see different verdicts for the same subscription. */
    const isExpired = isSubscriptionExpired(account.subscription_ends_at);
    const remaining = daysRemaining(account.subscription_ends_at);

    return (
      <div className="crm-modal-section" style={{ background: 'var(--bg3)', padding: '24px', borderRadius: '12px', border: `1px solid ${isSuspended || isExpired ? 'var(--error, #ef4444)' : 'var(--primary)'}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', background: isSuspended || isExpired ? 'var(--error, #ef4444)' : 'var(--primary)' }}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: isSuspended || isExpired ? 'var(--error, #ef4444)' : 'var(--primary)', fontSize: '28px' }}>
            {isSuspended || isExpired ? 'block' : 'verified_user'}
          </span>
          <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>
            {isSuspended ? 'حساب المشترك موقوف إدارياً' : (isExpired ? 'حساب المشترك معطل (انتهت صلاحية الـ 30 يوم)' : 'حساب المشترك فعّال')}
          </h4>
        </div>
        <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)' }}>
          اسم المستخدم: <strong style={{ color: 'var(--text)', background: 'var(--bg-4)', padding: '4px 8px', borderRadius: '6px' }}>{account.username}</strong>
        </p>

        {/* Renewals History */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: 8 }}>
            <h5 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>سجل الاشتراكات</h5>
            {/* The end date was never shown before — the coach had to infer it. */}
            {account.subscription_ends_at && (
              <span
                className="crm-tag"
                style={{ color: isExpired ? 'var(--error, #ef4444)' : 'var(--primary)' }}
              >
                {isExpired
                  ? `انتهى في ${new Date(account.subscription_ends_at).toLocaleDateString("ar-SA")}`
                  : `ينتهي في ${new Date(account.subscription_ends_at).toLocaleDateString("ar-SA")}${
                      remaining !== null ? ` — ${remaining} يوماً متبقياً` : ""
                    }`}
              </span>
            )}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li style={{ background: 'var(--bg-4)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
              <span>الشهر الأول (تاريخ التفعيل)</span>
              <span>{account.activation_date ? new Date(account.activation_date).toLocaleDateString("ar-SA") : (account.created_at ? new Date(account.created_at).toLocaleDateString("ar-SA") : '--')}</span>
            </li>
            {renewals.map((r, idx) => (
              <li key={idx} style={{ background: 'var(--bg-4)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{r.label}</span>
                <span>{new Date(r.date).toLocaleDateString("ar-SA")}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: '12px', border: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCreating ? '24px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '28px' }}>person_add</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>حساب المشترك</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>لم يتم إنشاء حساب دخول لهذا المشترك بعد.</p>
          </div>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="crm-btn-primary"
            style={{ padding: '8px 20px', borderRadius: '8px' }}
          >
            إنشاء حساب
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreateAccount} style={{ background: 'var(--bg3)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>اسم المستخدم</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: ahmed123"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>كلمة المرور</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة مرور قوية"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button 
              type="button"
              onClick={() => setIsCreating(false)}
              style={{ padding: '10px 20px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
              disabled={isLoading}
            >
              إلغاء
            </button>
            <button 
              type="submit"
              className="crm-btn-primary"
              style={{ padding: '10px 24px', borderRadius: '8px' }}
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
