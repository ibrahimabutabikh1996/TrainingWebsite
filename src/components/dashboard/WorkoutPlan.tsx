"use client";

import { UserProfile } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { isCustomExercise } from "@/types/admin";
import { useNow } from "@/hooks/useNow";
import { formatDayAndDate } from "@/lib/trainingDates";
import { safeVideoUrl } from "@/lib/videoEmbed";
import VideoPlayer from "@/components/VideoPlayer";
import "./workout-log.css";
import { CustomDatePicker } from "@/components/dashboard/CustomDatePicker";
import { WorkoutCompletionModal } from "@/components/dashboard/WorkoutCompletionModal";

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
  isCurrent: boolean;
  isEditable: boolean;
  /** The plan this cycle was performed against, frozen when it opened. */
  plan: PlanDay[];
  sessions: SessionRow[];
}

interface PlanExercise {
  id: string;
  name_ar: string;
  video_url?: string;
  target_muscle?: string;
  sets?: number;
  reps?: string[];
  rest_time?: string;
  rest_from?: string;
  rest_from_unit?: string;
  rest_to?: string;
  rest_to_unit?: string;
  /* A custom row: a free-text line the coach wrote, carrying a title and four
     columns instead of sets/reps/rest. See isCustomExercise in types/admin. */
  refId?: string;
  is_custom?: boolean;
  custom_col_1?: string;
  custom_col_2?: string;
  custom_col_3?: string;
  custom_col_4?: string;
}

interface PlanDay {
  id?: string;
  /* Copied verbatim into the cycle's frozen plan_data snapshot from the course's
     days_data, so a day designed with target muscles carries them to the
     trainee even after the course is later edited. */
  muscles?: string[];
  exercises?: PlanExercise[];
}

const key = (sessionId: string, exId: string, setIndex: number) =>
  `${sessionId}|${exId}|${setIndex}`;

function formatRestShorthand(ex: PlanExercise): string {
  const uMap: Record<string, string> = {
    ثانية: "sec",
    sec: "sec",
    دقيقة: "min",
    min: "min",
  };
  if (ex.rest_from && ex.rest_to) {
    const fVal = ex.rest_from.trim();
    const fU =
      uMap[(ex.rest_from_unit || "").trim()] || ex.rest_from_unit || "sec";
    const tVal = ex.rest_to.trim();
    const tU = uMap[(ex.rest_to_unit || "").trim()] || ex.rest_to_unit || "sec";
    if (fU === tU && fVal === tVal) return `${fVal} ${fU}`;
    if (fU === tU) return `${fVal}-${tVal} ${fU}`;
    return `${fVal} ${fU} - ${tVal} ${tU}`;
  } else if (ex.rest_from) {
    const fVal = ex.rest_from.trim();
    const fU =
      uMap[(ex.rest_from_unit || "").trim()] || ex.rest_from_unit || "sec";
    return `${fVal} ${fU}`;
  } else if (ex.rest_to) {
    const tVal = ex.rest_to.trim();
    const tU = uMap[(ex.rest_to_unit || "").trim()] || ex.rest_to_unit || "sec";
    return `${tVal} ${tU}`;
  }

  if (ex.rest_time) {
    const str = ex.rest_time
      .replace(/^من\s+/, "")
      .replace(/\s+إلى\s+/, " - ")
      .replace(/ثانية/g, "sec")
      .replace(/دقيقة/g, "min")
      .trim();
    const match = str.match(/^(\d+)\s+(sec|min)\s*-\s*(\d+)\s+(sec|min)$/i);
    if (match && match[2].toLowerCase() === match[4].toLowerCase()) {
      return `${match[1]}-${match[3]} ${match[2]}`;
    }
    return str;
  }
  return "60-90 sec";
}

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
    rows[last].sessions.every(
      (s) => s.performed_on === null && s.logs.length === 0,
    );
  return rows.map((w, i) => ({
    ...w,
    isEditable: w.isCurrent || i === last || (i === last - 1 && lastUntouched),
  }));
}

const DAY_ACCENT_COLORS = [
  "#E8C96A", // Day 1 - Vibrant Yellow / Gold
  "#F97316", // Day 2 - Sunset Orange (distinct from system primary colors)
  "#10B981", // Day 3 - Emerald Green
  "#A855F7", // Day 4 - Royal Purple
  "#EF4444", // Day 5 - Crimson Red
  "#EC4899", // Day 6 - Vibrant Magenta
  "#14B8A6", // Day 7 - Mint Teal
  "#8B5CF6", // Day 8 - Violet Amethyst
];

const getDayAccent = (dayNum: number) =>
  DAY_ACCENT_COLORS[(Math.max(1, dayNum) - 1) % DAY_ACCENT_COLORS.length];

export function WorkoutPlan({ profile }: { profile: UserProfile }) {
  /* The currently assigned course, used only to decide whether the trainee has a
     programme at all. The exercises themselves come from each cycle's own copy of
     the plan, so a course reassigned or edited later cannot re-label weights
     already recorded — see `plan` on each cycle below. */
  const assignedPlan: PlanDay[] = useMemo(
    () => (profile.workouts as unknown as PlanDay[]) || [],
    [profile.workouts],
  );

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
  /* `dateError` and `restCleared` were kept here and written to on every save,
     and nothing ever read either one. The message a rejected date produces
     reaches the trainee through `triggerToast`, on the same line that used to
     store it. */
  /** Number of the cycle just completed, announced once then dismissed. */
  const [showCelebration, setShowCelebration] = useState(false);
  const [toastAlert, setToastAlert] = useState<{
    title: string;
    desc?: string;
    type: "warning" | "error";
  } | null>(null);
  const [finishNote, setFinishNote] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = useCallback(
    (title: string, desc?: string, type: "warning" | "error" = "error") => {
      setToastAlert({ title, desc, type });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        setToastAlert((cur) => (cur && cur.title === title ? null : cur));
      }, 7000);
    },
    [],
  );

  /* Its counterpart, `checkSessionHasWeights` — "is there at least one weight
     in this session" — was removed with the `hasSessionWeights` value that was
     its only caller and which nothing read. This one answers "are they all
     filled in", and drives the finish button's wording. */
  const checkSessionHasAllWeights = (
    sessId: string,
    exList: PlanExercise[],
  ): boolean => {
    for (const ex of exList) {
      const setCount = ex.sets ?? ex.reps?.length ?? 3;
      for (let i = 0; i < setCount; i++) {
        const k = key(sessId, ex.id, i);
        const val = weights[k];
        const valExists =
          val !== undefined && val !== null && String(val).trim() !== "";
        const savedExists =
          saved[k] !== undefined &&
          saved[k] !== null &&
          String(saved[k]).trim() !== "";
        if (!valExists && !savedExists) {
          return false;
        }
      }
    }
    return true;
  };

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* One request returns every cycle the trainee has been through, the open one
     included — created on the fly if the previous cycle has just closed. */
  const load = useCallback(
    async (focusCurrent = false) => {
      if (!profile.id) return;
      try {
        const res = await fetch(`/api/training-cycles?profileId=${profile.id}`);
        if (!res.ok) return;
        const body = await res.json();
        if (!Array.isArray(body.cycles)) return;

        const rows: CycleRow[] = body.cycles;
        setCycles(rows);
        setActiveCycleId((prev) =>
          focusCurrent
            ? (body.currentCycleId ?? rows[rows.length - 1]?.id ?? prev)
            : (prev ??
              body.currentCycleId ??
              rows[rows.length - 1]?.id ??
              null),
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
          }),
        );
        setWeights(w);
        setSaved(s);
        setNotes(n);
      } finally {
        setLoading(false);
      }
    },
    [profile.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  /* `profile.isExpired` is the server's answer, computed when the profile was
     fetched. The second half re-checks it against the clock so a subscription
     that lapses while the tab is left open stops accepting writes without a
     reload — through the hook, so the render stays idempotent. */
  const now = useNow();
  const isSubscriptionExpired = Boolean(
    profile.isExpired ||
    (profile.subscription_ends_at &&
      new Date(profile.subscription_ends_at).getTime() <= now),
  );
  const activeCycle = cycles.find((w) => w.id === activeCycleId) ?? null;
  const editable = !isSubscriptionExpired && (activeCycle?.isEditable ?? false);

  const saveWeight = useCallback(
    async (
      sessionId: string,
      ex: PlanExercise,
      setIndex: number,
      reps: string,
      value: string,
    ) => {
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
    [profile.id],
  );

  const onWeight = (
    sessionId: string,
    ex: PlanExercise,
    setIndex: number,
    reps: string,
    value: string,
  ) => {
    const k = key(sessionId, ex.id, setIndex);
    setWeights((w) => ({ ...w, [k]: value }));
    setStates((s) => ({ ...s, [k]: "idle" }));
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(
      () => saveWeight(sessionId, ex, setIndex, reps, value),
      700,
    );
  };

  const flushWeight = (
    sessionId: string,
    ex: PlanExercise,
    setIndex: number,
    reps: string,
  ) => {
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
    timers.current[`n:${sessionId}`] = setTimeout(
      () => saveNote(sessionId, value),
      900,
    );
  };

  /**
   * Files a workout under the day the trainee says it happened — or takes that
   * date back off. Recording the last workout the plan asks for is what ends the
   * cycle, so the answer tells us whether a new one has just begun.
   */
  const saveDate = async (
    cycleId: string,
    sessionId: string,
    date: string | null,
  ) => {
    const cycle = cycles.find((c) => c.id === cycleId);
    const wasComplete = cycle ? !cycle.isCurrent : false;

    setDateStates((s) => ({ ...s, [sessionId]: "saving" }));

    try {
      const res = await fetch("/api/training-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, performedOn: date }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = body.error || "لا يمكن اختيار هذا التاريخ";
        setDateStates((s) => ({ ...s, [sessionId]: "error" }));
        triggerToast("لا يمكن اختيار هذا التاريخ", errMsg, "error");
        /* Refused because the cycle closed for good — read the list back so the
           schedule shows as the record it now is. */
        if (res.status === 409) await load();
        return;
      }

      setDateStates((s) => ({ ...s, [sessionId]: "saved" }));

      /* A cycle that just closed brings the next one with it, and re-opening one
         removes the empty cycle that had been started on top — both reshape the
         list, so read it back. */
      if (
        body.cycleCompleted ||
        (wasComplete && body.cycle && !body.cycle.completed)
      ) {
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
                  sessions: w.sessions.map((s) =>
                    s.id === sessionId
                      ? {
                          ...s,
                          performed_on: body.session?.performed_on ?? null,
                        }
                      : s,
                  ),
                },
          ),
        ),
      );
    } catch {
      setDateStates((s) => ({ ...s, [sessionId]: "error" }));
      triggerToast(
        "خطأ في الاتصال 🌐",
        "تعذّر الاتصال بالخادم في الوقت الحالي. يُرجى المحاولة مرة أخرى.",
        "error",
      );
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
            {loading
              ? "جاري تحميل برنامجك..."
              : "لم يتم تعيين برنامج تدريبي لك بعد."}
          </div>
        </div>
      </div>
    );
  }

  const session =
    activeCycle?.sessions.find((s) => s.day_number === activeDay) ?? null;
  const isSessionEditable = editable;
  /* Exercises come from the cycle being viewed, not from whatever course happens
     to be assigned now, so a finished cycle reads exactly as it was performed. */
  const planDays: PlanDay[] = activeCycle?.plan ?? [];
  /* Day N of the cycle follows day N of that plan. */
  const template = planDays[activeDay - 1];
  const recorded = session?.performed_on ?? "";

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-title" style={{ marginBottom: 16 }}>
        البرنامج التدريبي
      </div>

      <div className="wl-root">
        {loading ? (
          <div className="wl-empty">جاري تحميل جدول التمارين...</div>
        ) : !activeCycle ? (
          <div className="wl-empty">لم يبدأ أي جدول تدريبي بعد.</div>
        ) : (
          <>
            {isSubscriptionExpired ? (
              <div
                className="wl-locked"
                style={{
                  background: "color-mix(in srgb, var(--error) 14%, var(--bg2))",
                  borderColor: "color-mix(in srgb, var(--error) 45%, transparent)",
                  color: "var(--error-text)",
                  marginBottom: "16px",
                  padding: "16px 20px",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontWeight: 700,
                }}
              >
                <Icon
                  name="visibility"
                  style={{ fontSize: "24px", color: "var(--error-text)" }}
                />
                <span>
                  انتهت فترة اشتراكك الحالية (30 يوماً). البرنامج والتمارين
                  السابقة في وضع المشاهدة فقط (View Only) ولا يمكن التعديل عليها
                  أو إضافة أرقام جديدة.
                </span>
              </div>
            ) : activeCycle.isCurrent ? null : editable ? (
              /* The editing window closes once the next schedule is started, so
                 the wording promises only what it can keep. */
              <div className="wl-hint">
                <Icon name="edit_calendar" />
                <span>
                  اكتمل هذا الجدول. ما زال بإمكانك تصحيح تاريخ أي تمرين فيه ما
                  دمت لم تبدأ تسجيل الجدول التالي.
                </span>
              </div>
            ) : (
              <div className="wl-locked">
                <Icon name="lock" />
                <span>اكتمل هذا الجدول — محفوظ للمراجعة ولا يمكن تعديله.</span>
              </div>
            )}

            <div className="wl-days">
              {activeCycle.sessions.map((s) => {
                const dayColor = getDayAccent(s.day_number);
                const isSelected = activeDay === s.day_number;
                return (
                  <button
                    key={s.id}
                    className="wl-day-btn"
                    aria-pressed={isSelected}
                    data-logged={s.performed_on !== null}
                    onClick={() => setActiveDay(s.day_number)}
                    style={
                      {
                        "--day-accent": dayColor,
                        background: isSelected
                          ? dayColor
                          : `color-mix(in srgb, ${dayColor} 10%, var(--bg2))`,
                        borderColor: isSelected
                          ? dayColor
                          : `color-mix(in srgb, ${dayColor} 40%, var(--border))`,
                        color: isSelected
                          ? "var(--text-inverse)"
                          : "var(--text)",
                        boxShadow: isSelected
                          ? `0 6px 20px color-mix(in srgb, ${dayColor} 35%, transparent)`
                          : "0 2px 8px rgba(0, 0, 0, 0.1)",
                        fontWeight: isSelected ? 800 : 700,
                        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      } as React.CSSProperties
                    }
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: isSelected
                            ? "var(--text-inverse)"
                            : dayColor,
                        }}
                      />
                      <span>اليوم {s.day_number}</span>
                    </span>
                    <small
                      style={{
                        color: isSelected
                          ? "var(--text-inverse)"
                          : "var(--text-muted)",
                        opacity: isSelected ? 0.85 : 1,
                      }}
                    >
                      {s.performed_on
                        ? formatDayAndDate(s.performed_on)
                        : `${(planDays[s.day_number - 1]?.exercises || []).length} تمارين`}
                    </small>
                  </button>
                );
              })}
            </div>

            {!session ? (
              <div className="wl-empty">لم يُضف هذا اليوم إلى جدولك.</div>
            ) : (
              <div
                style={
                  {
                    "--day-accent": getDayAccent(activeDay),
                    "--primary": getDayAccent(activeDay),
                    "--border-primary": `color-mix(in srgb, ${getDayAccent(activeDay)} 45%, var(--border))`,
                    "--primary-dim": `color-mix(in srgb, ${getDayAccent(activeDay)} 15%, transparent)`,
                  } as React.CSSProperties
                }
              >
                {/* Calendar date selector placed at the top next to the active training day */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "16px",
                    background: `linear-gradient(to left, color-mix(in srgb, ${getDayAccent(activeDay)} 14%, var(--bg3)) 0%, var(--bg3) 85%)`,
                    border: `1px solid color-mix(in srgb, ${getDayAccent(activeDay)} 35%, var(--border))`,
                    borderInlineStart: `4px solid ${getDayAccent(activeDay)}`,
                    borderRadius: "var(--radius-xl)",
                    padding: "18px 22px",
                    margin: "16px 0 22px 0",
                    boxShadow: `0 8px 28px color-mix(in srgb, ${getDayAccent(activeDay)} 8%, rgba(0, 0, 0, 0.25))`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "46px",
                        height: "46px",
                        borderRadius: "var(--radius-lg)",
                        background: `color-mix(in srgb, ${getDayAccent(activeDay)} 18%, var(--bg2))`,
                        border: `1px solid color-mix(in srgb, ${getDayAccent(activeDay)} 40%, transparent)`,
                        color: getDayAccent(activeDay),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "25px",
                        boxShadow: `0 4px 14px color-mix(in srgb, ${getDayAccent(activeDay)} 18%, transparent)`,
                      }}
                    >
                      <Icon name="event_available" />
                    </div>
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "1.2rem",
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        تسجيل أداء اليوم {activeDay}
                      </h4>
                      {isSessionEditable ? null : (
                        <p
                          style={{
                            margin: "4px 0 0 0",
                            fontSize: "0.88rem",
                            color: "var(--muted)",
                          }}
                        >
                          تاريخ أداء التمرين المسجل الموثق
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <CustomDatePicker
                      value={recorded}
                      disabled={!isSessionEditable}
                      onChange={(date) =>
                        saveDate(activeCycle.id, session.id, date)
                      }
                    />

                    {dateStates[session.id] === "saving" && (
                      <span
                        className="wl-spin"
                        aria-hidden="true"
                        title="جارٍ الحفظ..."
                      />
                    )}
                  </div>
                </div>

                {/* Rest is chosen separately now, so an empty day means the plan
                    is short of what the trainee committed to — not a day off. */}
                {!template || !(template.exercises || []).length ? (
                  <div className="wl-empty" style={{ marginBottom: "15px" }}>
                    لم يضع الكابتن تمارين لهذا اليوم بعد — راجعه ليكمل جدولك.
                  </div>
                ) : (
                  <>
                    {(() => {
                      // Prefer live course muscles if available, just like the PDF export does
                      const liveTemplate = (profile.workouts || [])[
                        activeDay - 1
                      ];
                      const dayMuscles =
                        activeCycle.isCurrent && liveTemplate?.muscles
                          ? liveTemplate.muscles
                          : template.muscles || [];

                      let finalMuscles: string[] = [];

                      if (dayMuscles.length > 0) {
                        finalMuscles = dayMuscles.filter(
                          (m) =>
                            typeof m === "string" &&
                            m.trim() !== "" &&
                            m !== "الكل",
                        );
                      }

                      /* No muscles named on the day, so they are read off the
                         exercises instead.

                         This block used to appear twice, identically, one after
                         the other — the second guarded by the same
                         `finalMuscles.length === 0` the first had just tried to
                         satisfy, so it could only ever repeat a computation that
                         had already come back empty.

                         Both copies also consulted `(profile as any).muscleMap`.
                         There is no such field on the profile the dashboard
                         loads — the export page builds one, this screen does
                         not — so all three lookups were always misses and the
                         answer always came from `ex.target_muscle`. The cast is
                         what kept that quiet; reading the field directly is what
                         the code was doing anyway. */
                      if (finalMuscles.length === 0) {
                        const exMuscles = new Set<string>();
                        (template.exercises || []).forEach((ex) => {
                          const mStr = ex.target_muscle || "";
                          mStr.split(/[,،]/).forEach((m: string) => {
                            const cleaned = m.trim();
                            if (
                              cleaned &&
                              cleaned !== "عام" &&
                              cleaned !== "الكل"
                            ) {
                              exMuscles.add(cleaned);
                            }
                          });
                        });
                        finalMuscles = Array.from(exMuscles);
                      }

                      let finalArray =
                        finalMuscles.length > 0
                          ? finalMuscles
                          : ["تمارين شاملة"];

                      // Split by commas just in case multiple muscles were saved as a single string
                      const splitMuscles = new Set<string>();
                      finalArray.forEach((m) => {
                        if (typeof m === "string") {
                          m.split(/[,،]/).forEach((sub) => {
                            const cleaned = sub.trim();
                            if (cleaned) splitMuscles.add(cleaned);
                          });
                        }
                      });
                      finalArray = Array.from(splitMuscles);

                      return (
                        <div className="wl-day-muscles" style={{ marginBottom: "15px" }}>
                          <span className="wl-day-muscles-lbl">
                            العضلات المستهدفة:
                          </span>
                          {finalArray.map((m) => (
                            <span key={m} className="wl-day-muscle-chip">
                              {m}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    {(template.exercises || []).map((ex) => {
                      /* A custom row is a free-text line the coach wrote: a title
                       and four columns, with no sets, reps or rest. Sending it
                       through the logging table below gave it "0 سيت" and an
                       empty grid — or, for rows saved before the builder stopped
                       inventing them, three sets of 10 at 60–90s that nobody
                       entered. There is also nothing to log against it, so the
                       weight table is dropped entirely. */
                      if (isCustomExercise(ex)) {
                        const cols = [
                          ex.custom_col_1,
                          ex.custom_col_2,
                          ex.custom_col_3,
                          ex.custom_col_4,
                        ]
                          .map((c) => (c || "").trim())
                          .filter(Boolean);
                        return (
                          <div key={ex.id} className="wl-ex" style={{ marginBottom: "15px" }}>
                            <div className="wl-ex-head">
                              <div>
                                <h4 className="wl-ex-name">
                                  {ex.name_ar || "تمرين غير مسمى"}
                                </h4>
                              </div>
                            </div>
                            {cols.length > 0 && (
                              <div className="wl-custom-cols">
                                {cols.map((c, cIdx) => (
                                  <span key={cIdx} className="wl-custom-col">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const reps = ex.reps || [];
                      const setCount = ex.sets ?? reps.length;

                      const manualCompleteKey = key(session.id, ex.id, 999);
                      const isManuallyCompleted =
                        states[manualCompleteKey] === "saved" ||
                        states[manualCompleteKey] === "saving";

                      const isExCompleted =
                        isManuallyCompleted ||
                        Array.from({ length: setCount }).every((_, i) => {
                          const k = key(session.id, ex.id, i);
                          const w = weights[k];
                          const s = saved[k];
                          return (
                            (w !== undefined &&
                              w !== null &&
                              String(w).trim() !== "") ||
                            (s !== undefined &&
                              s !== null &&
                              String(s).trim() !== "")
                          );
                        });

                      return (
                        <div key={ex.id} className="wl-ex" style={{ marginBottom: "15px" }}>
                          <div className="wl-ex-head">
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                <h4
                                  className="wl-ex-name"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    margin: 0,
                                  }}
                                >
                                  {ex.name_ar}
                                  {isExCompleted && (
                                    <Icon
                                      name="check_circle"
                                      style={{
                                        color: "var(--success-text)",
                                        fontSize: "20px",
                                      }}
                                      title="تم إكمال التمرين"
                                    />
                                  )}
                                </h4>
                                {ex.target_muscle && (
                                  <span
                                    className="wl-ex-muscle"
                                    style={{ marginTop: "4px" }}
                                  >
                                    {ex.target_muscle}
                                  </span>
                                )}
                              </div>

                              {!isExCompleted && isSessionEditable && (
                                <button
                                  className="wl-mark-done"
                                  onClick={() =>
                                    saveWeight(session.id, ex, 999, "0", "")
                                  }
                                  disabled={
                                    states[manualCompleteKey] === "saving"
                                  }
                                  style={{
                                    cursor:
                                      states[manualCompleteKey] === "saving"
                                        ? "wait"
                                        : "pointer",
                                  }}
                                >
                                  {states[manualCompleteKey] === "saving" ? (
                                    <>
                                      <span
                                        className="wl-spin"
                                        style={{
                                          width: 12,
                                          height: 12,
                                          borderColor: "var(--primary)",
                                          borderRightColor: "transparent",
                                        }}
                                      />
                                      جارٍ الحفظ...
                                    </>
                                  ) : (
                                    <>
                                      <Icon
                                        name="check"
                                        style={{ fontSize: "16px" }}
                                      />
                                      تم الانتهاء
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            <span className="wl-ex-sets">{setCount} سيت</span>
                          </div>

                          {ex.video_url && (
                            <div
                              style={{
                                marginTop: "16px",
                                marginBottom: "16px",
                              }}
                            >
                              {/* Was an <iframe> per exercise, built here by a
                                  second copy of the address translation that
                                  lives in @/lib/videoEmbed — and mounted for
                                  every row of the day at once, whether or not
                                  the trainee had scrolled to it. Each of those
                                  frames was Drive's viewer application, on a
                                  phone, several times over.

                                  The player fetches the file itself where it
                                  can and defers the frame where it cannot, and
                                  `preload="metadata"` is the part that matters
                                  in a list: the still is what loads, not the
                                  video. Same box, same border, same 16/9 —
                                  `aspect-ratio` now rather than the padding
                                  trick, which is the same geometry. */}
                              <div
                                style={{
                                  borderRadius: "var(--radius-lg)",
                                  overflow: "hidden",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <VideoPlayer
                                  url={ex.video_url}
                                  title={ex.name_ar}
                                  preload="metadata"
                                />
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  marginTop: "8px",
                                }}
                              >
                                <a
                                  className="wl-video-link"
                                  href={safeVideoUrl(ex.video_url) ?? undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <span>فتح الفيديو في المتصفح</span>
                                  <Icon
                                    name="open_in_new"
                                    style={{ fontSize: "14px" }}
                                  />
                                </a>
                              </div>
                            </div>
                          )}

                          <div
                            className="wl-sets-list"
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              marginTop: "16px",
                            }}
                          >
                            {Array.from({ length: setCount }).map((_, i) => {
                              const k = key(session.id, ex.id, i);
                              const targetReps =
                                reps[i] ?? reps[reps.length - 1] ?? "10";
                              const state = states[k] ?? "idle";
                              const value = saved[k];

                              return (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    background: "var(--bg3)",
                                    padding: "12px 16px",
                                    borderRadius: "var(--radius-md)",
                                    border: "1px solid var(--border)",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "16px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span className="wl-set-badge">
                                      السيت {i + 1}
                                    </span>
                                    <span className="wl-reps-text">
                                      {targetReps} تكرار
                                    </span>
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        color: "var(--primary)",
                                      }}
                                    >
                                      <Icon
                                        name="schedule"
                                        style={{ fontSize: "16px" }}
                                      />
                                      <span
                                        style={{
                                          direction: "ltr",
                                          display: "inline-block",
                                          fontWeight: "700",
                                        }}
                                      >
                                        {formatRestShorthand(ex)}
                                      </span>
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "16px",
                                    }}
                                  >
                                    {isSessionEditable ? (
                                      <div className="wl-weight-input-wrap">
                                        <input
                                          type="number"
                                          inputMode="decimal"
                                          min={0}
                                          max={1000}
                                          step="0.5"
                                          placeholder="—"
                                          aria-label={`وزن السيت ${i + 1} لتمرين ${ex.name_ar}`}
                                          value={weights[k] ?? ""}
                                          onChange={(e) =>
                                            onWeight(
                                              session.id,
                                              ex,
                                              i,
                                              targetReps,
                                              e.target.value,
                                            )
                                          }
                                          onBlur={() =>
                                            flushWeight(
                                              session.id,
                                              ex,
                                              i,
                                              targetReps,
                                            )
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              flushWeight(
                                                session.id,
                                                ex,
                                                i,
                                                targetReps,
                                              );
                                              (
                                                e.target as HTMLInputElement
                                              ).blur();
                                            }
                                          }}
                                        />
                                        <span className="unit">كغم</span>
                                      </div>
                                    ) : (
                                      <span className="wl-readonly-badge">
                                        {value != null ? `${value} كغم` : "—"}
                                      </span>
                                    )}

                                    <div
                                      style={{
                                        width: "90px",
                                        textAlign: "end",
                                      }}
                                    >
                                      <span
                                        className="wl-status"
                                        data-state={
                                          state === "saved" ||
                                          (state === "idle" && value != null)
                                            ? "saved"
                                            : state
                                        }
                                      >
                                        {state === "saving" ? (
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              color: "var(--text-muted)",
                                              fontSize: "0.85rem",
                                              fontWeight: 600,
                                            }}
                                          >
                                            <span
                                              className="wl-spin"
                                              aria-hidden="true"
                                            />{" "}
                                            حفظ...
                                          </span>
                                        ) : state === "error" ? (
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              color: "var(--error-text)",
                                              fontSize: "0.85rem",
                                              fontWeight: 700,
                                            }}
                                          >
                                            <Icon name="error" /> خطأ
                                          </span>
                                        ) : state === "saved" ||
                                          (state === "idle" &&
                                            value != null) ? (
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              color: "var(--success-text)",
                                              fontSize: "0.85rem",
                                              fontWeight: 700,
                                            }}
                                          >
                                            <Icon name="check_circle" /> تم
                                          </span>
                                        ) : (
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              color: "var(--text-muted)",
                                              fontSize: "0.85rem",
                                              fontWeight: 600,
                                            }}
                                          >
                                            <Icon name="schedule" /> ينتظر
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                <div className="wl-ex" style={{ marginBottom: "15px" }}>
                  <h5 className="wl-session-title">
                    <Icon name="edit_note" />
                    ملاحظات اليوم {activeDay}
                  </h5>
                  <div className="wl-notes">
                    <textarea
                      placeholder={
                        isSessionEditable
                          ? "كيف كان أداؤك؟ أي إصابة أو ملاحظة للكابتن..."
                          : "لا توجد ملاحظات"
                      }
                      value={notes[session.id] ?? ""}
                      disabled={!isSessionEditable}
                      onChange={(e) => onNote(session.id, e.target.value)}
                      onBlur={() => {
                        clearTimeout(timers.current[`n:${session.id}`]);
                        if (isSessionEditable)
                          saveNote(session.id, notes[session.id] ?? "");
                      }}
                    />
                    {isSessionEditable &&
                      noteStates[session.id] === "saved" && (
                        <label style={{ color: "var(--success-text)" }}>
                          تم حفظ الملاحظة
                        </label>
                      )}
                    {isSessionEditable &&
                      noteStates[session.id] === "error" && (
                        <label style={{ color: "var(--error-text)" }}>
                          فشل حفظ الملاحظة
                        </label>
                      )}
                  </div>
                </div>

                {/* Celebratory Finish Button */}
                {(() => {
                  /* `hasSessionWeights` was computed here and never consulted:
                     finishing is gated on the cycle still being editable, not on
                     whether any weight was typed in. */
                  const canFinishWorkout = isSessionEditable;
                  return (
                    <div
                      style={{
                        marginTop: "36px",
                        paddingTop: "28px",
                        borderTop: "1px solid var(--border)",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "14px",
                        paddingBottom: "16px",
                      }}
                    >
                      <button
                        type="button"
                        disabled={!canFinishWorkout}
                        onClick={() => {
                          if (!canFinishWorkout) return;

                          const hasAllWeights =
                            session && template?.exercises
                              ? checkSessionHasAllWeights(
                                  session.id,
                                  template.exercises,
                                )
                              : false;
                          setFinishNote(
                            hasAllWeights
                              ? "تم تسجيل الاوزان"
                              : "لم يتم تسجيل الاوزان",
                          );

                          triggerToast(
                            "تم إتمام وتوثيق اليوم التدريبي! 🏆",
                            "يمكنك مراجعة وتعديل الأوزان أو الملاحظات في أي وقت.",
                            "warning",
                          );
                          setShowCelebration(true);
                        }}
                        className={
                          canFinishWorkout ? "dash-primary-btn" : undefined
                        }
                        style={{
                          background: canFinishWorkout
                            ? getDayAccent(activeDay)
                            : "var(--bg3)",
                          color: canFinishWorkout
                            ? "var(--text-inverse)"
                            : "var(--text-muted)",
                          border: canFinishWorkout
                            ? "none"
                            : "1.5px dashed var(--border)",
                          padding: "16px 36px",
                          fontSize: "1.15rem",
                          fontWeight: 800,
                          borderRadius: "var(--radius-xl)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "14px",
                          minWidth: "280px",
                          cursor: !canFinishWorkout ? "not-allowed" : "pointer",
                          opacity: !canFinishWorkout ? 0.7 : 1,
                          boxShadow: !canFinishWorkout
                            ? "none"
                            : `0 8px 32px color-mix(in srgb, ${getDayAccent(activeDay)} 42%, transparent)`,
                          transition: "all 0.25s ease",
                        }}
                      >
                        <Icon
                          name="emoji_events"
                          style={{ fontSize: "26px" }}
                        />
                        <span>إنهاء اليوم التدريبي</span>
                        <Icon name="verified" style={{ fontSize: "24px" }} />
                      </button>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.88rem",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          اضغط هنا عند الانتهاء من أداء جميع التمارين
                        </p>

                        {finishNote && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.95rem",
                              color:
                                finishNote === "تم تسجيل الاوزان"
                                  ? "var(--success-text)"
                                  : "var(--warning-text)",
                              fontWeight: 700,
                            }}
                          >
                            {finishNote}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Celebratory Modal */}
      <WorkoutCompletionModal
        isOpen={showCelebration}
        dayNumber={activeDay}
        onClose={() => setShowCelebration(false)}
      />

      {/* Luxury Transient Toast Notification Popup */}
      {toastAlert &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              bottom: "38px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 999999,
              display: "flex",
              alignItems: "flex-start",
              gap: "18px",
              background:
                "linear-gradient(145deg, rgba(26, 26, 26, 0.98) 0%, rgba(15, 15, 15, 0.98) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: `1px solid ${toastAlert.type === "warning" ? "rgba(245, 158, 11, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
              borderInlineStart: `5px solid ${toastAlert.type === "warning" ? "var(--warning)" : "var(--error)"}`,
              padding: "18px 22px",
              borderRadius: "var(--radius-xl)",
              boxShadow: `0 20px 50px rgba(0, 0, 0, 0.85), 0 0 35px ${toastAlert.type === "warning" ? "rgba(245, 158, 11, 0.16)" : "rgba(239, 68, 68, 0.16)"}`,
              color: "var(--text)",
              animation:
                "toastSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              maxWidth: "92vw",
              width: "560px",
            }}
            role="alert"
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-lg)",
                background:
                  toastAlert.type === "warning"
                    ? "radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0.08) 100%)"
                    : "radial-gradient(circle, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0.08) 100%)",
                border: `1px solid ${toastAlert.type === "warning" ? "rgba(245, 158, 11, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: toastAlert.type === "warning" ? "var(--warning-text)" : "var(--error-text)",
                boxShadow: `0 0 16px ${toastAlert.type === "warning" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              <Icon
                name={
                  toastAlert.type === "warning"
                    ? "error_outline"
                    : "report_problem"
                }
                style={{ fontSize: "26px" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                flex: 1,
                paddingTop: "2px",
              }}
            >
              <h5
                style={{
                  margin: 0,
                  fontSize: "1.02rem",
                  fontWeight: 800,
                  color: toastAlert.type === "warning" ? "#FDBA74" : "#FCA5A5",
                  letterSpacing: "0.1px",
                }}
              >
                {toastAlert.title}
              </h5>
              {toastAlert.desc && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    color: "#C4BFBA",
                    lineHeight: "1.65",
                    fontWeight: 500,
                  }}
                >
                  {toastAlert.desc}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setToastAlert(null)}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "var(--radius-lg)",
                color: "var(--text-muted)",
                cursor: "pointer",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s ease",
              }}
              title="إغلاق التنبيه"
            >
              <Icon name="close" style={{ fontSize: "19px" }} />
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
