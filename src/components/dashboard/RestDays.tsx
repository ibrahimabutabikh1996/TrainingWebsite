"use client";

import { UserProfile } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { arabicCount, DAY } from "@/lib/arabicCount";
import {
  DAY_MS,
  formatDayAndDate,
  fromISODate,
  relativeDayLabel,
  todayISODate,
  toISODate,
  weekdayOf,
  WEEKDAYS_AR,
  WEEKDAY_PICKER_ORDER,
} from "@/lib/trainingDates";
import "./workout-log.css";

/* Rest days belong to the trainee, not to a schedule.
   Since no day is fixed for training, no day is fixed for resting either: the
   trainee marks their own out of the days their subscription covers. A rest day
   is a record of a day taken off — it counts towards no cycle, and cannot on its
   own bring one closer to ending. */

interface RestDay {
  id: string;
  rest_on: string;
  note: string | null;
}

interface Window {
  start: string;
  end: string;
}

type SaveState = "idle" | "saving" | "error";

export function RestDays({ profile }: { profile: UserProfile }) {
  const [days, setDays] = useState<RestDay[]>([]);
  const [window, setWindow] = useState<Window | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("");

  /* The trainee's own calendar day, read in the browser: this component renders
     on the server too, and the two clocks can sit on different dates. */
  const [today, setToday] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile.id) return;
    try {
      const res = await fetch(`/api/rest-days?profileId=${profile.id}`);
      setToday(todayISODate());
      if (!res.ok) return;
      const body = await res.json();
      if (!Array.isArray(body.days)) return;
      setDays(body.days);
      setWindow(body.window ?? null);
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  /* Training on a day marked as rest drops the marking server-side. The workout
     card announces that; re-read so this list does not keep showing the day. */
  useEffect(() => {
    const onChanged = () => load();
    globalThis.addEventListener("gym:rest-days-changed", onChanged);
    return () => globalThis.removeEventListener("gym:rest-days-changed", onChanged);
  }, [load]);

  /* Every day the subscription covers, newest first — days already ahead are
     offered too, so a rest day can be planned as well as recorded. */
  const options = useMemo(() => {
    if (!window) return [];
    const start = fromISODate(window.start).getTime();
    const end = fromISODate(window.end).getTime();
    const span = Math.round((end - start) / DAY_MS);
    return Array.from({ length: span + 1 }, (_, i) => toISODate(new Date(end - i * DAY_MS)));
  }, [window]);

  /* Only the current subscription's rest days belong on this card — the trainee
     picks from the days it covers, so those are the days it should show back.
     Earlier ones stay in the record the coach reads rather than piling up here
     month after month. */
  const current = useMemo(
    () => (window ? days.filter((d) => d.rest_on >= window.start && d.rest_on <= window.end) : days),
    [days, window]
  );
  const earlier = days.length - current.length;

  const marked = useMemo(() => new Set(current.map((d) => d.rest_on)), [current]);
  const free = useMemo(() => options.filter((d) => !marked.has(d)), [options, marked]);

  const mark = async (date: string) => {
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/rest-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, restOn: date }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "تعذّر حفظ يوم الراحة");
        setState("error");
        return;
      }
      setDays((rows) =>
        [...rows.filter((r) => r.rest_on !== body.day.rest_on), body.day].sort((a, b) =>
          a.rest_on < b.rest_on ? 1 : -1
        )
      );
      setPicked("");
      setState("idle");
    } catch {
      setError("تعذّر الاتصال بالخادم");
      setState("error");
    }
  };

  const unmark = async (date: string) => {
    setState("saving");
    setError("");
    try {
      const res = await fetch(
        `/api/rest-days?profileId=${profile.id}&restOn=${date}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "تعذّر إلغاء يوم الراحة");
        setState("error");
        return;
      }
      setDays((rows) => rows.filter((r) => r.rest_on !== date));
      setState("idle");
    } catch {
      setError("تعذّر الاتصال بالخادم");
      setState("error");
    }
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-title" style={{ marginBottom: 16 }}>
        أيام الراحة
        {current.length > 0 && (
          <span className="pill-badge" style={{ fontSize: 14, padding: "6px 12px" }}>
            {arabicCount(current.length, DAY)}
          </span>
        )}
      </div>

      <div className="wl-root">
        {loading ? (
          <div className="wl-empty">جاري تحميل أيام الراحة...</div>
        ) : (
          <>
            <div className="wl-hint">
              <span className="material-symbols-outlined">self_improvement</span>
              <span>
                حدّد أيام راحتك بنفسك من أيام اشتراكك — لا يوجد يوم راحة مفروض عليك. يوم
                الراحة سجلّ لا يُحتسب ضمن تمارين الدورة، ولو تمرّنت في يوم حدّدته للراحة
                يُلغى تحديده تلقائياً.
              </span>
            </div>

            <div className="wl-record-fields">
              <label className="wl-field">
                <span>اليوم</span>
                <select
                  disabled={state === "saving" || free.length === 0}
                  value={picked ? String(weekdayOf(picked)) : ""}
                  onChange={(e) => {
                    const dow = e.target.value;
                    if (!dow) return setPicked("");
                    /* The nearest free day with that name, counting back from the
                       end of the subscription. */
                    const match = free.find((d) => weekdayOf(d) === Number(dow));
                    setPicked(match ?? "");
                  }}
                >
                  <option value="">— اختر اليوم —</option>
                  {WEEKDAY_PICKER_ORDER.map((d) => (
                    <option key={d} value={d} disabled={!free.some((f) => weekdayOf(f) === d)}>
                      {WEEKDAYS_AR[d]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wl-field">
                <span>التاريخ</span>
                <select
                  disabled={state === "saving" || free.length === 0}
                  value={picked}
                  onChange={(e) => setPicked(e.target.value)}
                >
                  <option value="">— اختر التاريخ —</option>
                  {free.map((d) => {
                    const rel = today ? relativeDayLabel(d, today) : null;
                    return (
                      <option key={d} value={d}>
                        {formatDayAndDate(d)}
                        {rel ? ` (${rel})` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="wl-field">
                <span aria-hidden="true">&nbsp;</span>
                <button
                  type="button"
                  className="wl-rest-add"
                  disabled={!picked || state === "saving"}
                  onClick={() => picked && mark(picked)}
                >
                  <span className="material-symbols-outlined">add</span>
                  تحديد كيوم راحة
                </button>
              </label>
            </div>

            {state === "error" && <p className="wl-record-state" data-state="error">{error}</p>}

            {!window && (
              <p className="wl-record-state">
                لم تُفعَّل مدة اشتراكك بعد — سيحدّد الكابتن بدايتها ثم تظهر أيامها هنا.
              </p>
            )}

            {current.length === 0 ? (
              <div className="wl-empty">لم تحدّد أي يوم راحة في اشتراكك الحالي.</div>
            ) : (
              <ul className="wl-rest-list">
                {current.map((d) => (
                  <li key={d.id}>
                    <span className="material-symbols-outlined">bedtime</span>
                    <strong>{formatDayAndDate(d.rest_on)}</strong>
                    {today && relativeDayLabel(d.rest_on, today) && (
                      <small>{relativeDayLabel(d.rest_on, today)}</small>
                    )}
                    <button
                      type="button"
                      disabled={state === "saving"}
                      onClick={() => unmark(d.rest_on)}
                      aria-label={`إلغاء يوم الراحة ${formatDayAndDate(d.rest_on)}`}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {earlier > 0 && (
              <p className="wl-record-state">
                {/* Phrased without an adjective so it agrees whether it is one day or many. */}
                ولديك {arabicCount(earlier, DAY)} راحة من اشتراكات سابقة، تجدها في سجلك عند
                الكابتن.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
