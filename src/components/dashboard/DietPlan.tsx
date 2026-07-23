"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { UserProfile } from "@/types";

export function DietPlan({ profile }: { profile: UserProfile }) {
  const { t } = useLanguage();
  
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {[
        { title: t("lbl_meal_breakfast"), meal: profile?.meals?.breakfast },
        { title: t("lbl_meal_lunch"), meal: profile?.meals?.lunch },
        { title: t("lbl_meal_dinner"), meal: profile?.meals?.dinner },
      ].map((item, idx) => (
        <div key={idx} className="diet-meal">
          <div className="diet-meal-header">
            <strong className="diet-meal-title">{item.title}</strong>
            <span className="diet-meal-time">
              {item.meal?.time === "غير محدد" ? t("not_specified") : (item.meal?.time || "-")}
            </span>
          </div>
          <p className="diet-meal-desc">
            {item.meal?.desc === "انتظر إضافة الجدول" ? t("wait_schedule") : (item.meal?.desc || "-")}
          </p>
        </div>
      ))}
    </div>
  );
}
