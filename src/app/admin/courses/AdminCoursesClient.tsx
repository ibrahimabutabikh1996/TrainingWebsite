"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Course,
  CourseAssignments,
  TraineeOption,
  asDays,
  countDays,
  countExercises,
} from "@/types/admin";
import AdminModal from "../components/AdminModal";
import { deleteCourseAction, assignCourseAction } from "../builder/actions";
import { arabicCount, DAY, EXERCISE, TRAINEE } from "@/lib/arabicCount";
import { toast, Toaster } from "react-hot-toast";
import { Icon } from "@/components/Icon";
import "../crm.css";
import "./courses.css";

const SORTS: [string, string][] = [
  ["newest", "الأحدث"],
  ["oldest", "الأقدم"],
  ["name", "الاسم"],
];

const ASSIGN_FILTERS: [string, string][] = [
  ["all", "الكل"],
  ["assigned", "مُعيَّنة"],
  ["unassigned", "غير مُعيَّنة"],
];

export default function AdminCoursesClient({
  initialCourses,
  initialTrainees = [],
  initialAssignments = {},
  recentCourses = 0
}: {
  initialCourses: Course[],
  initialTrainees?: TraineeOption[],
  initialAssignments?: CourseAssignments,
  /** Courses created in the last 30 days, counted server-side. */
  recentCourses?: number
}) {
  const router = useRouter();
  /* Only the id is held in state. Keeping the whole course object meant the
     drawer kept rendering a stale snapshot after router.refresh() — an edit or
     a new assignment wouldn't show until the drawer was reopened. */
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const courses = initialCourses || [];
  const trainees = initialTrainees || [];
  const assignments = initialAssignments || {};
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("newest");
  /* "Which courses are actually in use?" was only answerable by reading every
     card, so assignment state is now a filter of its own. */
  const [assignFilter, setAssignFilter] = useState("all");

  /* Derived from the latest props, so it can never go stale. Also self-heals if
     the course is deleted from under the drawer. */
  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  const assignedTo = (courseId: string) => assignments[courseId] ?? [];

  const query = searchTerm.trim().toLowerCase();
  const filteredCourses = courses
    .filter((c) => {
      const matchesQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.description ?? "").toLowerCase().includes(query) ||
        assignedTo(c.id).some((n) => n.toLowerCase().includes(query));
      if (!matchesQuery) return false;

      const isAssigned = assignedTo(c.id).length > 0;
      if (assignFilter === "assigned") return isAssigned;
      if (assignFilter === "unassigned") return !isAssigned;
      return true;
    })
    .sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      if (activeFilter === "oldest") return at - bt;
      if (activeFilter === "name") return a.name.localeCompare(b.name, "ar");
      return bt - at; // newest first
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
        if (selectedCourseId === showDeleteConfirm) setSelectedCourseId(null);
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
  /* recentCourses arrives from the server: deriving it here meant reading the
     clock during render, which is impure and can shift between re-renders. */
  /* How many courses are actually in a trainee's hands right now — more useful
     than repeating the total under a different label. */
  const assignedCourses = courses.filter((c) => assignedTo(c.id).length > 0).length;

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

      <div className="crm-split-layout">
        
        {/* Main List Area */}
        <div className="crm-main-area co-page">

          <header className="co-header">
            <div className="co-header-text">
              <h1>مكتبة الكورسات</h1>
              <p>إدارة الخطط التدريبية وتعيينها للمشتركين.</p>
              <div className="co-stats">
                <span className="co-stat"><b>{totalCourses}</b> كورس</span>
                <span className="co-stat"><b>{assignedCourses}</b> مُعيَّن</span>
                <span className="co-stat"><b>{recentCourses}</b> خلال ٣٠ يوماً</span>
              </div>
            </div>

            <Link href="/admin/builder" className="co-add-btn">
              <Icon name="add" style={{ fontSize: 20 }} />
              <span>إنشاء كورس جديد</span>
            </Link>
          </header>

          <div className="co-toolbar">
            <div className="co-toolbar-row">
              <div className="co-search">
                <Icon name="search" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الهدف أو اسم المشترك..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button className="co-search-clear" onClick={() => setSearchTerm("")} aria-label="مسح البحث">
                    <Icon name="close" style={{ fontSize: 16 }} />
                  </button>
                )}
              </div>

              {/* Was a plain dropdown; a segmented control shows the active sort
                  without having to open it. */}
              <div className="co-segment" role="group" aria-label="الترتيب">
                {SORTS.map(([v, label]) => (
                  <button key={v} onClick={() => setActiveFilter(v)} aria-pressed={activeFilter === v}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="co-toolbar-row">
              <span className="co-filter-label">حالة التعيين</span>
              <div className="co-segment" role="group" aria-label="حالة التعيين">
                {ASSIGN_FILTERS.map(([v, label]) => (
                  <button key={v} onClick={() => setAssignFilter(v)} aria-pressed={assignFilter === v}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="co-count">
            عرض <b>{filteredCourses.length}</b> من {totalCourses} كورس
          </p>

          <div className="co-grid">
            {filteredCourses.length === 0 ? (
              /* A fruitless search is not the same as an empty library. */
              <div className="co-empty">
                <Icon name={courses.length === 0 ? "library_books" : "search_off"} />
                <p>
                  {courses.length === 0
                    ? "لا توجد كورسات بعد — ابدأ بإنشاء كورس جديد"
                    : "لا توجد كورسات تطابق البحث أو التصفية الحالية"}
                </p>
                {courses.length === 0 ? (
                  <Link href="/admin/builder" className="co-add-btn">
                    <Icon name="add" style={{ fontSize: 20 }} />
                    <span>إنشاء كورس جديد</span>
                  </Link>
                ) : (
                  <button
                    className="co-add-btn"
                    onClick={() => { setSearchTerm(""); setAssignFilter("all"); }}
                  >
                    <Icon name="filter_alt_off" style={{ fontSize: 20 }} />
                    <span>إزالة التصفية</span>
                  </button>
                )}
              </div>
            ) : (
              filteredCourses.map((course) => {
                const daysCount = countDays(course.days_data);
                const exCount = countExercises(course.days_data);
                const assigned = assignedTo(course.id);
                const isSelected = selectedCourseId === course.id;

                return (
                  <article
                    key={course.id}
                    className={`co-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    <div className="co-card-head">
                      <span className="co-card-icon">
                        <Icon name="fitness_center" />
                      </span>
                      <div className="co-card-title">
                        <h3>{course.name}</h3>
                        <p>
                          {course.description?.trim()
                            ? course.description
                            : "لا يوجد وصف لهذا الكورس"}
                        </p>
                      </div>
                    </div>

                    <div className="co-chips">
                      {daysCount === 0 ? (
                        <span className="co-chip co-chip--empty">
                          <Icon name="warning" />
                          برنامج فارغ
                        </span>
                      ) : (
                        <>
                          <span className="co-chip co-chip--primary">{arabicCount(daysCount, DAY)}</span>
                          <span className="co-chip">{arabicCount(exCount, EXERCISE)}</span>
                        </>
                      )}
                      {assigned.length > 0 && (
                        <span className="co-chip co-chip--assigned" title={assigned.join("، ")}>
                          <Icon name="person" />
                          {arabicCount(assigned.length, TRAINEE)}
                        </span>
                      )}
                    </div>

                    <div className="co-card-foot">
                      <span className="co-card-date">
                        <Icon name="calendar_today" />
                        {new Date(course.created_at).toLocaleDateString("ar-SA")}
                      </span>

                      <div className="co-actions">
                        <button
                          className="co-icon-btn"
                          onClick={(e) => { e.stopPropagation(); setShowAssignModal(course.id); }}
                          title="تعيين لمشترك"
                          aria-label={`تعيين ${course.name} لمشترك`}
                        >
                          <Icon name="person_add" />
                        </button>
                        <Link
                          className="co-icon-btn"
                          href={`/admin/builder?courseId=${course.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title="تعديل"
                          aria-label={`تعديل ${course.name}`}
                        >
                          <Icon name="edit" />
                        </Link>
                        <button
                          className="co-icon-btn danger"
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(course.id); }}
                          title="حذف"
                          aria-label={`حذف ${course.name}`}
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {/* Centered Modal for Course Details */}
        {selectedCourse && (
          <AdminModal
            isOpen={!!selectedCourse}
            onClose={() => setSelectedCourseId(null)}
            title={selectedCourse.name}
            icon="fitness_center"
            maxWidth={820}
            footer={
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", width: "100%", direction: "rtl" }}>
                <a
                  href={`/export-workout?courseId=${selectedCourse.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="crm-btn-secondary"
                  style={{ padding: "10px 18px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px", textDecoration: "none", cursor: "pointer" }}
                >
                  <Icon name="file_download" style={{ fontSize: 18 }} />
                  <span>تحميل النظام التدريبي PDF</span>
                </a>
                <button
                  onClick={() => { setShowAssignModal(selectedCourse.id); setSelectedCourseId(null); }}
                  className="crm-btn-secondary"
                  style={{ padding: "10px 18px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                >
                  <Icon name="person_add" style={{ fontSize: 18 }} />
                  <span>تعيين لمشترك</span>
                </button>
                <Link
                  href={`/admin/builder?courseId=${selectedCourse.id}`}
                  className="crm-btn-primary"
                  style={{ padding: "10px 18px", fontSize: "0.9rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Icon name="edit" style={{ fontSize: 18 }} />
                  <span>تعديل البرنامج</span>
                </Link>
              </div>
            }
          >
            <div style={{ padding: "24px 28px", direction: "rtl", textAlign: "start" }}>
              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid color-mix(in srgb, var(--admin-on-surface) 6%, transparent)" }}>
                {selectedCourse.description && (
                  <p style={{ margin: "0 0 12px 0", color: "var(--admin-on-surface)", fontSize: "0.95rem", lineHeight: 1.7 }}>
                    {selectedCourse.description}
                  </p>
                )}
                <p style={{ margin: "0 0 14px 0", color: "var(--admin-outline)", fontSize: "0.9rem" }}>
                  تم الإنشاء في: {new Date(selectedCourse.created_at).toLocaleDateString("ar-SA")}
                </p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  <span className="crm-tag primary-tag">{arabicCount(countDays(selectedCourse.days_data), DAY)}</span>
                  <span className="crm-tag">{arabicCount(countExercises(selectedCourse.days_data), EXERCISE)}</span>
                </div>

                {/* Who is on this course. Previously invisible anywhere in the UI. */}
                {assignedTo(selectedCourse.id).length > 0 ? (
                  <div style={{ fontSize: "0.9rem", color: "var(--admin-on-surface)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Icon name="group" style={{ fontSize: 18, color: "var(--primary)" }} />
                    <span>
                      <strong>{arabicCount(assignedTo(selectedCourse.id).length, TRAINEE)}:</strong>{" "}
                      {assignedTo(selectedCourse.id).join("، ")}
                    </span>
                  </div>
                ) : (
                  <p style={{ margin: "0 0 0 0", color: "var(--admin-outline)", fontSize: "0.85rem" }}>
                    غير معيَّن لأي مشترك حالياً.
                  </p>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {asDays(selectedCourse.days_data).length === 0 ? (
                  <div className="crm-empty-state" style={{ padding: "32px 16px" }}>
                    <Icon name="inventory_2" />
                    <p style={{ margin: 0, fontSize: "0.95rem" }}>لا توجد أيام تدريبية مضافة لهذا الكورس.</p>
                  </div>
                ) : (
                  asDays(selectedCourse.days_data).map((day, dIndex) => (
                    <div 
                      key={day.id || dIndex} 
                      className="crm-modal-section"
                      style={{ background: "var(--admin-bg-3)", padding: "18px 20px", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--admin-on-surface) 5%, transparent)" }}
                    >
                      <h4 className="crm-modal-section-title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 14px 0", fontSize: "1.05rem", color: "var(--admin-on-surface)", fontWeight: 700 }}>
                        <Icon name="calendar_today" style={{ color: "var(--primary)" }} />
                        <span>اليوم التدريبي {dIndex + 1}</span>
                      </h4>

                      {/* The muscles the coach marked this day for, if any. */}
                      {(day.muscles?.length ?? 0) > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "-4px 0 14px" }}>
                          {day.muscles!.map((m) => (
                            <span key={m} className="crm-tag primary-tag" style={{ padding: "2px 12px", fontSize: "0.75rem", borderRadius: "20px" }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {!day.exercises || day.exercises.length === 0 ? (
                          <div style={{ color: "var(--admin-outline)", fontSize: "0.85rem", fontStyle: "italic", padding: "6px 0" }}>
                            لا توجد تمارين مضافة في هذا اليوم.
                          </div>
                        ) : (
                          <div className="co-minimal-table-wrapper">
                            <table className="co-minimal-table">
                              <thead>
                                <tr>
                                  <th style={{ textAlign: "start" }}>التمرين</th>
                                  <th style={{ textAlign: "center", width: "70px", paddingInline: "6px" }}>الجولات</th>
                                  <th style={{ textAlign: "start" }}>التكرارات</th>
                                  <th style={{ textAlign: "center", width: "140px" }}>وقت الراحة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.exercises.map((ex, exIndex) => {
                                  const repItems = Array.isArray(ex.reps)
                                    ? ex.reps
                                    : (typeof (ex.reps as unknown) === "string" ? String(ex.reps).split(/\s*[-–,،]\s*/).filter(Boolean) : [String(ex.reps || "10")]);

                                  return (
                                    <tr key={ex.id || exIndex}>
                                      <td style={{ textAlign: "start" }}>
                                        <div className="co-exercise-cell">
                                          <div className="co-exercise-title">
                                            <span className="co-exercise-num">{exIndex + 1}.</span>
                                            <span>{ex.name_ar || "تمرين غير مسمى"}</span>
                                          </div>
                                          {ex.target_muscle && (
                                            <span className="crm-tag primary-tag" style={{ padding: "2px 8px", fontSize: "0.7rem", fontWeight: 500 }}>
                                              {ex.target_muscle}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: "center", paddingInline: "6px" }}>
                                        <span className="co-sets-badge">
                                          {ex.sets || "—"}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "start" }}>
                                        <div className="co-reps-container">
                                          {repItems.map((rep, rIdx) => (
                                            <span
                                              key={rIdx}
                                              className="co-rep-chip"
                                              title={`الجولة ${rIdx + 1}: ${rep} تكرار`}
                                            >
                                              {rep}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600 }}>
                                        {ex.rest_time || "من 60 ثانية إلى 90 ثانية"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </AdminModal>
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
          <div style={{ padding: 24, direction: "rtl", textAlign: "start" }}>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "var(--admin-outline)", lineHeight: 1.7 }}>
              الكورس: <strong style={{ color: "var(--admin-on-surface)" }}>{courses.find((c) => c.id === showAssignModal)?.name}</strong>
              {assignedTo(showAssignModal).length > 0 && (
                <>
                  <br />
                  معيَّن حالياً إلى: {assignedTo(showAssignModal).join("، ")}
                </>
              )}
            </p>
            <label style={{ display: "block", fontSize: "0.95rem", color: "var(--admin-on-surface)", marginBottom: 12, fontWeight: 500 }}>
              اختر المشترك الذي ترغب في تعيين الكورس له:
            </label>
            <select 
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
              className="crm-filter-select"
              style={{ width: "100%", marginBottom: 24 }}
            >
              <option value="">-- اختر مشترك --</option>
              {trainees.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.username && t.username !== t.name ? ` (@${t.username})` : ""}
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
            <p style={{ margin: "0 0 16px 0", color: "var(--admin-on-surface)", fontSize: "1rem", lineHeight: 1.6 }}>
              هل أنت متأكد من رغبتك في حذف كورس{" "}
              <strong>«{courses.find((c) => c.id === showDeleteConfirm)?.name}»</strong>؟
            </p>
            {/* Name the affected trainees — the old copy warned about unassigning
                "المتدربين" without saying whether any actually existed. */}
            {assignedTo(showDeleteConfirm).length > 0 && (
              <p style={{ margin: "0 0 16px 0", padding: "12px", borderRadius: 4, background: "color-mix(in srgb, var(--error, #ef4444) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--error, #ef4444) 30%, transparent)", color: "var(--admin-on-surface)", fontSize: "0.88rem", lineHeight: 1.7 }}>
                هذا الكورس معيَّن حالياً إلى {arabicCount(assignedTo(showDeleteConfirm).length, TRAINEE)}:{" "}
                <strong>{assignedTo(showDeleteConfirm).join("، ")}</strong>
                <br />
                سيفقد البرنامج التدريبي عند الحذف.
              </p>
            )}
            <p style={{ margin: "0 0 24px 0", color: "var(--error, #ef4444)", fontSize: "0.85rem" }}>
              لا يمكن التراجع عن هذا الإجراء.
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
