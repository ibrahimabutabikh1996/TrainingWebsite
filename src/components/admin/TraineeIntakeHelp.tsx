"use client";

/* What the trainee said, while the coach builds what they asked for.
 *
 * A floating question mark on the two builder pages. Pressed, it reads back the
 * answers from that trainee's intake form that bear on the thing being built —
 * the body and the goal for a training programme, the same plus everything that
 * decides what may go on the plate for a diet.
 *
 * Deliberately reusable rather than written twice: the only difference between
 * the two pages is the word passed as `view`, and the field list that word
 * selects lives on the server. Adding this to a third page is one more entry in
 * `VIEWS` and one more `<TraineeIntakeHelp />`.
 *
 * Nothing is fetched until the button is pressed, and nothing about the trainee
 * rides along with the page. See the note at the top of `intakeActions.ts` for
 * why that matters here specifically.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AdminModal from "@/app/admin/components/AdminModal";
import { Icon } from "@/components/Icon";
import { getTraineeIntakeAction } from "@/app/admin/intakeActions";
import { attachmentSrc } from "@/lib/attachments";
import type { IntakeSummary, IntakeView } from "@/types/admin";
import "./trainee-intake-help.css";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; summary: IntakeSummary };

export default function TraineeIntakeHelp({
  view,
  traineeId,
  title = "بيانات المشترك من الاستمارة",
}: {
  view: IntakeView;
  /** Empty when the coach has not picked one — a general course has no trainee. */
  traineeId: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  /* Which trainee the state in hand describes. Without it, switching the
     dropdown and reopening would show the previous trainee's answers under the
     new one's name until the fetch returned — the worst possible failure for a
     panel whose entire job is to say what THIS person answered. */
  const loadedFor = useRef<string | null>(null);

  /* Answers are read once per trainee and kept, so reopening is instant. They
     cannot go stale underneath the coach: the intake form is filled in before
     any of this exists, and the panel is read-only. */
  useEffect(() => {
    if (loadedFor.current !== null && loadedFor.current !== traineeId) {
      loadedFor.current = null;
      setState({ status: "idle" });
    }
  }, [traineeId]);

  const load = useCallback(async () => {
    if (!traineeId) return;
    if (loadedFor.current === traineeId) return;
    setState({ status: "loading" });
    const summary = await getTraineeIntakeAction(traineeId, view);
    loadedFor.current = traineeId;
    setState({ status: "ready", summary });
  }, [traineeId, view]);

  const openPanel = () => {
    setOpen(true);
    void load();
  };

  return (
    <>
      {/* Present whether or not a trainee is chosen. A control that comes and
          goes as a dropdown changes is a control the coach has to look for; the
          panel says what is missing instead. */}
      <button
        type="button"
        className="tih-fab"
        onClick={openPanel}
        title="بيانات المشترك من الاستمارة"
        aria-label="بيانات المشترك من الاستمارة"
      >
        <Icon name="contact_support" />
      </button>

      <AdminModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={
          state.status === "ready" && state.summary.success
            ? `${title} — ${state.summary.name}`
            : title
        }
        icon="contact_support"
        maxWidth={720}
      >
        <div className="tih-body">
          {!traineeId ? (
            <p className="tih-note">
              اختر مشتركاً أولاً لعرض إجاباته في الاستمارة.
            </p>
          ) : state.status === "loading" || state.status === "idle" ? (
            <p className="tih-note">جاري جلب البيانات...</p>
          ) : !state.summary.success ? (
            <p className="tih-note tih-note--error">{state.summary.error}</p>
          ) : (
            <dl className="tih-list">
              {state.summary.rows.map((row) =>
                row.kind === "text" ? (
                  <div key={row.label} className="tih-row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ) : (
                  <div key={row.label} className="tih-row tih-row--photos">
                    <dt>{row.label}</dt>
                    <dd>
                      {row.paths.length === 0 ? (
                        <span className="tih-empty">--</span>
                      ) : (
                        <div className="tih-thumbs">
                          {row.paths.map((path, i) => {
                            /* Drawn only once the stored value resolves to an
                               address this project recognises. A path becomes a
                               request to the authorising reader; anything else
                               becomes null and is not drawn at all, rather than
                               a broken image pointing wherever the string
                               happened to say. */
                            const src = attachmentSrc(path);
                            if (!src) return null;
                            return (
                              <a
                                key={path}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="tih-thumb"
                                title="فتح الصورة بالحجم الكامل"
                              >
                                <img src={src} alt={`صورة ${i + 1}`} loading="lazy" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </dd>
                  </div>
                )
              )}
            </dl>
          )}
        </div>
      </AdminModal>
    </>
  );
}
