"use client";

import { UserProfile } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arabicCount, EXERCISE } from "@/lib/arabicCount";
import {
  formatDayAndDate,
  relativeDayLabel,
  selectableDates,
  todayISODate,
  weekdayOf,
  cycleTitle,
  WEEKDAYS_AR,
  WEEKDAY_PICKER_ORDER,
} from "@/lib/trainingDates";
import "./workout-log.css";

type SaveState = "idle" | "saving" | "saved" | "error";

interface LogRow {
  exercise_id: string;
  exercise_name: string;
  set_index: number;
  reps: string | null;
  weight: number | null;
}

interface SessionRow {
  id: string;
  day_number: number;
  performed_on: string | null;
  notes: string | null;
  logs: LogRow[];
}

interface CycleRow {
  id: string;
  cycle_number: number;
  days_count: number;
  /** Workouts recorded so far — this count, and nothing else, ends the cycle. */
  done: number;
  isCurrent: boolean;
  isEditable: boolean;
  /** The plan this cycle was performed against, frozen when it opened. */
  plan: PlanDay[];
  sessions: SessionRow[];
}

interface PlanExercise {
  id: string;
  name_ar: string;
  target_muscle?: string;
  sets?: number;
  reps?: string[];
}

interface PlanDay {
  id?: string;
  exercises?: PlanExercise[];
}

const key = (sessionId: string, exId: string, setIndex: number) =>
  `${sessionId}|${exId}|${setIndex}`;

/**
 * Which cycles may still be written to, by the same rule the server applies: the
 * open one, and the one just closed for as long as the cycle after it is
 * untouched. Recomputed locally so that recording the first workout of a new
 * cycle visibly closes the door on the previous one.
 */
function withEditability(rows: CycleRow[]): CycleRow[] {
  const last = rows.length - 1;
  const lastUntouched =
    last >= 0 &&
    rows[last].sessions.every((s) => s.performed_on === null && s.logs.length === 0);
  return rows.map((w, i) => ({
    ...w,
    isEditable: w.isCurrent || i === last || (i === last - 1 && lastUntouched),
  }));
}

export function WorkoutPlan({ profile }: { profile: UserProfile }) {
  /* The currently assigned course, used only to decide whether the trainee has a
     programme at all. The exercises themselves come from each cycle's own copy of
     the plan, so a course reassigned or edited later cannot re-label weights
     already recorded — see `plan` on each cycle below. */
  const assignedPlan: PlanDay[] = useMemo(() => profile.workouts || [], [profile.workouts]);

  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [loading, setLoading] = useState(true);

  const [weights, setWeights] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number | null>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteStates, setNoteStates] = useState<Record<string, SaveState>>({});
  const [dateStates, setDateStates] = useState<Record<string, SaveState>>({});
  const [dateError, setDateError] = useState<Record<string, string>>({});
  /** Sessions whose date landed on a day the trainee had marked as rest. */
  const [restCleared, setRestCleared] = useState<Record<string, boolean>>({});
  /** Number of the cycle just completed, announced once then dismissed. */
  const [finished, setFinished] = useState<number | null>(null);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* The trainee's own calendar day. Read in the browser rather than taken from
     the server: this component is rendered on both, and their clocks can sit on
     different dates — the trainee's is the one that means anything. */
  const [today, setToday] = useState<string | null>(null);

  const dateOptions = useMemo(() => (today ? selectableDates(today) : []), [today]);

  /* One request returns every cycle the trainee has been through, the open one
     included — created on the fly if the previous cycle has just closed. */
  const load = useCallback(
    async (focusCurrent = false) => {
      if (!profile.id) return;
      try {
        const res = await fetch(`/api/training-cycles?profileId=${profile.id}`);
        setToday(todayISODate());
        if (!res.ok) return;
        const body = await res.json();
        if (!Array.isArray(body.cycles)) return;

        const rows: CycleRow[] = body.cycles;
        setCycles(rows);
        setActiveCycleId((prev) =>
          focusCurrent
            ? body.currentCycleId ?? rows[rows.length - 1]?.id ?? prev
            : prev ?? body.currentCycleId ?? rows[rows.length - 1]?.id ?? null
        );

        const w: Record<string, string> = {};
        const s: Record<string, number | null> = {};
        const n: Record<string, string> = {};
        rows.forEach((cycle) =>
          cycle.sessions.forEach((sess) => {
            n[sess.id] = sess.notes ?? "";
            sess.logs.forEach((l) => {
              const k = key(sess.id, l.exercise_id, l.set_index);
              s[k] = l.weight;
              if (l.weight !== null) w[k] = String(l.weight);
            });
          })
        );
        setWeights(w);
        setSaved(s);
        setNotes(n);
      } finally {
        setLoading(false);
      }
    },
    [profile.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const activeCycle = cycles.find((w) => w.id === activeCycleId) ?? null;
  const editable = activeCycle?.isEditable ?? false;

  const saveWeight = useCallback(
    async (sessionId: string, ex: PlanExercise, setIndex: number, reps: string, value: string) => {
      const k = key(sessionId, ex.id, setIndex);
      setStates((s) => ({ ...s, [k]: "saving" }));
      try {
        const res = await fetch("/api/workout-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: profile.id,
            sessionId,
            dayId: sessionId, // the session identifies the training instance
            exerciseId: ex.id,
            exerciseName: ex.name_ar,
            setIndex,
            reps,
            weight: value,
          }),
        });
        if (!res.ok) throw new Error("save failed");
        const body = await res.json();
        setSaved((s) => ({ ...s, [k]: body.log?.weight ?? null }));
        setStates((s) => ({ ...s, [k]: "saved" }));
      } catch {
        setStates((s) => ({ ...s, [k]: "error" }));
      }
    },
    [profile.id]
  );

  const onWeight = (sessionId: string, ex: PlanExercise, setIndex: number, reps: string, value: string) => {
    const k = key(sessionId, ex.id, setIndex);
    setWeights((w) => ({ ...w, [k]: value }));
    setStates((s) => ({ ...s, [k]: "idle" }));
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => saveWeight(sessionId, ex, setIndex, reps, value), 700);
  };

  const flushWeight = (sessionId: string, ex: PlanExercise, setIndex: number, reps: string) => {
    const k = key(sessionId, ex.id, setIndex);
    const value = weights[k] ?? "";
    if (String(saved[k] ?? "") === String(value)) return;
    clearTimeout(timers.current[k]);
    saveWeight(sessionId, ex, setIndex, reps, value);
  };

  const saveNote = async (sessionId: string, value: string) => {
    setNoteStates((s) => ({ ...s, [sessionId]: "saving" }));
    try {
      const res = await fetch("/api/training-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, notes: value }),
      });
      if (!res.ok) throw new Error("note failed");
      setNoteStates((s) => ({ ...s, [sessionId]: "saved" }));
    } catch {
      setNoteStates((s) => ({ ...s, [sessionId]: "error" }));
    }
  };

  const onNote = (sessionId: string, value: string) => {
    setNotes((n) => ({ ...n, [sessionId]: value }));
    setNoteStates((s) => ({ ...s, [sessionId]: "idle" }));
    clearTimeout(timers.current[`n:${sessionId}`]);
    timers.current[`n:${sessionId}`] = setTimeout(() => saveNote(sessionId, value), 900);
  };

  /**
   * Files a workout under the day the trainee says it happened — or takes that
   * date back off. Recording the last workout the plan asks for is what ends the
   * cycle, so the answer tells us whether a new one has just begun.
   */
  const saveDate = async (cycleId: string, sessionId: string, date: string | null) => {
    const cycle = cycles.find((c) => c.id === cycleId);
    const wasComplete = cycle ? !cycle.isCurrent : false;

    setDateStates((s) => ({ ...s, [sessionId]: "saving" }));
    setDateError((e) => ({ ...e, [sessionId]: "" }));

    try {
      const res = await fetch("/api/training-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, performedOn: date }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDateError((e) => ({ ...e, [sessionId]: body.error || "تعذّر حفظ التاريخ" }));
        setDateStates((s) => ({ ...s, [sessionId]: "error" }));
        /* Refused because the cycle closed for good — read the list back so the
           schedule shows as the record it now is. */
        if (res.status === 409) await load();
        return;
      }

      setDateStates((s) => ({ ...s, [sessionId]: "saved" }));
      setRestCleared((r) => ({ ...r, [sessionId]: Boolean(body.clearedRestDay) }));
      /* The rest-days card holds its own copy of the list; tell it to re-read
         when training on a day cost that day its rest marking. */
      if (body.clearedRestDay) {
        globalThis.dispatchEvent(new CustomEvent("gym:rest-days-changed"));
      }

      /* A cycle that just closed brings the next one with it, and re-opening one
         removes the empty cycle that had been started on top — both reshape the
         list, so read it back. Otherwise the counters move on their own. */
      if (body.cycleCompleted || (wasComplete && body.cycle && !body.cycle.completed)) {
        if (body.cycleCompleted) setFinished(body.cycle?.cycle_number ?? null);
        setActiveDay(1);
        await load(true);
        return;
      }

      setCycles((rows) =>
        withEditability(
          rows.map((w) =>
            w.id !== cycleId
              ? w
              : {
                  ...w,
                  done: body.cycle?.done ?? w.done,
                  sessions: w.sessions.map((s) =>
                    s.id === sessionId
                      ? { ...s, performed_on: body.session?.performed_on ?? null }
                      : s
                  ),
                }
          )
        )
      );
    } catch {
      setDateError((e) => ({ ...e, [sessionId]: "تعذّر الاتصال بالخادم" }));
      setDateStates((s) => ({ ...s, [sessionId]: "error" }));
    }
  };

  /* Nothing assigned and nothing ever recorded — there is no programme to show. A
     trainee who has cycles keeps seeing them even after a course is unassigned,
     because the cycles hold their own copy of the plan. */
  if (!assignedPlan.length && cycles.length === 0) {
    return (
      <div className="dashboard-card">
        <div className="dashboard-card-title">البرنامج التدريبي</div>
        <div className="wl-root">
          <div className="wl-empty">
            {loading ? "جاري تحميل برنامجك..." : "لم يتم تعيين برنامج تدريبي لك بعد."}
          </div>
        </div>
      </div>
    );
  }

  const session = activeCycle?.sessions.find((s) => s.day_number === activeDay) ?? null;
  /* Exercises come from the cycle being viewed, not from whatever course happens
     to be assigned now, so a finished cycle reads exactly as it was performed. */
  const planDays: PlanDay[] = activeCycle?.plan ?? [];
  /* Day N of the cycle follows day N of that plan. */
  const template = planDays[activeDay - 1];
  const recorded = session?.performed_on ?? "";
  /* A date older than the picker's span still has to be shown once it is set. */
  const options =
    recorded && !dateOptions.includes(recorded) ? [recorded, ...dateOptions] : dateOptions;
  const progress = activeCycle
    ? Math.min(100, Math.round((activeCycle.done / Math.max(1, activeCycle.days_count)) * 100))
    : 0;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-title" style={{ marginBottom: 16 }}>
        البرنامج التدريبي
      </div>

      <div className="wl-root">
        {loading ? (
          <div className="wl-empty">جاري تحميل جدول الدورة...</div>
        ) : !activeCycle ? (
          <div className="wl-empty">لم تبدأ أي دورة تدريبية بعد.</div>
        ) : (
          <>
            {finished !== null && (
              <div className="wl-done" role="status">
                <span className="material-symbols-outlined">military_tech</span>
                <span>
                  أحسنت! أكملت تمارين {cycleTitle(finished)} — وبدأت {cycleTitle(finished + 1)} الآن.
                </span>
                <button type="button" onClick={() => setFinished(null)} aria-label="إغلاق">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            )}

            {cycles.length > 1 && (
              <div className="wl-cycles">
                <span className="wl-cycles-label">الدورة:</span>
                {cycles.map((c) => (
                  <button
                    key={c.id}
                    className="wl-cycle-btn"
                    aria-pressed={c.id === activeCycleId}
                    data-current={c.isCurrent}
                    onClick={() => {
                      setActiveCycleId(c.id);
                      setActiveDay(1);
                    }}
                  >
                    {cycleTitle(c.cycle_number)}
                    <small>
                      {c.done}/{c.days_count}
                    </small>
                  </button>
                ))}
              </div>
            )}

            <div className="wl-progress">
              <div className="wl-progress-head">
                <strong>{cycleTitle(activeCycle.cycle_number)}</strong>
                <span>
                  أنجزت {activeCycle.done} من أصل {arabicCount(activeCycle.days_count, EXERCISE)}
                </span>
              </div>
              <div className="wl-progress-bar">
                <span style={{ inlineSize: `${progress}%` }} />
              </div>
            </div>

            {activeCycle.isCurrent ? (
              <div className="wl-hint">
                <span className="material-symbols-outlined">info</span>
                <span>
                  لا تلتزم بأيام محددة ولا يلزم أن تكون متتابعة — إذا أجّلت تمريناً فلا شيء
                  يضيع. سجّل الأوزان، ثم اختر اليوم والتاريخ اللذين أدّيت فيهما التمرين فعلاً.
                  باكتمال عدد تمارين الدورة تُحفظ في سجلك وتبدأ الدورة التالية تلقائياً، وأي
                  تمرين إضافي يُحتسب لها.
                </span>
              </div>
            ) : editable ? (
              /* The cycle ended on the last date entered, so leave a window to
                 fix that date — it stays open until the next cycle is started. */
              <div className="wl-hint">
                <span className="material-symbols-outlined">edit_calendar</span>
                <span>
                  اكتملت {cycleTitle(activeCycle.cycle_number)}. ما زال بإمكانك تصحيح تاريخ أي
                  تمرين فيها ما دمت لم تبدأ تسجيل {cycleTitle(activeCycle.cycle_number + 1)}.
                </span>
              </div>
            ) : (
              <div className="wl-locked">
                <span className="material-symbols-outlined">lock</span>
                <span>
                  هذه {cycleTitle(activeCycle.cycle_number)} وقد اكتملت — محفوظة للمراجعة ولا
                  يمكن تعديلها.
                </span>
              </div>
            )}

            <div className="wl-days">
              {activeCycle.sessions.map((s) => (
                <button
                  key={s.id}
                  className="wl-day-btn"
                  aria-pressed={activeDay === s.day_number}
                  data-logged={s.performed_on !== null}
                  onClick={() => setActiveDay(s.day_number)}
                >
                  اليوم {s.day_number}
                  <small>
                    {s.performed_on
                      ? formatDayAndDate(s.performed_on)
                      : `${(planDays[s.day_number - 1]?.exercises || []).length} تمرين`}
                  </small>
                </button>
              ))}
            </div>

            {!session ? (
              <div className="wl-empty">لم يُضف هذا اليوم إلى جدولك.</div>
            ) : (
              <>
                {/* Rest is chosen separately now, so an empty day means the plan
                    is short of what the trainee committed to — not a day off. */}
                {!template || !(template.exercises || []).length ? (
                  <div className="wl-empty">
                    لم يضع الكابتن تمارين لهذا اليوم بعد — راجعه ليكمل جدولك.
                  </div>
                ) : (
                  (template.exercises || []).map((ex) => {
                    const reps = ex.reps || [];
                    const setCount = ex.sets ?? reps.length;

                    return (
                      <div key={ex.id} className="wl-ex">
                        <div className="wl-ex-head">
                          <div>
                            <h4 className="wl-ex-name">{ex.name_ar}</h4>
                            {ex.target_muscle && <span className="wl-ex-muscle">{ex.target_muscle}</span>}
                          </div>
                          <span className="wl-ex-sets">{setCount} جولات</span>
                        </div>

                        <div className="wl-sets">
                          <div className="wl-sets-head">
                            <span>الجولة</span>
                            <span>التكرار المطلوب</span>
                            <span>الوزن</span>
                            <span />
                          </div>

                          {Array.from({ length: setCount }).map((_, i) => {
                            const k = key(session.id, ex.id, i);
                            const targetReps = reps[i] ?? reps[reps.length - 1] ?? "10";
                            const state = states[k] ?? "idle";
                            const value = saved[k];

                            return (
                              <div className="wl-set" key={i}>
                                <span className="wl-set-no">{i + 1}</span>
                                <span className="wl-set-reps">{targetReps} تكرار</span>

                                {editable ? (
                                  <label className="wl-weight">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min={0}
                                      max={1000}
                                      step="0.5"
                                      placeholder="—"
                                      aria-label={`وزن الجولة ${i + 1} لتمرين ${ex.name_ar}`}
                                      value={weights[k] ?? ""}
                                      onChange={(e) => onWeight(session.id, ex, i, targetReps, e.target.value)}
                                      onBlur={() => flushWeight(session.id, ex, i, targetReps)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          flushWeight(session.id, ex, i, targetReps);
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                    />
                                    <span className="wl-weight-unit">كغم</span>
                                  </label>
                                ) : (
                                  <span className="wl-set-readonly">
                                    {value != null ? `${value} كغم` : "—"}
                                  </span>
                                )}

                                <span
                                  className="wl-status material-symbols-outlined"
                                  data-state={editable ? state : "idle"}
                                >
                                  {editable && state === "saving" ? (
                                    <span className="wl-spin" aria-hidden="true" />
                                  ) : editable && state === "saved" ? (
                                    "check_circle"
                                  ) : editable && state === "error" ? (
                                    "error"
                                  ) : (
                                    ""
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Recording the day and date is what marks the workout done and
                    moves the cycle's counter — so it sits with the workout, not
                    on a calendar somewhere. */}
                <div className="wl-ex wl-record" data-done={recorded !== ""}>
                  <h5 className="wl-session-title">
                    <span className="material-symbols-outlined">event_available</span>
                    تسجيل أداء اليوم {activeDay}
                  </h5>
                  <p className="wl-record-note">
                    {editable
                      ? "اختر اليوم والتاريخ اللذين أدّيت فيهما هذا التمرين فعلاً — يُحتسب ضمن تمارين الدورة فور اختياره."
                      : "اليوم والتاريخ اللذان سجّلهما المشترك لهذا التمرين."}
                  </p>

                  <div className="wl-record-fields">
                    <label className="wl-field">
                      <span>اليوم</span>
                      <select
                        disabled={!editable || !today}
                        value={recorded ? String(weekdayOf(recorded)) : ""}
                        onChange={(e) => {
                          const picked = e.target.value;
                          if (!picked) return saveDate(activeCycle.id, session.id, null);
                          /* The nearest past day with that name — the trainee is
                             recording something they have already done. */
                          const match = options.find((d) => weekdayOf(d) === Number(picked));
                          if (match) saveDate(activeCycle.id, session.id, match);
                        }}
                      >
                        <option value="">— لم يُسجَّل بعد —</option>
                        {WEEKDAY_PICKER_ORDER.map((d) => (
                          <option key={d} value={d}>
                            {WEEKDAYS_AR[d]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="wl-field">
                      <span>التاريخ</span>
                      <select
                        disabled={!editable || !today}
                        value={recorded}
                        onChange={(e) =>
                          saveDate(activeCycle.id, session.id, e.target.value || null)
                        }
                      >
                        <option value="">— لم يُسجَّل بعد —</option>
                        {options.map((d) => {
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
                  </div>

                  <p
                    className="wl-record-state"
                    data-state={dateStates[session.id] ?? (recorded ? "saved" : "idle")}
                  >
                    {dateStates[session.id] === "saving"
                      ? "جارٍ الحفظ..."
                      : dateStates[session.id] === "error"
                        ? dateError[session.id] || "تعذّر حفظ التاريخ"
                        : recorded
                          ? `مُسجَّل يوم ${formatDayAndDate(recorded)}`
                          : "لم يُسجَّل هذا التمرين بعد."}
                  </p>

                  {restCleared[session.id] && recorded && (
                    <p className="wl-record-state">
                      كان هذا اليوم محدَّداً كيوم راحة، وأُلغي تحديده لأنك تمرّنت فيه.
                    </p>
                  )}
                </div>

                <div className="wl-ex">
                  <h5 className="wl-session-title">
                    <span className="material-symbols-outlined">edit_note</span>
                    ملاحظات اليوم {activeDay}
                  </h5>
                  <div className="wl-notes">
                    <textarea
                      placeholder={editable ? "كيف كان أداؤك؟ أي إصابة أو ملاحظة للكابتن..." : "لا توجد ملاحظات"}
                      value={notes[session.id] ?? ""}
                      disabled={!editable}
                      onChange={(e) => onNote(session.id, e.target.value)}
                      onBlur={() => {
                        clearTimeout(timers.current[`n:${session.id}`]);
                        if (editable) saveNote(session.id, notes[session.id] ?? "");
                      }}
                    />
                    {editable && noteStates[session.id] === "saved" && (
                      <label style={{ color: "var(--success)" }}>تم حفظ الملاحظة</label>
                    )}
                    {editable && noteStates[session.id] === "error" && (
                      <label style={{ color: "var(--error)" }}>فشل حفظ الملاحظة</label>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
