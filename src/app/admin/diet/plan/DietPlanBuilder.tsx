"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import type { NutritionSource, TraineeOption } from "@/types/admin";
import { CustomSelect } from "@/components/CustomSelect";
import {
  MAX_PLANS_PER_TRAINEE,
  defaultPlanName,
  itemFromSource,
  getCategoryBadge,
  normalizeFoodCategory,
  type DietPlan,
  type MealsData,
  type Meal,
} from "@/types/diet";
import {
  saveDietPlanAction,
  deleteDietPlanAction,
  saveGeneralDietPlanAction,
  deleteGeneralDietPlanAction,
} from "./actions";
import { Icon } from "@/components/Icon";
import "../diet.css";
import "./plan.css";
import { normalizeArabic, arabicIncludes } from "@/lib/arabicSearch";
import { confirmDialog } from "@/lib/confirmDialog";
import TraineeIntakeHelp from "@/components/admin/TraineeIntakeHelp";

/* A plan the coach has started but not yet saved has no database id. Everything
   else about it behaves like a saved one, so the id is simply optional rather
   than a separate "draft" type. */
type EditablePlan = { id: string | null; name: string; position: number; meals: MealsData };

const snapshot = (plan: EditablePlan) => JSON.stringify({ name: plan.name, meals: plan.meals });

function buildSnapshots(plans: EditablePlan[]): Record<number, string> {
  return Object.fromEntries(plans.map((p) => [p.position, snapshot(p)]));
}

/** Lowest slot the trainee is not already using, or null when both are taken. */
function nextFreePosition(plans: EditablePlan[]): number | null {
  for (let p = 1; p <= MAX_PLANS_PER_TRAINEE; p++) {
    if (!plans.some((plan) => plan.position === p)) return p;
  }
  return null;
}



export default function DietPlanBuilder({
  trainees,
  sources,
  initialPlans,
  initialTraineeId,
  initialGeneralGroupId = "",
  initialGeneralName = "",
}: {
  trainees: TraineeOption[];
  sources: NutritionSource[];
  initialPlans: DietPlan[];
  initialTraineeId: string;
  /** The general template being edited, if any. Empty while a new one is written. */
  initialGeneralGroupId?: string;
  /** That template's own name. Empty for a new one, and for one saved before
      templates had a name of their own. */
  initialGeneralName?: string;
}) {
  const router = useRouter();

  /* With no trainee named, this screen is writing a general template — a diet
     with no owner, the way the programme builder saves a course with nobody on
     it. It holds the same two alternatives a trainee's diet does, numbered by
     the same `position`, so the tabs, the cap and the dirty tracking below are
     one piece of code serving both. What differs is only what makes two rows
     alternatives of each other: profile_id for a trainee, group_id here. */
  const isGeneral = !initialTraineeId;

  /* `?groupId=` named a template and the server found nothing — it has been
     deleted since the link was rendered. Seeding a blank one in that case would
     look like a new template and quietly create a second one on save; say so
     instead. */
  const generalMissing = isGeneral && initialGeneralGroupId !== "" && initialPlans.length === 0;

  /* A template the coach has just started has no rows behind it yet, so its
     first choice is seeded here rather than by the server, which has nothing to
     send. It carries no id, which is what makes the save below create rather
     than update — the same distinction `initialCourse?.id` draws in the
     programme builder. */
  const seedPlans: EditablePlan[] =
    isGeneral && !generalMissing && initialPlans.length === 0
      ? [{ id: null, name: "", position: 1, meals: [] }]
      : initialPlans;

  const [plans, setPlans] = useState<EditablePlan[]>(seedPlans);
  /* Seeded from what is on screen, not from what the server sent: a blank
     general plan nobody has typed into yet is not unsaved work, so it must not
     arm the save button or the "changes will be lost" question. For a trainee
     the two are the same list. */
  const [saved, setSaved] = useState<Record<number, string>>(() => buildSnapshots(seedPlans));
  const [activePosition, setActivePosition] = useState(seedPlans[0]?.position ?? 1);
  const [pickerMealId, setPickerMealId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /* Empty until the first save of a brand-new template, which is the one call
     that mints it. Held in state rather than read from the URL because the two
     choices are saved in one press and the second must carry the id the first
     just created — a `router.replace` cannot be awaited into that loop. */
  const [groupId, setGroupId] = useState(initialGeneralGroupId);
  /* The template's name, held apart from the choices because it is not one of
     them: the two alternatives are documents inside it, and this is what the
     library calls the thing holding them. */
  const [generalName, setGeneralName] = useState(initialGeneralName);
  const [savedGeneralName, setSavedGeneralName] = useState(initialGeneralName);

  const activePlan = plans.find((p) => p.position === activePosition) ?? null;

  const dirtyPositions = useMemo(
    () => plans.filter((p) => snapshot(p) !== saved[p.position]).map((p) => p.position),
    [plans, saved]
  );

  /* Renaming a template is an edit even when no choice was touched, so it arms
     the save button on its own. Only in general mode — a trainee's plans have
     no template name to change. */
  const generalNameDirty = isGeneral && generalName.trim() !== savedGeneralName;

  /* Switching trainee is a navigation, not local state: the plans belong to the
     URL, and the page remounts the builder on the new ?traineeId=. */
  const handleTraineeChange = async (id: string) => {
    if ((dirtyPositions.length > 0 || generalNameDirty) && !(await confirmDialog("هناك تعديلات غير محفوظة ستفقد. المتابعة؟"))) return;
    router.push(id ? `/admin/diet/plan?traineeId=${id}` : "/admin/diet/plan");
  };

  const updateActivePlan = (fn: (plan: EditablePlan) => EditablePlan) => {
    setPlans((prev) => prev.map((p) => (p.position === activePosition ? fn(p) : p)));
  };

  const updateMeal = (mealId: string, fn: (meal: Meal) => Meal) => {
    updateActivePlan((plan) => ({
      ...plan,
      meals: plan.meals.map((m) => (m.id === mealId ? fn(m) : m)),
    }));
  };

  const handleAddPlan = () => {
    const position = nextFreePosition(plans);
    if (position === null) {
      toast.error(`لا يمكن إضافة أكثر من ${MAX_PLANS_PER_TRAINEE} نظامين للمشترك`);
      return;
    }
    setPlans((prev) =>
      [...prev, { id: null, name: defaultPlanName(position), position, meals: [] }].sort(
        (a, b) => a.position - b.position
      )
    );
    setActivePosition(position);
  };

  const handleAddMeal = () => {
    updateActivePlan((plan) => ({
      ...plan,
      meals: [...plan.meals, { id: crypto.randomUUID(), name: "", time: "", startNote: "", note: "", items: [] }],
    }));
  };

  const handleRemoveMeal = async (mealId: string) => {
    if (!(await confirmDialog("هل أنت متأكد من حذف هذه الوجبة؟", { danger: true }))) return;
    updateActivePlan((plan) => ({
      ...plan,
      meals: plan.meals.filter((m) => m.id !== mealId),
    }));
  };

  const handleAddItem = (mealId: string, source: NutritionSource) => {
    updateMeal(mealId, (meal) => ({ ...meal, items: [...meal.items, itemFromSource(source)] }));
    toast.success(`أُضيف ${source.name}`);
  };

  const handleRemoveItem = (mealId: string, itemId: string) => {
    updateMeal(mealId, (meal) => ({ ...meal, items: meal.items.filter((i) => i.id !== itemId) }));
  };

  /* `handleQtyChange` used to live here, editing `item.qty` — a multiplier of a
     100g serving. The builder asks for the weight directly now, so `qty` is
     only read as a fallback when displaying a row saved before `weight`
     existed, and nothing edits it. */

  const handleWeightChange = (mealId: string, itemId: string, raw: string) => {
    const w = Number(raw);
    updateMeal(mealId, (meal) => ({
      ...meal,
      items: meal.items.map((i) =>
        i.id === itemId ? { ...i, weight: Number.isFinite(w) && w >= 0 ? w : i.weight } : i
      ),
    }));
  };

  const handleUnitChange = (mealId: string, itemId: string, newUnit: string) => {
    updateMeal(mealId, (meal) => ({
      ...meal,
      items: meal.items.map((i) =>
        i.id === itemId ? { ...i, unit: newUnit } : i
      ),
    }));
  };

  /* The general template's own save. Kept apart from the trainee save below for
     the same reason the two server actions are: that one upserts each slot on
     (trainee, position), and a template's slots are keyed by its group instead.
     The shape of the walk is deliberately identical — dirty choices only, in
     order, stopping at the first refusal. */
  const handleSaveGeneral = async () => {
    const pending = plans.filter((p) => dirtyPositions.includes(p.position));
    if (pending.length === 0 && !generalNameDirty) {
      toast("لا توجد تعديلات للحفظ");
      return;
    }
    if (!generalName.trim()) {
      toast.error("اسم النظام الغذائي العام مطلوب");
      return;
    }

    /* A rename with no edited choice still has to be written, and the name
       lives on the rows — so the first choice carries it, and the action
       spreads it over the rest of the group. Checked below rather than
       `pending`, because that choice is what this press writes. */
    const toSave = pending.length > 0 ? pending : plans.slice(0, 1);

    if (toSave.some((p) => !p.name.trim())) {
      toast.error("اسم الخيار مطلوب");
      return;
    }
    if (toSave.some((p) => p.meals.some((m) => !m.name.trim()))) {
      toast.error("يرجى تسمية جميع الوجبات");
      return;
    }

    setIsSaving(true);
    try {
      /* Sequential, and `group` carried forward by hand: the first choice of a
         brand-new template is the call that mints the group id, and the second
         has to be told what it was. Promise.all would race them and produce two
         templates of one choice each. */
      let group = groupId;
      const savedNow: Record<number, string> = {};
      for (const plan of toSave) {
        const res = await saveGeneralDietPlanAction({
          groupId: group || undefined,
          planId: plan.id ?? undefined,
          position: plan.position,
          name: plan.name.trim(),
          groupName: generalName.trim(),
          meals: plan.meals,
        });
        if (!res.success) {
          setSaved((prev) => ({ ...prev, ...savedNow }));
          toast.error(res.error);
          return;
        }
        if (res.groupId) group = res.groupId;
        savedNow[plan.position] = snapshot(plan);
        setPlans((prev) =>
          prev.map((p) => (p.position === plan.position ? { ...p, id: res.id } : p))
        );
      }
      setSaved((prev) => ({ ...prev, ...savedNow }));
      setSavedGeneralName(generalName.trim());
      setGroupId(group);
      toast.success("تم حفظ النظام الغذائي العام");
      /* The URL now names the template that exists, so a reload — or the back
         button after a visit to the library — reopens it rather than a blank
         one. `replace`, not `push`: writing the id into the address is not a
         place the coach navigated to. */
      if (!groupId && group) router.replace(`/admin/diet/plan?groupId=${group}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (isGeneral) return handleSaveGeneral();
    if (!initialTraineeId) {
      toast.error("اختر المشترك أولاً");
      return;
    }
    const pending = plans.filter((p) => dirtyPositions.includes(p.position));
    if (pending.length === 0) {
      toast("لا توجد تعديلات للحفظ");
      return;
    }
    if (pending.some((p) => !p.name.trim())) {
      toast.error("اسم النظام الغذائي مطلوب");
      return;
    }
    if (pending.some((p) => p.meals.some((m) => !m.name.trim()))) {
      toast.error("يرجى تسمية جميع الوجبات");
      return;
    }

    setIsSaving(true);
    try {
      /* Sequential, not Promise.all: both plans hit the same (profile_id,
         position) unique index, and a failure half-way should leave the
         snapshots of whatever did save already updated. */
      const savedNow: Record<number, string> = {};
      for (const plan of pending) {
        const res = await saveDietPlanAction({
          traineeId: initialTraineeId,
          position: plan.position,
          name: plan.name.trim(),
          meals: plan.meals,
        });
        if (!res.success) {
          setSaved((prev) => ({ ...prev, ...savedNow }));
          toast.error(res.error);
          return;
        }
        savedNow[plan.position] = snapshot(plan);
        setPlans((prev) =>
          prev.map((p) => (p.position === plan.position ? { ...p, id: res.id } : p))
        );
      }
      setSaved((prev) => ({ ...prev, ...savedNow }));
      toast.success("تم حفظ النظام الغذائي");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (plan: EditablePlan) => {
    if (!(await confirmDialog(`هل أنت متأكد من حذف "${plan.name}"؟`, { danger: true }))) return;

    /* One choice of a template, not the template — the library's delete button
       is what removes the whole card. An unsaved choice has no row yet, exactly
       as in the trainee branch below. Removing the last one leaves nothing to
       fall back to, so the coach goes to the library rather than being left in
       front of an empty builder. */
    if (isGeneral) {
      if (plan.id) {
        const res = await deleteGeneralDietPlanAction({ planId: plan.id });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
      }

      const remaining = plans.filter((p) => p.position !== plan.position);
      if (remaining.length === 0) {
        toast.success("تم حذف النظام");
        router.push("/admin/diet/library");
        return;
      }

      setPlans(remaining);
      setSaved(buildSnapshots(remaining));
      setActivePosition(remaining[0].position);
      toast.success("تم حذف الخيار");
      router.refresh();
      return;
    }

    /* An unsaved draft exists only here, so it never reaches the server. */
    if (plan.id) {
      const res = await deleteDietPlanAction({
        traineeId: initialTraineeId,
        position: plan.position,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
    }

    const remaining = plans.filter((p) => p.position !== plan.position);
    setPlans(remaining);
    setSaved(buildSnapshots(remaining));
    setActivePosition(remaining[0]?.position ?? 1);
    toast.success("تم حذف النظام");
  };

  const selectedTrainee = trainees.find((t) => t.id === initialTraineeId);

  return (
    <div className="diet-page dplan-page">
      {/* The answers this diet is being built from — weight, height, goal, then
          everything that decides what may go on the plate: allergies, the foods
          they like, the meat, the coffee, past injuries, and whether they can
          buy supplements at all. The trainee here comes from the URL rather
          than from local state, because picking one remounts this builder. */}
      <TraineeIntakeHelp view="diet" traineeId={initialTraineeId} />

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
          {/* Named for what is being written, because the two are different
              documents: one is prescribed to a person, the other is a plan the
              library will hold until somebody is given a copy. */}
          <h1>{isGeneral ? "تصميم نظام غذائي عام" : "تصميم النظام الغذائي"}</h1>
        </div>

        <div className="dplan-header-actions">
          <label className="dplan-trainee" style={{ minWidth: "min(300px, 100vw - 96px)" }}>
            <span>المشترك</span>
            {/* The empty option is no longer "you have not chosen yet" — it is a
                choice, and the one this screen is on when it writes a general
                plan. Worded the way the programme builder words the same
                option, so the two screens agree about what it means. */}
            <CustomSelect
              value={initialTraineeId}
              onChange={handleTraineeChange}
              placeholder="— نظام عام لجميع المشتركين —"
              options={[
                { value: "", label: "— نظام عام لجميع المشتركين —" },
                ...trainees.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </label>

          <button
            onClick={handleSave}
            className="diet-add-btn"
            disabled={isSaving || (dirtyPositions.length === 0 && !generalNameDirty)}
          >
            <Icon name="save" style={{ fontSize: 20 }} />
            <span>
              {isSaving
                ? "جارٍ الحفظ..."
                : dirtyPositions.length > 0
                  ? `حفظ (${dirtyPositions.length})`
                  : generalNameDirty
                    ? "حفظ"
                    : "محفوظ"}
            </span>
          </button>
        </div>
      </header>

      {sources.length === 0 ? (
        <div className="diet-empty">
          <Icon name="restaurant_menu" />
          <p>مكتبة المصادر الغذائية فارغة — أضف مصادر أولاً حتى تتمكن من بناء الوجبات.</p>
          <a href="/admin/diet" className="diet-add-btn" style={{ marginTop: 8, textDecoration: "none" }}>
            <Icon name="add" style={{ fontSize: 20 }} />
            <span>الذهاب إلى المكتبة</span>
          </a>
        </div>
      ) : (
        <>
          {/* The template's own name, above the tabs because it names the thing
              the tabs are inside — the card the library shows, which used to
              have to borrow the first choice's name. Written once at creation
              and editable here afterwards. Prescribed plans have no such
              document, so this belongs to general mode alone. */}
          {isGeneral && !generalMissing && (
            <div className="dplan-toolbar">
              <label className="dplan-name" style={{ flex: 1 }}>
                <span>اسم النظام الغذائي</span>
                <input
                  value={generalName}
                  onChange={(e) => setGeneralName(e.target.value)}
                  placeholder="مثال: نظام التنشيف"
                  maxLength={80}
                />
              </label>
            </div>
          )}

          {/* The two alternatives, in both modes. They mean the same thing on
              either screen — the choice the trainee is given — and are numbered
              by the same `position`, so this row is one piece of code rather
              than two. The template it belongs to differs (a person, or a
              group), and nothing here has to know which. */}
          {!generalMissing && (
            <div className="dplan-tabs">
              {plans.map((plan) => (
                <button
                  key={plan.position}
                  onClick={() => setActivePosition(plan.position)}
                  aria-pressed={plan.position === activePosition}
                  className="dplan-tab"
                >
                  <span>{plan.name === "النظام الأول" ? "النظام الغذائي الاختيار الأول" :
                         plan.name === "النظام الثاني" ? "النظام الغذائي الاختيار الثاني" :
                         plan.name === "النظام الثالث" ? "النظام الغذائي الاختيار الثالث" :
                         plan.name || defaultPlanName(plan.position)}</span>
                  {dirtyPositions.includes(plan.position) && (
                    <span className="dplan-dot" title="تعديلات غير محفوظة" />
                  )}
                </button>
              ))}

              {nextFreePosition(plans) !== null && (
                <button onClick={handleAddPlan} className="dplan-tab dplan-tab--add">
                  <Icon name="add" style={{ fontSize: 18 }} />
                  <span>{plans.length === 0 ? "إنشاء نظام غذائي" : "إضافة نظام ثانٍ"}</span>
                </button>
              )}
            </div>
          )}

          {isGeneral && !generalMissing && (
            <p className="dplan-general-note">
              <Icon name="info" />
              نظام غذائي عام لا يخصّ مشتركاً بعينه، ويحمل الخيارين تماماً كنظام المشترك. احفظه
              ليظهر في مكتبة الأنظمة الغذائية، ثم انسخه لمن تشاء من هناك — يصل المشترك بخياريه، ولكل
              مشترك نسخته الخاصة.
            </p>
          )}

          {generalMissing ? (
            <div className="diet-empty">
              <Icon name="folder_off" />
              <p>هذا النظام العام لم يعد موجوداً — ربما حُذف من المكتبة.</p>
              <a
                href="/admin/diet/library"
                className="diet-add-btn"
                style={{ marginTop: 8, textDecoration: "none" }}
              >
                <Icon name="nutrition" style={{ fontSize: 20 }} />
                <span>العودة إلى مكتبة الأنظمة الغذائية</span>
              </a>
            </div>
          ) : !activePlan ? (
            <div className="diet-empty">
              <Icon name="restaurant" />
              <p>
                {selectedTrainee?.name ?? "هذا المشترك"} لا يملك نظاماً غذائياً بعد. أنشئ النظام
                الأول للبدء.
              </p>
            </div>
          ) : (
            <>
              <div className="dplan-toolbar">
                <label className="dplan-name">
                  {/* Named for what it is in each mode: in a template this is
                      the alternative's own name, beside the template's above —
                      two fields reading "اسم النظام" would be two fields nobody
                      can tell apart. A trainee's screen is unchanged. */}
                  <span>{isGeneral ? "اسم الخيار" : "اسم النظام"}</span>
                  <input
                    value={activePlan.name}
                    onChange={(e) => updateActivePlan((p) => ({ ...p, name: e.target.value }))}
                    placeholder="مثال: نظام يوم التمرين"
                    maxLength={80}
                  />
                </label>


                <button
                  onClick={() => handleDeletePlan(activePlan)}
                  className="dplan-delete-plan"
                  title="حذف هذا النظام"
                >
                  <Icon name="delete" />
                  <span>حذف النظام</span>
                </button>
              </div>

              <div className="dplan-meals">
                {activePlan.meals.map((meal) => {

                  return (
                    <section key={meal.id} className="dplan-meal">
                      <header className="dplan-meal-head">
                        <div className="dplan-meal-title" style={{ flex: 1 }}>
                          <Icon name="restaurant_menu" />
                          <input
                            value={meal.name}
                            onChange={(e) => updateMeal(meal.id, (m) => ({ ...m, name: e.target.value }))}
                            placeholder="اسم الوجبة (مثال: وجبة الفطور، وجبة بعد التمرين...)"
                            style={{ 
                              background: "transparent", 
                              border: "1px solid var(--border)", 
                              color: "var(--text)", 
                              fontSize: "1.1rem", 
                              fontWeight: 800, 
                              padding: "6px 12px", 
                              flex: 1,
                              borderRadius: "var(--radius-md)",
                              outline: "none"
                            }}
                            maxLength={80}
                          />
                          <span className="dplan-meal-count">{meal.items.length} صنف</span>
                        </div>

                        <div className="dplan-meal-tools">
                          <input
                            className="dplan-time"
                            value={meal.time}
                            onChange={(e) =>
                              updateMeal(meal.id, (m) => ({ ...m, time: e.target.value }))
                            }
                            placeholder="الوقت (اختياري)"
                            maxLength={40}
                          />
                          <button
                            className="diet-icon-btn danger"
                            onClick={() => handleRemoveMeal(meal.id)}
                            title="حذف الوجبة"
                            style={{ marginLeft: 8 }}
                          >
                            <Icon name="delete" />
                          </button>
                        </div>
                      </header>

                      <div style={{ padding: "0 16px", marginBottom: "12px" }}>
                        <input
                          className="dplan-note"
                          value={meal.startNote || ""}
                          onChange={(e) =>
                            updateMeal(meal.id, (m) => ({ ...m, startNote: e.target.value }))
                          }
                          placeholder="ملاحظة في بداية الوجبة (اختياري)"
                          maxLength={500}
                        />
                      </div>

                      {meal.items.length === 0 ? (
                        <p className="dplan-meal-empty">لم تُضف أصناف لهذه الوجبة بعد.</p>
                      ) : (
                        <ul className="dplan-items">
                          {meal.items.map((item) => {
                            const itemBadge = getCategoryBadge(item.category || "");
                            return (
                              <li key={item.id} className="dplan-item">
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 200px", minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: "38px",
                                      height: "38px",
                                      borderRadius: "var(--radius-md)",
                                      flexShrink: 0,
                                      background: itemBadge.bg,
                                      border: `1px solid ${itemBadge.border}`,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      overflow: "hidden",
                                      padding: "4px",
                                    }}
                                  >
                                    <img src={itemBadge.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                  </div>
                                  <div className="dplan-item-main">
                                    <strong>{item.name}</strong>
                                    <span className="dplan-item-cat">{item.category}</span>
                                  </div>
                                </div>

                                {(() => {
                                  const baseGrams = 100;
                                  const displayWeight = item.weight != null ? Math.round(item.weight * 10) / 10 : Math.round(item.qty * baseGrams * 10) / 10;
                                  return (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "color-mix(in srgb, var(--bg2) 85%, transparent)", padding: "6px 12px", borderRadius: "var(--radius-lg)", border: "1px solid color-mix(in srgb, var(--primary) 25%, rgba(255,255,255,0.08))", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)" }}>
                                      {/* Weight/Amount & Unit Input */}
                                      <div className="dplan-qty" style={{ margin: 0, gap: "6px", display: "inline-flex", alignItems: "center" }}>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          style={{ width: "76px", background: "color-mix(in srgb, #071926 75%, var(--bg1, #080808))", fontWeight: 800, color: "#38BDF8", border: "1px solid color-mix(in srgb, #38BDF8 45%, transparent)", borderRadius: "var(--radius-sm)", padding: "6px", textAlign: "center" }}
                                          value={displayWeight}
                                          onChange={(e) => handleWeightChange(meal.id, item.id, e.target.value)}
                                          title="الوزن أو الكمية الإجمالية"
                                        />
                                        {/* Wide enough for the longest unit.
                                            "بدون وحدة قياس" is 114px of text,
                                            and the trigger spends 50px of the
                                            box on its padding and caret — at
                                            110 the label had 60px and was cut
                                            down to "بدون و…". */}
                                        <div style={{ width: 165 }}>
                                          <CustomSelect
                                            value={item.unit || "غرام"}
                                            onChange={(v) => handleUnitChange(meal.id, item.id, v)}
                                            options={[
                                              { value: "غرام", label: "غرام" },
                                              { value: "كغم", label: "كغم" },
                                              { value: "مل", label: "مل" },
                                              { value: "لتر", label: "لتر" },
                                              { value: "قطعة", label: "قطعة" },
                                              { value: "كوب", label: "كوب" },
                                              { value: "ملعقة طعام", label: "ملعقة طعام" },
                                              { value: "ملعقة شاي", label: "ملعقة شاي" },
                                              { value: "شريحة", label: "شريحة" },
                                              { value: "بدون وحدة قياس", label: "بدون وحدة قياس" },
                                            ]}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}


                                <button
                                  className="diet-icon-btn danger"
                                  onClick={() => handleRemoveItem(meal.id, item.id)}
                                  title="إزالة الصنف"
                                >
                                  <Icon name="close" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <div className="dplan-meal-foot">
                        <button className="dplan-add-item" onClick={() => setPickerMealId(meal.id)}>
                          <Icon name="add" style={{ fontSize: 18 }} />
                          <span>إضافة صنف</span>
                        </button>

                        <input
                          className="dplan-note"
                          value={meal.note}
                          onChange={(e) =>
                            updateMeal(meal.id, (m) => ({ ...m, note: e.target.value }))
                          }
                          placeholder="ملاحظة للمشترك (اختياري)"
                          maxLength={500}
                        />
                      </div>
                    </section>
                  );
                })}
                
                <button
                  onClick={handleAddMeal}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "16px",
                    borderRadius: "var(--radius-lg)",
                    border: "2px dashed color-mix(in srgb, var(--primary) 30%, transparent)",
                    background: "transparent",
                    color: "var(--primary)",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--primary) 10%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon name="add" style={{ fontSize: "24px" }} />
                  إضافة وجبة جديدة
                </button>
              </div>
            </>
          )}
        </>
      )}

      {pickerMealId && (
        <SourcePicker
          sources={sources}
          slotLabel={activePlan?.meals.find(m => m.id === pickerMealId)?.name || "الوجبة"}
          onPick={(source) => handleAddItem(pickerMealId, source)}
          onClose={() => setPickerMealId(null)}
        />
      )}
    </div>
  );
}

/* Stays open after a pick: meals are built several items at a time, and closing
   on every choice would mean reopening and re-filtering for each one. */
function SourcePicker({
  sources,
  slotLabel,
  onPick,
  onClose,
}: {
  sources: NutritionSource[];
  slotLabel: string;
  onPick: (source: NutritionSource) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const normalizedSources = useMemo(
    () => sources.map((s) => ({ ...s, category: normalizeFoodCategory(s.category) })),
    [sources]
  );

  const categories = useMemo(
    () => [...new Set(normalizedSources.map((s) => s.category))].filter(Boolean),
    [normalizedSources]
  );

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    return normalizedSources.filter((s) => {
      if (category && s.category !== category) return false;
      if (q && !arabicIncludes(s.name, q)) return false;
      return true;
    });
  }, [normalizedSources, query, category]);

  return (
    <div className="dplan-picker-backdrop" onClick={onClose}>
      <div
        className="dplan-picker"
        role="dialog"
        aria-label={`إضافة صنف إلى ${slotLabel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dplan-picker-head">
          <div>
            <h3>إضافة صنف</h3>
            <p>{slotLabel}</p>
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
            placeholder="ابحث باسم الصنف..."
          />
          <div style={{ flex: 1 }}>
            <CustomSelect
              value={category}
              onChange={setCategory}
              placeholder="كل التصنيفات"
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>

        <ul className="dplan-picker-list">
          {filtered.length === 0 ? (
            <li className="dplan-picker-empty">لا توجد أصناف مطابقة.</li>
          ) : (
            filtered.map((s) => {
              const badge = getCategoryBadge(s.category);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => onPick(s)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "12px 14px",
                      background: "var(--bg2)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "var(--radius-lg)",
                      transition: "all 0.25s ease",
                      width: "100%",
                      textAlign: "right",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "var(--radius-lg)",
                        flexShrink: 0,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        padding: "4px",
                      }}
                    >
                      {/* Same as the library grid: the food's own photograph
                          when it has one. Saved plan items below keep the
                          category picture — a `MealItem` is a snapshot that
                          deliberately does not carry the library's image. */}
                      <img src={s.image_url || badge.image} alt={s.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                    <span className="dplan-picker-name" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--text)", fontWeight: 800 }}>{s.name}</strong>
                      <small style={{ color: badge.color, fontWeight: 700, fontSize: "0.78rem" }}>
                        ● {badge.label}
                      </small>
                    </span>
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--primary-dim)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
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
