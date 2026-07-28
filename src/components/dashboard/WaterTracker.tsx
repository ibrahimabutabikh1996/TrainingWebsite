"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export function WaterTracker() {
  const [water, setWater] = useState(0);
  const { t } = useLanguage();

  const updateWater = (delta: number) => {
    setWater((prev) => Math.max(0, Math.min(8, prev + delta)));
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ fontSize: "1rem", color: "#00bcd4", display: "flex", alignItems: "center", gap: 6 }}>
          💧 {t("dash_water_title")}
        </strong>
        <span style={{ fontSize: "0.85rem", color: "var(--muted2)", fontWeight: 600 }}>
          {water} / 8 {t("dash_water_glasses")}
        </span>
      </div>
      <div className="water-controls">
        <button onClick={() => updateWater(-1)} className="water-btn" aria-label="Decrease water">
          -
        </button>
        <div className="water-glasses">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`water-glass ${i < water ? 'filled' : ''}`}></div>
          ))}
        </div>
        <button onClick={() => updateWater(1)} className="water-btn" aria-label="Increase water">
          +
        </button>
      </div>
    </div>
  );
}
