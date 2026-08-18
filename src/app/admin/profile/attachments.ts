/* What counts as an attachment, kept apart from the actions that delete them.
   A `"use server"` module may only export async functions, so the constant and
   the types that both sides need live here instead. */

/** What the registration form can attach. */
export const ATTACHMENT_FIELDS = [
  "payment_receipt",
  "analysis_file",
  "supplements_photo",
  "diet_history_file",
  "body_photos",
] as const;

export type AttachmentField = (typeof ATTACHMENT_FIELDS)[number];

export interface DeleteAttachmentInput {
  profileId: string;
  field: AttachmentField;
  /** Which file. Required — it is also what proves the coach is deleting what they saw. */
  url: string;
  /** Null for the current month, otherwise the index of the entry in `history`. */
  monthIndex: number | null;
}

export type DeleteResult = { success: true } | { success: false; error: string };
