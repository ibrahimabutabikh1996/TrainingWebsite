"use client";

/* Where every file in the system reports how far along it is.
 *
 * Until now each screen answered "is this file there yet?" its own way: the
 * registration form knew only "uploading / done / error", the content manager
 * counted to ninety on a timer that had nothing to do with the transfer, and the
 * nutrition library said nothing at all — a spinner on the button and a photo
 * that appeared whenever it appeared. Three answers to one question, none of
 * them the real number.
 *
 * This is the one record, and it is deliberately not a React context. A context
 * would have to wrap every tree that can start an upload and be threaded through
 * every hook that performs one; the call sites here are a hook, two modals and a
 * server-action wrapper, and none of them are components. A module-level store
 * read through `useSyncExternalStore` lets the reporter be any code at all and
 * the reader be one window mounted once in the root layout.
 *
 * Nothing here is a boundary. It describes work already authorised elsewhere —
 * the server still names every path, checks every byte and decides what may be
 * stored. This only says how far the bytes have got.
 */

export type UploadPhase = "preparing" | "uploading" | "done" | "error";

export interface UploadTask {
  readonly id: string;
  /** What to call it on screen — the file's own name. */
  readonly name: string;
  /** Bytes, or 0 when the caller does not know. Weights the overall figure. */
  readonly size: number;
  /** 0–100. Never falls while the file is still on its way. */
  readonly percent: number;
  readonly phase: UploadPhase;
  readonly error?: string;
}

/**
 * The reporter's end of one file. Handed back by `beginUpload`, and the only way
 * the store is written to — there is no setter that takes an id, so a caller
 * cannot touch a file that is not its own.
 */
export interface UploadHandle {
  readonly id: string;
  /** Everything before the bytes leave: compression, cropping, asking for a slot. */
  preparing(percent: number): void;
  /** The transfer itself, as a share of the bytes acknowledged. */
  uploading(percent: number): void;
  done(): void;
  fail(message?: string): void;
}

/**
 * How much of the bar the preparation phase owns, and where the transfer stops.
 *
 * The ceiling matters: the last byte leaving the browser is not the same event
 * as the server accepting the file, and the gap between them is where a refusal
 * lands. A bar that reaches 100% and then says "فشل" was lying at 100%. It
 * reaches 100% when the server has said yes, and not before.
 */
const PREPARE_SHARE = 15;
const TRANSFER_CEILING = 97;

const NONE: readonly UploadTask[] = [];

let tasks: readonly UploadTask[] = NONE;
let counter = 0;
const listeners = new Set<() => void>();

function publish(next: readonly UploadTask[]): void {
  tasks = next;
  for (const listener of listeners) listener();
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const isSettled = (task: UploadTask) => task.phase === "done" || task.phase === "error";

function update(id: string, change: Partial<UploadTask>): void {
  publish(
    tasks.map((task) => {
      if (task.id !== id) return task;
      /* Monotonic on purpose. Two things can push the figure backwards — a
         browser reporting `loaded` against a body slightly larger than the file,
         and a phase boundary — and a bar that retreats reads as a fault.
         Rounded here rather than at the call sites: the phase mapping below
         produces fractions, and a bar labelled 24.25% is a number nobody asked
         for. */
      const percent =
        typeof change.percent === "number"
          ? Math.max(task.percent, clamp(change.percent))
          : task.percent;
      return { ...task, ...change, percent };
    })
  );
}

export function subscribeToUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUploadTasks(): readonly UploadTask[] {
  return tasks;
}

/* The server renders no window: nothing has been chosen yet on a request that
   has not reached a browser. Same empty array as the initial client snapshot, so
   hydration has nothing to disagree about. */
export function getServerUploadTasks(): readonly UploadTask[] {
  return NONE;
}

/** Forgets the finished files. The window calls this when it closes. */
export function clearSettledUploads(): void {
  const live = tasks.filter((task) => !isSettled(task));
  publish(live.length === tasks.length ? tasks : live.length === 0 ? NONE : live);
}

/**
 * Registers one file and returns the handle that reports on it.
 *
 * A batch that has entirely settled is cleared first, so choosing a second file
 * a minute later opens a window about that file rather than adding a line to the
 * last one's list.
 */
export function beginUpload(name: string, size = 0): UploadHandle {
  if (tasks.length > 0 && tasks.every(isSettled)) publish(NONE);

  const id = `upload-${++counter}`;
  publish([...tasks, { id, name: name || "ملف", size, percent: 0, phase: "preparing" }]);

  /* Whether this file had a preparation step decides where its transfer starts.
     A file that goes straight out — the registration attachments, which are sent
     as chosen — would otherwise jump to 15% before a single byte had moved. */
  let prepared = false;

  return {
    id,
    preparing(percent) {
      prepared = true;
      update(id, { phase: "preparing", percent: (clamp(percent) / 100) * PREPARE_SHARE });
    },
    uploading(percent) {
      const floor = prepared ? PREPARE_SHARE : 0;
      update(id, {
        phase: "uploading",
        percent: floor + (clamp(percent) / 100) * (TRANSFER_CEILING - floor),
      });
    },
    done() {
      update(id, { phase: "done", percent: 100 });
    },
    fail(message) {
      update(id, { phase: "error", error: message });
    },
  };
}
