import { prisma } from "@/lib/db";
import { subscriptionWindow } from "@/lib/subscription";
import { formatDate, formatDayAndDate, toISODate } from "@/lib/trainingDates";

/* The days the trainee took off, as they marked them themselves.

   Rest days are not scheduled by the coach and are not part of any cycle — they
   are here so the coach can read the shape of a trainee's month: which days were
   trained, which were deliberately left out.

   Rendered on the server: a read-only report has no reason to ship to the browser. */

export default async function RestDaysHistory({ profileId }: { profileId: string }) {
  let days: { id: string; rest_on: string; note: string | null }[] = [];
  let window: { start: string; end: string } | null = null;

  try {
    const [rows, profile] = await Promise.all([
      prisma.rest_days.findMany({
        where: { profile_id: profileId },
        orderBy: { rest_on: "desc" },
        select: { id: true, rest_on: true, note: true },
      }),
      prisma.profiles.findUnique({
        where: { id: profileId },
        select: { subscription_ends_at: true },
      }),
    ]);
    days = rows.map((d) => ({ id: d.id, rest_on: toISODate(d.rest_on), note: d.note }));
    window = subscriptionWindow(profile?.subscription_ends_at);
  } catch (error) {
    // A failed query shouldn't take the whole profile page down.
    console.error("Failed to load rest days:", error);
  }

  const inWindow = window
    ? days.filter((d) => d.rest_on >= window.start && d.rest_on <= window.end)
    : days;

  return (
    <div className="crm-modal-section">
      <h4 className="crm-modal-section-title">
        <span className="material-symbols-outlined">self_improvement</span>
        أيام الراحة {days.length > 0 && `(${days.length})`}
      </h4>

      {days.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
          لم يحدّد المشترك أي يوم راحة. يختارها بنفسه من أيام اشتراكه، ولا تُحتسب ضمن
          تمارين الدورة.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span className="crm-tag primary-tag">{inWindow.length} في الاشتراك الحالي</span>
            {window && (
              <span className="crm-tag">
                {formatDate(window.start)} — {formatDate(window.end)}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {days.map((d) => {
              const current = !window || (d.rest_on >= window.start && d.rest_on <= window.end);
              return (
                <span
                  key={d.id}
                  title={d.note ?? undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: "var(--bg3)",
                    border: `1px solid ${current ? "var(--border-primary)" : "var(--border)"}`,
                    color: current ? "var(--text)" : "var(--text-muted)",
                    fontSize: "0.83rem",
                    fontWeight: 600,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    bedtime
                  </span>
                  {formatDayAndDate(d.rest_on)}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
