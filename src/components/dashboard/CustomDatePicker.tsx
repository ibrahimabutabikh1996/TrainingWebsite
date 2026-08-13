"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { formatDayAndDate, todayISODate } from "@/lib/trainingDates";

interface CustomDatePickerProps {
  value: string | null;
  minDate?: string | null;
  maxDate?: string | null;
  onlyToday?: boolean;
  disabled?: boolean;
  onChange: (date: string | null) => void;
  onInvalidSelect?: () => void;
}

const ArabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const WeekDays = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمعة", "سبت"];

export function CustomDatePicker({ value, minDate, maxDate, onlyToday = false, disabled = false, onChange, onInvalidSelect }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const initialDate = value && value.length >= 10 ? new Date(value) : new Date(todayISODate());
  const validYear = !isNaN(initialDate.getFullYear()) ? initialDate.getFullYear() : new Date().getFullYear();
  const validMonth = !isNaN(initialDate.getMonth()) ? initialDate.getMonth() : new Date().getMonth();

  const [currentYear, setCurrentYear] = useState(validYear);
  const [currentMonth, setCurrentMonth] = useState(validMonth);

  useEffect(() => {
    if (value && value.length >= 10) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getUTCFullYear());
        setCurrentMonth(d.getUTCMonth());
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const todayISO = todayISODate();

  const firstDayOfWeek = new Date(Date.UTC(currentYear, currentMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();

  // Check if previous/next month navigation should be disabled
  const prevMonthEndISO = `${currentMonth === 0 ? currentYear - 1 : currentYear}-${pad(currentMonth === 0 ? 12 : currentMonth)}-${pad(new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate())}`;
  const isPrevDisabled = Boolean((minDate && prevMonthEndISO < minDate) || (onlyToday && prevMonthEndISO < todayISO));
  
  const nextMonthStartISO = `${currentMonth === 11 ? currentYear + 1 : currentYear}-${pad(currentMonth === 11 ? 1 : currentMonth + 2)}-01`;
  const isNextDisabled = Boolean((maxDate && nextMonthStartISO > maxDate) || (onlyToday && nextMonthStartISO > todayISO));

  const handleSelectDay = (cellISO: string, isDisabled: boolean) => {
    if (isDisabled || (onlyToday && cellISO !== todayISO)) {
      if (onInvalidSelect) onInvalidSelect();
      return;
    }
    onChange(cellISO);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    onChange(todayISO);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={popupRef}>
      {/* Trigger Pill Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="custom-date-trigger"
        style={{
          background: value ? "color-mix(in srgb, var(--primary) 15%, var(--bg2))" : "var(--bg2)",
          color: value ? "var(--primary)" : "var(--text)",
          border: value ? "1.5px solid color-mix(in srgb, var(--primary) 65%, transparent)" : "1.5px dashed var(--border)",
          padding: "10px 18px",
          borderRadius: "14px",
          fontSize: "0.98rem",
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        title={disabled ? "التاريخ غير متاح للتعديل حالياً" : "اضغط لاختيار أو تعديل تاريخ الجلسة"}
      >
        <Icon name="event_available" style={{ fontSize: "20px", color: value ? "var(--primary)" : "var(--text-muted)" }} />
        <span>{value ? formatDayAndDate(value) : "تحديد تاريخ الجلسة..."}</span>
        <Icon name={isOpen ? "expand_more" : "calendar_month"} style={{ fontSize: "18px", opacity: 0.8, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }} />
      </button>

      {/* Dropdown Calendar Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            zIndex: 5000,
            width: 310,
            background: "var(--bg2)",
            border: "1px solid color-mix(in srgb, var(--primary) 45%, var(--border))",
            borderRadius: "20px",
            padding: "20px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
          }}
        >
          {/* Calendar Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", background: "var(--bg3)", padding: "8px 12px", borderRadius: "14px", border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={isPrevDisabled}
              className="custom-date-nav-btn"
              title="الشهر السابق"
            >
              <Icon name="chevron_right" />
            </button>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--primary)" }}>
              {ArabicMonths[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isNextDisabled}
              className="custom-date-nav-btn"
              title="الشهر التالي"
            >
              <Icon name="chevron_left" />
            </button>
          </div>

          {/* Weekdays header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "8px", textAlign: "center" }}>
            {WeekDays.map((wd, idx) => (
              <div key={idx} style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)", padding: "4px 0" }}>
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} style={{ height: "38px" }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const cellISO = `${currentYear}-${pad(currentMonth + 1)}-${pad(dayNum)}`;
              const isToday = cellISO === todayISO;
              const isDisabled = Boolean((minDate && cellISO < minDate) || (maxDate && cellISO > maxDate) || (onlyToday && !isToday));
              const isSelected = cellISO === value;

              let cellClass = "custom-date-cell";
              if (isSelected) cellClass += " selected";
              else if (isToday) cellClass += " today";

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(cellISO, isDisabled)}
                  className={cellClass}
                  style={isDisabled ? { opacity: 0.28, cursor: "not-allowed", background: "rgba(255,255,255,0.01)" } : undefined}
                  title={isDisabled ? "لا يمكن اختيار هذا التاريخ" : isToday ? "اليوم" : undefined}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={handleSelectToday}
              disabled={Boolean(minDate && todayISO < minDate)}
              style={{
                background: "var(--bg3)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                padding: "6px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
            >
              اليوم
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: "transparent",
                  color: "var(--error, #ef4444)",
                  border: "none",
                  padding: "6px 10px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                مسح التاريخ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
