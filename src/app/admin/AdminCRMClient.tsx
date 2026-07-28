"use client";

import type { JsonRecord } from "@/types";
import { useEffect, useState } from "react";
import { Profile } from "@/types/admin";
import { Toaster, toast } from "react-hot-toast";
import { planLabel } from "@/lib/formLabels";
import "./crm.css";

/* The intake blob, parsed. Older rows stored it as a string, newer ones as JSON.
   Lives outside the component: it reads nothing but its argument, and an effect
   near the top of the component used to call it before its declaration ran. */
function getProfileData(p: Profile): JsonRecord {
  if (typeof p.data === "string") {
    try {
      return JSON.parse(p.data);
    } catch {
      return {};
    }
  }
  return p.data || {};
}

export default function AdminCRMClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles || []);

  useEffect(() => {
    // Show persistent toasts for unread profiles on mount
    profiles.forEach(p => {
      const data = getProfileData(p);
      if (data.is_new) {
        toast(() => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 'bold' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications_active</span>
              {data.is_renewal ? 'طلب تجديد اشتراك!' : 'مشترك جديد!'}
            </div>
            <div>
              قام <strong>{data.fullname || p.username}</strong> للتو بطلب {data.is_renewal ? 'تجديد الاشتراك' : 'التسجيل'} واختار: 
              <br/> <span style={{ color: 'var(--primary)' }}>{planLabel(data.plan, "غير محدد")}</span>
            </div>
          </div>
        ), {
          id: p.id, // Use profile ID so we can dismiss it later
          duration: Infinity, // Doesn't disappear
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectProfile = async (profile: Profile) => {
    // Open in a new tab immediately
    window.open(`/admin/profile/${profile.id}`, '_blank');
    
    const data = getProfileData(profile);
    if (data.is_new) {
      // Dismiss the toast
      toast.dismiss(profile.id);
      
      // Update local state to remove the badge
      setProfiles(prev => prev.map(p => {
        if (p.id === profile.id) {
          const pData = getProfileData(p);
          return { ...p, data: { ...pData, is_new: false } };
        }
        return p;
      }));

      // Call API to update database
      try {
        await fetch("/api/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: profile.id })
        });
      } catch (err) {
        console.error("Failed to mark profile as read", err);
      }
    }
  };

  const handleToggleSuspend = async (e: React.MouseEvent, profile: Profile) => {
    e.stopPropagation(); // Prevent card click
    
    const data = getProfileData(profile);
    const isSuspended = !!profile.is_suspended;

    if (!confirm(`هل أنت متأكد من رغبتك في ${isSuspended ? "تفعيل" : "إيقاف"} حساب ${data.fullname || profile.username}؟`)) return;

    try {
      const res = await fetch("/api/admin/suspend-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, isSuspended: !isSuspended }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "حدث خطأ");
        return;
      }

      toast.success(`تم ${isSuspended ? "تفعيل" : "إيقاف"} الحساب بنجاح`);
      
      // Update local state
      setProfiles(prev => prev.map(p => {
        if (p.id === profile.id) {
          const pData = getProfileData(p);
          const newIsSuspended = !isSuspended;
          const newActivationDate = (!newIsSuspended && !pData.activation_date) ? new Date().toISOString() : pData.activation_date;
          return { ...p, is_suspended: newIsSuspended, data: { ...pData, is_suspended: newIsSuspended, activation_date: newActivationDate } };
        }
        return p;
      }));

    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    }
  };

  const filteredProfiles = profiles
    .filter((p) => {
      const data = getProfileData(p);
      const term = search.toLowerCase();
      const name = data.fullname?.toLowerCase() || "";
      const username = p.username?.toLowerCase() || "";
      const matchesSearch = name.includes(term) || username.includes(term);
      
      if (!matchesSearch) return false;
      if (filterPlan !== "all") {
        /* Stored as the plan key from the landing-page link ("plan1".."plan3"),
           never as Arabic text — the old substring matching never matched, so
           every filter returned an empty list. */
        const plan = String(data.plan || "");
        if (filterPlan === "bronze") return plan === "plan1";
        if (filterPlan === "silver") return plan === "plan2";
        if (filterPlan === "primary") return plan === "plan3";
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

  // Calculate Stats
  const totalSubscribers = profiles.length;
  const recentSubscribers = profiles.filter(p => {
    const diffTime = Math.abs(new Date().getTime() - new Date(p.created_at).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 30;
  }).length;
  const activePlans = profiles.filter(p => {
    const plan = getProfileData(p).plan;
    return plan && plan.trim() !== "";
  }).length;

  return (
    <div className="crm-dashboard">
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            background: '#141414', 
            color: '#F0EDE8', 
            border: '1px solid var(--primary)', 
            padding: '16px 24px', 
            borderRadius: '4px',
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          } 
        }} 
      />
      
      <div className="crm-split-layout">
        
        {/* Main List Area */}
        <div className="crm-main-area" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div className="crm-hero-header">
            <div className="crm-hero-title-group">
              <h1 className="crm-hero-title">نظرة عامة</h1>
              <p className="crm-hero-subtitle">تحليل وتتبع أداء المتدربين</p>
            </div>
            
            <div className="crm-hero-stats-group">
              <div className="crm-hero-stat">
                <span className="stat-val">{totalSubscribers}</span>
                <span className="stat-lbl">إجمالي المتدربين</span>
              </div>
              <div className="crm-hero-stat highlight">
                <span className="stat-val">{activePlans}</span>
                <span className="stat-lbl">باقات نشطة</span>
              </div>
              <div className="crm-hero-stat">
                <span className="stat-val">+{recentSubscribers}</span>
                <span className="stat-lbl">انضموا حديثاً</span>
              </div>
            </div>
          </div>

          <div className="crm-toolbar">
            <div className="crm-search-box">
              <span className="material-symbols-outlined crm-search-icon">search</span>
              <input 
                type="text" 
                placeholder="ابحث باسم المتدرب أو المعرف..." 
                className="crm-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="crm-toolbar-filters">
              <select className="crm-filter-select" value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
                <option value="all">جميع الباقات</option>
                <option value="bronze">التدريب الذاتي</option>
                <option value="silver">المتابعة الاسبوعية</option>
                <option value="primary">المتابعة اليومية</option>
              </select>
              <select className="crm-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </div>
          </div>

          <div className="crm-list-cards">
            {filteredProfiles.length === 0 ? (
              <div className="crm-empty-state">
                <span className="material-symbols-outlined">person_off</span>
                <p>لا يوجد متدربين مطابقين للبحث</p>
              </div>
            ) : (
              filteredProfiles.map((profile, i) => {
                const data = getProfileData(profile);
                const displayName = data.fullname || profile.username;
                const initial = displayName ? displayName.charAt(0).toUpperCase() : "?";

                return (
                  <div 
                    key={profile.id} 
                    className="crm-list-card"
                    onClick={() => handleSelectProfile(profile)}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="crm-card-avatar" style={{ position: 'relative' }}>
                      {initial}
                      {data.is_new && (
                        <div style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, background: '#ef4444', borderRadius: '50%', border: '2px solid var(--bg-2)' }} title="مشترك جديد"></div>
                      )}
                    </div>
                    
                    <div className="crm-card-info">
                      <h4 className="crm-card-name" style={{ margin: 0 }}>{displayName}</h4>
                    </div>

                    <div className="crm-card-meta">
                      <span className={`crm-tag ${data.plan ? 'primary-tag' : ''}`}>
                        {planLabel(data.plan, "غير محدد")}
                      </span>
                      <span className="crm-card-date" title="تاريخ بداية الاشتراك">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                        {new Date(data.activation_date || profile.created_at).toLocaleDateString("ar-SA")}
                      </span>
                    </div>

                    <div className="crm-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={(e) => handleToggleSuspend(e, profile)}
                        title={profile.is_suspended ? "تفعيل الحساب" : "إيقاف الحساب"}
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: profile.is_suspended ? 'var(--primary)' : 'var(--error, #ef4444)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          borderRadius: '4px',
                          transition: '0.2s'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {profile.is_suspended ? 'play_circle' : 'block'}
                        </span>
                      </button>
                      <span className="material-symbols-outlined crm-chevron">chevron_left</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
