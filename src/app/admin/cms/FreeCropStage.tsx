"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  applyDrag,
  containBox,
  HANDLES,
  toPixels,
  type Fractional,
  type Handle,
  type PixelRect,
} from "./freeCropGeometry";

/* A crop frame with no ratio: the coach drags its edges wherever they want.
 *
 * `react-easy-crop` draws every other crop on this screen and cannot draw this
 * one. Its frame is not resizable at all — `aspect` is a required number there
 * (4/3 when nothing is passed, which is why a field that appears to set no
 * ratio is really cropping 4:3), and the person moves the picture behind a
 * fixed window rather than sizing the window. So the hero gets its own frame,
 * and the other five fields keep the cropper they already had, untouched.
 *
 * Only the frame is new. The rectangle this reports is the same
 * `{x, y, width, height}` in the source image's own pixels that the cropper
 * reports, so `getCroppedImg` and the confirm button behave exactly as before —
 * this replaces the part that decides *which* rectangle, and nothing after it.
 *
 * The arithmetic lives in `./freeCropGeometry`, away from the JSX, so it can be
 * tested without a browser. What is left here is markup and pointer plumbing.
 */

export default function FreeCropStage({
  image,
  onChange,
}: {
  image: string;
  onChange: (rect: PixelRect | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [rect, setRect] = useState<Fractional>({ x: 0, y: 0, w: 1, h: 1 });

  /* The drag in progress: where it started and which edges it may move. */
  const drag = useRef<{
    handle: Handle | "move";
    px: number;
    py: number;
    start: Fractional;
  } | null>(null);

  /* The stage's size, watched rather than measured once — the dialog is
     responsive and the window can be resized in the middle of a crop. */
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const box = natural ? containBox(natural, stage) : null;

  /* Reported on every change, so the confirm button always holds the current
     rectangle without having to ask for it. */
  useEffect(() => {
    onChange(natural ? toPixels(rect, natural) : null);
  }, [rect, natural, onChange]);

  const onPointerDown = useCallback(
    (handle: Handle | "move") => (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { handle, px: event.clientX, py: event.clientY, start: rect };
    },
    [rect]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = drag.current;
      if (!state || !box) return;

      /* Screen pixels become fractions of the picture, which is the only unit
         the rectangle is ever stored in. */
      setRect(
        applyDrag(
          state.handle,
          (event.clientX - state.px) / box.w,
          (event.clientY - state.py) / box.h,
          state.start
        )
      );
    },
    [box]
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <div className="cms-freecrop" ref={stageRef}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: or blob:
          URL for a picture that has not been uploaded yet, so there is nothing
          for the image optimiser to fetch. */}
      <img
        className="cms-freecrop-img"
        src={image}
        alt=""
        draggable={false}
        onLoad={(e) =>
          setNatural({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
      />

      {box && (
        <div
          className="cms-freecrop-frame"
          style={{
            left: box.left + rect.x * box.w,
            top: box.top + rect.y * box.h,
            width: rect.w * box.w,
            height: rect.h * box.h,
          }}
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {HANDLES.map((handle) => (
            <span
              key={handle}
              className={`cms-freecrop-handle is-${handle}`}
              onPointerDown={onPointerDown(handle)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
