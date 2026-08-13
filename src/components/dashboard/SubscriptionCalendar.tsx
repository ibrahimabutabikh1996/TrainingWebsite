"use client";

import React, { useState } from "react";
import { Icon } from "@/components/Icon";

interface SubscriptionCalendarProps {
  startDate: Date;
  endDate: Date;
  workoutDates?: string[];
}

const ArabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const WeekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toISOTen = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export function SubscriptionCalendar({ startDate, endDate, workoutDates = [] }: SubscriptionCalendarProps) {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth());

  const startISO = toISOTen(startDate);
  const endISO = toISOTen(endDate);
  const todayISO = toISOTen(now);
  const workoutSet = new Set(workoutDates);

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

  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  return (
    <div className="home-stat-card" style={{ marginTop: 28, transform: "none", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: "1px solid var(--border)", paddingBottom: 20 }}>
        <div>
          <div className="home-card-header" style={{ marginBottom: 8 }}>
            <h3 className="home-card-title" style={{ fontSize: "1.35rem", margin: 0 }}>تقويم الاشتراك وسجل التمرين الشهري</h3>
            <div className="home-card-icon"><Icon name="calendar_month" /></div>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", margin: 0, lineHeight: 1.6 }}>
            متابعة التزامك اليومي بالتمارين الرياضية خلال فترة اشتراكك النشط مع الكابتن إبراهيم.
          </p>
        </div>

        {/* Month Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg3)", padding: "8px 16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
          <button
            onClick={handlePrevMonth}
            style={{ padding: "6px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
            title="الشهر السابق"
          >
            <Icon name="chevron_right" />
          </button>
          <span style={{ minWidth: 130, textAlign: "center", fontWeight: 700, fontSize: "1.1rem", color: "var(--primary)" }}>
            {ArabicMonths[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            style={{ padding: "6px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
            title="الشهر التالي"
          >
            <Icon name="chevron_left" />
          </button>
        </div>
      </div>

      {/* Legend / Key */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: "16px 0", borderBottom: "1px solid var(--border)", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: "var(--success, #10b981)", boxShadow: "0 0 6px var(--success, #10b981)" }}></span>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>تمرين منجز (أخضر)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: "var(--error, #ef4444)" }}></span>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>لم يُسجل تمرين (أحمر)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "var(--primary)", color: "var(--text-inverse)", fontSize: "0.75rem", fontWeight: 700 }}>🏁 بداية / نهاية الاشتراك</span>
          <span>تواريخ الخطة</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "var(--radius-xs)", border: "1px dashed var(--primary)", background: "transparent" }}></span>
          <span>أيام قادمة في الخطة</span>
        </div>
      </div>

      {/* Calendar Grid Wrapper for responsiveness */}
      <div style={{ overflowX: "auto", marginTop: 16, paddingBottom: 8 }}>
        <div style={{ minWidth: 680 }}>
          {/* WeekDays Header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginBottom: 10, textAlign: "center", fontWeight: 700, fontSize: "0.95rem", color: "var(--primary)" }}>
            {WeekDays.map((day, idx) => (
              <div key={idx} style={{ padding: "10px 4px", background: "var(--bg3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: 100, background: "transparent", borderRadius: "var(--radius-lg)" }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const cellDate = new Date(currentYear, currentMonth, dayNum);
              const cellISO = toISOTen(cellDate);

              const isStart = cellISO === startISO;
              const isEnd = cellISO === endISO;
              const isInSub = cellISO >= startISO && cellISO <= endISO;
              const isElapsed = cellISO <= todayISO;
              const isToday = cellISO === todayISO;
              const isWorkedOut = workoutSet.has(cellISO);

              let bg = "var(--bg3)";
              let border = "1px solid var(--border)";
              let opacity = 1;
              let statusLabel = "";
              let statusColor = "var(--text-muted)";
              let statusIcon: "check_circle" | "close" | "schedule" | "fitness_center" | null = null;

              if (isInSub) {
                if (isWorkedOut) {
                  bg = "color-mix(in srgb, var(--success, #10b981) 16%, var(--bg3))";
                  border = "1.5px solid var(--success, #10b981)";
                  statusLabel = "تم التمرين";
                  statusColor = "var(--success, #10b981)";
                  statusIcon = "check_circle";
                } else if (isToday) {
                  // Today is ongoing and available for recording
                  bg = "color-mix(in srgb, var(--primary, #C9A84C) 14%, var(--bg3))";
                  border = "2px solid var(--primary, #C9A84C)";
                  statusLabel = "متاح للتسجيل";
                  statusColor = "var(--primary, #C9A84C)";
                  statusIcon = "schedule";
                } else if (cellISO < todayISO) {
                  // Day has finished without recording
                  bg = "color-mix(in srgb, var(--error, #ef4444) 14%, var(--bg3))";
                  border = "1.5px solid var(--error, #ef4444)";
                  statusLabel = "لم يُسجل";
                  statusColor = "var(--error, #ef4444)";
                  statusIcon = "close";
                } else {
                  // Future subscription day
                  bg = "var(--bg2)";
                  border = "1px dashed color-mix(in srgb, var(--primary) 45%, var(--border))";
                  statusLabel = "يوم قادم";
                  statusColor = "var(--text-muted)";
                }
              } else {
                // Outside subscription range
                opacity = 0.4;
                bg = "var(--bg2)";
                border = "1px solid var(--border)";
              }

              if (isToday) {
                border = "2px solid var(--primary)";
              }

              return (
                <div
                  key={dayNum}
                  style={{
                    background: bg,
                    border: border,
                    borderRadius: "var(--radius-lg)",
                    padding: 10,
                    minHeight: 104,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    opacity: opacity,
                    position: "relative",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Top Bar of cell: Day Number & Today indicator */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "1.15rem", fontWeight: 700, color: isToday ? "var(--primary)" : "var(--text)" }}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <span style={{ background: "var(--primary)", color: "var(--text-inverse)", padding: "2px 6px", borderRadius: "var(--radius-xs)", fontSize: "0.68rem", fontWeight: 700 }}>
                        اليوم
                      </span>
                    )}
                  </div>

                  {/* Center: Workout Status */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, margin: "auto 0", flexGrow: 1 }}>
                    {statusIcon && (
                      <Icon name={statusIcon} style={{ fontSize: "22px", color: statusColor }} />
                    )}
                    {statusLabel && (
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: statusColor, textAlign: "center" }}>
                        {statusLabel}
                      </span>
                    )}
                  </div>

                  {/* Bottom: Subscription Start / End Badge */}
                  {(isStart || isEnd) && (
                    <div style={{ marginTop: 8, width: "100%" }}>
                      {isStart && (
                        <div style={{ background: "var(--primary)", color: "var(--text-inverse)", padding: "4px", borderRadius: "var(--radius-xs)", fontSize: "0.74rem", fontWeight: 700, textAlign: "center", marginBottom: isEnd ? 4 : 0, boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                          🏁 بداية الاشتراك
                        </div>
                      )}
                      {isEnd && (
                        <div style={{ background: "var(--primary)", color: "var(--text-inverse)", padding: "4px", borderRadius: "var(--radius-xs)", fontSize: "0.74rem", fontWeight: 700, textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                          🏁 نهاية الاشتراك
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
