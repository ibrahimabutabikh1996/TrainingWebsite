"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import type { NutritionSource, TraineeOption } from "@/types/admin";
import { CustomSelect } from "@/components/CustomSelect";
import {
  MEAL_SLOTS,
  MAX_PLANS_PER_TRAINEE,
  defaultPlanName,
  emptyMeals,
  itemFromSource,
  getCategoryBadge,
  normalizeFoodCategory,
  type DietPlan,
  type MealSlotKey,
  type MealsData,
} from "@/types/diet";
import { saveDietPlanAction, deleteDietPlanAction } from "./actions";
import { Icon } from "@/components/Icon";
import "../diet.css";
import "./plan.css";

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
}: {
  trainees: TraineeOption[];
  sources: NutritionSource[];
  initialPlans: DietPlan[];
  initialTraineeId: string;
}) {
  const router = useRouter();

  const [plans, setPlans] = useState<EditablePlan[]>(initialPlans);
  const [saved, setSaved] = useState<Record<number, string>>(() => buildSnapshots(initialPlans));
  const [activePosition, setActivePosition] = useState(initialPlans[0]?.position ?? 1);
  const [pickerSlot, setPickerSlot] = useState<MealSlotKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activePlan = plans.find((p) => p.position === activePosition) ?? null;

  const dirtyPositions = useMemo(
    () => plans.filter((p) => snapshot(p) !== saved[p.position]).map((p) => p.position),
    [plans, saved]
  );


  /* Switching trainee is a navigation, not local state: the plans belong to the
     URL, and the page remounts the builder on the new ?traineeId=. */
  const handleTraineeChange = (id: string) => {
    if (dirtyPositions.length > 0 && !confirm("هناك تعديلات غير محفوظة ستفقد. المتابعة؟")) return;
    router.push(id ? `/admin/diet/plan?traineeId=${id}` : "/admin/diet/plan");
  };

  const updateActivePlan = (fn: (plan: EditablePlan) => EditablePlan) => {
    setPlans((prev) => prev.map((p) => (p.position === activePosition ? fn(p) : p)));
  };

  const updateMeal = (slot: MealSlotKey, fn: (meal: MealsData[MealSlotKey]) => MealsData[MealSlotKey]) => {
    updateActivePlan((plan) => ({
      ...plan,
      meals: { ...plan.meals, [slot]: fn(plan.meals[slot]) },
    }));
  };

  const handleAddPlan = () => {
    const position = nextFreePosition(plans);
    if (position === null) {
      toast.error(`لا يمكن إضافة أكثر من ${MAX_PLANS_PER_TRAINEE} نظامين للمشترك`);
      return;
    }
    setPlans((prev) =>
      [...prev, { id: null, name: defaultPlanName(position), position, meals: emptyMeals() }].sort(
        (a, b) => a.position - b.position
      )
    );
    setActivePosition(position);
  };

  const handleAddItem = (slot: MealSlotKey, source: NutritionSource) => {
    updateMeal(slot, (meal) => ({ ...meal, items: [...meal.items, itemFromSource(source)] }));
    toast.success(`أُضيف ${source.name}`);
  };

  const handleRemoveItem = (slot: MealSlotKey, itemId: string) => {
    updateMeal(slot, (meal) => ({ ...meal, items: meal.items.filter((i) => i.id !== itemId) }));
  };

  const handleQtyChange = (slot: MealSlotKey, itemId: string, raw: string) => {
    const qty = Number(raw);
    updateMeal(slot, (meal) => ({
      ...meal,
      items: meal.items.map((i) =>
        i.id === itemId ? { ...i, qty: Number.isFinite(qty) && qty >= 0 ? qty : i.qty } : i
      ),
    }));
  };

  const handleWeightChange = (slot: MealSlotKey, itemId: string, raw: string) => {
    const w = Number(raw);
    updateMeal(slot, (meal) => ({
      ...meal,
      items: meal.items.map((i) =>
        i.id === itemId ? { ...i, weight: Number.isFinite(w) && w >= 0 ? w : i.weight } : i
      ),
    }));
  };

  const handleUnitChange = (slot: MealSlotKey, itemId: string, newUnit: string) => {
    updateMeal(slot, (meal) => ({
      ...meal,
      items: meal.items.map((i) =>
        i.id === itemId ? { ...i, unit: newUnit } : i
      ),
    }));
  };

  const handleSave = async () => {
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
    if (!confirm(`هل أنت متأكد من حذف "${plan.name}"؟`)) return;

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
          <h1>تصميم النظام الغذائي</h1>
          <p>
            خمس وجبات ثابتة لكل نظام: الفطور، سناك، الغداء، سناك، العشاء. تُضاف الأصناف من مكتبة
            المصادر الغذائية مع تحديد الكمية والوزن الموصى به لكل وجبة.
          </p>
        </div>

        <div className="dplan-header-actions">
          <label className="dplan-trainee">
            <span>المشترك</span>
            <select value={initialTraineeId} onChange={(e) => handleTraineeChange(e.target.value)}>
              <option value="">— اختر المشترك —</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={handleSave}
            className="diet-add-btn"
            disabled={isSaving || !initialTraineeId || dirtyPositions.length === 0}
          >
            <Icon name="save" style={{ fontSize: 20 }} />
            <span>
              {isSaving
                ? "جارٍ الحفظ..."
                : dirtyPositions.length > 0
                  ? `حفظ (${dirtyPositions.length})`
                  : "محفوظ"}
            </span>
          </button>
        </div>
      </header>

      {!initialTraineeId ? (
        <div className="diet-empty">
          <Icon name="person_search" />
          <p>اختر المشترك من القائمة أعلاه لبدء تصميم نظامه الغذائي.</p>
        </div>
      ) : sources.length === 0 ? (
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

          {!activePlan ? (
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
                  <span>اسم النظام</span>
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
                {MEAL_SLOTS.map((slot) => {
                  const meal = activePlan.meals[slot.key];

                  return (
                    <section key={slot.key} className="dplan-meal">
                      <header className="dplan-meal-head">
                        <div className="dplan-meal-title">
                          <Icon name={slot.icon} />
                          <h3>{slot.label}</h3>
                          <span className="dplan-meal-count">{meal.items.length} صنف</span>
                        </div>

                        <div className="dplan-meal-tools">
                          <input
                            className="dplan-time"
                            value={meal.time}
                            onChange={(e) =>
                              updateMeal(slot.key, (m) => ({ ...m, time: e.target.value }))
                            }
                            placeholder="الوقت (اختياري)"
                            maxLength={40}
                          />
                        </div>
                      </header>

                      {meal.items.length === 0 ? (
                        <p className="dplan-meal-empty">لم تُضف أصناف لهذه الوجبة بعد.</p>
                      ) : (
                        <ul className="dplan-items">
                          {meal.items.map((item) => {
                            const itemBadge = getCategoryBadge(item.category || "");
                            return (
                              <li key={item.id} className="dplan-item">
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "color-mix(in srgb, var(--bg2, #0F0F0F) 85%, transparent)", padding: "6px 12px", borderRadius: "var(--radius-lg)", border: "1px solid color-mix(in srgb, var(--primary, #C9A84C) 25%, rgba(255,255,255,0.08))", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)" }}>
                                      {/* Quantity / Count Input */}
                                      <label className="dplan-qty" style={{ margin: 0, gap: "6px" }}>
                                        <span style={{ color: "var(--text-secondary, #9A9490)", fontWeight: 800, fontSize: "0.8rem" }}>العدد</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.25"
                                          style={{ width: "70px", background: "var(--bg1, #080808)", fontWeight: 800, color: "var(--primary, #C9A84C)", border: "1px solid color-mix(in srgb, var(--primary, #C9A84C) 40%, transparent)", borderRadius: "var(--radius-sm)", padding: "6px", textAlign: "center" }}
                                          value={item.qty}
                                          onChange={(e) =>
                                            handleQtyChange(slot.key, item.id, e.target.value)
                                          }
                                          title="عدد الحصص (المضاعف)"
                                        />
                                      </label>

                                      <span style={{ color: "rgba(255,255,255,0.15)", fontWeight: 900 }}>|</span>

                                      {/* Weight/Amount & Unit Input */}
                                      <div className="dplan-qty" style={{ margin: 0, gap: "6px", display: "inline-flex", alignItems: "center" }}>
                                        <span style={{ color: "#38BDF8", fontWeight: 800, fontSize: "0.8rem" }}>
                                          {!item.unit || item.unit === "غرام" || item.unit === "كغم" ? "الوزن" : "الكمية"}
                                        </span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          style={{ width: "76px", background: "color-mix(in srgb, #071926 75%, var(--bg1, #080808))", fontWeight: 800, color: "#38BDF8", border: "1px solid color-mix(in srgb, #38BDF8 45%, transparent)", borderRadius: "var(--radius-sm)", padding: "6px", textAlign: "center" }}
                                          value={displayWeight}
                                          onChange={(e) => handleWeightChange(slot.key, item.id, e.target.value)}
                                          title="الوزن أو الكمية الإجمالية"
                                        />
                                        <div style={{ width: 110 }}>
                                          <CustomSelect
                                            value={item.unit || "غرام"}
                                            onChange={(v) => handleUnitChange(slot.key, item.id, v)}
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
                                  onClick={() => handleRemoveItem(slot.key, item.id)}
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
                        <button className="dplan-add-item" onClick={() => setPickerSlot(slot.key)}>
                          <Icon name="add" style={{ fontSize: 18 }} />
                          <span>إضافة صنف</span>
                        </button>

                        <input
                          className="dplan-note"
                          value={meal.note}
                          onChange={(e) =>
                            updateMeal(slot.key, (m) => ({ ...m, note: e.target.value }))
                          }
                          placeholder="ملاحظة للمشترك (اختياري)"
                          maxLength={500}
                        />
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {pickerSlot && (
        <SourcePicker
          sources={sources}
          slotLabel={MEAL_SLOTS.find((s) => s.key === pickerSlot)?.label ?? ""}
          onPick={(source) => handleAddItem(pickerSlot, source)}
          onClose={() => setPickerSlot(null)}
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
    const q = query.trim().toLowerCase();
    return normalizedSources.filter((s) => {
      if (category && s.category !== category) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
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
                      background: "var(--bg2, #0F0F0F)",
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
                      <img src={badge.image} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                    <span className="dplan-picker-name" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--text, #F0EDE8)", fontWeight: 800 }}>{s.name}</strong>
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
