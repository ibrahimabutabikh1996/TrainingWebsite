"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntakeUploadField } from "@/lib/uploadFields";
import { uploadToSignedUrlWithProgress } from "@/lib/signedUpload";
import { beginUpload } from "@/lib/uploadProgress";

/* Sending the attachments to storage as they are chosen, rather than all at once
 * at the end.
 *
 * The form used to hold every file in memory and post the lot as one multipart
 * body. On Vercel that body is capped at about 4.5 MB, which a single photo from
 * a phone can exceed — the submission would have failed at the platform before
 * any of this project's code ran. Each file now goes straight to Supabase over a
 * URL the server signed for that one object, and the submission itself carries
 * only the answers and a session id.
 *
 * It also fixes what the old flow did to the person filling the form in: one
 * long wait at the end, and if it failed, everything was gone. Now each file
 * settles as it is picked, and the last step is a few kilobytes of JSON.
 *
 * Nothing here is a security boundary. The server names every path, verifies
 * every object after upload, and decides what may be attached — see
 * `@/lib/uploadSessions`. This is the part that makes it pleasant.
 */

export type UploadState = "uploading" | "done" | "error";

export interface UploadRecord {
  /** Identifies the file locally, so removals can be matched up. */
  key: string;
  /** The server's id for the slot. The only thing the submission sends back. */
  itemId: string;
  state: UploadState;
  error?: string;
}

/** Files are matched by identity across renders without holding the File itself. */
function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

interface UseUploadsOptions {
  /** Renewal binds the session to a profile; registration has none yet. */
  scope: "registration" | "renewal";
  profileId?: string;
}

export function useUploads({ scope, profileId }: UseUploadsOptions) {
  const [records, setRecords] = useState<Record<string, UploadRecord[]>>({});
  const sessionRef = useRef<string | null>(null);
  const pendingSession = useRef<Promise<string> | null>(null);
  /* Keys already handed to the server, so a re-render cannot upload twice. */
  const claimed = useRef<Set<string>>(new Set());

  /** One session per form, created on the first file and reused after. */
  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionRef.current) return sessionRef.current;
    if (pendingSession.current) return pendingSession.current;

    pendingSession.current = (async () => {
      const res = await fetch("/api/uploads/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, profileId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "تعذّر بدء الرفع");
      }
      const body = await res.json();
      sessionRef.current = body.uploadSessionId as string;
      return sessionRef.current;
    })();

    try {
      return await pendingSession.current;
    } finally {
      pendingSession.current = null;
    }
  }, [scope, profileId]);

  const uploadOne = useCallback(
    async (field: IntakeUploadField, file: File) => {
      const key = fileKey(file);
      const patch = (update: Partial<UploadRecord>) =>
        setRecords((prev) => ({
          ...prev,
          [field]: (prev[field] ?? []).map((r) => (r.key === key ? { ...r, ...update } : r)),
        }));

      /* The same window the coach's uploads report into, mounted once in the
         root layout. The person filling the form watches their photographs
         travel instead of watching a form that has stopped responding. */
      const task = beginUpload(file.name, file.size);

      try {
        const uploadSessionId = await ensureSession();

        /* The server names the path and issues a token bound to it. */
        const slotRes = await fetch("/api/uploads/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadSessionId, field }),
        });
        if (!slotRes.ok) {
          const body = await slotRes.json().catch(() => ({}));
          throw new Error(body.error || "تعذّر تجهيز الرفع");
        }
        const slot = await slotRes.json();

        /* A local size check purely so the person is told immediately instead of
           after the bytes have travelled. The server re-measures the stored
           object; this number is a courtesy, not a limit. */
        if (typeof slot.maxBytes === "number" && file.size > slot.maxBytes) {
          throw new Error(`حجم الملف يتجاوز ${Math.round(slot.maxBytes / (1024 * 1024))} ميغابايت`);
        }

        /* Straight to storage, and measured on the way — see
           `@/lib/signedUpload`. The token is bound to the path the server chose
           above; this call cannot write anywhere else. */
        await uploadToSignedUrlWithProgress({
          bucket: "uploads",
          path: slot.path,
          token: slot.token,
          file,
          onProgress: (percent) => task.uploading(percent),
        });

        const confirmRes = await fetch("/api/uploads/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadSessionId, itemId: slot.itemId }),
        });
        if (!confirmRes.ok) {
          const body = await confirmRes.json().catch(() => ({}));
          throw new Error(body.error || "الملف مرفوض");
        }

        patch({ itemId: slot.itemId, state: "done" });
        task.done();
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذّر الرفع";
        patch({ state: "error", error: message });
        task.fail(message);
      }
    },
    [ensureSession]
  );

  /**
   * Brings the upload records in line with the files currently chosen for a
   * field: anything new starts uploading, anything removed is forgotten.
   */
  const sync = useCallback(
    (field: IntakeUploadField, files: File[]) => {
      const keys = files.map(fileKey);

      setRecords((prev) => {
        const existing = prev[field] ?? [];
        const kept = existing.filter((r) => keys.includes(r.key));
        const added = keys
          .filter((k) => !existing.some((r) => r.key === k))
          .map((k) => ({ key: k, itemId: "", state: "uploading" as const }));
        return { ...prev, [field]: [...kept, ...added] };
      });

      for (const file of files) {
        const key = fileKey(file);
        if (claimed.current.has(key)) continue;
        claimed.current.add(key);
        void uploadOne(field, file);
      }
    },
    [uploadOne]
  );

  /* Keys of files that are gone from the form stop being claimed, so re-adding
     the same file later uploads it again rather than silently doing nothing. */
  useEffect(() => {
    const live = new Set(Object.values(records).flat().map((r) => r.key));
    for (const key of claimed.current) {
      if (!live.has(key)) claimed.current.delete(key);
    }
  }, [records]);

  const all = Object.values(records).flat();

  return {
    /** Call whenever a field's file list changes. */
    sync,
    records,
    /* A function, not a value: the session id lives in a ref, and reading a ref
       while rendering is both a lint error and a real hazard — the render that
       reads it would not re-run when it changes. Every caller wants it inside
       the submit handler anyway. */
    getUploadSessionId: () => sessionRef.current,
    /** The submission sends these; the server keeps only the ones it confirmed. */
    keepItemIds: all.filter((r) => r.state === "done" && r.itemId).map((r) => r.itemId),
    isUploading: all.some((r) => r.state === "uploading"),
    failed: all.filter((r) => r.state === "error"),
  };
}
