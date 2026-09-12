import { Fragment } from "react";
import { formatDayAndDate } from "@/lib/trainingDates";
import { Icon } from "@/components/Icon";
import { TrainingCalendarMonth, type TrainedDay } from "@/components/dashboard/TrainingCalendarMonth";

/* Coach-side view of what the trainee actually lifted.

   Columns are the days the trainee said they trained on, not the days the
   numbers were typed in — `redateSessionLogs` files each set under the date its
   workout was recorded under.

   Presentation only. It used to run its own Prisma query and render on the
   server, which was right while it stood alone at the bottom of the profile
   page. It now appears once inside each month of the subscription timeline —
   and that timeline is a client component, which cannot render an async server
   component. So the query moved up to `AdminSubscriptionTimeline`, which is a
   server component behind the same `requireAdminPage` guard, and this takes the
   rows it is given. The authorisation is unchanged: the same coach, on the same
   page, behind the same guard. */

export interface WorkoutLogRow {
  exercise_id: string;
  exercise_name: string;
  set_index: number;
  reps: string | null;
  weight: number | null;
  /** `YYYY-MM-DD`, which is what makes filtering a month a string comparison. */
  session_date: string;
}

type Row = WorkoutLogRow;

/**
 * @param rows  already narrowed to whatever period the caller is showing
 * @param trainedDays  the days that period was trained on, narrowed the same
 *                     way. They become columns too, so a day the trainee
 *                     recorded but typed no weight into is still a column of
 *                     dashes rather than a day that never happened.
 * @param calendarDays  every day the trainee ever recorded — the calendar is
 *                      theirs and navigates their whole history, so it is not
 *                      narrowed to the period.
 * @param emptyNote  what to say when there are none — a month with no sessions
 *                   is a different statement from a trainee who never logged
 */
export default function WorkoutProgress({
  rows,
  trainedDays = [],
  calendarDays = [],
  emptyNote = "لم يسجّل المشترك أي أوزان بعد. تظهر هنا الأوزان التي يدخلها أثناء التمرين.",
}: {
  rows: Row[];
  trainedDays?: TrainedDay[];
  calendarDays?: TrainedDay[];
  emptyNote?: string;
}) {
  if (rows.length === 0 && calendarDays.length === 0) {
    return (
      <div className="crm-modal-section">
        <h4 className="crm-modal-section-title">
          <Icon name="monitoring" />
          سجل الأوزان ومتابعة التقدّم
        </h4>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
          {emptyNote}
        </p>
      </div>
    );
  }

  /* Pivot into exercise → set → date so each row reads as a progression.

     The columns are every day the period holds — the days recorded as trained
     and the days weights were typed on — not the second list alone. A workout
     the trainee marked done without filling a single field is a fact about the
     month, and dropping its column made it read as a day they skipped. Sorted
     because the two lists are merged; `YYYY-MM-DD` sorts chronologically. */
  const dates = [
    ...new Set([...trainedDays.map((d) => d.date), ...rows.map((r) => r.session_date)]),
  ].sort();
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

  /* Same container as the month record and the weigh-in chart beside it: one
     radius, one border, one background, so the three tabs of a month read as
     three of a kind. `--border-strong` because `--border` is within seven units
     of `--bg2` and the outline all but disappeared into it. */
  return (
    <details className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: "var(--radius-xl)", border: '1px solid var(--border-strong)' }}>
      <summary className="crm-modal-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', listStyle: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="monitoring" style={{ color: 'var(--primary)', fontSize: '24px' }} />
          <span style={{ fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>سجل الأوزان ومتابعة التقدّم</span>
        </div>
        <Icon name="expand_more" className="accordion-icon" style={{ color: 'var(--text-muted)' }} />
      </summary>

      <div style={{ marginTop: '24px' }}>

      {/* The trainee's own calendar, exactly as their home tab draws it and just
          as inert — it marks days and takes no choice. Capped rather than left
          to fill the panel: a seven-column grid across a desktop-wide card
          stops reading as a month. */}
      {calendarDays.length > 0 && (
      <div style={{ maxWidth: 480, marginBottom: 18 }}>
        <TrainingCalendarMonth days={calendarDays} />
      </div>
      )}

      {rows.length === 0 ? (
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
        {emptyNote}
      </p>
      ) : (
      <>
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
                              style={{ color: "var(--success-text)", marginInlineStart: 6 }}
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
      </>
      )}
      </div>
    </details>
  );
}
