"use server";

/* The trainee's own answers, read while the coach builds their programme.
 *
 * Both builder pages deliberately send the browser nothing but `{id, name,
 * username}` per trainee — the note above `trainees` on each page records why:
 * an earlier version shipped every profile's whole intake blob to fill a
 * dropdown, phone numbers and health history and body-photo paths included.
 * That is not undone here. Nothing extra rides along with the page; one
 * trainee's answers are fetched when the coach asks for them, and only the
 * answers the view is allowed to show.
 *
 * The client names a VIEW, never a field. That is the whole security design of
 * this module: `VIEWS` below is not exported and cannot be reached from the
 * browser, so the worst a tampered call can do is ask for the other view's
 * list — which is the same trainee's data the same coach could already read on
 * their profile page.
 */

import { requireAdminAction } from "@/lib/authGuard";
import { prisma } from "@/lib/db";
import { answerLabel, EMPTY } from "@/lib/formLabels";
import { translations } from "@/lib/translations";
import { isStoragePath } from "@/lib/attachments";
import type { IntakeSummary, IntakeRow, IntakeView } from "@/types/admin";

const DENIED: IntakeSummary = { success: false, error: "غير مصرح لك بهذا الإجراء" };

const isValidUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

const dict = translations as Record<string, string>;

/* The label a question is asked by, not a second copy of it.
 *
 * Every one of these keys is the same string the intake form puts above the
 * field, so the coach reads back the question the trainee answered rather than
 * a paraphrase that drifts the first time the form is reworded. */
type IntakeField = { field: string; labelKey: string; kind: "text" | "photos" };

/* Not exported, and it must stay that way — this is the allow-list. A field
   absent from the view the caller named cannot be returned by any argument the
   caller can construct. */
const VIEWS: Record<IntakeView, ReadonlyArray<IntakeField>> = {
  /* Building the training programme: the body being trained, where it is going,
     and what it looks like now. */
  workout: [
    { field: "weight", labelKey: "lbl_weight", kind: "text" },
    { field: "target_weight", labelKey: "lbl_target_weight", kind: "text" },
    { field: "height", labelKey: "lbl_height", kind: "text" },
    { field: "sub_goal", labelKey: "lbl_sub_goal", kind: "text" },
    { field: "body_photos", labelKey: "lbl_photos_body", kind: "photos" },
  ],
  /* Building the diet: the same body, plus everything that decides what may go
     on the plate and what the trainee will actually eat. */
  diet: [
    { field: "weight", labelKey: "lbl_weight", kind: "text" },
    { field: "height", labelKey: "lbl_height", kind: "text" },
    { field: "sub_goal", labelKey: "lbl_sub_goal", kind: "text" },
    { field: "allergies", labelKey: "lbl_allergies", kind: "text" },
    { field: "fav_foods", labelKey: "lbl_fav_foods", kind: "text" },
    { field: "meat", labelKey: "lbl_meat", kind: "text" },
    { field: "coffee_rate", labelKey: "lbl_coffee_rate", kind: "text" },
    { field: "injuries", labelKey: "lbl_injuries", kind: "text" },
    { field: "buy_supp", labelKey: "lbl_buy_supp", kind: "text" },
  ],
};

function parseData(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return (JSON.parse(raw) as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  }
  return (raw as Record<string, unknown>) ?? {};
}

/* Only what this project would have written, and only from the trainee area.
 *
 * A legacy row holds a full public URL rather than a path, and those still
 * resolve, so both shapes pass — `attachmentSrc` on the other side is what
 * decides which is which. What does not pass is a string that is neither, so a
 * value edited into the blob by some other route cannot become an `<img src>`
 * pointing wherever it likes. */
function usablePhoto(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (isStoragePath(value)) return true;
  return value.startsWith("https://") && value.includes("/storage/v1/object/public/");
}

/**
 * One trainee's answers for one view, resolved to display text.
 *
 * Returns the same refusal for "not the coach" as the rest of the panel, and a
 * plain message for a missing or malformed id — nothing here distinguishes
 * "no such trainee" from "not allowed to ask", because the caller who reaches
 * this has already been proven to be the coach and the distinction only
 * matters to someone who has not.
 */
export async function getTraineeIntakeAction(
  traineeId: string,
  view: IntakeView
): Promise<IntakeSummary> {
  const session = await requireAdminAction();
  if (!session) return DENIED;

  /* An unknown view name is not a field list to fall back to. Reject it rather
     than defaulting, so a typo here can never widen what is returned. */
  const fields = Object.prototype.hasOwnProperty.call(VIEWS, view) ? VIEWS[view] : null;
  if (!fields) return { success: false, error: "طلب غير صالح" };

  if (!traineeId || !isValidUUID(traineeId)) {
    return { success: false, error: "لم يتم اختيار مشترك" };
  }

  try {
    const profile = await prisma.profiles.findUnique({
      where: { id: traineeId },
      /* `data` is the whole intake blob. It is narrowed to the view's fields
         below and never returned as it stands. */
      select: { username: true, data: true },
    });
    if (!profile) return { success: false, error: "المشترك غير موجود" };

    const data = parseData(profile.data);
    const fullname = typeof data.fullname === "string" ? data.fullname : "";

    const rows: IntakeRow[] = fields.map((f) => {
      const label = dict[f.labelKey] ?? f.labelKey;

      if (f.kind === "photos") {
        const raw = data[f.field];
        const paths = Array.isArray(raw) ? raw.filter(usablePhoto) : [];
        return { kind: "photos", label, paths };
      }

      /* Answers are stored as translation keys ("opt_goal_fitness"), never as
         display text — `answerLabel` resolves a known key and passes free text
         through untouched. An unanswered question becomes `--` rather than an
         empty row, so the coach can tell "no answer" from "nothing rendered". */
      return { kind: "text", label, value: answerLabel(data[f.field], EMPTY) };
    });

    return { success: true, name: fullname || profile.username, rows };
  } catch (error) {
    console.error("Failed to read trainee intake summary:", error);
    return { success: false, error: "تعذّر جلب بيانات المشترك" };
  }
}
