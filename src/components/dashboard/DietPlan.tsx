"use client";

import { useState } from "react";
import type { UserProfile } from "@/types";
import { t } from "@/lib/translations";
import { defaultPlanName, fmtMacro } from "@/types/diet";
import "./diet-plan.css";
import { Icon } from "@/components/Icon";

/* One hue per meal, but expressed as a fill/foreground pair rather than a raw
   hex: the fill paints edges, tints and icon chips, the foreground is the only
   thing allowed to be text.

   Cycled by the meal's place in the list rather than keyed by a slot name: a
   plan is the coach's own sequence of meals now, any number of them under names
   they typed, not the five fixed slots this view was first written against. */
const MEAL_ACCENTS: { fill: string; text: string }[] = [
  { fill: "var(--warning)", text: "var(--warning-text)" },    // Warm Sunrise Amber
  { fill: "var(--error)", text: "var(--error-text)" },        // Crimson Red
  { fill: "var(--success)", text: "var(--success-text)" },    // Emerald Mint Green
  { fill: "var(--primary)", text: "var(--primary-on-tint)" }, // Serene Evening Blue
];

export function DietPlan({ profile }: { profile: UserProfile }) {
  const plans = profile.dietPlans ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  const plan = plans[activeIndex] ?? plans[0] ?? null;

  return (
    <div className="dashboard-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h3 className="dashboard-card-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <Icon name="restaurant_menu" style={{ color: "var(--primary-on-tint)" }} />
          <span>{t("diet_title") || "الجدول الغذائي اليومي"}</span>
        </h3>
      </div>

      {!plan ? (
        <p className="dpv-none">{t("diet_none") || "لم يتم تحديد جدول غذائي لك حالياً من قِبل الكابتن."}</p>
      ) : (
        <div className="dpv-wrapper">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "14px", background: "var(--bg2)", padding: "16px", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)" }}>
            <div style={{ flex: "1 1 auto" }}>
              {plans.length > 1 ? (
                <div className="dpv-tabs" role="tablist" style={{ margin: 0 }}>
                  {plans.map((p, i) => (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={i === activeIndex}
                      onClick={() => setActiveIndex(i)}
                    >
                      <span>{p.name || defaultPlanName(p.position)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontWeight: 700, color: "var(--text)" }}>
                  {plan.name || defaultPlanName(plan.position)}
                </div>
              )}
            </div>

            <a
              href={`/export-diet?profileId=${profile.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="dash-primary-btn"
              style={{ padding: "12px 24px", fontSize: "0.98rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <Icon name="file_download" style={{ fontSize: "22px" }} />
              <span>تحميل النظام الغذائي</span>
            </a>
          </div>

          {/* Meals List */}
          <div className="dpv-meals">
            {plan.meals.length === 0 ? (
              <p className="dpv-none">لم يضع الكابتن وجبات في هذا النظام بعد.</p>
            ) : plan.meals.map((meal, mealIndex) => {
              const isEmpty = meal.items.length === 0;
              const accent = MEAL_ACCENTS[mealIndex % MEAL_ACCENTS.length];

              return (
                <section
                  key={meal.id}
                  className={`dpv-meal ${isEmpty ? "dpv-meal--empty" : ""}`}
                  style={{
                    "--meal-accent": accent.fill,
                    "--meal-accent-text": accent.text,
                  } as React.CSSProperties}
                >
                  {/* Minimalist Meal Header */}
                  <header className="dpv-meal-head">
                    <div className="dpv-meal-title-group">
                      <div className="dpv-meal-icon-minimal">
                        <Icon name="restaurant" />
                      </div>
                      <div className="dpv-meal-titles">
                        <h4 className="dpv-meal-name">{meal.name}</h4>
                        {meal.time ? (
                          <span className="dpv-time-sub">
                            الوقت المقترح: {meal.time}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </header>

                  {/* The coach types this one above the food list in the builder,
                      so it is read above the food list here. */}
                  {meal.startNote && (
                    <div className="dpv-note-box-min" style={{ marginBottom: "16px" }}>
                      <b>💡 ملاحظة:</b>
                      <span>{meal.startNote}</span>
                    </div>
                  )}

                  {/* Clean Minimal Table */}
                  {isEmpty ? (
                    <div className="dpv-meal-empty-msg">
                      <span>لم يُحدد الكابتن أطعمة لهذه الوجبة (اختيارية)</span>
                    </div>
                  ) : (
                    <div className="dpv-table-wrap">
                      <table className="dpv-min-table">
                        <thead>
                          <tr>
                            <th style={{ width: "55%" }}>صنف الطعام</th>
                            <th style={{ width: "45%" }}>الكمية / الوزن</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meal.items.map((item) => {
                            return (
                              <tr key={item.id}>
                                <td>
                                  <span className="dpv-food-title">{item.name}</span>
                                </td>
                                <td>
                                  <div className="dpv-serving-text">
                                    {(() => {
                                      const totalWeight = item.weight != null ? Math.round(item.weight * 10) / 10 : Math.round((item.qty || 1) * 100 * 10) / 10;
                                      const unit = item.unit || "غرام";
                                      const prefix = (unit === "غرام" || unit === "كغم") ? "الوزن" : "الكمية";
                                      const unitSuffix = unit === "بدون وحدة قياس" ? "" : ` ${unit}`;
                                      return (
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                          {item.qty > 0 && (
                                            <span style={{ fontWeight: 700 }}>العدد: {fmtMacro(item.qty)}</span>
                                          )}
                                          {totalWeight > 0 && (
                                            <span style={{ color: "var(--primary-on-tint)", background: "var(--primary-dim)", border: "1px solid var(--border-primary)", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.78rem", fontWeight: 800 }}>
                                              {prefix}: {totalWeight}{unitSuffix}
                                            </span>
                                          )}
                                          {item.qty <= 0 && totalWeight <= 0 && (
                                            <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>حسب الرغبة</span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Minimalist Coach Note Box */}
                  {meal.note && (
                    <div className="dpv-note-box-min">
                      <b>💡 ملاحظة:</b>
                      <span>{meal.note}</span>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
