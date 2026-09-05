/* The form fields that carry attachments.
 *
 * Its own module because both sides need the list and they cannot share one:
 * `@/lib/uploadSessions` is `server-only`, and the browser has to know which
 * field name to ask a slot for. Naming them here keeps one definition rather
 * than two that drift.
 *
 * The server still checks every field name it is given against this list —
 * knowing the names is not permission to use them.
 */

/* The per-file ceiling for those fields, in bytes.
 *
 * Here rather than in `@/lib/uploads` beside the rule that uses it, for the
 * reason above: the browser has to know this number *before* it asks for a
 * slot, and `@/lib/uploads` carries the magic-byte tables and the `Buffer`
 * work that only the server has any use for. `INTAKE_RULE.maxBytes` reads it
 * from here, so there is still one number and not two that drift.
 *
 * Knowing it in the browser is a courtesy, not a boundary. The server measures
 * the stored object itself in `confirmUpload` and rejects and deletes anything
 * over — that check is the one that counts and it is unchanged.
 *
 * Ten, because ten is what the form has always told people. `form_dropzone_hint`
 * reads "الحد الأقصى 10 ميغابايت لكل ملف" and the rule enforced twelve, so a
 * file between the two was accepted after being told it would not be, and a
 * file over twelve was refused with a number nobody had been shown. Every
 * message that quotes a size derives it from here, so the promise and the rule
 * are now the same number in both directions. */
export const INTAKE_MAX_BYTES = 10 * 1024 * 1024;

export const INTAKE_UPLOAD_FIELDS = [
  /* The payment receipt, collected before the questions rather than after them:
     the form now opens on a gate where the trainee settles the fee over
     WhatsApp and attaches the transfer slip. */
  "payment_receipt",
  "analysis_file",
  "supplements_photo",
  "home_equipment_photo",
  "diet_history_file",
  "body_photos",
] as const;

export type IntakeUploadField = (typeof INTAKE_UPLOAD_FIELDS)[number];

export function isIntakeUploadField(value: string): value is IntakeUploadField {
  return (INTAKE_UPLOAD_FIELDS as readonly string[]).includes(value);
}
