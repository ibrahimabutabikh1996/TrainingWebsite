"use client";

import { useState } from "react";
import { formatDayAndDate } from "@/lib/trainingDates";
import { Icon } from "@/components/Icon";
import {
  TrainingCalendarMonth,
  type TrainedDay,
} from "@/components/dashboard/TrainingCalendarMonth";

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
 * @param trainedDays  still accepted so the callers that pass it keep
 *                     compiling, and no longer read: it fed the progression
 *                     table's columns, which was removed at the owner's
 *                     request.
 * @param calendarDays  every day the trainee ever recorded — the calendar is
 *                      theirs and navigates their whole history, so it is not
 *                      narrowed to the period.
 * @param emptyNote  what to say when there are none — a month with no sessions
 *                   is a different statement from a trainee who never logged
 */
export default function WorkoutProgress({
  rows,
  calendarDays = [],
  emptyNote = "لم يسجّل المشترك أي أوزان بعد. تظهر هنا الأوزان التي يدخلها أثناء التمرين.",
}: {
  rows: Row[];
  trainedDays?: TrainedDay[];
  calendarDays?: TrainedDay[];
  emptyNote?: string;
}) {
  /* The day the coach pressed on in the calendar, or null for none yet.
     Declared above the empty-state return because a hook cannot sit behind one. */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (rows.length === 0 && calendarDays.length === 0) {
    return (
      <div className="crm-modal-section">
        <h4 className="crm-modal-section-title">
          <Icon name="monitoring" />
          سجل الأوزان ومتابعة التقدّم
        </h4>
        <p
          style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}
        >
          {emptyNote}
        </p>
      </div>
    );
  }

  /* The one day the coach pressed on, read straight off the same rows: every
     exercise of that day with its rounds, and nothing but the weight and the
     reps. Built only while a day is selected — nothing is listed otherwise,
     and this would be an empty map every other render. */
  const dayExercises = new Map<
    string,
    { name: string; sets: Map<number, Row> }
  >();
  /* The columns of that day's table: every round number any of its exercises
     reached, not the longest exercise's count — an exercise may be missing a
     round the others have, and that is a gap in its row, not a missing column. */
  const daySetIndexes = new Set<number>();
  if (selectedDate) {
    for (const r of rows) {
      if (r.session_date !== selectedDate) continue;
      let ex = dayExercises.get(r.exercise_id);
      if (!ex) {
        ex = { name: r.exercise_name, sets: new Map() };
        dayExercises.set(r.exercise_id, ex);
      }
      ex.name = r.exercise_name;
      ex.sets.set(r.set_index, r);
      daySetIndexes.add(r.set_index);
    }
  }
  const daySets = [...daySetIndexes].sort((a, b) => a - b);

  /* Same container as the month record and the weigh-in chart beside it: one
     radius, one border, one background, so the three tabs of a month read as
     three of a kind. `--border-strong` because `--border` is within seven units
     of `--bg2` and the outline all but disappeared into it. */
  return (
    <details
      className="crm-modal-section"
      style={{
        background: "var(--bg2)",
        padding: "24px",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-strong)",
      }}
    >
      <summary
        className="crm-modal-section-title"
        style={{
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Icon
            name="monitoring"
            style={{ color: "var(--primary)", fontSize: "24px" }}
          />
          <span
            style={{
              fontSize: "1.2rem",
              color: "var(--text)",
              fontWeight: 600,
            }}
          >
            سجل الأوزان ومتابعة التقدّم
          </span>
        </div>
        <Icon
          name="expand_more"
          className="accordion-icon"
          style={{ color: "var(--text-muted)" }}
        />
      </summary>

      {/* Calendar and log side by side, each in its own outlined panel — the two
          were stacked and ran into one another with nothing to say where one
          ended. The row is RTL, so the calendar sits on the right by being first
          in the source; no `left`/`right` anywhere. It wraps on its own once the
          two bases no longer fit, which is the narrow layout. */}
      <div
        style={{
          marginTop: "24px",
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-5)",
          flexWrap: "wrap",
        }}
      >
        {/* The trainee's own calendar, exactly as their home tab draws it and just
          as inert — it marks days and takes no choice. Fixed at a width that
          holds seven columns: a seven-column grid across a desktop-wide card
          stops reading as a month. */}
        {calendarDays.length > 0 && (
          <div
            style={{
              flex: "0 0 400px",
              maxWidth: "100%",
              padding: "var(--space-4)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <TrainingCalendarMonth
              days={calendarDays}
              selectedDate={selectedDate}
              /* Pressing the open day again closes it, so the list clears from
             wherever the eye already is. */
              onSelectDay={(d) =>
                setSelectedDate((cur) => (cur === d ? null : d))
              }
            />
          </div>
        )}

        {/* `min-width: 0` or the table's own min-content width becomes the flex
          item's floor and the overflow box below never scrolls. */}
        <div
          style={{
            flex: "1 1 420px",
            minWidth: 0,
            padding: "var(--space-4)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {/* A day is pressed: this side becomes that day alone — its exercises,
          their sets, the reps and the weight, and nothing else. Until one is,
          it says so and shows nothing. */}
          {selectedDate ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  flexWrap: "wrap",
                  marginBottom: "var(--space-4)",
                }}
              >
                <span
                  style={{
                    color: "var(--text)",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                  }}
                >
                  {formatDayAndDate(selectedDate)}
                </span>
              </div>

              {dayExercises.size === 0 ? (
                /* The rows this component is handed are narrowed to the period it sits
         in, while the calendar carries the trainee's whole history — so a day
         pressed outside this month is a day with nothing here to say. */
                <p
                  style={{
                    margin: 0,
                    color: "var(--text-muted)",
                    fontSize: "0.9rem",
                  }}
                >
                  لا توجد أوزان مسجّلة في هذا اليوم ضمن هذه الفترة.
                </p>
              ) : (
                /* Two parts and no more: the exercise, then a column per round carrying
         that round's reps and weight. Scrolls inside its own box like the
         progression table, for a day that ran to many rounds. */
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                    }}
                  >
                    <thead>
                      <tr>
                        {/* The head carries no fill of its own — a label line over a rule
                  reads lighter than a banded row, and the rule is the strong
                  border so the head is told apart from the row separators. */}
                        <th
                          style={{
                            textAlign: "start",
                            padding: "0 14px 10px",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            letterSpacing: "0.04em",
                            borderBottom: "1px solid var(--border-strong)",
                            borderInlineEnd: "1px solid var(--border)",
                            position: "sticky",
                            insetInlineStart: 0,
                            background: "var(--bg2)",
                          }}
                        >
                          التمرين
                        </th>
                        {daySets.map((setIndex) => (
                          <th
                            key={setIndex}
                            style={{
                              padding: "0 14px 10px",
                              color: "var(--text-muted)",
                              fontWeight: 600,
                              fontSize: "0.72rem",
                              letterSpacing: "0.04em",
                              whiteSpace: "nowrap",
                              minWidth: 96,
                              borderBottom: "1px solid var(--border-strong)",
                            }}
                          >
                            سيت {setIndex + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...dayExercises.entries()].map(([exId, ex]) => (
                        <tr key={exId}>
                          {/* The name column is sticky, so it needs a fill to hide what
                    scrolls under it — `--bg2` is the panel's own ground, which
                    is why the column reads as no fill at all. The rule at its
                    end is what separates it from the numbers. */}
                          <td
                            style={{
                              padding: "12px 14px",
                              color: "var(--text)",
                              fontWeight: 600,
                              fontSize: "0.86rem",
                              whiteSpace: "nowrap",
                              borderBottom: "1px solid var(--border)",
                              borderInlineEnd: "1px solid var(--border)",
                              position: "sticky",
                              insetInlineStart: 0,
                              background: "var(--bg2)",
                            }}
                          >
                            {ex.name}
                          </td>
                          {daySets.map((setIndex) => {
                            const cell = ex.sets.get(setIndex);
                            return (
                              <td
                                key={setIndex}
                                style={{
                                  padding: "12px 14px",
                                  textAlign: "center",
                                  whiteSpace: "nowrap",
                                  verticalAlign: "middle",
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {cell ? (
                                  <>
                                    {/* Reps first, as they are read — small and quiet.
                              The weight is the number the eye comes for, so it
                              carries the size, with its unit kept out of the
                              way. */}
                                    <div
                                      style={{
                                        color: "var(--text-muted)",
                                        fontSize: "0.72rem",
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {cell.reps ? `${cell.reps} تكرار` : "—"}
                                    </div>
                                    <div
                                      style={{
                                        color: "var(--text)",
                                        fontWeight: 600,
                                        fontSize: "0.98rem",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {cell.weight != null ? cell.weight : "—"}
                                      {cell.weight != null && (
                                        <span
                                          style={{
                                            color: "var(--text-muted)",
                                            fontWeight: 500,
                                            fontSize: "0.68rem",
                                            marginInlineStart: 3,
                                          }}
                                        >
                                          كغم
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : rows.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: "var(--text-muted)",
                fontSize: "0.9rem",
              }}
            >
              {emptyNote}
            </p>
          ) : (
            /* No day pressed yet. The progression table that used to stand here —
         a column per date, with the ▲ mark and its footnote — was removed at
         the owner's request: the day view is what this side is for now. */
            <p
              style={{
                margin: 0,
                color: "var(--text-muted)",
                fontSize: "0.9rem",
              }}
            >
              اختر يوماً من التقويم لعرض تمارين ذلك اليوم.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
