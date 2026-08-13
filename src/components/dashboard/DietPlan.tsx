"use client";

import { useState } from "react";
import type { UserProfile } from "@/types";
import { t, type TranslationKey } from "@/lib/translations";
import {
  MEAL_SLOTS,
  fmtMacro,
  type MealSlotKey,
} from "@/types/diet";
import "./diet-plan.css";
import { Icon } from "@/components/Icon";

const SLOT_LABEL_KEY: Record<MealSlotKey, TranslationKey> = {
  breakfast: "diet_meal_breakfast",
  snack1: "diet_meal_snack1",
  lunch: "diet_meal_lunch",
  snack2: "diet_meal_snack2",
  dinner: "diet_meal_dinner",
};

/* One hue per meal, but expressed as a fill/foreground pair rather than a raw
   hex: the fill paints edges, tints and icons chips, the foreground is the only
   thing allowed to be text. The literal ambers and greens this replaced were
   dark-theme values — as text on the light theme's tinted cards they landed
   between 1.7:1 and 3.1:1. */
const MEAL_ACCENTS: Record<MealSlotKey, { fill: string; text: string }> = {
  breakfast: { fill: "var(--warning)", text: "var(--warning-text)" }, // Warm Sunrise Amber
  snack1: { fill: "var(--error)", text: "var(--error-text)" },        // Crimson Red (Snack 1)
  lunch: { fill: "var(--success)", text: "var(--success-text)" },     // Emerald Mint Green
  snack2: { fill: "var(--error)", text: "var(--error-text)" },        // Crimson Red (Snack 2)
  dinner: { fill: "var(--primary)", text: "var(--primary-on-tint)" }, // Serene Evening Blue
};


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
        {plan && (
          <a
            href={`/export-diet?profileId=${profile.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--primary-dim)",
              color: "var(--primary-on-tint)",
              border: "1px solid var(--border-primary)",
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              fontWeight: 800,
              fontSize: "0.85rem",
              textDecoration: "none",
              transition: "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease)",
            }}
          >
            <Icon name="file_download" style={{ fontSize: "18px" }} />
            <span>تحميل النظام الغذائي</span>
          </a>
        )}
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
                      <span>
                        {p.name === "النظام الأول" ? "النظام الغذائي الاختيار الأول" :
                         p.name === "النظام الثاني" ? "النظام الغذائي الاختيار الثاني" :
                         p.name === "النظام الثالث" ? "النظام الغذائي الاختيار الثالث" :
                         p.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontWeight: 700, color: "var(--text)" }}>
                  {plan.name === "النظام الأول" ? "النظام الغذائي الاختيار الأول" :
                   plan.name === "النظام الثاني" ? "النظام الغذائي الاختيار الثاني" :
                   plan.name === "النظام الثالث" ? "النظام الغذائي الاختيار الثالث" :
                   plan.name}
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
            {MEAL_SLOTS.map((slot) => {
              const meal = plan.meals[slot.key];
              const isEmpty = meal.items.length === 0;

              return (
                <section
                  key={slot.key}
                  className={`dpv-meal ${isEmpty ? "dpv-meal--empty" : ""}`}
                  style={{
                    "--meal-accent": MEAL_ACCENTS[slot.key]?.fill ?? "var(--primary)",
                    "--meal-accent-text": MEAL_ACCENTS[slot.key]?.text ?? "var(--primary-on-tint)",
                  } as React.CSSProperties}
                >
                  {/* Minimalist Meal Header */}
                  <header className="dpv-meal-head">
                    <div className="dpv-meal-title-group">
                      <div className="dpv-meal-icon-minimal">
                        <Icon name={slot.icon || "restaurant"} />
                      </div>
                      <div className="dpv-meal-titles">
                        <h4 className="dpv-meal-name">{t(SLOT_LABEL_KEY[slot.key])}</h4>
                        {meal.time ? (
                          <span className="dpv-time-sub">
                            الوقت المقترح: {meal.time}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </header>

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
                                            <span style={{ color: "var(--primary, #C9A84C)", background: "color-mix(in srgb, var(--primary, #C9A84C) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--primary, #C9A84C) 30%, transparent)", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.78rem", fontWeight: 800 }}>
                                              {prefix}: {totalWeight}{unitSuffix}
                                            </span>
                                          )}
                                          {item.qty <= 0 && totalWeight <= 0 && (
                                            <span style={{ fontWeight: 700, color: "var(--text-secondary, #9A9490)" }}>حسب الرغبة</span>
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
