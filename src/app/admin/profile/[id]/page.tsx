import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Toaster } from "react-hot-toast";
import AccountManager from "@/components/admin/AccountManager";
import ProfileDetailsTabs from "@/components/admin/ProfileDetailsTabs";
import DeleteSubscriberZone from "@/components/admin/DeleteSubscriberZone";
import WorkoutProgress from "@/components/admin/WorkoutProgress";
import CycleHistory from "@/components/admin/CycleHistory";
import AdminSubscriptionTimeline from "@/components/admin/AdminSubscriptionTimeline";
import { activityLabel, planLabel } from "@/lib/formLabels";
import "../../crm.css";
import type { JsonRecord } from "@/types";
import { Icon } from "@/components/Icon";

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
    <div className="crm-dashboard">
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
      <div className="crm-main-area">
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px', borderBottom: '1px solid color-mix(in srgb, var(--border) 60%, transparent)', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}>
            <div className="crm-modal-avatar" style={{ width: '72px', height: '72px', fontSize: '2rem', flexShrink: 0, borderRadius: 'var(--radius-xl)' }}>
              <Icon name="user_male" style={{ fontSize: 44 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '1.6rem', margin: '0 0 8px 0', color: 'var(--text)', lineHeight: 1.3, fontWeight: 700 }}>
                {data.fullname || profile.username}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                  تاريخ التسجيل: <strong style={{ color: 'var(--text-secondary)' }}>{new Date(profile.created_at).toLocaleDateString("en-GB")}</strong>
                </p>
                {cleanPhone && (
                  <a 
                    href={`https://wa.me/${cleanPhone}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="crm-btn-whatsapp"
                    title="مراسلة واتساب"
                    style={{ width: '36px', height: '36px', textDecoration: 'none' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 448 512" fill="currentColor">
                      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-23.1-115-65.1-157.1zM223.9 414.7c-33 0-65.3-8.9-93.6-25.7l-6.7-4-69.5 18.2L72.7 334l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                    </svg>
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.plan && <span className={`crm-tag ${data.plan.replace('plan', 'plan-')}`} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>{planLabel(data.plan)}</span>}
                {data.activity && <span className="crm-tag" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>{activityLabel(data.activity)}</span>}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {data.plan_type !== 'diet' && Array.isArray(data.workouts) && data.workouts.length > 0 && (
              <a
                href={`/export-workout?profileId=${profile.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="crm-btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.95rem', textDecoration: 'none' }}
              >
                <Icon name="file_download" style={{ fontSize: '20px' }} />
                <span>تحميل النظام التدريبي PDF</span>
              </a>
            )}

            {data.plan_type !== 'diet' && (
              <Link
                href={`/admin/builder?traineeId=${profile.id}`}
                className="crm-btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.95rem', textDecoration: 'none' }}
              >
                <Icon name="edit_document" style={{ fontSize: '20px' }} />
                <span>تصميم كورس</span>
              </Link>
            )}
            
            {data.plan_type !== 'training' && (
              <Link
                href={`/admin/diet/plan?traineeId=${profile.id}`}
                className="crm-btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.95rem', textDecoration: 'none' }}
              >
                <Icon name="restaurant_menu" style={{ fontSize: '20px' }} />
                <span>تصميم نظام غذائي</span>
              </Link>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="crm-modal-grid-new" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <AccountManager profileId={profile.id} existingAccount={existingAccount} />
          <AdminSubscriptionTimeline profileId={profile.id} />
          {data.plan_type !== 'diet' && (
            <>
              <CycleHistory profileId={profile.id} />
              <WorkoutProgress profileId={profile.id} />
            </>
          )}
          <ProfileDetailsTabs currentData={data} profileId={profile.id} />
          <DeleteSubscriberZone profileId={profile.id} />
          <DeleteSubscriberZone profileId={profile.id} />

        </div>
      </div>
    </div>
  );
}
