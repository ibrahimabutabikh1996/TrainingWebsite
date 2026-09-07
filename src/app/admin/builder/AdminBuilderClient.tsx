"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { CourseTemplate, DayExercise, Exercise, TraineeOption } from "@/types/admin";
import { useCourseBuilder, normalizeDays } from "./useCourseBuilder";
import { isCustomExercise } from "@/types/admin";
import DayMusclePicker from "./DayMusclePicker";
import AdminModal from "../components/AdminModal";
import { Toaster, toast } from "react-hot-toast";
import { loadCourseTemplateAction, saveCourseAction } from "./actions";
import { arabicCount, DAY, EXERCISE } from "@/lib/arabicCount";
import { Icon } from "@/components/Icon";
import { CustomSelect } from "@/components/CustomSelect";
import TraineeIntakeHelp from "@/components/admin/TraineeIntakeHelp";
/* Same order the diet plan builder uses: the shared page vocabulary first, then
   the plan-builder layout, then this page's own additions. */
import "../diet/diet.css";
import "../diet/plan/plan.css";
import "./day-muscle-picker.css";
import "./builder.css";
import { normalizeArabic, arabicIncludes } from "@/lib/arabicSearch";

/* Reps are stored as an array but older rows may hold a bare string/number. */
function repList(reps: DayExercise["reps"]): string[] {
  if (Array.isArray(reps)) return reps;
  if (reps === undefined || reps === null) return [];
  return [String(reps)];
}

export default function AdminBuilderClient({
  initialTrainees,
  initialExercises,
  initialCourse = null,
  initialTraineeId = "",
  initialTemplates = []
}: {
  initialTrainees: TraineeOption[],
  initialExercises: Exercise[],
  initialCourse?: { id: string, name: string, description?: string, days_data: unknown } | null,
  initialTraineeId?: string,
  /** Courses already in the library, to start a new one from. Empty when editing. */
  initialTemplates?: CourseTemplate[]
}) {
  const router = useRouter();

  const {
    courseName, setCourseName,
    courseDesc, setCourseDesc,
    selectedTrainee, setSelectedTrainee,
    days, setDays,
    addDay, deleteDay, moveDay, setDayMuscles,
    addExerciseToDay, addCustomExerciseToDay,
    updateSets, updateRep, applyRepsToAll, updateCustomCol, updateCustomTitle,
    removeExercise, moveExercise, updateRestTime,
    totals,
  } = useCourseBuilder({
    name: initialCourse?.name,
    description: initialCourse?.description,
    traineeId: initialTraineeId,
    days: normalizeDays(initialCourse?.days_data),
  });

  const [isSaving, setIsSaving] = useState(false);

  const [activeDayId, setActiveDayId] = useState<string | null>(() => {
    const d = normalizeDays(initialCourse?.days_data);
    return d.length > 0 ? d[0].id : null;
  });

  /* Which day the picker is adding to. Null while it is closed — the same
     single-slot state the diet builder keeps for its meal picker. */
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  /* Deleting a training day asks first; this holds what the dialog is about. */
  const [dayToDelete, setDayToDelete] = useState<{ id: string; index: number; exCount: number } | null>(null);

  /* "Start from an existing course": the picker, its search box, and which
     course the contents on screen were taken from — kept only so the header can
     say so, since after this point the two are unrelated documents. */
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);
  const [startedFrom, setStartedFrom] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  const currentDay = days.find((d) => d.id === activeDayId) || days[0] || null;
  const currentDayIndex = currentDay ? days.findIndex((d) => d.id === currentDay.id) : -1;
  const dayExercises = useMemo(() => currentDay?.exercises ?? [], [currentDay]);

  /* How many times each library exercise already sits in the open day, so the
     picker can show what has been taken without closing. */
  const usedInDay = useMemo(() => {
    const counts = new Map<string, number>();
    dayExercises.forEach((ex) => {
      if (ex.refId) counts.set(ex.refId, (counts.get(ex.refId) ?? 0) + 1);
    });
    return counts;
  }, [dayExercises]);

  const nameFilled = courseName.trim().length > 0;

  const templateQ = normalizeArabic(templateQuery);
  const filteredTemplates = useMemo(
    () =>
      !templateQ
        ? initialTemplates
        : initialTemplates.filter(
            (t) =>
              arabicIncludes(t.name, templateQ) ||
              arabicIncludes(t.description, templateQ)
          ),
    [initialTemplates, templateQ]
  );

  /**
   * Loads an existing course into this builder as the starting point for a new
   * one.
   *
   * Nothing about the course it came from is kept — no id above all, so the
   * save below still takes the "create" branch and the original stays exactly
   * as it is, along with whoever is training on it. What lands here is a
   * detached copy of its days that the coach edits like any other draft.
   */
  const handlePickTemplate = async (template: CourseTemplate) => {
    setTemplateLoading(template.id);
    try {
      const result = await loadCourseTemplateAction(template.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const loaded = normalizeDays(result.course.days);
      setCourseName(`${result.course.name} (نسخة)`);
      setCourseDesc(result.course.description);
      setDays(loaded);
      setActiveDayId(loaded.length > 0 ? loaded[0].id : null);
      setStartedFrom(result.course.name);
      setShowTemplates(false);
      setTemplateQuery("");
      toast.success(`تم تحميل نسخة من "${result.course.name}" — عدّلها ثم احفظها ككورس جديد.`);
    } catch (error) {
      console.error(error);
      toast.error("تعذّر تحميل الكورس.");
    } finally {
      setTemplateLoading(null);
    }
  };

  const handleSaveCourse = async () => {
    if (!courseName.trim()) {
      toast.error("يرجى إدخال اسم الكورس أولاً.");
      nameRef.current?.focus();
      return;
    }

    if (days.length === 0) {
      toast.error("يرجى إضافة يوم تدريبي واحد على الأقل وتصميم تمارين الكورس.");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("جاري حفظ الكورس...");

    try {
      /* No coach id is sent: the action takes it from the session. Reading it
         out of localStorage meant the browser naming who authored the course. */
      const result = await saveCourseAction({
        courseId: initialCourse?.id,
        name: courseName,
        description: courseDesc,
        traineeId: selectedTrainee || undefined,
        daysData: days,
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

  const handleCreateNewDay = () => {
    const newId = addDay();
    setActiveDayId(newId);
    toast.success(`تم إنشاء اليوم التدريبي ${days.length + 1}`, { duration: 1600 });
  };

  const handleDeleteDay = (dayId: string, index: number) => {
    const day = days.find((d) => d.id === dayId);
    const exCount = day?.exercises.length ?? 0;
    setDayToDelete({ id: dayId, index, exCount });
  };

  /* Deleting a training day takes two steps: `handleDeleteDay` above names the
     day, and this confirms it. The dialog between them was missing — nothing
     rendered `dayToDelete` and nothing called this — so pressing the day's
     delete button set a piece of state and stopped. No dialog, no deletion, no
     error: the day simply stayed. The dialog is at the end of this component. */
  const confirmDeleteDay = () => {
    if (!dayToDelete) return;
    deleteDay(dayToDelete.id);
    if (activeDayId === dayToDelete.id) {
      const remaining = days.filter((d) => d.id !== dayToDelete.id);
      setActiveDayId(remaining.length > 0 ? remaining[0].id : null);
    }
    toast.success("تم حذف اليوم التدريبي");
    setDayToDelete(null);
  };
  const handleAddExercise = (dayId: string, ex: Exercise) => {
    addExerciseToDay(dayId, ex);
    toast.success(`أُضيف ${ex.name_ar}`);
  };

  const assignedTrainee = initialTrainees.find((t) => t.id === selectedTrainee) || null;

  return (
    <div className="diet-page dplan-page bldr-page">
      {/* The answers this programme is being built from — weight, target,
          height, goal, and the photographs. Reads the trainee currently chosen
          in the toolbar above; with none chosen it says so rather than
          disappearing. Nothing is fetched until it is opened. */}
      <TraineeIntakeHelp view="workout" traineeId={selectedTrainee} />

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--bg2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            direction: "rtl",
            fontFamily: "inherit",
            fontWeight: 600,
          },
        }}
      />

      <header className="diet-header">
        <div className="diet-header-text">
          {/* "النظام التدريبي" is what the rest of the product calls this — the
              PDF button in the library, the export page, the trainee's
              timeline. This screen was the last one still saying "الكورس". */}
          <h1>{initialCourse ? "تعديل النظام التدريبي" : "إنشاء النظام التدريبي"}</h1>
          {/* Said once, where the coach is about to press save: this is a new
              course, and the one it was copied from is not being edited. */}
          {startedFrom && (
            <p className="bldr-from-note">
              <Icon name="content_copy" />
              نسخة من «{startedFrom}» — سيُحفظ ككورس جديد ولن يتأثر الأصل.
            </p>
          )}
        </div>

        <div className="dplan-header-actions">
          <label className="dplan-trainee" style={{ minWidth: "min(300px, 100vw - 96px)" }}>
            <span>المشترك</span>
            <CustomSelect
              value={selectedTrainee}
              onChange={setSelectedTrainee}
              placeholder="— كورس عام لجميع المشتركين —"
              options={initialTrainees.map((t) => ({
                value: t.id,
                label: t.name + (t.username && t.username !== t.name ? ` (@${t.username})` : ""),
              }))}
            />
          </label>

          {/* Offered only when building something new — the server sends an
              empty list while editing, so this is not a second guard so much as
              the same rule stated where it is visible. */}
          {initialTemplates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="diet-btn-secondary"
            >
              <Icon name="content_copy" style={{ fontSize: 20 }} />
              <span>ابدأ من كورس موجود</span>
            </button>
          )}

          {/* The link to the course library was here, and it was the only
              control on this row that did not act on the programme being built
              — it navigated away from it. The same destination is a permanent
              button in the bottom bar on every admin page, this one included,
              so nothing became unreachable when it went. The diet builder's
              toolbar never had an equivalent; this is the two of them agreeing
              rather than a control being lost. */}

          <button onClick={handleSaveCourse} className="diet-add-btn" disabled={isSaving}>
            <Icon name="save" style={{ fontSize: 20 }} />
            <span>{isSaving ? "جارٍ الحفظ..." : "حفظ الكورس"}</span>
          </button>
        </div>
      </header>

      <div className="dplan-toolbar">
        <label className="dplan-name">
          <span>اسم الكورس <b className="bldr-req">*</b></span>
          <input
            ref={nameRef}
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="مثال: كورس تضخيم وبناء عضلات 4 أيام"
            maxLength={80}
          />
        </label>

        <label className="dplan-name">
          <span>الهدف من الكورس (اختياري)</span>
          <input
            value={courseDesc}
            onChange={(e) => setCourseDesc(e.target.value)}
            placeholder="مثال: زيادة الكتلة العضلية والقوة الدافعة"
            maxLength={160}
          />
        </label>

        <div className="bldr-stats">
          <span className={`bldr-flag ${nameFilled ? "ok" : "todo"}`}>
            <Icon name={nameFilled ? "check_circle" : "error"} style={{ fontSize: 16 }} />
            <span>{nameFilled ? "الاسم مكتمل" : "الاسم مطلوب"}</span>
          </span>
          <span className="bldr-flag">
            <Icon name="calendar_today" style={{ fontSize: 16 }} />
            <span><b>{totals.days}</b> يوم</span>
          </span>
          <span className="bldr-flag">
            <Icon name="fitness_center" style={{ fontSize: 16 }} />
            <span><b>{totals.exercises}</b> تمرين</span>
          </span>
        </div>
      </div>

      {initialExercises.length === 0 ? (
        <div className="diet-empty">
          <Icon name="fitness_center" />
          <p>مكتبة التمارين فارغة — أضف تمارين أولاً حتى تتمكن من بناء الأيام التدريبية.</p>
          <a href="/admin/exercises" className="diet-add-btn" style={{ marginTop: 8, textDecoration: "none" }}>
            <Icon name="add" style={{ fontSize: 20 }} />
            <span>الذهاب إلى مكتبة التمارين</span>
          </a>
        </div>
      ) : (
        <>
          <div className="dplan-tabs">
            {days.map((day, dIdx) => (
              <button
                key={day.id}
                onClick={() => setActiveDayId(day.id)}
                aria-pressed={day.id === currentDay?.id}
                className="dplan-tab"
                title={(day.muscles ?? []).join(" · ") || "بدون عضلات محددة"}
              >
                <span>اليوم {dIdx + 1}</span>
                <span className="bldr-tab-count">{day.exercises.length}</span>
              </button>
            ))}

            <button onClick={handleCreateNewDay} className="dplan-tab dplan-tab--add">
              <Icon name="add" style={{ fontSize: 18 }} />
              <span>{days.length === 0 ? "إنشاء اليوم التدريبي الأول" : "إضافة يوم"}</span>
            </button>
          </div>

          {!currentDay ? (
            <div className="diet-empty">
              <Icon name="view_timeline" />
              <p>
                {assignedTrainee ? `كورس ${assignedTrainee.name}` : "هذا الكورس"} لا يحتوي على أيام
                تدريبية بعد. أنشئ اليوم الأول للبدء.
              </p>
            </div>
          ) : (
            <>
              <div className="dplan-toolbar">
                <div className="bldr-day-muscles">
                  <span className="bldr-lbl">العضلات المستهدفة في اليوم {currentDayIndex + 1}</span>
                  <DayMusclePicker
                    selected={currentDay.muscles ?? []}
                    onChange={(m) => setDayMuscles(currentDay.id, m)}
                  />
                </div>

                <div className="bldr-day-actions">
                  <button
                    className="diet-icon-btn"
                    onClick={() => moveDay(currentDay.id, -1)}
                    disabled={currentDayIndex <= 0}
                    title="تقديم هذا اليوم في الترتيب"
                    aria-label="تقديم اليوم"
                  >
                    <Icon name="chevron_right" />
                  </button>
                  <button
                    className="diet-icon-btn"
                    onClick={() => moveDay(currentDay.id, 1)}
                    disabled={currentDayIndex === days.length - 1}
                    title="تأخير هذا اليوم في الترتيب"
                    aria-label="تأخير اليوم"
                  >
                    <Icon name="chevron_left" />
                  </button>
                  <button
                    className="dplan-delete-plan"
                    onClick={() => handleDeleteDay(currentDay.id, currentDayIndex)}
                    title="حذف هذا اليوم التدريبي"
                  >
                    <Icon name="delete" />
                    <span>حذف اليوم</span>
                  </button>
                </div>
              </div>

              <div className="dplan-meals">
                {dayExercises.length === 0 ? (
                  <p className="dplan-meal-empty">لم تُضف تمارين لهذا اليوم بعد.</p>
                ) : (
                  dayExercises.map((ex, exIndex) => {
                    const reps = repList(ex.reps);
                    const sets = typeof ex.sets === "number" ? ex.sets : reps.length || 1;
                    const repValues = Array.from({ length: sets }, (_, i) => reps[i] ?? "10");

                    const isCustomEx = isCustomExercise(ex);
                    return isCustomEx ? (
                      <section key={`ex-${ex.id}-${exIndex}`} className="dplan-meal">
                        <header className="dplan-meal-head">
                          <div className="dplan-meal-title" style={{ flex: 1 }}>
                            <input
                              type="text"
                              value={ex.name_ar || ""}
                              onChange={(e) => updateCustomTitle(currentDay.id, ex.id, e.target.value)}
                              placeholder="تمرين خارج الخطة (اكتب الاسم هنا)"
                              style={{ width: "100%", border: "none", background: "transparent", color: "var(--text)", fontSize: "1.1rem", fontWeight: "bold", outline: "none", margin: 0 }}
                            />
                          </div>
                          <div className="dplan-meal-tools">
                            <button className="diet-icon-btn" onClick={() => moveExercise(currentDay.id, ex.id, -1)} disabled={exIndex === 0} title="تحريك التمرين للأعلى">
                              <Icon name="expand_more" className="bldr-flip" />
                            </button>
                            <button className="diet-icon-btn" onClick={() => moveExercise(currentDay.id, ex.id, 1)} disabled={exIndex === dayExercises.length - 1} title="تحريك التمرين للأسفل">
                              <Icon name="expand_more" />
                            </button>
                            <button className="diet-icon-btn danger" onClick={() => removeExercise(currentDay.id, ex.id)} title="إزالة التمرين من هذا اليوم">
                              <Icon name="close" />
                            </button>
                          </div>
                        </header>
                        <div style={{ margin: "16px 0", borderRadius: "4px", background: "var(--bg3)", padding: "12px 24px", display: "flex", gap: "16px" }}>
                          <input type="text" placeholder="..." value={ex.custom_col_1 || ""} onChange={(e) => updateCustomCol(currentDay.id, ex.id, 1, e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--bg2)", color: "var(--text)" }} />
                          <input type="text" placeholder="..." value={ex.custom_col_2 || ""} onChange={(e) => updateCustomCol(currentDay.id, ex.id, 2, e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--bg2)", color: "var(--text)" }} />
                          <input type="text" placeholder="..." value={ex.custom_col_3 || ""} onChange={(e) => updateCustomCol(currentDay.id, ex.id, 3, e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--bg2)", color: "var(--text)" }} />
                          <input type="text" placeholder="..." value={ex.custom_col_4 || ""} onChange={(e) => updateCustomCol(currentDay.id, ex.id, 4, e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--bg2)", color: "var(--text)" }} />
                        </div>
                      </section>
                    ) : (
                      <section key={`ex-${ex.id}-${exIndex}`} className="dplan-meal">
                        <header className="dplan-meal-head">
                          <div className="dplan-meal-title">
                            <span className="bldr-ex-num">{exIndex + 1}</span>
                            <h3>{ex.name_ar}</h3>
                            <span className="dplan-meal-count">{ex.target_muscle || "عام"}</span>
                          </div>

                          <div className="dplan-meal-tools">
                            <button
                              className="diet-icon-btn"
                              onClick={() => moveExercise(currentDay.id, ex.id, -1)}
                              disabled={exIndex === 0}
                              title="تحريك التمرين للأعلى"
                              aria-label="تحريك للأعلى"
                            >
                              <Icon name="expand_more" className="bldr-flip" />
                            </button>
                            <button
                              className="diet-icon-btn"
                              onClick={() => moveExercise(currentDay.id, ex.id, 1)}
                              disabled={exIndex === dayExercises.length - 1}
                              title="تحريك التمرين للأسفل"
                              aria-label="تحريك للأسفل"
                            >
                              <Icon name="expand_more" />
                            </button>
                            <button
                              className="diet-icon-btn danger"
                              onClick={() => removeExercise(currentDay.id, ex.id)}
                              title="إزالة التمرين من هذا اليوم"
                              aria-label="إزالة التمرين"
                            >
                              <Icon name="close" />
                            </button>
                          </div>
                        </header>

                        <ul className="dplan-items bldr-ex-row">
                          <li className="dplan-item dplan-item--sets">
                            <div className="dplan-item-main">
                              <strong>عدد الجولات</strong>
                            </div>
                            <div className="bldr-row-controls">
                              <div className="bldr-pill">
                                <div className="bldr-stepper">
                                  <button
                                    type="button"
                                    onClick={() => updateSets(currentDay.id, ex.id, String(sets - 1))}
                                    disabled={sets <= 1}
                                    title="إنقاص جولة"
                                    aria-label="إنقاص جولة"
                                  >−</button>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={sets}
                                    onChange={(e) => updateSets(currentDay.id, ex.id, e.target.value)}
                                    aria-label="عدد الجولات"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateSets(currentDay.id, ex.id, String(sets + 1))}
                                    disabled={sets >= 10}
                                    title="إضافة جولة"
                                    aria-label="إضافة جولة"
                                  >+</button>
                                </div>
                              </div>
                            </div>
                          </li>

                          <li className="dplan-item dplan-item--reps" style={{ minWidth: 0 }}>
                            <div className="dplan-item-main" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
                              <strong>التكرارات لكل جولة</strong>
                              {repValues.length > 1 && (
                                <button
                                  type="button"
                                  className="bldr-mini-btn"
                                  onClick={() => applyRepsToAll(currentDay.id, ex.id, repValues[0])}
                                  title="نسخ تكرار الجولة الأولى إلى بقية الجولات"
                                  style={{ flexShrink: 0 }}
                                >
                                  توحيد الكل
                                </button>
                              )}
                            </div>

                            <div className="bldr-row-controls" style={{ flexWrap: "wrap", overflowX: "auto" }}>
                              <div className="bldr-pill bldr-pill--grid" style={{ gridTemplateColumns: `repeat(${Math.min(repValues.length, 4)}, 1fr)` }}>
                                {repValues.map((rep, rIndex) => (
                                  <label key={rIndex} className="bldr-rep" style={{ width: "100%" }}>
                                    <span>{rIndex + 1}</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={rep}
                                      onChange={(e) => updateRep(currentDay.id, ex.id, rIndex, e.target.value)}
                                      placeholder="10"
                                      aria-label={`تكرار الجولة ${rIndex + 1}`}
                                      style={{ width: "100%", minWidth: "0" }}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          </li>

                          <li className="dplan-item dplan-item--rest" style={{ minWidth: 0 }}>
                            <div className="dplan-item-main">
                              <strong>وقت الراحة</strong>
                            </div>

                            <div className="bldr-row-controls" style={{ flexWrap: "wrap", overflow: "visible" }}>
                              <div className="bldr-pill" style={{ flexWrap: "wrap" }}>
                                <span className="bldr-word" style={{ whiteSpace: "nowrap" }}>من</span>
                                <input
                                  type="number"
                                  min="1"
                                  className="bldr-rest-val"
                                  value={ex.rest_from ?? "60"}
                                  onChange={(e) => updateRestTime(currentDay.id, ex.id, "rest_from", e.target.value)}
                                  placeholder="60"
                                  aria-label="أقل وقت راحة"
                                  style={{ minWidth: "50px" }}
                                />
                                <div style={{ width: 100, flexShrink: 0 }}>
                                  <CustomSelect
                                    value={ex.rest_from_unit ?? "ثانية"}
                                    onChange={(v) => updateRestTime(currentDay.id, ex.id, "rest_from_unit", v)}
                                    options={[
                                      { value: "ثانية", label: "ثانية" },
                                      { value: "دقيقة", label: "دقيقة" },
                                    ]}
                                  />
                                </div>

                                <span className="bldr-word" style={{ whiteSpace: "nowrap" }}>إلى</span>
                                <input
                                  type="number"
                                  min="1"
                                  className="bldr-rest-val"
                                  value={ex.rest_to ?? "90"}
                                  onChange={(e) => updateRestTime(currentDay.id, ex.id, "rest_to", e.target.value)}
                                  placeholder="90"
                                  aria-label="أقصى وقت راحة"
                                  style={{ minWidth: "50px" }}
                                />
                                <div style={{ width: 100, flexShrink: 0 }}>
                                  <CustomSelect
                                    value={ex.rest_to_unit ?? "ثانية"}
                                    onChange={(v) => updateRestTime(currentDay.id, ex.id, "rest_to_unit", v)}
                                    options={[
                                      { value: "ثانية", label: "ثانية" },
                                      { value: "دقيقة", label: "دقيقة" },
                                    ]}
                                  />
                                </div>
                              </div>
                            </div>
                          </li>
                        </ul>
                      </section>
                    );
                  })
                )}

                <div className="dplan-meal-foot" style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button className="dplan-add-item" onClick={() => setPickerDayId(currentDay.id)}>
                    <Icon name="add" style={{ fontSize: 18 }} />
                    <span>إضافة تمرين</span>
                  </button>
                  <button className="dplan-add-item" onClick={() => addCustomExerciseToDay(currentDay.id)} style={{ background: "transparent", color: "var(--primary-light)", border: "1px dashed var(--border-primary)" }}>
                    <Icon name="add" style={{ fontSize: 18 }} />
                    <span>تمرين خارج الخطة</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <AdminModal
        isOpen={dayToDelete !== null}
        onClose={() => setDayToDelete(null)}
        title="حذف اليوم التدريبي"
        icon="warning"
        maxWidth={480}
        footer={
          <>
            <button
              type="button"
              className="crm-btn-secondary"
              style={{ padding: "10px 20px", borderRadius: "var(--radius-md)" }}
              onClick={() => setDayToDelete(null)}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={confirmDeleteDay}
              style={{
                background: "var(--error)",
                color: "var(--text-inverse)",
                border: "none",
                padding: "10px 24px",
                borderRadius: "var(--radius-md)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              تأكيد الحذف
            </button>
          </>
        }
      >
        <div style={{ padding: "var(--space-6)", color: "var(--text)", lineHeight: 1.8 }}>
          <p style={{ margin: 0 }}>
            سيتم حذف <strong>اليوم {(dayToDelete?.index ?? 0) + 1}</strong> من هذا الكورس.
          </p>
          {(dayToDelete?.exCount ?? 0) > 0 && (
            <p style={{ margin: "12px 0 0", color: "var(--error-text)" }}>
              يحتوي هذا اليوم على {dayToDelete?.exCount} تمرين — سيتم حذفها معه.
            </p>
          )}
          <p style={{ margin: "12px 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            لن يُحفظ الحذف نهائياً إلا بعد الضغط على حفظ الكورس.
          </p>
        </div>
      </AdminModal>

      <AdminModal
        isOpen={showTemplates}
        onClose={() => { setShowTemplates(false); setTemplateQuery(""); }}
        title="ابدأ من كورس موجود"
        icon="content_copy"
        maxWidth={620}
      >
        <div className="bldr-tpl">
          <p className="bldr-tpl-lead">
            اختر كورساً لتُحمَّل أيامه وتمارينه هنا كنسخة جديدة. عدّل ما تشاء، اختر المشترك، ثم احفظ —
            الكورس الأصلي ومَن يتدرب عليه لا يتأثران.
          </p>

          {/* Only worth saying when there is something to lose. */}
          {(days.length > 0 || courseName.trim() !== "") && (
            <p className="bldr-tpl-warn">
              <Icon name="warning" />
              سيحل الكورس المختار محل ما صمّمته في هذه الصفحة حتى الآن.
            </p>
          )}

          <div className="bldr-tpl-search">
            <Icon name="search" />
            <input
              type="text"
              value={templateQuery}
              onChange={(e) => setTemplateQuery(e.target.value)}
              placeholder="ابحث باسم الكورس أو وصفه…"
            />
          </div>

          <ul className="bldr-tpl-list">
            {filteredTemplates.length === 0 ? (
              <li className="bldr-tpl-empty">لا توجد كورسات مطابقة.</li>
            ) : (
              filteredTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => handlePickTemplate(t)}
                    disabled={templateLoading !== null}
                  >
                    <span className="bldr-tpl-name">
                      <strong>{t.name}</strong>
                      {t.description && <small>{t.description}</small>}
                    </span>
                    <span className="bldr-tpl-meta">
                      {arabicCount(t.days, DAY)} · {arabicCount(t.exercises, EXERCISE)}
                    </span>
                    <span className="bldr-tpl-take">
                      {templateLoading === t.id ? "جارٍ التحميل…" : "استخدام"}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </AdminModal>

      {pickerDayId && (
        <ExercisePicker
          exercises={initialExercises}
          dayLabel={`اليوم التدريبي ${currentDayIndex + 1}`}
          usedInDay={usedInDay}
          onPick={(ex) => handleAddExercise(pickerDayId, ex)}
          onClose={() => setPickerDayId(null)}
        />
      )}
    </div>
  );
}

/* Stays open after a pick: a training day is built several exercises at a time,
   and closing on every choice would mean reopening and re-filtering for each. */
function ExercisePicker({
  exercises,
  dayLabel,
  usedInDay,
  onPick,
  onClose,
}: {
  exercises: Exercise[];
  dayLabel: string;
  usedInDay: Map<string, number>;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");

  const muscles = useMemo(
    () => [...new Set(exercises.map((e) => e.target_muscle).filter((m): m is string => !!m))],
    [exercises]
  );

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    return exercises.filter((e) => {
      if (muscle && e.target_muscle !== muscle) return false;
      if (q && !arabicIncludes(e.name_ar, q)) return false;
      return true;
    });
  }, [exercises, query, muscle]);

  return (
    <div className="dplan-picker-backdrop" onClick={onClose}>
      <div
        className="dplan-picker"
        role="dialog"
        aria-label={`إضافة تمرين إلى ${dayLabel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dplan-picker-head">
          <div>
            <h3>إضافة تمرين</h3>
            <p>{dayLabel}</p>
          </div>
          <button className="diet-icon-btn" onClick={onClose} title="إغلاق">
            <Icon name="close" />
          </button>
        </header>

        <div className="dplan-picker-filters">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم التمرين..."
          />
          <div style={{ flex: 1 }}>
            <CustomSelect
              value={muscle}
              onChange={setMuscle}
              placeholder="كل العضلات"
              options={muscles.map((m) => ({ value: m, label: m }))}
            />
          </div>
        </div>

        <ul className="dplan-picker-list">
          {filtered.length === 0 ? (
            <li className="dplan-picker-empty">لا توجد تمارين مطابقة.</li>
          ) : (
            filtered.map((ex) => {
              const used = usedInDay.get(ex.id) ?? 0;
              return (
                <li key={ex.id}>
                  <button onClick={() => onPick(ex)} title={`إضافة ${ex.name_ar} إلى ${dayLabel}`}>
                    <span className="dplan-picker-icon">
                      <Icon name="fitness_center" />
                    </span>
                    <span className="dplan-picker-name">
                      <strong>{ex.name_ar}</strong>
                      <small>{ex.target_muscle || "عام"}</small>
                    </span>
                    {used > 0 && (
                      <span className="bldr-used" title="عدد مرات وجوده في هذا اليوم">
                        <Icon name="check" style={{ fontSize: 13 }} />
                        {used}
                      </span>
                    )}
                    <span className="bldr-pick-add">
                      <Icon name="add" style={{ fontSize: 18 }} />
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
