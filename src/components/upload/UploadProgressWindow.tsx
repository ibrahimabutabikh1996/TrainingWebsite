"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/Icon";
import { useIsClient } from "@/hooks/useIsClient";
import {
  clearSettledUploads,
  getServerUploadTasks,
  getUploadTasks,
  subscribeToUploads,
  type UploadPhase,
  type UploadTask,
} from "@/lib/uploadProgress";
import "./upload-progress.css";

/* The window every upload in the system reports into.
 *
 * Mounted once, in the root layout, and therefore covering all of it: the
 * registration and renewal form, the content manager, the media library, the
 * testimonials editor and the nutrition library. A screen that starts an upload
 * does not mount, wrap or import anything for this to appear — it calls
 * `beginUpload` and the window opens itself. That is the point of the store
 * being a module rather than a context, and it is what keeps "everywhere" from
 * meaning "everywhere someone remembered".
 *
 * It renders nothing at all while nothing is uploading, so the cost on every
 * other page is one subscription to an empty array.
 */

/** How long a finished batch stays on screen before the window closes itself. */
const LINGER_MS = 1100;

const PHASE_LABEL: Record<UploadPhase, string> = {
  preparing: "جاري التحضير…",
  uploading: "جاري الرفع…",
  done: "تم الرفع",
  error: "فشل الرفع",
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(task: UploadTask): IconName {
  if (task.phase === "done") return "check_circle";
  if (task.phase === "error") return "error";
  return /\.(png|jpe?g|webp|gif|avif|heic|heif)$/i.test(task.name) ? "image" : "description";
}

/**
 * One figure for the batch, weighted by size.
 *
 * A plain average would let a 20 KB thumbnail that finished instantly drag the
 * bar most of the way up while the 4 MB photo behind it has not started. Files
 * whose size is unknown count as one byte, so they still participate without
 * distorting anything.
 */
function overallPercent(tasks: readonly UploadTask[]): number {
  const total = tasks.reduce((sum, task) => sum + Math.max(task.size, 1), 0);
  if (total === 0) return 0;
  const done = tasks.reduce((sum, task) => sum + Math.max(task.size, 1) * task.percent, 0);
  return Math.round(done / total);
}

export function UploadProgressWindow() {
  const isClient = useIsClient();
  const tasks = useSyncExternalStore(subscribeToUploads, getUploadTasks, getServerUploadTasks);

  const active = tasks.some((task) => task.phase === "preparing" || task.phase === "uploading");
  const failed = tasks.some((task) => task.phase === "error");

  /* A batch that finished cleanly closes itself, after just long enough for the
     hundred and the tick to be read. A batch with a failure in it stays: it is
     carrying the only account of what went wrong, and something has to be done
     about the file it names. */
  useEffect(() => {
    if (tasks.length === 0 || active || failed) return;
    const timer = setTimeout(clearSettledUploads, LINGER_MS);
    return () => clearTimeout(timer);
  }, [tasks, active, failed]);

  /* Escape closes it once there is nothing left in flight. While files are still
     travelling there is nothing to close — the window is the only thing saying
     they are. */
  useEffect(() => {
    if (tasks.length === 0 || active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSettledUploads();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tasks.length, active]);

  if (!isClient || tasks.length === 0) return null;

  const state: "uploading" | "done" | "error" = active ? "uploading" : failed ? "error" : "done";
  const percent = overallPercent(tasks);
  const totalBytes = tasks.reduce((sum, task) => sum + task.size, 0);

  const heading = active
    ? tasks.length > 1
      ? "جاري رفع الملفات"
      : "جاري رفع الملف"
    : failed
      ? "تعذّر رفع بعض الملفات"
      : "اكتمل الرفع";

  const note = active
    ? "يرجى إبقاء الصفحة مفتوحة حتى يكتمل الرفع."
    : failed
      ? "أعد اختيار الملف الذي لم يُرفع ثم حاول مرة أخرى."
      : "تم حفظ الملفات بنجاح.";

  return createPortal(
    <div
      className="upw-scrim"
      data-state={state}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upw-title"
      aria-busy={active}
    >
      <div className="upw-card">
        <header className="upw-head">
          <span className="upw-head-icon">
            <Icon name={state === "done" ? "cloud_done" : state === "error" ? "error" : "cloud_upload"} />
          </span>
          <div className="upw-head-text">
            <h2 className="upw-title" id="upw-title">
              {heading}
            </h2>
            <p className="upw-subtitle">
              {tasks.length} {tasks.length === 1 ? "ملف" : "ملفات"}
              {totalBytes > 0 && (
                <>
                  {" · "}
                  <span dir="ltr">{formatSize(totalBytes)}</span>
                </>
              )}
            </p>
          </div>
          <span className="upw-overall" dir="ltr">
            {percent}%
          </span>
        </header>

        <div
          className="upw-overall-track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="نسبة اكتمال الرفع"
        >
          <div className="upw-overall-fill" style={{ width: `${percent}%` }} />
        </div>

        <ul className="upw-list">
          {tasks.map((task) => {
            /* Before the first measurable event there is no honest number to
               show, so the row shows movement instead of a figure. */
            const unmeasured = task.phase === "preparing" && task.percent === 0;
            return (
              <li className="upw-item" key={task.id} data-phase={task.phase}>
                <span className="upw-item-icon">
                  <Icon name={iconFor(task)} />
                </span>
                <div className="upw-item-body">
                  <div className="upw-item-top">
                    <span className="upw-item-name" title={task.name}>
                      {task.name}
                    </span>
                    <span className="upw-item-percent" dir="ltr">
                      {task.phase === "error" ? "—" : `${task.percent}%`}
                    </span>
                  </div>
                  <div className="upw-track">
                    <div
                      className="upw-fill"
                      data-indeterminate={unmeasured}
                      style={unmeasured ? undefined : { width: `${task.percent}%` }}
                    />
                  </div>
                  <div className="upw-item-meta">
                    <span className="upw-item-state">
                      {task.phase === "error" ? (task.error ?? PHASE_LABEL.error) : PHASE_LABEL[task.phase]}
                    </span>
                    {task.size > 0 && (
                      <span className="upw-item-size" dir="ltr">
                        {formatSize(task.size)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="upw-foot">
          <p className="upw-note">{note}</p>
          {!active && (
            <button type="button" className="upw-close" onClick={clearSettledUploads}>
              إغلاق
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
