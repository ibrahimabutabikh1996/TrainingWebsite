"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";

/**
 * Renders its children at the end of `<body>` instead of where they are written.
 *
 * Every full-screen surface in the panel is written inside the screen that owns
 * it, which puts it inside `main.admin-main-content` — and that element carries
 * `position: relative; z-index: 2`, which makes it a **stacking context**. A
 * `z-index` inside a stacking context is only compared against its siblings, so
 * the crop window's `z-index: 10000` was being weighed against nothing at all
 * and the whole overlay was stacked as if it were the `2` of its ancestor.
 * `.admin-bottom-nav` sits outside that ancestor at `z-index: 100` and therefore
 * painted straight over the top of it.
 *
 * It was not a cosmetic overlap. Measured on the content screen at 1280x800:
 * the bar holding "إلغاء" and "تأكيد وقص الصورة" runs from 713px to the bottom
 * of an 800px viewport, the nav covers 728px down, and
 * `document.elementFromPoint` over the middle of the confirm button returned
 * `nav.admin-bottom-nav`. The two buttons were not merely hard to see, they were
 * not clickable — a crop could be neither confirmed nor cancelled.
 *
 * Moving the node to `document.body` puts it back in the root stacking context,
 * where its `z-index` means what it says. Nothing about the markup or the styles
 * changes; only where in the tree it is drawn.
 *
 * The `useIsClient` gate is what keeps this safe inside a component that also
 * renders on the server: `document` does not exist there, and portalling on the
 * first client render before hydration has finished would not match the
 * server's HTML. That hook is the project's existing answer to this — the same
 * one `WorkoutCompletionModal` and `UploadProgressWindow` use.
 */
export function Overlay({ children }: { children: ReactNode }) {
  const isClient = useIsClient();

  if (!isClient || typeof document === "undefined") return null;

  return createPortal(children, document.body);
}
