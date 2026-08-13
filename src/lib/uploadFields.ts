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

export const INTAKE_UPLOAD_FIELDS = [
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
