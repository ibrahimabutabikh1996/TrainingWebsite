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

/* The tiles and the two arrows that page through them.
 *
 * This was written entirely in inline styles, which is why it behaved the same
 * on a 1920px monitor and a 320px phone: an inline style is unreachable from a
 * media query, so nothing here could be told to stand down on a small screen.
 * On a 320px screen the two 44px arrows and their gaps took 104px of the 262px
 * the toolbar had, leaving a 158px window onto a 1279px strip — a filter you
 * could see one and a half tiles of.
 *
 * The arrows are for a mouse. A touch screen swipes the strip directly, so
 * below 640px they are hidden and the tiles take the whole width; see
 * `.mtabs-nav` in exercises.css. Nothing is lost: the same tiles, reached the
 * way a phone reaches them.
 *
 * The scrollbar-hiding rule went with the styles, and not a moment too soon —
 * it was `div::-webkit-scrollbar { display: none }`, a bare type selector in a
 * <style> tag, so mounting this component hid the scrollbar of every div on the
 * page. It is scoped to this track now.
 */
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
    <div className="mtabs">
      <button onClick={scrollRight} aria-label="تمرير لليمين" className="mtabs-nav">
        <Icon name="chevron_right" />
      </button>

      <div ref={scrollRef} role="group" aria-label="تصفية حسب العضلة" className="mtabs-track">
        {uniqueMuscles.map((muscle) => {
          const isSelected = selectedMuscle === muscle;
          return (
            <button
              key={muscle}
              onClick={() => onSelect(muscle)}
              aria-pressed={isSelected}
              className="mtabs-tile"
            >
              <span className="mtabs-tile-img">
                <img src={getMuscleImage(muscle)} alt={muscle} />
              </span>
              <span className="mtabs-tile-label">{muscle}</span>
            </button>
          );
        })}
      </div>

      <button onClick={scrollLeft} aria-label="تمرير لليسار" className="mtabs-nav">
        <Icon name="chevron_left" />
      </button>
    </div>
  );
}
