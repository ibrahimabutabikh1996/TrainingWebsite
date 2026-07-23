"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Profile } from "@/types/admin";
import { Toaster, toast } from "react-hot-toast";
import "./crm.css";

export default function AdminCRMClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const profiles = initialProfiles || [];

  const getProfileData = (p: Profile) => {
    if (typeof p.data === "string") {
      try {
        return JSON.parse(p.data);
      } catch (e) {
        return {};
      }
    }
    return p.data || {};
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
        const plan = data.plan?.toLowerCase() || "";
        if (filterPlan === "bronze") return plan.includes("برونز") || plan.includes("bronze") || plan.includes("ذاتي");
        if (filterPlan === "silver") return plan.includes("فض") || plan.includes("silver") || plan.includes("اسبوع") || plan.includes("أسبوع");
        if (filterPlan === "primary") return plan.includes("ذهب") || plan.includes("primary") || plan.includes("يومي");
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

  const handleChatTrainee = () => {
    if (!selectedProfile) return;
    const data = getProfileData(selectedProfile);
    const phone = data.phone || data.mobile;
    if (!phone) {
      toast.error("لا يوجد رقم هاتف مسجل لهذا المشترك.");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

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
      
      <div className={`crm-split-layout ${selectedProfile ? 'has-drawer' : ''}`}>
        
        {/* Main List Area */}
        <div className="crm-main-area">
          
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
                const isSelected = selectedProfile?.id === profile.id;
                const displayName = data.fullname || profile.username;
                const initial = displayName ? displayName.charAt(0).toUpperCase() : "?";

                return (
                  <div 
                    key={profile.id} 
                    className={`crm-list-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedProfile(profile)}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="crm-card-avatar">{initial}</div>
                    
                    <div className="crm-card-info">
                      <h4 className="crm-card-name">{displayName}</h4>
                      <span className="crm-card-handle">@{profile.username}</span>
                    </div>

                    <div className="crm-card-meta">
                      <span className={`crm-tag ${data.plan ? 'primary-tag' : ''}`}>
                        {data.plan || "غير محدد"}
                      </span>
                      <span className="crm-card-date">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                        {new Date(profile.created_at).toLocaleDateString("ar-SA")}
                      </span>
                    </div>

                    <div className="crm-card-actions">
                      <span className="material-symbols-outlined crm-chevron">chevron_left</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side Drawer */}
        {selectedProfile && (
          <div className="crm-side-drawer">
            <div className="crm-drawer-header">
              <button className="crm-drawer-close" onClick={() => setSelectedProfile(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="crm-drawer-actions">
                <button 
                  onClick={handleChatTrainee}
                  className="crm-btn-icon"
                  title="مراسلة واتساب"
                >
                  <span className="material-symbols-outlined">chat</span>
                </button>
                <Link 
                  href={`/admin/builder?traineeId=${selectedProfile.id}`}
                  className="crm-btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_document</span>
                  تصميم كورس
                </Link>
              </div>
            </div>

            <div className="crm-drawer-scroll-area">
              <div className="crm-modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <div className="crm-modal-avatar">
                  {selectedProfile.data?.fullname ? selectedProfile.data.fullname.charAt(0).toUpperCase() : selectedProfile.username.charAt(0).toUpperCase()}
                </div>
                <div className="crm-modal-header-info">
                  <h3>{selectedProfile.data?.fullname || selectedProfile.username}</h3>
                  <p>@{selectedProfile.username} • منذ {new Date(selectedProfile.created_at).toLocaleDateString("ar-SA")}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    {selectedProfile.data?.plan && (
                      <span className="crm-tag primary-tag">{selectedProfile.data.plan}</span>
                    )}
                    {selectedProfile.data?.activity && (
                      <span className="crm-tag">{selectedProfile.data.activity}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="crm-modal-grid-new" style={{ display: 'flex', flexDirection: 'column', marginTop: '32px' }}>
                
                <div className="crm-modal-section">
                  <h4 className="crm-modal-section-title">
                    <span className="material-symbols-outlined">person</span>
                    المعلومات الأساسية
                  </h4>
                  <div className="crm-stats-grid-small" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="crm-stat-box-small">
                      <span className="material-symbols-outlined">cake</span>
                      <div className="crm-stat-box-info">
                        <span className="label">العمر</span>
                        <span className="value">{selectedProfile.data?.age ? `${selectedProfile.data.age} سنة` : "--"}</span>
                      </div>
                    </div>
                    <div className="crm-stat-box-small">
                      <span className="material-symbols-outlined">wc</span>
                      <div className="crm-stat-box-info">
                        <span className="label">الجنس</span>
                        <span className="value">{selectedProfile.data?.gender === "female" ? "أنثى" : (selectedProfile.data?.gender === "male" ? "ذكر" : "--")}</span>
                      </div>
                    </div>
                    <div className="crm-stat-box-small" style={{ gridColumn: '1 / -1' }}>
                      <span className="material-symbols-outlined">call</span>
                      <div className="crm-stat-box-info">
                        <span className="label">رقم الهاتف</span>
                        <span className="value" style={{ direction: "ltr", textAlign: "right" }}>{selectedProfile.data?.phone || selectedProfile.data?.mobile || "غير مسجل"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="crm-modal-section">
                  <h4 className="crm-modal-section-title">
                    <span className="material-symbols-outlined">monitor_weight</span>
                    المؤشرات البدنية
                  </h4>
                  <div className="crm-stats-grid-small" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="crm-stat-box-small">
                      <span className="material-symbols-outlined">height</span>
                      <div className="crm-stat-box-info">
                        <span className="label">الطول</span>
                        <span className="value">{selectedProfile.data?.height ? `${selectedProfile.data.height} سم` : "--"}</span>
                      </div>
                    </div>
                    <div className="crm-stat-box-small">
                      <span className="material-symbols-outlined">scale</span>
                      <div className="crm-stat-box-info">
                        <span className="label">الوزن</span>
                        <span className="value">{selectedProfile.data?.weight ? `${selectedProfile.data.weight} كج` : "--"}</span>
                      </div>
                    </div>
                    <div className="crm-stat-box-small primary-box" style={{ gridColumn: '1 / -1' }}>
                      <span className="material-symbols-outlined">target</span>
                      <div className="crm-stat-box-info">
                        <span className="label">الوزن المستهدف</span>
                        <span className="value primary-text">{selectedProfile.data?.targetWeight ? `${selectedProfile.data.targetWeight} كج` : "--"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="crm-modal-section">
                  <h4 className="crm-modal-section-title">
                    <span className="material-symbols-outlined">flag</span>
                    الهدف الصحي
                  </h4>
                  <div className="crm-stat-box-small highlight-box">
                    <div className="crm-stat-box-info">
                      <span className="value" style={{ lineHeight: '1.6' }}>{selectedProfile.data?.goal || "لم يقم المتدرب بتحديد هدف تفصيلي بعد."}</span>
                    </div>
                  </div>
                </div>

                {selectedProfile.data?.allergies && (
                  <div className="crm-modal-section">
                    <h4 className="crm-modal-section-title">
                      <span className="material-symbols-outlined">warning</span>
                      ملاحظات صحية (حساسية)
                    </h4>
                    <div className="crm-stat-box-small" style={{ borderLeft: '4px solid var(--error, #ef4444)' }}>
                      <div className="crm-stat-box-info">
                        <span className="value" style={{ lineHeight: '1.6' }}>{selectedProfile.data.allergies}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {selectedProfile.data?.photos && Object.keys(selectedProfile.data.photos).length > 0 && (
                <div className="crm-modal-gallery" style={{ marginTop: '32px' }}>
                  <h4 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--admin-on-surface)' }}>التطور الجسدي (الصور)</h4>
                  <div className="crm-gallery-scroll">
                    {Object.entries(selectedProfile.data.photos).map(([key, url]: [string, any]) => (
                      url && (
                        <div key={key} className="crm-gallery-item">
                          <div className="crm-gallery-img">
                            <img src={url} alt={key} loading="lazy" />
                          </div>
                          <span>
                            {key === "front" ? "أمامية" : key === "back" ? "خلفية" : key === "side" ? "جانبية" : key}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
