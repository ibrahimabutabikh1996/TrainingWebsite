"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Exercise, TraineeOption } from "@/types/admin";
import { useCourseBuilder, normalizeDays } from "./useCourseBuilder";
import MuscleTabs from "../components/MuscleTabs";
import AdminModal from "../components/AdminModal";
import { Toaster, toast } from "react-hot-toast";
import { saveCourseAction } from "./actions";
import "../crm.css";

export default function AdminBuilderClient({
  initialTrainees,
  initialExercises,
  initialCourse = null,
  initialTraineeId = ""
}: {
  initialTrainees: TraineeOption[],
  initialExercises: Exercise[],
  initialCourse?: { id: string, name: string, description?: string, days_data: unknown } | null,
  initialTraineeId?: string
}) {
  const router = useRouter();

  /* Seeded directly from props — see the note in useCourseBuilder. The page
     supplies a `key` so switching course/trainee remounts with fresh values. */
  const {
    courseName, setCourseName,
    courseDesc, setCourseDesc,
    selectedTrainee, setSelectedTrainee,
    days, setDays,
    addDay, deleteDay,
    addExerciseToDay, updateSets, updateRep, removeExercise,
    totals,
  } = useCourseBuilder({
    name: initialCourse?.name,
    description: initialCourse?.description,
    traineeId: initialTraineeId,
    days: normalizeDays(initialCourse?.days_data),
  });

  const [isSaving, setIsSaving] = useState(false);

  const assignedTrainee = initialTrainees.find((t) => t.id === selectedTrainee) || null;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscleTab, setSelectedMuscleTab] = useState<string>("الكل");

  const handleSaveCourse = async () => {
    if (!courseName.trim()) {
      toast.error("يرجى إدخال اسم الكورس أولاً.");
      return;
    }

    if (days.length === 0) {
      toast.error("يرجى إضافة يوم تدريبي واحد على الأقل وتصميم تمارين الكورس.");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("جاري حفظ الكورس...");

    try {
      const coachId = typeof window !== "undefined" ? localStorage.getItem("loggedInUserId") : undefined;

      const result = await saveCourseAction({
        courseId: initialCourse?.id,
        name: courseName,
        description: courseDesc,
        traineeId: selectedTrainee || undefined,
        daysData: days, // Saving directly as an array of Days
        coachId: coachId || undefined,
      });

      if (result.success) {
        toast.success("تم حفظ الكورس بنجاح!", { id: toastId });
        setCourseName("");
        setCourseDesc("");
        setSelectedTrainee("");
        setDays([]);
        router.push("/admin/courses");
        router.refresh();
      } else {
        toast.error(result.error || "فشل حفظ الكورس.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ غير متوقع أثناء حفظ الكورس.", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteDay = (dayId: string, index: number) => {
    const day = days.find((d) => d.id === dayId);
    const exCount = day?.exercises.length ?? 0;
    if (exCount > 0 && !window.confirm(`حذف اليوم ${index + 1} وما يحتويه من ${exCount} تمرين؟`)) {
      return;
    }
    deleteDay(dayId);
  };

  // Extract unique muscles for tabs
  const uniqueMuscles = useMemo(() => {
    const muscles = new Set<string>();
    initialExercises.forEach(ex => {
      if (ex.target_muscle) muscles.add(ex.target_muscle);
    });
    return ["الكل", ...Array.from(muscles)];
  }, [initialExercises]);

  const openExerciseModal = (dayId: string) => {
    setActiveDayId(dayId);
    setExerciseSearch("");
    setSelectedMuscleTab("الكل");
    setIsModalOpen(true);
  };

  const handleAddExercise = (ex: Exercise) => {
    if (!activeDayId) return;
    addExerciseToDay(activeDayId, ex);
    setIsModalOpen(false);
  };

  // Filter exercises
  const filteredExercises = initialExercises.filter(ex => {
    const matchesSearch = ex.name_ar.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscle = selectedMuscleTab === "الكل" || ex.target_muscle === selectedMuscleTab;
    return matchesSearch && matchesMuscle;
  });

  return (
    <div className="crm-dashboard" style={{ overflowY: 'auto' }}>
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            background: 'var(--admin-bg-2)', 
            color: 'var(--admin-on-surface)', 
            border: '1px solid var(--primary)', 
            padding: '16px 24px', 
            borderRadius: '4px',
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          } 
        }} 
      />
      
      <div className="crm-main-area" style={{ paddingInlineEnd: 0 }}>
        
        {/* Hero Header */}
        <div className="crm-hero-header">
          <div className="crm-hero-title-group">
            <h1 className="crm-hero-title">
              {initialCourse ? "تعديل البرنامج التدريبي" : "صانع البرامج التدريبية"}
            </h1>
            <p className="crm-hero-subtitle">
              {assignedTrainee
                ? `برنامج مخصص للمشترك: ${assignedTrainee.name}`
                : "قم ببناء وتخصيص خطط تدريبية احترافية للمشتركين بكل سهولة."}
            </p>
            {/* Program size at a glance, so the coach can tell an empty
                skeleton from a finished plan before saving. */}
            {days.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <span className="crm-tag primary-tag">{totals.days} يوم تدريبي</span>
                <span className="crm-tag">{totals.exercises} تمرين</span>
              </div>
            )}
          </div>

          <div className="crm-hero-stats-group" style={{ alignItems: "flex-end" }}>
            <button
              onClick={handleSaveCourse}
              disabled={isSaving}
              className="crm-btn-primary"
              style={{ padding: "16px 32px", fontSize: "1.1rem", opacity: isSaving ? 0.7 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>save</span>
              <span>{isSaving ? "جاري الحفظ..." : "حفظ البرنامج التدريبي"}</span>
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 32, paddingBottom: 64 }}>
          
          {/* Basic Info */}
          <div className="crm-modal-section" style={{ background: "var(--admin-bg-2)", padding: 24, borderRadius: 4, border: "1px solid color-mix(in srgb, var(--admin-on-surface) 6%, transparent)" }}>
            <h4 className="crm-modal-section-title" style={{ marginBottom: 24 }}>
              <span className="material-symbols-outlined">info</span>
              المعلومات الأساسية
            </h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>تخصيص البرنامج لمشترك (اختياري)</label>
                <select
                  value={selectedTrainee}
                  onChange={(e) => setSelectedTrainee(e.target.value)}
                  className="crm-filter-select"
                  style={{ width: "100%", padding: "14px 16px" }}
                >
                  <option value="">-- كورس عام --</option>
                  {initialTrainees.map(t => (
                    <option key={t.id} value={t.id}>
                      {/* The account name is usually identical to the full name,
                          so only qualify it when they actually differ. */}
                      {t.name}{t.username && t.username !== t.name ? ` (@${t.username})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>اسم الكورس *</label>
                <div className="crm-search-box" style={{ maxWidth: "100%", padding: "14px 16px" }}>
                  <input 
                    type="text" 
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="مثال: كورس تضخيم 4 أيام"
                    className="crm-search-input"
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>الهدف من الكورس</label>
                <div className="crm-search-box" style={{ maxWidth: "100%", padding: "14px 16px" }}>
                  <input 
                    type="text" 
                    value={courseDesc}
                    onChange={(e) => setCourseDesc(e.target.value)}
                    placeholder="مثال: مخصص لزيادة الكتلة العضلية..."
                    className="crm-search-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Curriculum Builder */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h4 className="crm-modal-section-title" style={{ margin: 0 }}>
                <span className="material-symbols-outlined">view_timeline</span>
                المنهج التدريبي (الأيام)
              </h4>
              
              <button 
                onClick={addDay}
                className="crm-btn-icon"
                style={{ padding: "8px 16px", gap: 8, fontSize: "0.9rem" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                إضافة يوم تدريبي
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {days.length === 0 ? (
                <div className="crm-empty-state">
                  <span className="material-symbols-outlined">calendar_month</span>
                  <p>اضغط على &laquo;إضافة يوم تدريبي&raquo; للبدء بتصميم الجدول الزمني</p>
                </div>
              ) : (
                days.map((day, dIndex) => (
                  <div key={`day-${day.id || dIndex}`} style={{ background: "var(--admin-bg-2)", padding: 24, borderRadius: 4, border: "1px solid color-mix(in srgb, var(--admin-on-surface) 6%, transparent)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                      <h5 style={{ fontWeight: 700, color: "var(--admin-on-surface)", fontSize: "1.2rem", margin: 0, fontFamily: "var(--font-display)", letterSpacing: "1px", display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 24 }}>calendar_today</span>
                        اليوم التدريبي {dIndex + 1}
                      </h5>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button onClick={() => openExerciseModal(day.id)} className="crm-btn-icon" style={{ padding: "6px 16px", gap: 6, fontSize: "0.85rem", background: "color-mix(in srgb, var(--primary) 10%, transparent)", border: "none" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
                          إضافة تمرين
                        </button>
                        <button onClick={() => confirmDeleteDay(day.id, dIndex)} className="crm-btn-icon" style={{ padding: "6px 12px", color: "var(--error, #ef4444)", borderColor: "color-mix(in srgb, var(--error, #ef4444) 30%, transparent)" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {(!day.exercises || day.exercises.length === 0) ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--admin-outline)", fontSize: "0.9rem", border: "1px dashed color-mix(in srgb, var(--admin-on-surface) 10%, transparent)", borderRadius: 4 }}>
                          لا توجد تمارين مضافة في هذا اليوم. اضغط على «إضافة تمرين».
                        </div>
                      ) : (
                        day.exercises.map((ex, exIndex) => (
                          <div key={`ex-${ex.id}-${exIndex}`} style={{ display: "flex", flexDirection: "column", gap: 16, background: "var(--admin-bg-3)", border: "1px solid color-mix(in srgb, var(--admin-on-surface) 4%, transparent)", borderRadius: 4, padding: "16px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 4, background: "color-mix(in srgb, var(--admin-on-surface) 5%, transparent)", color: "var(--admin-on-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>
                                  {exIndex + 1}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--admin-on-surface)" }}>{ex.name_ar}</div>
                                  <div className="crm-tag primary-tag" style={{ marginTop: 4, padding: "2px 8px", fontSize: "0.75rem", display: "inline-block" }}>{ex.target_muscle}</div>
                                </div>
                              </div>
                              <button onClick={() => removeExercise(day.id, ex.id)} className="crm-btn-icon" style={{ padding: 8, border: "none", color: "var(--admin-outline)" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                              </button>
                            </div>

                            <div style={{ display: "flex", gap: 24, padding: "16px", background: "var(--admin-bg-2)", borderRadius: 4 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: "0.85rem", color: "var(--admin-outline)", fontWeight: 500 }}>الجولات:</span>
                                <input 
                                  type="number" 
                                  min="1" max="10"
                                  value={ex.sets}
                                  onChange={(e) => updateSets(day.id, ex.id, e.target.value)}
                                  className="crm-search-input"
                                  style={{ width: 64, background: "var(--admin-bg-3)", border: "1px solid color-mix(in srgb, var(--admin-on-surface) 10%, transparent)", borderRadius: 4, padding: "8px", textAlign: "center", fontSize: "1rem", fontWeight: 600 }}
                                />
                              </div>
                              
                              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
                                <span style={{ fontSize: "0.85rem", color: "var(--admin-outline)", fontWeight: 500 }}>التكرار لكل جولة:</span>
                                {(ex.reps || []).map((rep, rIndex) => (
                                  <div key={rIndex} style={{ position: "relative" }}>
                                    <input 
                                      type="text" 
                                      value={rep}
                                      onChange={(e) => updateRep(day.id, ex.id, rIndex, e.target.value)}
                                      placeholder="10"
                                      className="crm-search-input"
                                      style={{ width: 56, background: "var(--admin-bg-3)", border: "1px solid color-mix(in srgb, var(--admin-on-surface) 10%, transparent)", borderRadius: 4, padding: "8px", textAlign: "center", fontSize: "1rem", fontWeight: 600 }}
                                    />
                                    <span style={{ position: "absolute", top: -8, insetInlineStart: -8, fontSize: "0.65rem", background: "var(--primary)", color: "var(--text-inverse)", fontWeight: 700, borderRadius: "4px", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      {rIndex + 1}
                                    </span>
                                  </div>
                                ))}
                              </div>
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
      </div>

      {/* Exercise Picker Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="مكتبة التمارين"
        icon="fitness_center"
        maxWidth={700}
      >
        <div style={{ padding: "16px 24px", borderBottom: "1px solid color-mix(in srgb, var(--admin-on-surface) 6%, transparent)", display: "flex", flexDirection: "column", gap: 16, flexShrink: 0, background: "var(--admin-bg-2)" }}>
          <div className="crm-search-box" style={{ width: "100%", maxWidth: "100%" }}>
            <span className="material-symbols-outlined crm-search-icon">search</span>
            <input 
              type="text" 
              placeholder="ابحث باسم التمرين..." 
              className="crm-search-input"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
            />
          </div>

          <MuscleTabs 
            uniqueMuscles={uniqueMuscles} 
            selectedMuscle={selectedMuscleTab} 
            onSelect={setSelectedMuscleTab} 
          />
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 8, background: "var(--admin-bg-2)" }}>
          {filteredExercises.length === 0 ? (
            <div className="crm-empty-state" style={{ border: "none" }}>
              <span className="material-symbols-outlined">search_off</span>
              <p>لا توجد تمارين تطابق البحث</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {filteredExercises.map(ex => (
                <button 
                  key={ex.id}
                  onClick={() => handleAddExercise(ex)}
                  className="crm-list-card"
                  style={{ textAlign: "start", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", animation: "none", opacity: 1, height: "auto" }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--admin-on-surface)", fontSize: "0.95rem", marginBottom: 4 }}>{ex.name_ar}</div>
                    <div className="crm-tag" style={{ border: "none", padding: "2px 0", background: "transparent", color: "var(--admin-outline)" }}>{ex.target_muscle || "عام"}</div>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 24 }}>add_circle</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}
