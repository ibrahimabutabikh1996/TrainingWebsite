"use client";

/* Where the app asks "are you sure?".
 *
 * Every one of these used to be `window.confirm`, which the browser draws
 * itself — titled "localhost:3000 says", untouchable by any stylesheet, and
 * blocking the whole thread until it is answered. Ten of them, all on panel
 * screens, and none of them looked like the product they interrupt.
 *
 * Deliberately a module-level store read through `useSyncExternalStore` rather
 * than a React context, for the reason `uploadProgress` gives: the callers are
 * a hook, a handful of click handlers and a couple of plain functions, and none
 * of them are components. A context would have to wrap every tree that can ask
 * a question and be threaded through code that is not React at all. This way
 * the asker can be any code, and the reader is one dialog mounted once.
 *
 * Nothing here is a boundary. A confirmation is an affordance — it saves a
 * coach from a click they did not mean, and that is all it has ever done. Every
 * action behind these questions is guarded on the server by `requireAdminAction`
 * and stays guarded whether this file exists or not.
 */

export interface ConfirmOptions {
  /** Heading of the dialog. Defaults to a neutral "تأكيد". */
  title?: string;
  /** Wording of the button that goes ahead. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button as destructive. Deletes should pass this. */
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  readonly id: number;
  readonly message: string;
}

let pending: ConfirmRequest | null = null;
let answer: ((value: boolean) => void) | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function publish(next: ConfirmRequest | null): void {
  pending = next;
  for (const listener of listeners) listener();
}

export function subscribeToConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConfirmRequest(): ConfirmRequest | null {
  return pending;
}

/** Server render has nothing to ask about. */
export function getServerConfirmRequest(): ConfirmRequest | null {
  return null;
}

/**
 * Ask the question and wait for the answer.
 *
 * ```ts
 * if (!(await confirmDialog("هل أنت متأكد من حذف هذه الوجبة؟", { danger: true }))) return;
 * ```
 *
 * A second question asked while one is still open answers itself `false` rather
 * than replacing the first. Two dialogs cannot both be on screen, and the
 * alternative — letting the newcomer take over — would silently abandon a
 * question the coach is in the middle of reading, on a destructive action.
 */
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (pending) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    answer = resolve;
    publish({ id: ++counter, message, ...options });
  });
}

/** Called by the dialog, and by nothing else. */
export function settleConfirm(value: boolean): void {
  const resolve = answer;
  answer = null;
  publish(null);
  /* After the store is cleared, so a caller that asks again the moment it is
     answered finds the slot free rather than being told `false`. */
  resolve?.(value);
}
