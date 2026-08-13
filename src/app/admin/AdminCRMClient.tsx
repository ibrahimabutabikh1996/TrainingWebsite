"use client";

import type { JsonRecord } from "@/types";
import { useEffect, useState } from "react";
import { Profile } from "@/types/admin";
import { Toaster, toast } from "react-hot-toast";
import { planLabel } from "@/lib/formLabels";
import { Icon } from "@/components/Icon";
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

function CustomSelect({ value, onChange, options }: { value: string, onChange: (val: string) => void, options: {value: string, label: string}[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="crm-custom-select-container">
      <button 
        type="button" 
        className={`crm-filter-select ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption?.label}</span>
        <Icon name="expand_more" className="crm-select-icon" />
      </button>

      {isOpen && (
        <>
          <div className="crm-select-backdrop" onClick={() => setIsOpen(false)} />
          <div className="crm-select-dropdown">
            {options.map(opt => (
              <button
                key={opt.value}
                className={`crm-select-option ${opt.value === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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
              <Icon name="notifications_active" style={{ fontSize: 20 }} />
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

  const handleExportToExcel = () => {
    if (profiles.length === 0) return;

    // Build CSV content
    const headers = ["اسم المستخدم", "الاسم الكامل", "رقم الهاتف", "تاريخ الانضمام", "نوع الخطة", "عدد اشهر الاشتراك"];
    
    const rows = profiles.map(p => {
      const data = getProfileData(p);
      const fullname = data.fullname || "";
      const phone = data.phone || "";
      const plan = planLabel(data.plan, "غير محدد");
      const dateObj = new Date(p.created_at);
      const dateStr = dateObj.toLocaleDateString("ar-EG");
      
      const diffTime = Date.now() - dateObj.getTime();
      // Using 30.44 days for an average month
      const diffMonths = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)));

      // Wrap strings in quotes to handle commas correctly
      return [
        `"${p.username || ""}"`, 
        `"${fullname}"`, 
        `"${phone}"`, 
        `"${dateStr}"`, 
        `"${plan}"`,
        `"${diffMonths}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    
    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `subscribers_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      const dateA = new Date(a.created_at).getTime();            <div className="crm-hero-stats-group">
              <div className="crm-hero-stat">
                <span className="stat-val">{totalSubscribers}</span>
                <span className="stat-lbl">إجمالي المتدربين</span>
              </div>
            </div>
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
            color: 'var(--text)', 
            border: '1px solid var(--primary)', 
            padding: '16px 24px', 
            borderRadius: "var(--radius-xs)",
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          } 
        }} 
      />
      
      <div className="crm-split-layout">
        
        {/* Main List Area */}
        <div className="crm-main-area">
          <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div className="crm-hero-header">
            <div className="crm-hero-title-group">
              <h1 className="crm-hero-title">ادارة المشتركين</h1>
              <p className="crm-hero-subtitle">تحليل وتتبع أداء المتدربين</p>
            </div>
            <div className="crm-hero-stats-group">
              <div className="crm-hero-stat">
                <span className="stat-val">{totalSubscribers}</span>
                <span className="stat-lbl">إجمالي المتدربين</span>
              </div>
            </div>
          </div>

          <div className="crm-toolbar">
            <div className="crm-search-box">
              <Icon name="search" className="crm-search-icon" />
              <input 
                type="text" 
                placeholder="ابحث باسم المتدرب أو المعرف..." 
                className="crm-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="crm-toolbar-filters">
              <CustomSelect 
                value={filterPlan} 
                onChange={setFilterPlan} 
                options={[
                  { value: "all", label: "جميع الخطط" },
                  { value: "bronze", label: "خطة ذاتية التوجيه" },
                  { value: "silver", label: "خطة المتابعة الأسبوعية" },
                  { value: "primary", label: "خطة المتابعة اليومية" }
                ]} 
              />
              <CustomSelect 
                value={sortBy} 
                onChange={setSortBy} 
                options={[
                  { value: "newest", label: "الأحدث أولاً" },
                  { value: "oldest", label: "الأقدم أولاً" }
                ]} 
              />
              <button 
                className="crm-export-btn"
                onClick={handleExportToExcel}
                title="تصدير جميع بيانات المشتركين إلى ملف إكسل"
              >
                <Icon name="excel" />
                تصدير إكسل
              </button>
            </div>
          </div>

          <div className="crm-list-cards">
            {filteredProfiles.length === 0 ? (
              <div className="crm-empty-state">
                <Icon name="person_off" />
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
                      <Icon name="user_male" style={{ fontSize: 28 }} />
                      {data.is_new && (
                        <div style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, background: '#ef4444', borderRadius: '50%', border: '2px solid var(--bg-2)' }} title="مشترك جديد"></div>
                      )}
                    </div>
                    
                    <div className="crm-card-info">
                      <h4 className="crm-card-name" style={{ margin: 0 }}>{displayName}</h4>
                    </div>

                    <div className="crm-card-meta">
                      <span className={`crm-tag ${
                        data.plan === 'plan1' ? 'plan-1' : 
                        data.plan === 'plan2' ? 'plan-2' : 
                        data.plan === 'plan3' ? 'plan-3' : 
                        data.plan ? 'primary-tag' : ''
                      }`}>
                        {planLabel(data.plan, "غير محدد")}
                      </span>
                      {data.plan_type && (
                        <span className="crm-tag" style={{ background: "var(--bg3)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                          {data.plan_type === 'both' ? 'نظام تدريبي + غذائي' : 
                           data.plan_type === 'diet' ? 'نظام غذائي فقط' : 
                           data.plan_type === 'training' ? 'نظام تدريبي فقط' : data.plan_type}
                        </span>
                      )}
                      <span className="crm-card-date" title="تاريخ بداية الاشتراك">
                        <Icon name="calendar_today" style={{ fontSize: 14 }} />
                        {new Date(data.activation_date || profile.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>

                    <div className="crm-card-actions">
                      <Icon name="chevron_left" className="crm-chevron" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
