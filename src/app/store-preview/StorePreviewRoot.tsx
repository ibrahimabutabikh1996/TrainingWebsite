"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import StoreShell from "../store/StoreShell";
import { StoreEditContext } from "../store/StoreEditable";
import { usePreviewGuard } from "@/hooks/usePreviewGuard";
import { useIsClient } from "@/hooks/useIsClient";
import { applyContent, parseFieldId, readField, writeField, type StoreContent } from "@/lib/store/content";
import type { StoreProduct, StoreSettings } from "@/lib/store/types";

/**
 * The storefront as the store content screen shows it — the real components,
 * drawn from the content the screen is editing rather than from what is
 * published.
 *
 * The screen frames `/store-preview` and posts its whole content here on every
 * change (`STORE_PREVIEW`). Framed, the copy on the page is editable in place:
 * a press on an `Editable` makes it writable, each keystroke goes up to the
 * screen as `STORE_INLINE_EDIT`, and the screen's echo comes back as the next
 * `STORE_PREVIEW`. While a field is being written in, the echo is held back
 * for that one field — React redrawing the element under the caret would
 * throw the caret to the start — and applied when the edit ends, with the
 * element drawn afresh (see `tick` in StoreEditable).
 *
 * Nothing here is operable otherwise: `usePreviewGuard` stops every link, the
 * cart and the order form. Messages are exchanged with the parent window on
 * this origin only.
 */

type View = { settings: StoreSettings; products: StoreProduct[] };
const PreviewContext = createContext<View | null>(null);

export function useStorePreview(): View {
  const view = useContext(PreviewContext);
  if (!view) throw new Error("useStorePreview outside StorePreviewRoot");
  return view;
}

export default function StorePreviewRoot({
  settings,
  products,
  initialContent,
  children,
}: {
  settings: StoreSettings;
  products: StoreProduct[];
  initialContent: StoreContent;
  children: React.ReactNode;
}) {
  const [content, setContent] = useState(initialContent);
  /* Framed by the store content screen — false on the server and on the
     first client render, so both draw the same markup. */
  const isClient = useIsClient();
  const framed = isClient && window.parent !== window;
  const [tick, setTick] = useState(0);
  /* The field under the caret, and the latest content the screen sent. */
  const editingRef = useRef<string | null>(null);
  const latestRef = useRef(initialContent);

  usePreviewGuard(true);

  useEffect(() => {
    if (window.parent === window) return;
    const origin = window.location.origin;
    const send = (message: object) => window.parent.postMessage(message, origin);
    const root = document.documentElement;
    root.classList.add("store-inline-editing");

    const editableOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-store-edit]") : null;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = editableOf(e.target);
      if (!el || el.isContentEditable) return;
      try {
        el.contentEditable = "plaintext-only";
      } catch {
        el.contentEditable = "true";
      }
      el.spellcheck = false;
      editingRef.current = el.dataset.storeEdit ?? null;
    };

    /* Tells the screen what was clicked, so its panel can open on that field. */
    const onClick = (e: MouseEvent) => {
      const el = editableOf(e.target);
      if (el) send({ type: "STORE_INLINE_SELECT", field: el.dataset.storeEdit });
    };

    const onInput = (e: Event) => {
      const el = editableOf(e.target);
      if (!el?.isContentEditable || !el.dataset.storeEdit) return;
      send({ type: "STORE_INLINE_EDIT", field: el.dataset.storeEdit, value: el.textContent ?? "" });
    };

    const editing = () => {
      const active = document.activeElement;
      return active instanceof HTMLElement && active.isContentEditable && active.dataset.storeEdit ? active : null;
    };

    /* Enter or Escape finishes — every field here is a line or a paragraph. */
    const onKeyDown = (e: KeyboardEvent) => {
      const el = editing();
      if (!el) return;
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        el.blur();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (!editing()) return;
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " ");
      document.execCommand("insertText", false, text);
    };

    const onFocusOut = (e: FocusEvent) => {
      const el = editableOf(e.target);
      if (!el?.isContentEditable) return;
      el.removeAttribute("contenteditable");
      editingRef.current = null;
      setContent(latestRef.current);
      setTick((t) => t + 1);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== window.parent) return;
      const data = e.data;
      if (data?.type === "STORE_PREVIEW" && data.content && typeof data.content === "object") {
        const next = data.content as StoreContent;
        latestRef.current = next;
        const held = editingRef.current;
        setContent((shown) => {
          if (!held || !parseFieldId(held)) return next;
          const kept = readField(shown, held);
          return kept === undefined ? next : writeField(next, held, kept);
        });
      } else if (data?.type === "STORE_SCROLL_TO" && typeof data.id === "string") {
        document.getElementById(data.id)?.scrollIntoView({ block: "start" });
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("message", onMessage);
    send({ type: "STORE_FRAME_READY" });

    return () => {
      root.classList.remove("store-inline-editing");
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const view = useMemo(() => applyContent(settings, products, content), [settings, products, content]);
  const edit = useMemo(() => ({ editing: framed, tick }), [framed, tick]);

  return (
    <StoreEditContext.Provider value={edit}>
      <PreviewContext.Provider value={view}>
        <StoreShell settings={view.settings}>{children}</StoreShell>
      </PreviewContext.Provider>
    </StoreEditContext.Provider>
  );
}
