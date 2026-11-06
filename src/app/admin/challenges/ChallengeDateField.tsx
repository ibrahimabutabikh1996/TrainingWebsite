"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { formatDate, todayISODate, weekdayName } from "@/lib/trainingDates";

/* The date field in the challenge editor: a trigger that looks like the other
 * fields, and a calendar of the panel's own glass in place of the browser's.
 *
 * Two views. Days: the month's grid, Saturday-first as an Iraqi week reads, with
 * today ringed, the chosen day filled and — when the other end of the
 * challenge's dates is known — the days between them tinted. Months: pressing
 * the month's name drops down the twelve months and a year stepper, so a date
 * a long way off is two presses rather than a dozen arrow clicks.
 *
 * The calendar is portalled to <body> and placed from the trigger's rectangle.
 * Inside the editor it would otherwise be clipped by the dialog's scrolling
 * body — which is what the browser's own picker was doing.
 *
 * `value` is "YYYY-MM-DD" or "". Its own copy rather than the dashboard's
 * CustomDatePicker, whose labels and title speak of training sessions. */

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/* Saturday first. */
const WEEKDAYS = ["سبت", "أحد", "إثن", "ثلا", "أرب", "خمي", "جمعة"];

const POPUP_WIDTH = 320;
const GAP = 8;

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(value: string): { y: number; m: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 };
}

export default function ChallengeDateField({
  value,
  onChange,
  placeholder,
  minDate,
  rangeStart,
  rangeEnd,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Days before this cannot be picked — the end date's floor is the start. */
  minDate?: string;
  /** The challenge's two dates, for tinting the days between them. */
  rangeStart?: string;
  rangeEnd?: string;
  /** For screen readers: the field's visible label. */
  label: string;
}) {
  const today = todayISODate();
  const start = parse(value) ?? parse(minDate ?? "") ?? parse(today)!;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months">("days");
  const [year, setYear] = useState(start.y);
  const [month, setMonth] = useState(start.m);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  /* Opening shows the chosen day's month, or today's. */
  const toggle = () => {
    if (!open) {
      const s = parse(value) ?? parse(minDate ?? "") ?? parse(today)!;
      setYear(s.y);
      setMonth(s.m);
      setView("days");
    }
    setOpen(!open);
  };

  /* Below the trigger when it fits, above it when it does not; kept on screen
     sideways. Read again on scroll and resize, since the dialog body scrolls. */
  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const height = popupRef.current?.offsetHeight ?? 400;
    const up = r.bottom + GAP + height > window.innerHeight && r.top - GAP - height > 0;
    const width = Math.min(POPUP_WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    setPos({ top: up ? r.top - GAP - height : r.bottom + GAP, left, up });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, view, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const step = (delta: number) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  };

  const choose = (iso: string) => {
    onChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  /* Saturday-first offset: getUTCDay is Sunday = 0, so Saturday (6) becomes 0. */
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 1) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lo = rangeStart || "";
  const hi = rangeEnd || "";

  const prevDisabled = Boolean(minDate && isoOf(year, month, 1) <= minDate);

  return (
    <>
      <div className={`chl-date-field${open ? " is-open" : ""}${value ? " has-value" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          className="chl-date-trigger"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: ${value ? `${weekdayName(value)} ${formatDate(value)}` : "غير محدد"}`}
        >
          <Icon name="calendar_month" />
          <span className="chl-date-text">
            {value ? (
              <>
                <span className="chl-date-day">{weekdayName(value)}</span> {formatDate(value)}
              </>
            ) : (
              <span className="chl-date-placeholder">{placeholder}</span>
            )}
          </span>
          {!value && <Icon name="expand_more" className="chl-date-caret" />}
        </button>
        {value && (
          <button type="button" className="chl-date-clear" aria-label={`مسح ${label}`} title="مسح التاريخ" onClick={() => onChange("")}>
            <Icon name="close" />
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            className={`chl-cal${pos?.up ? " is-up" : ""}`}
            role="dialog"
            aria-label={label}
            dir="rtl"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(POPUP_WIDTH, typeof window === "undefined" ? POPUP_WIDTH : window.innerWidth - 16) }}
          >
            <div className="chl-cal-head">
              <button
                type="button"
                className="chl-cal-nav"
                onClick={() => (view === "days" ? step(-1) : setYear(year - 1))}
                disabled={view === "days" && prevDisabled}
                aria-label={view === "days" ? "الشهر السابق" : "السنة السابقة"}
              >
                <Icon name="chevron_right" />
              </button>
              <button
                type="button"
                className={`chl-cal-title${view === "months" ? " is-active" : ""}`}
                onClick={() => setView(view === "days" ? "months" : "days")}
                aria-expanded={view === "months"}
                aria-label="اختيار الشهر والسنة"
              >
                {view === "days" ? `${MONTHS[month]} ${year}` : year}
                <Icon name="expand_more" />
              </button>
              <button
                type="button"
                className="chl-cal-nav"
                onClick={() => (view === "days" ? step(1) : setYear(year + 1))}
                aria-label={view === "days" ? "الشهر التالي" : "السنة التالية"}
              >
                <Icon name="chevron_left" />
              </button>
            </div>

            {view === "months" ? (
              <div className="chl-cal-months" role="listbox" aria-label="الأشهر">
                {MONTHS.map((name, i) => {
                  const last = isoOf(year, i, new Date(Date.UTC(year, i + 1, 0)).getUTCDate());
                  const disabled = Boolean(minDate && last < minDate);
                  const isCurrent = i === month;
                  const isThisMonth = today.slice(0, 7) === `${year}-${pad(i + 1)}`;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      disabled={disabled}
                      className={`chl-cal-month${isCurrent ? " is-selected" : ""}${isThisMonth ? " is-today" : ""}`}
                      onClick={() => {
                        setMonth(i);
                        setView("days");
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="chl-cal-week" aria-hidden="true">
                  {WEEKDAYS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="chl-cal-grid">
                  {Array.from({ length: offset }, (_, i) => (
                    <span key={`e${i}`} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const d = i + 1;
                    const iso = isoOf(year, month, d);
                    const disabled = Boolean(minDate && iso < minDate);
                    const selected = iso === value;
                    const inRange = Boolean(lo && hi && iso > lo && iso < hi);
                    const isEdge = Boolean((lo && iso === lo) || (hi && iso === hi));
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={disabled}
                        className={[
                          "chl-cal-day",
                          selected && "is-selected",
                          !selected && isEdge && "is-edge",
                          inRange && "is-range",
                          iso === today && "is-today",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={selected}
                        aria-label={`${weekdayName(iso)} ${formatDate(iso)}`}
                        onClick={() => choose(iso)}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="chl-cal-foot">
              <button
                type="button"
                className="chl-cal-today"
                disabled={Boolean(minDate && today < minDate)}
                onClick={() => choose(today)}
              >
                <Icon name="event_available" />
                اليوم
              </button>
              {value && (
                <button type="button" className="chl-cal-clear" onClick={() => choose("")}>
                  مسح التاريخ
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
