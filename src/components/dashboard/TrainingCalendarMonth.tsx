"use client";

/* The training calendar — the home tab's month grid, marking every day the
 * trainee has trained on. It reads; it takes no choice. The day a workout is
 * filed under is chosen on the workout tab, in the date picker that has always
 * been there, and shows up here once it is.
 *
 * Dates here are plain calendar days, carried and read as UTC midnight through
 * the helpers in @/lib/trainingDates — never `new Date(y, m, d)`, which is local
 * midnight and lands on the day before wherever local time runs behind UTC. The
 * note at the top of that file explains why the whole log is written this way.
 */

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { fromISODate, todayISODate } from "@/lib/trainingDates";
import "./training-calendar.css";

/** One day the trainee has marked as trained. */
export interface TrainedDay {
  /** `YYYY-MM-DD` — the day the workout happened on, as the trainee gave it. */
  date: string;
  day_number: number;
  cycle_number?: number;
}

/* The eight accents the workout screen gives its day buttons, so day 3 is the
   same colour on its mark here as it is on its own chip there.

   A second copy of that list, not a shared one: consolidating them means editing
   WorkoutPlan's own constant, which is outside what I was asked to change. The
   day accents are literals in both places — unlike every other colour in the
   product, which comes from a token in globals.css. */
const DAY_ACCENT_COLORS = [
  "#E8C96A",
  "#F97316",
  "#10B981",
  "#A855F7",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#8B5CF6",
];

function dayAccent(dayNumber: number): string {
  return DAY_ACCENT_COLORS[(Math.max(1, dayNumber) - 1) % DAY_ACCENT_COLORS.length];
}

/* Gregorian months and short weekday names, written out rather than taken from
   `toLocaleDateString`: the `ar-SA` locale resolves to the Umm al-Qura calendar
   on some browsers and would print a Hijri month for a Gregorian day. Same
   reason the helpers in trainingDates are hand-rolled, and the same two lists
   CustomDatePicker keeps for itself. */
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** Indexed by `getUTCDay()`: 0 = Sunday … 6 = Saturday. */
const WEEKDAYS_SHORT = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمعة", "سبت"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Months since year zero — for comparing two months without building dates. */
const monthIndex = (y: number, m: number) => y * 12 + m;

interface TrainingCalendarMonthProps {
  days: TrainedDay[];
}

export function TrainingCalendarMonth({ days }: TrainingCalendarMonthProps) {
  const todayISO = todayISODate();

  /* Two workouts may carry the same date — nothing forbids it — so a day holds a
     list of marks rather than one. */
  const byDate = useMemo(() => {
    const map = new Map<string, TrainedDay[]>();
    days.forEach((d) => {
      const at = map.get(d.date);
      if (at) at.push(d);
      else map.set(d.date, [d]);
    });
    return map;
  }, [days]);

  /* Which month is on screen. Opens on this one. */
  const [cursor, setCursor] = useState(() => {
    const at = fromISODate(todayISO);
    return { y: at.getUTCFullYear(), m: at.getUTCMonth() };
  });

  /* How far back the arrows go: the trainee's own first recorded day, so their
     whole history is reachable and nothing beyond it is. */
  const floorISO = useMemo(
    () => days.reduce((earliest, d) => (d.date < earliest ? d.date : earliest), todayISO),
    [days, todayISO],
  );

  const floor = fromISODate(floorISO);
  const today = fromISODate(todayISO);
  const shown = monthIndex(cursor.y, cursor.m);
  const isPrevDisabled = shown <= monthIndex(floor.getUTCFullYear(), floor.getUTCMonth());
  const isNextDisabled = shown >= monthIndex(today.getUTCFullYear(), today.getUTCMonth());

  const step = (delta: number) => {
    const next = cursor.m + delta;
    if (next < 0) setCursor({ y: cursor.y - 1, m: 11 });
    else if (next > 11) setCursor({ y: cursor.y + 1, m: 0 });
    else setCursor({ y: cursor.y, m: next });
  };

  const firstWeekday = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();

  const trainedThisMonth = Array.from(byDate.entries()).reduce(
    (count, [date, marks]) =>
      date.startsWith(`${cursor.y}-${pad(cursor.m + 1)}`) ? count + marks.length : count,
    0,
  );

  return (
    <div>
      <div className="tcal-head">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={isPrevDisabled}
          className="custom-date-nav-btn"
          title="الشهر السابق"
        >
          <Icon name="chevron_right" />
        </button>
        <span className="tcal-month">
          {MONTHS_AR[cursor.m]} {cursor.y}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={isNextDisabled}
          className="custom-date-nav-btn"
          title="الشهر التالي"
        >
          <Icon name="chevron_left" />
        </button>
      </div>

      <div className="tcal-weekdays">
        {WEEKDAYS_SHORT.map((name) => (
          <div key={name} className="tcal-weekday">
            {name}
          </div>
        ))}
      </div>

      <div className="tcal-grid">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`blank-${i}`} className="tcal-blank" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const cellISO = `${cursor.y}-${pad(cursor.m + 1)}-${pad(dayNum)}`;
          const marks = byDate.get(cellISO) ?? [];
          const isToday = cellISO === todayISO;

          let cellClass = "tcal-cell";
          if (marks.length) cellClass += " is-trained";
          if (isToday) cellClass += " is-today";

          return (
            <div key={cellISO} className={cellClass} title={isToday ? "اليوم" : undefined}>
              <span className="tcal-num">{dayNum}</span>
              {marks.length > 0 && (
                <span className="tcal-marks">
                  {marks.map((mark, at) => (
                    <span
                      key={`${mark.day_number}-${at}`}
                      className="tcal-dot"
                      style={{ background: dayAccent(mark.day_number) }}
                      title={
                        mark.cycle_number
                          ? `اليوم ${mark.day_number} — الجدول ${mark.cycle_number}`
                          : `اليوم ${mark.day_number}`
                      }
                    >
                      {mark.day_number}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="tcal-foot">
        <span>تمارين هذا الشهر</span>
        <strong style={{ color: "var(--primary-on-tint)" }}>{trainedThisMonth}</strong>
      </div>
    </div>
  );
}

/**
 * The home tab's card: the month, the marks, and nothing to press.
 *
 * Reads `?view=dates`, which answers with the recorded days alone rather than
 * with every cycle, plan and weight. `reloadKey` is the page's way of saying the
 * answer may have moved — it is bumped when the live poller sees a change and
 * when the home tab is opened, so a workout filed on the workout tab shows up
 * here without a reload.
 */
export function TrainingCalendarCard({
  profileId,
  reloadKey = 0,
}: {
  profileId: string;
  reloadKey?: number;
}) {
  const [days, setDays] = useState<TrainedDay[] | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/training-cycles?profileId=${profileId}&view=dates`);
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && Array.isArray(body.days)) setDays(body.days as TrainedDay[]);
      } catch {
        /* A calendar that cannot load shows the month it has rather than an
           error: nothing here is an action the trainee is waiting on. */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, reloadKey]);

  return (
    <div className="home-stat-card">
      <div>
        <div className="home-card-header">
          <h3 className="home-card-title">أيام التدريب</h3>
          <div className="home-card-icon">
            <Icon name="calendar_month" />
          </div>
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          {days === null ? (
            <div className="tcal-loading">جاري تحميل التقويم...</div>
          ) : (
            <TrainingCalendarMonth days={days} />
          )}
        </div>
      </div>
    </div>
  );
}
