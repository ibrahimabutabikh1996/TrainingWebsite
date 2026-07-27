import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/trainingCycle";
import { cycleTitle, dateRangeLabel, formatDayAndDate } from "@/lib/trainingDates";
import { workoutDaysOf } from "@/lib/workoutDays";
import { asDays } from "@/types/admin";

/* Coach-side cycle-by-cycle record.

   A cycle is a count of workouts, never a calendar week: the trainee dates each
   workout themselves, so what the coach reads here is the days they actually
   trained, in the order the cycles were lived through. How many workouts close a
   cycle comes from the trainee's own answer at registration, which is why this
   view warns when the plan holds fewer days than that answer.

   Rendered on the server: it is a read-only report, so there is no reason to
   ship the whole history to the browser. */

export default async function CycleHistory({ profileId }: { profileId: string }) {
  /** Set when the plan cannot cover the cycle the trainee committed to. */
  let shortPlan: { committed: number; planDays: number } | null = null;
  let cycles: {
    id: string;
    cycle_number: number;
    days_count: number;
    isCurrent: boolean;
    sessions: {
      day_number: number;
      performed_on: string | null;
      notes: string | null;
      logs: { exercise_name: string; set_index: number; weight: number | null; reps: string | null }[];
    }[];
  }[] = [];

  try {
    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { data: true, courses: { select: { days_data: true } } },
    });
    const committed = workoutDaysOf(profile?.data);
    const planDays = asDays(profile?.courses?.days_data).length;
    if (committed !== null && planDays > 0 && planDays < committed) {
      shortPlan = { committed, planDays };
    }

    const rows = await prisma.training_cycles.findMany({
      where: { profile_id: profileId },
      orderBy: { cycle_number: "desc" },
      select: {
        id: true,
        cycle_number: true,
        days_count: true,
        completed_at: true,
        training_sessions: {
          orderBy: { day_number: "asc" },
          select: {
            day_number: true,
            performed_on: true,
            notes: true,
            workout_logs: {
              orderBy: [{ exercise_name: "asc" }, { set_index: "asc" }],
              select: { exercise_name: true, set_index: true, weight: true, reps: true },
            },
          },
        },
      },
    });

    cycles = rows.map((c) => ({
      id: c.id,
      cycle_number: c.cycle_number,
      days_count: c.days_count,
      isCurrent: c.completed_at === null,
      sessions: c.training_sessions.map((s) => ({
        day_number: s.day_number,
        performed_on: s.performed_on ? toISODate(s.performed_on) : null,
        notes: s.notes,
        logs: s.workout_logs.map((l) => ({
          ...l,
          weight: l.weight === null ? null : Number(l.weight),
        })),
      })),
    }));
  } catch (error) {
    // A failed query shouldn't take the whole profile page down.
    console.error("Failed to load training cycles:", error);
  }

  if (cycles.length === 0) {
    return (
      <div className="crm-modal-section">
        <h4 className="crm-modal-section-title">
          <span className="material-symbols-outlined">calendar_month</span>
          الدورات التدريبية
        </h4>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
          لم تبدأ أي دورة تدريبية بعد. تُنشأ الدورة تلقائياً بعد إسناد كورس ودخول
          المشترك إلى لوحته.
        </p>
      </div>
    );
  }

  return (
    <div className="crm-modal-section">
      <h4 className="crm-modal-section-title">
        <span className="material-symbols-outlined">calendar_month</span>
        الدورات التدريبية ({cycles.length})
      </h4>

      {/* The cycle counts to the trainee's own answer, so a shorter plan leaves
          them days they must record without any exercises to do. */}
      {shortPlan && (
        <p
          style={{
            margin: "0 0 16px",
            padding: "10px 12px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--warning) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
            color: "var(--text-secondary)",
            fontSize: "0.85rem",
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: "var(--text)" }}>تنبيه: </strong>
          اختار المشترك {shortPlan.committed} أيام تمرين أسبوعياً، والكورس المُسند إليه يحتوي{" "}
          {shortPlan.planDays} أيام فقط. الدورة تكتمل عند {shortPlan.committed} تمارين، لذا
          ستظهر لديه أيام بلا تمارين — أضف الأيام الناقصة إلى الكورس.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {cycles.map((c) => {
          const totalWeights = c.sessions.reduce(
            (n, s) => n + s.logs.filter((l) => l.weight !== null).length,
            0
          );
          /* A workout counts once the trainee has dated it — that is the same
             count that closes the cycle. */
          const doneDays = c.sessions.filter((s) => s.performed_on !== null).length;
          const span = dateRangeLabel(c.sessions.map((s) => s.performed_on));

          return (
            <div
              key={c.id}
              style={{
                border: `1px solid ${c.isCurrent ? "var(--border-primary)" : "var(--border)"}`,
                background: "var(--bg3)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <strong style={{ color: "var(--text)", fontSize: "0.95rem" }}>
                  {cycleTitle(c.cycle_number)}
                </strong>
                {c.isCurrent ? (
                  <span className="crm-tag primary-tag">الدورة الحالية</span>
                ) : (
                  <span className="crm-tag">مكتملة</span>
                )}
                <span className="crm-tag">{doneDays} من {c.days_count} تمارين</span>
                {span && <span className="crm-tag">{span}</span>}
                <span className="crm-tag">{totalWeights} وزن مُسجّل</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {c.sessions.map((s) => {
                  /* Group the sets of each exercise onto one line. */
                  const byExercise = new Map<string, (number | null)[]>();
                  s.logs.forEach((l) => {
                    const arr = byExercise.get(l.exercise_name) ?? [];
                    arr[l.set_index] = l.weight;
                    byExercise.set(l.exercise_name, arr);
                  });

                  const empty = byExercise.size === 0 && !s.notes && !s.performed_on;

                  return (
                    <div
                      key={s.day_number}
                      style={{
                        background: "var(--bg2)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: empty ? 0 : 8 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--primary)" }}>
                          اليوم {s.day_number}
                        </span>
                        {/* The day the trainee says they trained — they choose it,
                            so it is the only date that means anything here. */}
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: s.performed_on ? "var(--text-secondary)" : "var(--text-muted)",
                          }}
                        >
                          {s.performed_on ? `— ${formatDayAndDate(s.performed_on)}` : "— لم يُسجَّل بعد"}
                        </span>
                      </div>

                      {byExercise.size > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {[...byExercise.entries()].map(([name, sets]) => (
                            <div
                              key={name}
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                fontSize: "0.83rem",
                                color: "var(--text-secondary)",
                              }}
                            >
                              <span style={{ color: "var(--text)", fontWeight: 600 }}>{name}:</span>
                              <span>
                                {sets
                                  .map((v, i) => `ج${i + 1} ${v != null ? `${v}كغم` : "—"}`)
                                  .join("  ·  ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {s.notes && (
                        <p
                          style={{
                            margin: "8px 0 0",
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "var(--bg3)",
                            borderInlineStart: "3px solid var(--primary)",
                            fontSize: "0.82rem",
                            lineHeight: 1.7,
                            color: "var(--text-secondary)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          <strong style={{ color: "var(--text)" }}>ملاحظة المشترك: </strong>
                          {s.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
