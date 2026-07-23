"use client";

import React from "react";
import "../crm.css";

interface MuscleTabsProps {
  uniqueMuscles: string[];
  selectedMuscle: string;
  onSelect: (muscle: string) => void;
}

export default function MuscleTabs({ uniqueMuscles, selectedMuscle, onSelect }: MuscleTabsProps) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, paddingTop: 4 }} className="custom-scrollbar">
      {uniqueMuscles.map(muscle => {
        let imgSrc = "/muscles/muscles.png";
        if (muscle === "الكل") imgSrc = "/muscles/gym.png";
        else if (muscle.includes("ظهر")) imgSrc = "/muscles/back.png";
        else if (muscle.includes("صدر")) imgSrc = "/muscles/front.png";
        else if (muscle.includes("باي") || muscle.includes("ذراع")) imgSrc = "/muscles/biceps.png";
        
        return (
          <button
            key={muscle}
            onClick={() => onSelect(muscle)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 80, padding: "12px 16px", borderRadius: 16, cursor: "pointer",
              border: selectedMuscle === muscle ? "1px solid var(--admin-primary)" : "1px solid var(--admin-card-border)",
              background: selectedMuscle === muscle ? "rgba(173,198,255,0.15)" : "var(--bg2)",
              transition: "all 0.2s"
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--admin-card-border)", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}>
              <img src={imgSrc} alt={muscle} style={{ width: "100%", height: "100%", objectFit: "contain", filter: selectedMuscle === muscle ? "drop-shadow(0 0 4px var(--admin-primary))" : "grayscale(50%) opacity(70%)" }} />
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap", color: selectedMuscle === muscle ? "var(--admin-primary)" : "var(--admin-outline)" }}>
              {muscle}
            </span>
          </button>
        );
      })}
    </div>
  );
}
