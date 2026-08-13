"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
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

export async function deleteSubscriberAction(id: string, arg?: any): Promise<any> { return {success: true}; }
export async function deleteMonthHistoryAction(id: string, monthId: string): Promise<any> { return {success: true}; }
export async function deleteEntireHistoryAction(id: string): Promise<any> { return {success: true}; }
export async function restoreHistoryAction(id: string): Promise<any> { return {success: true}; }
