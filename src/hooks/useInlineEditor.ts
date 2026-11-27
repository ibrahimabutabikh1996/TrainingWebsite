"use client";

import { useEffect } from "react";
import { RICH_TEXT_KEYS } from "@/lib/richText";

/**
 * Writing on the home page itself, inside the content manager.
 *
 * The manager frames `/cms-preview?edit=1` and this runs in that frame. Every
 * piece of copy on the page already names its field — `data-i18n="hero_title"`
 * is on the heading itself — so a click on one is enough to know what is being
 * edited: the element becomes editable in place, and each keystroke goes up to
 * the manager as `{ key, value }`, which writes it into the same draft the form
 * fields edit. Nothing here saves anything; the manager owns the draft.
 *
 * A click anywhere else on the page — a photo, a plan card, the background —
 * tells the manager which section it landed in and which image field it hit,
 * if any, so the panel beside the frame can open on that field.
 *
 * Messages go to this origin only, and are read only from the parent window
 * on this origin, for the same reason the existing preview channel checks it.
 */

export type InlineEditorMessage =
  | { type: "CMS_FRAME_READY" }
  | { type: "CMS_INLINE_EDIT"; key: string; value: string }
  | { type: "CMS_INLINE_SELECT"; key: string | null; section: string | null };

const IMAGE_SUFFIX = "-img-el";

/** `coach-img-el` → `coach_img_url`, `card2-img-el` → `card2_img_url`. */
function imageKeyOf(target: Element): string | null {
  const img = target.closest(`img[id$="${IMAGE_SUFFIX}"]`);
  if (!img) return null;
  return `${img.id.slice(0, -IMAGE_SUFFIX.length).replace(/-/g, "_")}_img_url`;
}

/** The copy element under the pointer, if it is one the coach can write on. */
function copyOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>("[data-i18n]");
  if (!el || el.hidden) return null;
  return el;
}

function valueOf(el: HTMLElement): string {
  const key = el.dataset.i18n ?? "";
  return RICH_TEXT_KEYS.has(key) ? el.innerHTML : el.textContent ?? "";
}

/** The element being written in right now, if any. */
function editingElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active.isContentEditable && active.dataset.i18n
    ? active
    : null;
}

export function useInlineEditor(enabled: boolean) {
  useEffect(() => {
    if (!enabled || window.parent === window) return;

    const origin = window.location.origin;
    const send = (message: InlineEditorMessage) => window.parent.postMessage(message, origin);
    const root = document.documentElement;
    root.classList.add("cms-inline-editing");

    /* Made editable on the way down rather than on click, so the browser's own
       handling of the press puts the caret exactly where the coach pointed. */
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = copyOf(e.target);
      if (!el || el.isContentEditable) return;
      const rich = RICH_TEXT_KEYS.has(el.dataset.i18n ?? "");
      /* Plain-text editing keeps pasted formatting and stray markup out of every
         field but the one that is allowed it. Older engines refuse the value
         outright, and those fall back to ordinary editing with paste handled
         below. */
      try {
        el.contentEditable = rich ? "true" : "plaintext-only";
      } catch {
        el.contentEditable = "true";
      }
      el.spellcheck = false;
    };

    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const el = copyOf(e.target);
      send({
        type: "CMS_INLINE_SELECT",
        key: el?.dataset.i18n ?? imageKeyOf(e.target),
        section: e.target.closest("section[id]")?.id ?? null,
      });
    };

    const onInput = (e: Event) => {
      const el = copyOf(e.target);
      if (!el || !el.isContentEditable) return;
      send({ type: "CMS_INLINE_EDIT", key: el.dataset.i18n ?? "", value: valueOf(el) });
    };

    /* Enter finishes the edit — every field is a line or a sentence. The one
       field allowed markup takes Shift+Enter as its line break, which is the
       `<br />` its headline is written with. */
    const onKeyDown = (e: KeyboardEvent) => {
      const el = editingElement();
      if (!el) return;
      if (e.key === "Escape") {
        el.blur();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey && RICH_TEXT_KEYS.has(el.dataset.i18n ?? "")) {
          document.execCommand("insertLineBreak");
        } else {
          el.blur();
        }
      }
    };

    /* Text only, whatever was copied — a paste from a web page or a document
       would otherwise bring its styling into the headline. */
    const onPaste = (e: ClipboardEvent) => {
      if (!editingElement()) return;
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " ");
      document.execCommand("insertText", false, text);
    };

    const onFocusOut = (e: FocusEvent) => {
      const el = copyOf(e.target);
      if (el?.isContentEditable) el.removeAttribute("contenteditable");
    };

    /* The manager asks for a section when the coach picks its tab. */
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== window.parent) return;
      if (e.data?.type !== "CMS_SCROLL_TO" || typeof e.data.id !== "string") return;
      const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";
      if (e.data.id === "home") window.scrollTo({ top: 0, behavior });
      else document.getElementById(e.data.id)?.scrollIntoView({ behavior, block: "start" });
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("message", onMessage);

    send({ type: "CMS_FRAME_READY" });

    return () => {
      root.classList.remove("cms-inline-editing");
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("message", onMessage);
    };
  }, [enabled]);
}
