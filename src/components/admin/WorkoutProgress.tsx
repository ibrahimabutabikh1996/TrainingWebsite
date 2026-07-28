import { Fragment } from "react";
import { prisma } from "@/lib/db";
import { arabicCount, DAY } from "@/lib/arabicCount";
import { formatDayAndDate } from "@/lib/trainingDates";

/* Coach-side view of what the trainee actually lifted.

   Columns are the days the trainee said they trained on, not the days the
   numbers were typed in — `redateSessionLogs` files each set under the date its
   workout was recorded under.

   Rendered on the server: this is a read-only report, so there is no reason to
   ship the whole log history to the browser. */

interface Row {
  exercise_id: string;
  exercise_name: string;
  set_index: number;
  reps: string | null;
  weight: number | null;
  session_date: string;
}

export default async function WorkoutProgress({ profileId }: { profileId: string }) {
  let rows: Row[] = [];
  try {
    const logs = await prisma.workout_logs.findMany({
      where: { profile_id: profileId },
      orderBy: [{ session_date: "asc" }, { exercise_name: "asc" }, { set_index: "asc" }],
      select: {
        exercise_id: true,
        exercise_name: true,
        set_index: true,
        reps: true,
        weight: true,
        session_date: true,
      },
    });
    rows = logs.map((l) => ({
      ...l,
      weight: l.weight === null ? null : Number(l.weight),
      session_date: l.session_date.toISOString().slice(0, 10),
    }));
  } catch (error) {
    // A failed query shouldn't take the whole profile page down.
    console.error("Failed to load workout logs:", error);
  }

  if (rows.length === 0) {
    return (
      <div className="crm-modal-section">
        <h4 className="crm-modal-section-title">
          <span className="material-symbols-outlined">monitoring</span>
          سجل الأوزان ومتابعة التقدّم
        </h4>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
          لم يسجّل المشترك أي أوزان بعد. تظهر هنا الأوزان التي يدخلها أثناء التمرين.
        </p>
      </div>
    );
  }

  /* Pivot into exercise → set → date so each row reads as a progression. */
  const dates = [...new Set(rows.map((r) => r.session_date))];
  const byExercise = new Map<string, { name: string; sets: Map<number, Map<string, Row>> }>();

  for (const r of rows) {
    let ex = byExercise.get(r.exercise_id);
    if (!ex) {
      ex = { name: r.exercise_name, sets: new Map() };
      byExercise.set(r.exercise_id, ex);
    }
    /* The stored name is a snapshot per entry; keep the latest wording. */
    ex.name = r.exercise_name;
    let set = ex.sets.get(r.set_index);
    if (!set) {
      set = new Map();
      ex.sets.set(r.set_index, set);
    }
    set.set(r.session_date, r);
  }

  const totalSessions = dates.length;
  const totalEntries = rows.filter((r) => r.weight !== null).length;
  const heaviest = rows.reduce<Row | null>(
    (best, r) => (r.weight !== null && (!best || r.weight > (best.weight ?? 0)) ? r : best),
    null
  );

  return (
    <div className="crm-modal-section">
      <h4 className="crm-modal-section-title">
        <span className="material-symbols-outlined">monitoring</span>
        سجل الأوزان ومتابعة التقدّم
      </h4>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <span className="crm-tag primary-tag">{arabicCount(totalSessions, DAY)} تمرين مُسجَّل</span>
        <span className="crm-tag">{totalEntries} وزن مُدخل</span>
        {heaviest?.weight != null && (
          <span className="crm-tag">أثقل وزن: {heaviest.weight} كغم — {heaviest.exercise_name}</span>
        )}
      </div>

      {/* Wide histories scroll inside their own box rather than stretching the page. */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 420,
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: "0.86rem",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "start",
                  padding: "10px 12px",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  borderBottom: "1px solid var(--border)",
                  position: "sticky",
                  insetInlineStart: 0,
                  background: "var(--bg2)",
                }}
              >
                التمرين / الجولة
              </th>
              {dates.map((d) => (
                <th
                  key={d}
                  style={{
                    padding: "10px 12px",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {formatDayAndDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...byExercise.entries()].map(([exId, ex]) => (
              /* Fragment carries the key: a keyed child inside an unkeyed
                 fragment does not satisfy React's list reconciliation. */
              <Fragment key={exId}>
                <tr>
                  <td
                    colSpan={dates.length + 1}
                    style={{
                      padding: "12px 12px 6px",
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {ex.name}
                  </td>
                </tr>
                {[...ex.sets.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([setIndex, byDate]) => {
                    const values = dates
                      .map((d) => byDate.get(d)?.weight ?? null)
                      .filter((v): v is number => v !== null);
                    const first = values[0];
                    const last = values[values.length - 1];
                    const improved = values.length > 1 && last > first;

                    return (
                      <tr key={`${exId}-${setIndex}`}>
                        <td
                          style={{
                            padding: "8px 12px",
                            color: "var(--text-secondary)",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            insetInlineStart: 0,
                            background: "var(--bg2)",
                          }}
                        >
                          الجولة {setIndex + 1}
                          {improved && (
                            <span
                              title={`تقدّم من ${first} إلى ${last} كغم`}
                              style={{ color: "var(--success)", marginInlineStart: 6 }}
                            >
                              ▲
                            </span>
                          )}
                        </td>
                        {dates.map((d) => {
                          const cell = byDate.get(d);
                          return (
                            <td
                              key={d}
                              style={{
                                padding: "8px 12px",
                                textAlign: "center",
                                color: cell?.weight != null ? "var(--text)" : "var(--text-muted)",
                                fontWeight: cell?.weight != null ? 600 : 400,
                                background: "var(--bg3)",
                                borderTop: "1px solid var(--border)",
                              }}
                              title={cell?.reps ? `${cell.reps} تكرار` : undefined}
                            >
                              {cell?.weight != null ? cell.weight : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: "12px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
        الأرقام بالكيلوغرام. ▲ تعني أن الوزن في هذه الجولة ارتفع عن أول يوم مُسجَّل.
      </p>
    </div>
  );
}
