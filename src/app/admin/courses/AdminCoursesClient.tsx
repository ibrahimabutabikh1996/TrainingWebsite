"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Course } from "@/types/admin";
import AdminModal from "../components/AdminModal";
import { deleteCourseAction, assignCourseAction } from "../builder/actions";
import { toast, Toaster } from "react-hot-toast";
import "../crm.css";

export default function AdminCoursesClient({ 
  initialCourses,
  initialProfiles = []
}: { 
  initialCourses: Course[],
  initialProfiles?: { id: string, username: string, fullname: string }[]
}) {
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const courses = initialCourses || [];
  const profiles = initialProfiles || [];
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    router.refresh();
  }, [router]);

  // Filter and sort courses
  const filteredCourses = courses
    .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (activeFilter === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // default 'newest' / 'all'
    });

  const handleDeleteCourse = async () => {
    if (!showDeleteConfirm) return;
    setIsActionLoading(true);
    const toastId = toast.loading("جاري حذف الكورس...");
    
    try {
      const result = await deleteCourseAction(showDeleteConfirm);
      if (result.success) {
        toast.success("تم حذف الكورس بنجاح!", { id: toastId });
        setShowDeleteConfirm(null);
        if (selectedCourse?.id === showDeleteConfirm) setSelectedCourse(null);
        router.refresh();
      } else {
        toast.error(result.error || "فشل حذف الكورس.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ غير متوقع أثناء حذف الكورس.", { id: toastId });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAssignCourse = async () => {
    if (!showAssignModal || !selectedTraineeId) return;
    setIsActionLoading(true);
    const toastId = toast.loading("جاري تعيين الكورس للمشترك...");

    try {
      const result = await assignCourseAction(showAssignModal, selectedTraineeId);
      if (result.success) {
        toast.success("تم تعيين الكورس بنجاح!", { id: toastId });
        setShowAssignModal(null);
        setSelectedTraineeId("");
        router.refresh();
      } else {
        toast.error(result.error || "فشل تعيين الكورس.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ غير متوقع أثناء تعيين الكورس.", { id: toastId });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Stats
  const totalCourses = courses.length;
  const recentCourses = courses.filter(c => {
    const diffTime = Math.abs(new Date().getTime() - new Date(c.created_at).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 30;
  }).length;

  return (
    <div className="crm-dashboard">
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            background: 'var(--admin-bg-2)', 
            color: 'var(--admin-on-surface)', 
            border: '1px solid var(--admin-primary)', 
            padding: '16px 24px', 
            borderRadius: '4px',
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          } 
        }} 
      />

      <div className={`crm-split-layout ${selectedCourse ? 'has-drawer' : ''}`}>
        
        {/* Main List Area */}
        <div className="crm-main-area">
          
          <div className="crm-hero-header">
            <div className="crm-hero-title-group">
              <h1 className="crm-hero-title">مكتبة الكورسات</h1>
              <p className="crm-hero-subtitle">إدارة الخطط التدريبية وتطوير البرامج</p>
            </div>
            
            <div className="crm-hero-stats-group">
              <div className="crm-hero-stat">
                <span className="stat-val">{totalCourses}</span>
                <span className="stat-lbl">إجمالي الكورسات</span>
              </div>
              <div className="crm-hero-stat highlight">
                <span className="stat-val">+{recentCourses}</span>
                <span className="stat-lbl">انشئ حديثاً</span>
              </div>
              <div className="crm-hero-stat" style={{ justifyContent: 'flex-end', marginLeft: '16px' }}>
                <Link 
                  href="/admin/builder" 
                  className="crm-btn-primary"
                  style={{ padding: '12px 24px', fontSize: '1rem', textDecoration: 'none' }}
                >
                  <span className="material-symbols-outlined">add</span>
                  إنشاء كورس جديد
                </Link>
              </div>
            </div>
          </div>

          <div className="crm-toolbar">
            <div className="crm-search-box">
              <span className="material-symbols-outlined crm-search-icon">search</span>
              <input 
                type="text" 
                placeholder="ابحث عن كورس تدريبي..." 
                className="crm-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="crm-toolbar-filters">
              <select className="crm-filter-select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="all">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </div>
          </div>

          <div className="crm-list-cards">
            {filteredCourses.length === 0 ? (
              <div className="crm-empty-state">
                <span className="material-symbols-outlined">library_books</span>
                <p>لا توجد كورسات متاحة حالياً</p>
              </div>
            ) : (
              filteredCourses.map((course, i) => {
                let daysCount = 0;
                if (Array.isArray(course.days_data)) {
                  course.days_data.forEach((week: any) => {
                    if (week && Array.isArray(week.days)) {
                      daysCount += week.days.length;
                    }
                  });
                }
                const isSelected = selectedCourse?.id === course.id;

                return (
                  <div 
                    key={course.id} 
                    className={`crm-list-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedCourse(course)}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="crm-card-avatar">
                      <span className="material-symbols-outlined">fitness_center</span>
                    </div>
                    
                    <div className="crm-card-info">
                      <h4 className="crm-card-name">{course.name}</h4>
                      <span className="crm-card-handle">تطوير البرنامج التدريبي</span>
                    </div>

                    <div className="crm-card-meta">
                      <span className="crm-tag primary-tag">{course.days_data?.length || 0} أسابيع</span>
                      <span className="crm-tag">{daysCount} يوم</span>
                      <span className="crm-card-date">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                        {new Date(course.created_at).toLocaleDateString("ar-SA")}
                      </span>
                    </div>

                    <div className="crm-card-actions">
                      <button 
                        className="crm-btn-icon" 
                        onClick={(e) => { e.stopPropagation(); setShowAssignModal(course.id); }}
                        title="تعيين لمشترك"
                        style={{ marginLeft: '8px', border: 'none', background: 'transparent' }}
                      >
                        <span className="material-symbols-outlined">person_add</span>
                      </button>
                      <Link 
                        className="crm-btn-icon" 
                        href={`/admin/builder?courseId=${course.id}`}
                        onClick={(e) => { e.stopPropagation(); }}
                        title="تعديل"
                        style={{ border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'inherit' }}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </Link>
                      <button 
                        className="crm-btn-icon" 
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(course.id); }}
                        title="حذف"
                        style={{ border: 'none', background: 'transparent', color: 'var(--error, #ef4444)' }}
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side Drawer for Course Details */}
        {selectedCourse && (
          <div className="crm-side-drawer">
            <div className="crm-drawer-header">
              <button className="crm-drawer-close" onClick={() => setSelectedCourse(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="crm-drawer-actions">
                <button 
                  onClick={() => setShowAssignModal(selectedCourse.id)}
                  className="crm-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
                  تعيين لمشترك
                </button>
                <Link 
                  href={`/admin/builder?courseId=${selectedCourse.id}`}
                  className="crm-btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                  تعديل البرنامج
                </Link>
              </div>
            </div>

            <div className="crm-drawer-scroll-area">
              
              <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid color-mix(in srgb, var(--admin-on-surface) 6%, transparent)" }}>
                <h3 style={{ margin: "0 0 8px 0", color: "var(--admin-on-surface)", fontSize: "1.5rem", fontFamily: "var(--font-display)" }}>
                  {selectedCourse.name}
                </h3>
                <p style={{ margin: 0, color: "var(--admin-outline)", fontSize: "0.9rem" }}>
                  تم الإنشاء في: {new Date(selectedCourse.created_at).toLocaleDateString("ar-SA")}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {!Array.isArray(selectedCourse.days_data) || selectedCourse.days_data.length === 0 ? (
                  <div className="crm-empty-state" style={{ padding: "32px 16px" }}>
                    <span className="material-symbols-outlined">inventory_2</span>
                    <p style={{ margin: 0, fontSize: "0.95rem" }}>لا توجد تفاصيل أو تمارين مضافة لهذا الكورس.</p>
                  </div>
                ) : (
                  (selectedCourse.days_data as any[]).map((week: any, wIndex: number) => (
                    <div 
                      key={week.id || wIndex} 
                      className="crm-modal-section"
                      style={{ background: "var(--admin-bg-3)", padding: "16px", borderRadius: "4px", border: "1px solid color-mix(in srgb, var(--admin-on-surface) 4%, transparent)" }}
                    >
                      <h4 className="crm-modal-section-title">
                        <span className="material-symbols-outlined">calendar_view_week</span>
                        الأسبوع {wIndex + 1}
                      </h4>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {!week.days || week.days.length === 0 ? (
                          <div style={{ color: "var(--admin-outline)", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
                            لا توجد أيام تدريبية في هذا الأسبوع.
                          </div>
                        ) : (
                          week.days.map((day: any, dIndex: number) => (
                            <div 
                              key={day.id || dIndex} 
                              style={{ 
                                background: "var(--admin-bg-2)", 
                                border: "1px solid color-mix(in srgb, var(--admin-on-surface) 4%, transparent)", 
                                borderRadius: "4px", 
                                padding: "12px 16px" 
                              }}
                            >
                              <h5 style={{ margin: "0 0 12px 0", color: "var(--admin-on-surface)", fontWeight: "600", display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>calendar_today</span>
                                اليوم {dIndex + 1}
                              </h5>
                              
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {!day.exercises || day.exercises.length === 0 ? (
                                  <div style={{ color: "var(--admin-outline)", fontSize: "0.8rem", fontStyle: "italic" }}>
                                    لا توجد تمارين مضافة في هذا اليوم.
                                  </div>
                                ) : (
                                  day.exercises.map((ex: any, exIndex: number) => (
                                    <div 
                                      key={ex.id || exIndex} 
                                      style={{ 
                                        background: "color-mix(in srgb, var(--admin-on-surface) 2%, transparent)", 
                                        border: "1px solid color-mix(in srgb, var(--admin-on-surface) 4%, transparent)", 
                                        borderRadius: "4px", 
                                        padding: "10px 12px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--admin-on-surface)" }}>
                                          {exIndex + 1}. {ex.name_ar || ex.name || "تمرين غير مسمى"}
                                        </span>
                                        <span className="crm-tag primary-tag" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>
                                          {ex.target_muscle}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: "0.8rem", color: "var(--admin-outline)", display: "flex", gap: "12px" }}>
                                        <span>الجولات: {ex.sets}</span>
                                        <span>•</span>
                                        <span>التكرار: {Array.isArray(ex.reps) ? ex.reps.join(" - ") : ex.reps || "10"}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal (kept as centered modal as it requires select input) */}
      {showAssignModal && (
        <AdminModal
          isOpen={!!showAssignModal}
          onClose={() => { setShowAssignModal(null); setSelectedTraineeId(""); }}
          title="تعيين الكورس لمشترك"
          icon="person_add"
          maxWidth={500}
        >
          <div style={{ padding: 24, direction: "rtl", textAlign: "right" }}>
            <label style={{ display: "block", fontSize: "0.9rem", color: "var(--admin-outline)", marginBottom: 12, fontWeight: 500 }}>
              اختر المشترك الذي ترغب في تعيين الكورس له:
            </label>
            <select 
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
              className="crm-filter-select"
              style={{ width: "100%", marginBottom: 24 }}
            >
              <option value="">-- اختر مشترك --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.fullname} (@{p.username})
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button 
                onClick={() => { setShowAssignModal(null); setSelectedTraineeId(""); }} 
                disabled={isActionLoading}
                className="crm-btn-secondary"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAssignCourse}
                disabled={isActionLoading || !selectedTraineeId}
                className="crm-btn-primary"
                style={{ opacity: (isActionLoading || !selectedTraineeId) ? 0.6 : 1 }}
              >
                {isActionLoading ? "جاري التعيين..." : "تعيين الجدول"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <AdminModal
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          title="تأكيد الحذف"
          icon="delete"
          maxWidth={400}
        >
          <div style={{ padding: 24, textAlign: "center", direction: "rtl" }}>
            <p style={{ margin: "0 0 24px 0", color: "var(--admin-on-surface)", fontSize: "1rem", lineHeight: 1.6 }}>
              هل أنت متأكد من رغبتك في حذف هذا الكورس؟ <br/>
              <span style={{ color: "var(--error, #ef4444)", fontSize: "0.85rem" }}>لا يمكن التراجع عن هذا الإجراء وسيتم إلغاء تعيينه من المتدربين.</span>
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                disabled={isActionLoading}
                className="crm-btn-secondary"
                style={{ flex: 1 }}
              >
                تراجع
              </button>
              <button 
                onClick={handleDeleteCourse}
                disabled={isActionLoading}
                className="crm-btn-primary"
                style={{ flex: 1, background: "var(--error, #ef4444)", color: "white" }}
              >
                {isActionLoading ? "جاري الحذف..." : "نعم، احذف"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
