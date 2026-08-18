"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { comparePassword } from "@/lib/auth";
import { requireAdminAction } from "@/lib/authGuard";
import { storagePathOf, supabaseAdmin, UPLOADS_BUCKET } from "@/lib/supabaseAdmin";
import type { JsonRecord } from "@/types";
import {
  ATTACHMENT_FIELDS,
  type DeleteAttachmentInput,
  type DeleteResult,
} from "./attachments";

/* Permanently removing an attachment a trainee sent in with their registration.
   The coach decides when; nothing expires on its own.

   "Permanently" means both halves, and in this order: the reference comes out of
   the trainee's answers first, and the file leaves storage only once no answer
   anywhere in that profile still points at it. Done the other way round, a
   failure between the two steps would leave the coach looking at a link to a file
   that no longer exists — a worse state than either end of the operation. */

const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function parseBlob(raw: unknown): JsonRecord {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as JsonRecord;
    } catch {
      return {};
    }
  }
  return (raw as JsonRecord) ?? {};
}

/**
 * The month the attachment belongs to: the current answers, or one of the
 * snapshots kept in `history` from before a renewal. Returns the record itself so
 * the caller edits it in place.
 */
function monthRecord(blob: JsonRecord, monthIndex: number | null): JsonRecord | null {
  if (monthIndex === null) return blob;
  const history = Array.isArray(blob.history) ? blob.history : [];
  const entry = history[monthIndex];
  if (!entry || typeof entry !== "object") return null;
  if (!entry.data || typeof entry.data !== "object") return null;
  return entry.data as JsonRecord;
}

/** Every attachment address held anywhere in the profile, current and past months. */
function allAttachmentUrls(blob: JsonRecord): string[] {
  const months: JsonRecord[] = [blob];
  if (Array.isArray(blob.history)) {
    for (const entry of blob.history) {
      if (entry && typeof entry === "object" && entry.data && typeof entry.data === "object") {
        months.push(entry.data as JsonRecord);
      }
    }
  }
  const urls: string[] = [];
  for (const month of months) {
    for (const field of ATTACHMENT_FIELDS) {
      const value = month[field];
      if (typeof value === "string") urls.push(value);
      else if (Array.isArray(value)) urls.push(...value.filter((v): v is string => typeof v === "string"));
    }
  }
  return urls;
}

/**
 * Drops the file from storage.
 *
 * Anything that is not an address in this project's uploads bucket is left alone:
 * a value that came from somewhere else is not ours to delete, and quietly
 * ignoring it is safer than guessing at a path.
 */
async function removeFromStorage(url: string): Promise<void> {
  const path = storagePathOf(url);
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(UPLOADS_BUCKET).remove([path]);
  if (error) {
    /* The reference is already gone, so the coach's view is correct either way.
       A file left behind in storage is worth a log line, not a failed operation
       that would tempt them to press delete again. */
    console.error("Failed to delete attachment from storage:", error);
  }
}

export async function deleteAttachmentAction(input: DeleteAttachmentInput): Promise<DeleteResult> {
  /* Permanently destroys a trainee's uploaded file. A server action is a public
     endpoint however it reads at the call site, so it asks for itself. */
  if (!(await requireAdminAction())) {
    return { success: false, error: "غير مصرح لك بهذا الإجراء" };
  }

  try {
    const { profileId, field, url, monthIndex } = input;

    if (!profileId || !isValidUUID(profileId)) {
      return { success: false, error: "معرّف المشترك غير صالح" };
    }
    if (!ATTACHMENT_FIELDS.includes(field)) {
      return { success: false, error: "نوع المرفق غير معروف" };
    }
    if (!url || typeof url !== "string") {
      return { success: false, error: "لم يُحدَّد المرفق" };
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { id: true, data: true },
    });
    if (!profile) {
      return { success: false, error: "المشترك غير موجود" };
    }

    const blob = parseBlob(profile.data);
    const month = monthRecord(blob, monthIndex);
    if (!month) {
      return { success: false, error: "لم يُعثر على بيانات هذا الشهر" };
    }

    /* Only ever delete a file this profile actually points at, and only from the
       field it was shown under. Without this the action would delete any address
       it was handed. */
    const value = month[field];
    let removed = false;

    if (Array.isArray(value)) {
      const rest = value.filter((v) => v !== url);
      if (rest.length === value.length) return { success: false, error: "المرفق غير موجود" };
      if (rest.length === 0) delete month[field];
      else month[field] = rest;
      removed = true;
    } else if (value === url) {
      delete month[field];
      removed = true;
    }

    if (!removed) {
      return { success: false, error: "المرفق غير موجود" };
    }

    await prisma.profiles.update({
      where: { id: profileId },
      data: { data: blob },
    });

    /* A month kept in history and the current month could name the same file.
       The file goes only when the last reference to it has gone. */
    if (!allAttachmentUrls(blob).includes(url)) {
      await removeFromStorage(url);
    }

    revalidatePath(`/admin/profile/${profileId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete attachment:", error);
    return { success: false, error: "حدث خطأ أثناء حذف المرفق" };
  }
}

/** Removes every attachment of one month in a single pass. */
export async function deleteAllAttachmentsAction(
  profileId: string,
  monthIndex: number | null
): Promise<DeleteResult & { deleted?: number }> {
  if (!(await requireAdminAction())) {
    return { success: false, error: "غير مصرح لك بهذا الإجراء" };
  }

  try {
    if (!profileId || !isValidUUID(profileId)) {
      return { success: false, error: "معرّف المشترك غير صالح" };
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { id: true, data: true },
    });
    if (!profile) return { success: false, error: "المشترك غير موجود" };

    const blob = parseBlob(profile.data);
    const month = monthRecord(blob, monthIndex);
    if (!month) return { success: false, error: "لم يُعثر على بيانات هذا الشهر" };

    const doomed: string[] = [];
    for (const field of ATTACHMENT_FIELDS) {
      const value = month[field];
      if (typeof value === "string") doomed.push(value);
      else if (Array.isArray(value)) doomed.push(...value.filter((v): v is string => typeof v === "string"));
      delete month[field];
    }

    if (doomed.length === 0) {
      return { success: false, error: "لا توجد مرفقات لحذفها" };
    }

    await prisma.profiles.update({
      where: { id: profileId },
      data: { data: blob },
    });

    const stillReferenced = new Set(allAttachmentUrls(blob));
    for (const url of doomed) {
      if (!stillReferenced.has(url)) await removeFromStorage(url);
    }

    revalidatePath(`/admin/profile/${profileId}`);
    return { success: true, deleted: doomed.length };
  } catch (error) {
    console.error("Failed to delete all attachments:", error);
    return { success: false, error: "حدث خطأ أثناء حذف المرفقات" };
  }
}

/* ------------------------------------------------------------------ *
 * Removing a subscriber, and hiding months from their history
 * ------------------------------------------------------------------ *
 *
 * All four of these existed as one-line stubs that took their arguments,
 * ignored them and returned `{ success: true }`. The panel believed the answer
 * and said "تم الحذف بنجاح" every time, so four buttons reported work that had
 * never happened and no error anywhere said otherwise.
 */

/**
 * Checks a password against an account, tolerating the legacy plaintext rows the
 * sign-in path still allows for. Same rule as /api/auth/login: a value that is
 * not a bcrypt hash is compared as plaintext, and a bcrypt fault is an error
 * rather than a silent "wrong password".
 */
async function passwordMatches(accountId: string, submitted: string): Promise<boolean> {
  const account = await prisma.accounts.findUnique({
    where: { id: accountId },
    select: { password: true },
  });
  if (!account) return false;

  if (account.password.startsWith("$2a$") || account.password.startsWith("$2b$")) {
    return comparePassword(submitted, account.password);
  }
  return submitted === account.password;
}

/**
 * Deletes a subscriber: their profile, everything that hangs off it, their
 * uploaded files, and the account they signed in with.
 *
 * The coach re-types their own password to get here. That is not authentication
 * — the session already settled who is asking — it is confirmation, on an
 * action with no undo, from a panel that may have been left open.
 *
 * Order matters. The attachment addresses are read before the row goes, because
 * afterwards there is nothing left to read them from; the files are removed
 * after the row, because a file deleted first would leave the coach looking at a
 * profile full of links to nothing if the delete then failed.
 */
export async function deleteSubscriberAction(
  profileId: string,
  adminPassword: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdminAction();
  if (!session) return { success: false, error: "غير مصرح لك بهذا الإجراء" };

  if (!profileId || !isValidUUID(profileId)) {
    return { success: false, error: "معرّف المشترك غير صالح" };
  }
  if (!adminPassword) {
    return { success: false, error: "كلمة المرور مطلوبة" };
  }

  try {
    if (!(await passwordMatches(session.userId, adminPassword))) {
      console.warn(`Failed subscriber-delete confirmation by account ${session.userId}`);
      return { success: false, error: "كلمة المرور غير صحيحة" };
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { id: true, data: true, user_id: true },
    });
    if (!profile) return { success: false, error: "المشترك غير موجود" };

    const files = allAttachmentUrls(parseBlob(profile.data));

    /* client_courses, diet_plans, training_cycles (and the sessions
       under them), upload_sessions and workout_logs all cascade from this row —
       see the onDelete: Cascade relations in prisma/schema.prisma. */
    await prisma.profiles.delete({ where: { id: profileId } });

    /* The sign-in account goes too, but only once it has no other profile left
       to belong to.

       This check is load-bearing, not a courtesy. `profiles.user_id` is
       ON DELETE SET NULL — verified against the database, not assumed — so
       deleting an account that still has another profile would not be refused:
       it would succeed and quietly null that profile's `user_id`, leaving a
       trainee who cannot sign in and a row nothing links to. */
    if (profile.user_id) {
      const remaining = await prisma.profiles.count({ where: { user_id: profile.user_id } });
      if (remaining === 0) {
        await prisma.accounts.delete({ where: { id: profile.user_id } });
      }
    }

    for (const url of files) await removeFromStorage(url);

    revalidatePath("/admin");
    revalidatePath(`/admin/profile/${profileId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete subscriber:", error);
    return { success: false, error: "حدث خطأ أثناء حذف المشترك" };
  }
}

/**
 * Reads the profile's blob, hands it to `edit`, and writes back whatever that
 * returns. The three history actions differ only in that one function.
 */
async function updateBlob(
  profileId: string,
  edit: (blob: JsonRecord) => void
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdminAction();
  if (!session) return { success: false, error: "غير مصرح لك بهذا الإجراء" };

  if (!profileId || !isValidUUID(profileId)) {
    return { success: false, error: "معرّف المشترك غير صالح" };
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { id: true, data: true },
  });
  if (!profile) return { success: false, error: "المشترك غير موجود" };

  const blob = parseBlob(profile.data);
  edit(blob);

  await prisma.profiles.update({ where: { id: profileId }, data: { data: blob } });

  revalidatePath("/dashboard");
  revalidatePath(`/admin/profile/${profileId}`);
  return { success: true };
}

/**
 * Hides one month from the subscription history.
 *
 * A number, not a row: the months are derived from the activation date on every
 * read — see the loop in /api/profile — so there is nothing to delete. Hiding
 * is recorded as the month's number in `deleted_months`, which every reader
 * (the API, the export page, both timelines) already skips. That is also what
 * makes `restoreHistoryAction` possible: nothing was destroyed.
 */
export async function deleteMonthHistoryAction(
  profileId: string,
  monthNumber: number
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(monthNumber) || monthNumber < 1) {
    return { success: false, error: "رقم الشهر غير صالح" };
  }

  try {
    return await updateBlob(profileId, (blob) => {
      const hidden = Array.isArray(blob.deleted_months)
        ? (blob.deleted_months as unknown[]).filter(
            (m): m is number => typeof m === "number"
          )
        : [];
      if (!hidden.includes(monthNumber)) hidden.push(monthNumber);
      hidden.sort((a, b) => a - b);
      blob.deleted_months = hidden;
    });
  } catch (error) {
    console.error("Failed to hide month from history:", error);
    return { success: false, error: "حدث خطأ أثناء حذف الشهر" };
  }
}

/** Hides the whole history at once — the flag every reader checks first. */
export async function deleteEntireHistoryAction(
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await updateBlob(profileId, (blob) => {
      blob.delete_all_history = true;
    });
  } catch (error) {
    console.error("Failed to hide the subscription history:", error);
    return { success: false, error: "حدث خطأ أثناء حذف السجل" };
  }
}

/** Brings all of it back: both the per-month list and the all-at-once flag. */
export async function restoreHistoryAction(
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await updateBlob(profileId, (blob) => {
      blob.deleted_months = [];
      blob.delete_all_history = false;
    });
  } catch (error) {
    console.error("Failed to restore the subscription history:", error);
    return { success: false, error: "حدث خطأ أثناء استرجاع السجل" };
  }
}
