import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Toaster } from "react-hot-toast";
import AccountManager from "@/components/admin/AccountManager";
import ProfileDetailsTabs from "@/components/admin/ProfileDetailsTabs";
import WorkoutProgress from "@/components/admin/WorkoutProgress";
import CycleHistory from "@/components/admin/CycleHistory";
import RestDaysHistory from "@/components/admin/RestDaysHistory";
import { activityLabel, planLabel } from "@/lib/formLabels";
import "../../crm.css";
import type { JsonRecord } from "@/types";

export default async function ProfileDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const profile = await prisma.profiles.findUnique({
    where: { id }
  });

  if (!profile) {
    notFound();
  }

  let data = profile.data as JsonRecord;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = {};
    }
  }

  const phone = data.phone || data.mobile;
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";

  let existingAccount = null;
  if (profile.user_id) {
    const acc = await prisma.accounts.findUnique({
      where: { id: profile.user_id }
    });
    if (acc) {
      existingAccount = { 
        username: acc.username,
        created_at: acc.created_at ? acc.created_at.toISOString() : null,
        activation_date: data.activation_date || null,
        renewals: data.renewals || [],
        // From columns, not the JSON blob.
        is_suspended: profile.is_suspended,
        subscription_ends_at: profile.subscription_ends_at
          ? profile.subscription_ends_at.toISOString()
          : null
      };
    }
  }

  return (
    <div className="crm-dashboard" style={{ minHeight: '100vh', padding: '32px' }}>
      {/* This page had none, so every message AccountManager raised — including
          "account created" — was dropped silently. */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--bg3)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          },
        }}
      />
      <div className="crm-main-area" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', background: 'var(--bg2)', borderRadius: '16px', padding: '40px', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div className="crm-modal-avatar" style={{ width: '80px', height: '80px', fontSize: '2rem' }}>
              {data.fullname ? data.fullname.charAt(0).toUpperCase() : profile.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', color: 'var(--text)' }}>
                {data.fullname || profile.username}
              </h2>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                تاريخ التسجيل: {new Date(profile.created_at).toLocaleDateString("ar-SA")}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.plan && <span className="crm-tag primary-tag">{planLabel(data.plan)}</span>}
                {data.activity && <span className="crm-tag">{activityLabel(data.activity)}</span>}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {cleanPhone && (
              <a 
                href={`https://wa.me/${cleanPhone}`} 
                target="_blank" 
                rel="noreferrer"
                className="crm-btn-icon"
                title="مراسلة واتساب"
                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined">chat</span>
              </a>
            )}
            <Link 
              href={`/admin/builder?traineeId=${profile.id}`}
              className="crm-btn-primary"
              style={{ padding: '8px 24px', fontSize: '1rem', textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit_document</span>
              تصميم كورس
            </Link>
          </div>
        </div>

        {/* Details Grid */}
        <div className="crm-modal-grid-new" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <AccountManager profileId={profile.id} existingAccount={existingAccount} />
          <CycleHistory profileId={profile.id} />
          <RestDaysHistory profileId={profile.id} />
          <WorkoutProgress profileId={profile.id} />
          <ProfileDetailsTabs currentData={data} profileId={profile.id} />

        </div>
      </div>
    </div>
  );
}
