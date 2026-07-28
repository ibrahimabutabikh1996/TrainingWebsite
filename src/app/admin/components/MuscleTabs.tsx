"use client";

import React from "react";
import "../crm.css";

interface MuscleTabsProps {
  uniqueMuscles: string[];
  selectedMuscle: string;
  onSelect: (muscle: string) => void;
}

const getMuscleImage = (muscle: string) => {
  if (muscle === "الكل" || muscle === "عام" || muscle.toLowerCase() === "all") return "/photos/musclesPhotos/23 - Rectus Abdominis العضلة المستقيمة البطنية - عضلات البطن كاملة.png";
  const m = muscle.toLowerCase();
  
  if (m.includes("ساعد") || m.includes("سواعد") || m.includes("forearm")) return "/photos/musclesPhotos/01 - Forearms عضلات الساعد.png";
  if (m.includes("سمان") || m.includes("بطات") || m.includes("ربلة") || m.includes("calf") || m.includes("calves")) return "/photos/musclesPhotos/02 - Calves عضلات السمانة - ربلة الساق.png";
  if (m.includes("خواصر") || m.includes("مائلة") || m.includes("جانبي") || m.includes("oblique")) return "/photos/musclesPhotos/03 - Obliques العضلات المائلة الجانبية - الخواصر.png";
  if (m.includes("كتف أمامي") || m.includes("anterior deltoid")) return "/photos/musclesPhotos/18 - Anterior Deltoids عضلات الكتف الأمامية.png";
  if (m.includes("كتف") || m.includes("أكتاف") || m.includes("دالي") || m.includes("deltoid") || m.includes("shoulder")) return "/photos/musclesPhotos/04 - Deltoids عضلات الكتف - العضلة الدالية.png";
  if (m.includes("تراي") || m.includes("ثلاثية") || m.includes("tricep")) return "/photos/musclesPhotos/05 - Triceps العضلة ثلاثية الرؤوس - الترايسبس.png";
  if (m.includes("أسفل الظهر") || m.includes("قطني") || m.includes("lower back") || m.includes("erector")) return "/photos/musclesPhotos/06 - Lower Back - Erector Spinae عضلات أسفل الظهر - القطنية.png";
  if (m.includes("مجنص") || m.includes("latissimus") || m.includes("lats")) return "/photos/musclesPhotos/07 - Latissimus Dorsi - Lats العضلة الظهرية العريضة - المجنص.png";
  if (m.includes("ترابيس") || m.includes("شبه منحرف") || m.includes("trapezius") || m.includes("traps")) return "/photos/musclesPhotos/08 - Trapezius - Traps العضلة شبه المنحرفة - الترابيس.png";
  if (m.includes("ظهر") || m.includes("back")) return "/photos/musclesPhotos/07 - Latissimus Dorsi - Lats العضلة الظهرية العريضة - المجنص.png";
  if (m.includes("فخذ خلفي") || m.includes("أفخاذ خلفية") || m.includes("خلفيات") || m.includes("أوتار") || m.includes("hamstring")) return "/photos/musclesPhotos/09 - Hamstrings عضلات الفخذ الخلفية - أوتار الركبة.png";
  if (m.includes("أرداف") || m.includes("مؤخر") || m.includes("ألوية") || m.includes("جلوت") || m.includes("glute")) return "/photos/musclesPhotos/10 - Glutes عضلات الألوية - الأرداف.png";
  if (m.includes("ضام") || m.includes("فخذ داخلي") || m.includes("أفخاذ داخلية") || m.includes("adductor")) return "/photos/musclesPhotos/11 - Adductors عضلات الفخذ الداخلية - الضامة.png";
  if (m.includes("مبعد") || m.includes("فخذ خارجي") || m.includes("أفخاذ خارجية") || m.includes("abductor")) return "/photos/musclesPhotos/12 - Abductors عضلات الفخذ الخارجية - المبعدة.png";
  if (m.includes("دمعي") || m.includes("vastus medialis")) return "/photos/musclesPhotos/13 - Vastus Medialis العضلة المتسعة الأنسية أو العضلة الدمعية.png";
  if (m.includes("رباعي") || m.includes("فخذ أمامي") || m.includes("أفخاذ أمامية") || m.includes("أماميات") || m.includes("quadricep") || m.includes("quad")) return "/photos/musclesPhotos/14 - Quadriceps عضلات الفخذ الأمامية - الرباعية.png";
  if (m.includes("قصبة") || m.includes("ظنبوب") || m.includes("tibialis")) return "/photos/musclesPhotos/16 - Tibialis Anterior العضلة الظنبوبية الأمامية - عضلة قصبة الساق.png";
  if (m.includes("باي") || m.includes("ذات الرأسين") || m.includes("bicep")) return "/photos/musclesPhotos/17 - Biceps العضلة ذات الرأسين - البايسبس.png";
  if (m.includes("رقب") || m.includes("neck")) return "/photos/musclesPhotos/19 - Neck muscles عضلات الرقبة.png";
  if (m.includes("صدر") || m.includes("بنج") || m.includes("chest") || m.includes("pectoral")) return "/photos/musclesPhotos/20 - Pectorals - Chest عضلات الصدر - البنج.png";
  if (m.includes("بطن علوي") || m.includes("upper ab")) return "/photos/musclesPhotos/21 - Upper Abs عضلات البطن العلوية.png";
  if (m.includes("بطن سفلي") || m.includes("lower ab")) return "/photos/musclesPhotos/22 - Lower Abs عضلات البطن السفلية.png";
  if (m.includes("معدة") || m.includes("مستقيمة بطنية") || m.includes("بطن") || m.includes("abdomin") || m.includes("abs")) return "/photos/musclesPhotos/23 - Rectus Abdominis العضلة المستقيمة البطنية - عضلات البطن كاملة.png";
  if (m.includes("فخذ") || m.includes("أفخاذ") || m.includes("رجل") || m.includes("أرجل") || m.includes("leg")) return "/photos/musclesPhotos/14 - Quadriceps عضلات الفخذ الأمامية - الرباعية.png";
  if (m.includes("ذراع") || m.includes("arm")) return "/photos/musclesPhotos/17 - Biceps العضلة ذات الرأسين - البايسبس.png";
  if (m.includes("كارديو") || m.includes("cardio") || m.includes("عام") || m.includes("كل")) return "/photos/musclesPhotos/23 - Rectus Abdominis العضلة المستقيمة البطنية - عضلات البطن كاملة.png"; // Fallback for cardio
  
  return "/photos/musclesPhotos/23 - Rectus Abdominis العضلة المستقيمة البطنية - عضلات البطن كاملة.png";
};

export default function MuscleTabs({ uniqueMuscles, selectedMuscle, onSelect }: MuscleTabsProps) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, paddingTop: 4 }} className="custom-scrollbar">
      {uniqueMuscles.map(muscle => {
        const imgSrc = getMuscleImage(muscle);
        
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
