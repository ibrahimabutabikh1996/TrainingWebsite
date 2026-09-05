/* The arithmetic behind the hero's free crop frame — see FreeCropStage.tsx.
 *
 * Its own module, and deliberately free of React and of JSX, because this is
 * the part worth testing: the component around it is markup and pointer
 * plumbing, while everything here can be wrong in ways that only show up as a
 * frame that will not reach an edge, or one that escapes the picture. Driving
 * it through the real dialog needs a signed-in browser; calling it does not.
 *
 * Everything is expressed as fractions of the picture, 0 at one edge and 1 at
 * the other. That is what makes the frame survive the dialog being resized:
 * there are no screen pixels stored anywhere to go stale.
 */

/** The crop, as fractions of the picture. */
export interface Fractional {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What `getCroppedImg` wants: the source image's own pixels. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type Handle = (typeof HANDLES)[number];

/** Smallest crop, as a fraction of the picture, so the frame cannot be lost. */
export const MIN = 0.04;

export const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

/**
 * Where the frame lands after a drag of `dx`/`dy`, both already expressed as
 * fractions of the picture.
 */
export function applyDrag(
  handle: Handle | "move",
  dx: number,
  dy: number,
  s: Fractional
): Fractional {
  if (handle === "move") {
    /* The frame keeps its size and stays whole: clamping the corner against
       `1 - size` is what stops it being pushed off an edge. */
    return { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) };
  }

  let { x, y, w, h } = s;

  /* Each named edge moves on its own, so a corner is simply both of its edges.
     Dragging one edge never moves the opposite one: the far side is held by
     deriving the new width from it rather than from the delta. */
  if (handle.includes("w")) {
    const nx = clamp(s.x + dx, 0, s.x + s.w - MIN);
    x = nx;
    w = s.x + s.w - nx;
  }
  if (handle.includes("e")) {
    w = clamp(s.w + dx, MIN, 1 - s.x);
  }
  if (handle.includes("n")) {
    const ny = clamp(s.y + dy, 0, s.y + s.h - MIN);
    y = ny;
    h = s.y + s.h - ny;
  }
  if (handle.includes("s")) {
    h = clamp(s.h + dy, MIN, 1 - s.y);
  }

  return { x, y, w, h };
}

/**
 * Where the picture actually sits inside the stage.
 *
 * It is drawn `contain`, so it is centred with bars on whichever pair of sides
 * does not fit — and the frame has to follow the picture rather than the stage,
 * or dragging to "the edge" would stop in the middle of a bar.
 */
export function containBox(
  natural: { w: number; h: number },
  stage: { w: number; h: number }
): { left: number; top: number; w: number; h: number } | null {
  if (natural.w <= 0 || natural.h <= 0 || stage.w <= 0 || stage.h <= 0) return null;

  const scale = Math.min(stage.w / natural.w, stage.h / natural.h);
  const w = natural.w * scale;
  const h = natural.h * scale;
  return { left: (stage.w - w) / 2, top: (stage.h - h) / 2, w, h };
}

/** The frame in the source image's pixels, which is the only thing the rest of
 *  the crop path ever sees. */
export function toPixels(rect: Fractional, natural: { w: number; h: number }): PixelRect {
  return {
    x: Math.round(rect.x * natural.w),
    y: Math.round(rect.y * natural.h),
    width: Math.round(rect.w * natural.w),
    height: Math.round(rect.h * natural.h),
  };
}
