"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { UserProfile } from "@/types";

export function ProfileStats({ profile }: { profile: UserProfile }) {
  const { t } = useLanguage();
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <section className="dashboard-card">
        <div className="dashboard-card-title">
          {t("dash_sec_profile")}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { label: t("lbl_fullname"), value: profile.fullname },
            { label: t("lbl_plan"), value: profile.plan, highlight: true },
            { label: t("lbl_age"), value: profile.age },
            { label: t("lbl_weight"), value: profile.weight },
            { label: t("lbl_height"), value: profile.height },
            { label: t("lbl_activity"), value: profile.activity },
            { label: t("lbl_sub_goal"), value: profile.goal },
          ].map((item, idx) => {
            let displayValue = item.value || "-";
            if (displayValue === "غير محدد") displayValue = t("not_specified");
            if (displayValue === "الخطة البرونزية") displayValue = t("opt_plan_bronze") || displayValue;
            if (displayValue === "الخطة الفضية") displayValue = t("opt_plan_silver") || displayValue;
            if (displayValue === "الخطة الذهبية") displayValue = t("opt_plan_gold") || displayValue;
            
            return (
              <div key={idx} className="stat-row">
                <span className="stat-label">{item.label}</span>
                <span className={`stat-value ${item.highlight ? 'stat-highlight' : ''}`}>{displayValue}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
