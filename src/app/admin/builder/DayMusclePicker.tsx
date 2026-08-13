"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

const PREDEFINED_MUSCLES = [
  "كامل الجسم",
  "صدر",
  "ظهر",
  "ذراع",
  "اكتاف",
  "ارجل",
  "بطن",
  "تراي",
  "باي",
];

/**
 * Multi-select for a training day's target muscles.
 *
 * Provides a curated list of common muscles to check/uncheck with a multi-select
 * interactive menu, plus an "عضلة أخرى" option that reveals a text field to add
 * arbitrary custom muscles.
 */
export default function DayMusclePicker({
  selected,
  options,
  onChange,
}: {
  selected: string[];
  options?: string[];
  onChange: (muscles: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [custom, setCustom] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setShowCustomInput(false);
      setCustom("");
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  const toggle = (muscle: string) => {
    const m = muscle.trim();
    if (!m) return;
    onChange(
      selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m]
    );
  };

  const addCustom = () => {
    const m = custom.trim();
    if (!m) return;
    if (!selected.includes(m)) {
      onChange([...selected, m]);
    }
    setCustom("");
  };

  /* Show predefined choices first, then any custom typed muscles currently selected */
  const allOptions = useMemo(() => {
    const extra = selected.filter((m) => !PREDEFINED_MUSCLES.includes(m));
    return [...PREDEFINED_MUSCLES, ...extra];
  }, [selected]);

  return (
    <div ref={rootRef} className="dmp-root">
      <div className="dmp-chips">
        {selected.length === 0 ? (
          <span className="dmp-placeholder">لا توجد عضلات مستهدفة</span>
        ) : (
          selected.map((m) => (
            <span key={m} className="dmp-chip">
              {m}
              <button
                type="button"
                onClick={() => toggle(m)}
                aria-label={`إزالة ${m}`}
                title="إزالة"
              >
                <Icon name="close" style={{ fontSize: 14 }} />
              </button>
            </span>
          ))
        )}

        <button
          type="button"
          className="dmp-add"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <Icon name="add" style={{ fontSize: 16 }} />
          <span>إضافة عضلة</span>
        </button>
      </div>

      {open && (
        <div className="dmp-pop" role="dialog" aria-label="اختيار العضلات المستهدفة">
          <div className="dmp-pop-title">اختر العضلات المستهدفة (يمكنك اختيار أكثر من خيار):</div>
          
          <div className="dmp-list">
            {allOptions.map((m) => {
              const active = selected.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  className={`dmp-list-item ${active ? "active" : ""}`}
                  onClick={() => toggle(m)}
                  aria-pressed={active}
                >
                  <span className="dmp-checkbox">
                    {active && <Icon name="check" style={{ fontSize: 14 }} />}
                  </span>
                  <span className="dmp-item-text">{m}</span>
                </button>
              );
            })}
          </div>

          <div className="dmp-divider" />

          <button
            type="button"
            className={`dmp-other-btn ${showCustomInput ? "open" : ""}`}
            onClick={() => setShowCustomInput((v) => !v)}
          >
            <Icon name={showCustomInput ? "remove_circle_outline" : "add_circle_outline"} style={{ fontSize: 18 }} />
            <span>عضلة أخرى</span>
          </button>

          {showCustomInput && (
            <div className="dmp-custom-box">
              <input
                ref={inputRef}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="اكتب اسم العضلة هنا..."
                aria-label="إضافة عضلة جديدة"
              />
              <button
                type="button"
                className="dmp-custom-submit"
                onClick={addCustom}
                disabled={!custom.trim()}
                title="إضافة"
              >
                <span>إضافة</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
