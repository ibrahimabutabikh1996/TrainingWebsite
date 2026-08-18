"use client";

import React, { useRef } from "react";
import { Icon } from "@/components/Icon";
import "../crm.css";
import "../exercises/exercises.css";

interface MuscleTabsProps {
  uniqueMuscles: string[];
  selectedMuscle: string;
  onSelect: (muscle: string) => void;
}

const getMuscleImage = (muscle: string) => {
  switch (muscle) {
    case "صدر": return "/photos/musclesPhotos/20 - Pectorals - Chest عضلات الصدر - البنج.png";
    case "ظهر": return "/photos/musclesPhotos/07 - Latissimus Dorsi - Lats العضلة الظهرية العريضة - المجنص.png";
    case "اكتاف": return "/photos/musclesPhotos/04 - Deltoids عضلات الكتف - العضلة الدالية.png";
    case "ذراعين": return "/photos/musclesPhotos/17 - Biceps العضلة ذات الرأسين - البايسبس.png";
    case "ارجل": return "/photos/musclesPhotos/14 - Quadriceps عضلات الفخذ الأمامية - الرباعية.png";
    case "بطن": return "/photos/musclesPhotos/23 - Rectus Abdominis العضلة المستقيمة البطنية - عضلات البطن كاملة.png";
    case "فيديوهات توضيحية": return "/photos/musclesPhotos/25 - VIdeos فديوهات توضيحية.png";
    case "منزلي بدون معدات": return "/photos/musclesPhotos/24 - Home Workout منزلي بدون معدات.png";
    case "خشونة الركبة": return "/photos/musclesPhotos/26 - خشونة الركبة.png";
    case "كل التمارين": 
    default: 
      return "/photos/musclesPhotos/27 - كل عضلات الجسم.png";
  }
};

export default function MuscleTabs({ uniqueMuscles, selectedMuscle, onSelect }: MuscleTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -250, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 250, behavior: "smooth" });
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", position: "relative" }}>
      <button
        onClick={scrollRight}
        aria-label="تمرير لليمين"
        style={{
          flexShrink: 0,
          zIndex: 10,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.15)",
          color: "var(--text)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <Icon name="chevron_right" />
      </button>

      <div
        ref={scrollRef}
        role="group"
        aria-label="تصفية حسب العضلة"
        style={{
          display: "flex",
          gap: "var(--space-4)",
          overflowX: "auto",
          paddingBottom: "var(--space-4)",
          paddingTop: "var(--space-2)",
          paddingInline: "var(--space-2)",
          maxWidth: "100%",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {uniqueMuscles.map((muscle) => {
          const isSelected = selectedMuscle === muscle;
          const imgSrc = getMuscleImage(muscle);
          return (
            <button
              key={muscle}
              onClick={() => onSelect(muscle)}
              aria-pressed={isSelected}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
                minWidth: "110px",
                padding: "var(--space-4) var(--space-2)",
                background: isSelected ? "var(--bg3)" : "transparent",
                border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                borderRadius: "var(--radius-xl)",
                cursor: "pointer",
                transition: "all var(--dur-slow) var(--ease-out)",
                transform: isSelected ? "translateY(-4px)" : "translateY(0)",
                boxShadow: isSelected ? "var(--elev-2)" : "none",
                flexShrink: 0,
              }}
            >
              <div style={{ height: "72px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img 
                  src={imgSrc} 
                  alt={muscle} 
                  style={{ 
                    maxHeight: "100%", 
                    maxWidth: "100%",
                    objectFit: "contain", 
                    filter: isSelected ? "none" : "grayscale(100%) opacity(40%)",
                    transition: "all var(--dur-slow) var(--ease-out)",
                    transform: isSelected ? "scale(1.1)" : "scale(1)"
                  }} 
                />
              </div>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: isSelected ? "var(--weight-bold)" : "var(--weight-medium)",
                  color: isSelected ? "var(--text)" : "var(--text-secondary)",
                  transition: "color var(--dur-fast) var(--ease)",
                  whiteSpace: "nowrap"
                }}
              >
                {muscle}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={scrollLeft}
        aria-label="تمرير لليسار"
        style={{
          flexShrink: 0,
          zIndex: 10,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.15)",
          color: "var(--text)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <Icon name="chevron_left" />
      </button>
    </div>
  );
}
