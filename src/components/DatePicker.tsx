"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { formatDate, todayISODate, weekdayName } from "@/lib/trainingDates";
import "./DatePicker.css";

/* The site's one date field: a trigger that looks like the other fields, and a
 * calendar of the product's own glass in place of the browser's.
 *
 * Two views. Days: the month's grid, Saturday-first as an Iraqi week reads, with
 * today ringed, the chosen day filled and — when both ends of a span are given —
 * the days between them tinted. Months: pressing the month's name drops down the
 * twelve months and a year stepper, so a date a long way off is two presses
 * rather than a dozen arrow clicks.
 *
 * The calendar is portalled to <body> and placed from the trigger's rectangle,
 * below it when it fits and above when it does not. Inside a dialog it would
 * otherwise be clipped by the dialog's scrolling body.
 *
 * Values are "YYYY-MM-DD". `onChange(null)` means cleared.
 *
 * Used directly by the challenge editor, and through the older
 * `CustomDatePicker` on the trainee's weight log and workout days. */

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
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function parse(value: string | null | undefined): { y: number; m: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  return { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 };
}

export interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shown while empty. */
  placeholder?: string;
  /** For screen readers: what the field is. */
  label?: string;
  /** Days before / after these cannot be picked. */
  minDate?: string | null;
  maxDate?: string | null;
  /** Only today may be picked. */
  onlyToday?: boolean;
  disabled?: boolean;
  /** Called when a day that cannot be picked is pressed. */
  onInvalidSelect?: () => void;
  /** Both ends of a span, for tinting the days between them. */
  rangeStart?: string | null;
  rangeEnd?: string | null;
  /** A ✕ on the field that clears it. The calendar's own "مسح" is always there. */
  clearable?: boolean;
  /** Stretch to the container; otherwise as wide as the date needs. */
  fullWidth?: boolean;
  title?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
  label = "التاريخ",
  minDate,
  maxDate,
  onlyToday = false,
  disabled = false,
  onInvalidSelect,
  rangeStart,
  rangeEnd,
  clearable = false,
  fullWidth = true,
  title,
  id,
}: DatePickerProps) {
  const today = todayISODate();
  const current = value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
  /* Only today allowed is the same as a floor and a ceiling on today. */
  const floor = onlyToday ? today : minDate || null;
  const ceiling = onlyToday ? today : maxDate || null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months">("days");
  const [year, setYear] = useState(() => (parse(current) ?? parse(today)!).y);
  const [month, setMonth] = useState(() => (parse(current) ?? parse(today)!).m);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  /* Opening shows the chosen day's month — or the nearest month that can be
     picked from, or today's. */
  const toggle = () => {
    if (disabled) return;
    if (!open) {
      const s = parse(current) ?? parse(ceiling && today > ceiling ? ceiling : floor && today < floor ? floor : today)!;
      setYear(s.y);
      setMonth(s.m);
      setView("days");
      setPos(null);
    }
    setOpen(!open);
  };

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  /* Below the trigger when it fits, above it when it does not; kept on screen
     sideways. Read again on scroll and resize, since dialog bodies scroll. */
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
  }, [open, view, year, month, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        /* The calendar's Escape, not the dialog's: closing the editor around it
           would throw away what was typed. */
        e.stopPropagation();
        close();
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
  }, [open, place, close]);

  /* A disabled trigger cannot hold an open calendar. */
  if (disabled && open) setOpen(false);

  const step = (delta: number) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  };

  const outOfBounds = (iso: string) => Boolean((floor && iso < floor) || (ceiling && iso > ceiling));

  const choose = (iso: string | null) => {
    if (iso !== null && outOfBounds(iso)) {
      onInvalidSelect?.();
      return;
    }
    onChange(iso);
    close();
  };

  /* Saturday-first offset: getUTCDay is Sunday = 0, so Saturday (6) becomes 0. */
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 1) % 7;
  const days = lastDayOf(year, month);
  const lo = rangeStart || "";
  const hi = rangeEnd || "";

  const prevDisabled =
    view === "days"
      ? Boolean(floor && isoOf(year, month, 1) <= floor)
      : Boolean(floor && `${year - 1}-12-31` < floor);
  const nextDisabled =
    view === "days"
      ? Boolean(ceiling && isoOf(year, month, days) >= ceiling)
      : Boolean(ceiling && `${year + 1}-01-01` > ceiling);

  const shown = current ? `${weekdayName(current)} ${formatDate(current)}` : null;

  return (
    <>
      <div className={`dp-field${fullWidth ? " is-full" : ""}${open ? " is-open" : ""}${current ? " has-value" : ""}${clearable && current ? " is-clearable" : ""}`}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className="dp-trigger"
          onClick={toggle}
          disabled={disabled}
          title={title}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: ${shown ?? "غير محدد"}`}
        >
          <Icon name="calendar_month" />
          <span className="dp-text">
            {current ? (
              <>
                <span className="dp-day">{weekdayName(current)}</span> {formatDate(current)}
              </>
            ) : (
              <span className="dp-placeholder">{placeholder}</span>
            )}
          </span>
          {!(clearable && current) && <Icon name="expand_more" className="dp-caret" />}
        </button>
        {clearable && current && !disabled && (
          <button type="button" className="dp-clear" aria-label={`مسح ${label}`} title="مسح التاريخ" onClick={() => onChange(null)}>
            <Icon name="close" />
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            className={`dp-cal${pos?.up ? " is-up" : ""}`}
            role="dialog"
            aria-label={label}
            dir="rtl"
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: Math.min(POPUP_WIDTH, window.innerWidth - 16),
              /* Measured once before it is shown, so it never flashes in the
                 wrong place. */
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <div className="dp-head">
              <button
                type="button"
                className="dp-nav"
                onClick={() => (view === "days" ? step(-1) : setYear(year - 1))}
                disabled={prevDisabled}
                aria-label={view === "days" ? "الشهر السابق" : "السنة السابقة"}
              >
                <Icon name="chevron_right" />
              </button>
              <button
                type="button"
                className={`dp-title${view === "months" ? " is-active" : ""}`}
                onClick={() => setView(view === "days" ? "months" : "days")}
                aria-expanded={view === "months"}
                aria-label="اختيار الشهر والسنة"
              >
                {view === "days" ? `${MONTHS[month]} ${year}` : year}
                <Icon name="expand_more" />
              </button>
              <button
                type="button"
                className="dp-nav"
                onClick={() => (view === "days" ? step(1) : setYear(year + 1))}
                disabled={nextDisabled}
                aria-label={view === "days" ? "الشهر التالي" : "السنة التالية"}
              >
                <Icon name="chevron_left" />
              </button>
            </div>

            {view === "months" ? (
              <div className="dp-months" role="listbox" aria-label="الأشهر">
                {MONTHS.map((name, i) => {
                  const off = Boolean(
                    (floor && isoOf(year, i, lastDayOf(year, i)) < floor) || (ceiling && isoOf(year, i, 1) > ceiling)
                  );
                  const isCurrent = i === month;
                  const isThisMonth = today.slice(0, 7) === `${year}-${pad(i + 1)}`;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      disabled={off}
                      className={`dp-month${isCurrent ? " is-selected" : ""}${isThisMonth ? " is-today" : ""}`}
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
                <div className="dp-week" aria-hidden="true">
                  {WEEKDAYS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="dp-grid">
                  {Array.from({ length: offset }, (_, i) => (
                    <span key={`e${i}`} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const d = i + 1;
                    const iso = isoOf(year, month, d);
                    const off = outOfBounds(iso);
                    const selected = iso === current;
                    const inRange = Boolean(lo && hi && iso > lo && iso < hi);
                    const isEdge = Boolean((lo && iso === lo) || (hi && iso === hi));
                    return (
                      <button
                        key={iso}
                        type="button"
                        /* aria-disabled rather than disabled, so a press on a
                           day that cannot be picked can still say why. */
                        aria-disabled={off || undefined}
                        className={[
                          "dp-day-cell",
                          selected && "is-selected",
                          !selected && isEdge && "is-edge",
                          inRange && "is-range",
                          iso === today && "is-today",
                          off && "is-off",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={selected}
                        aria-label={`${weekdayName(iso)} ${formatDate(iso)}`}
                        title={off ? "لا يمكن اختيار هذا التاريخ" : iso === today ? "اليوم" : undefined}
                        onClick={() => choose(iso)}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="dp-foot">
              <button type="button" className="dp-today" disabled={outOfBounds(today)} onClick={() => choose(today)}>
                <Icon name="event_available" />
                اليوم
              </button>
              {current && (
                <button type="button" className="dp-reset" onClick={() => choose(null)}>
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

export default DatePicker;
