"use client";

import { useEffect } from "react";

/* The light behind the glass, the cursor's light on it, and the ripple a
 * button sends out when pressed.
 *
 * Mounted once in the root layout. It renders the ambient pools of colour the
 * glass panes frost over, and listens to the pointer so the surface beneath it
 * can answer:
 *
 *   --mx, --my     the cursor inside a card or a primary button, in px — the
 *                  spotlight's centre
 *   data-glow      present while the cursor is over that card
 *   --bx, --by     where a button was pressed, in px — the ripple's origin
 *   is-rippling    on the pressed button for the length of the ripple
 *
 * Nothing here styles anything; `globals.css` (the "Glass & interaction
 * layer" block) reads these. A custom property is not a transform, so writing
 * one never gives an element a containing block or fights its stylesheet —
 * the same reason `useParallax` writes `--py` rather than positioning anything.
 *
 * Cards never move. The spotlight is mouse only, since a finger has no hover;
 * the ripple answers a finger too. Both stay off when the reader has asked for
 * reduced motion.
 */

/** Cards that carry the spotlight — kept in step with the list in globals.css. */
const GLOW =
  ".dashboard-card, .home-stat-card, .processing-card, .admin-card, " +
  ".membership-card, .testimonial-card, .form-card, .pw-card, " +
  ".co-card, .ex-card, .crm-list-card, .cms-pricing-card";

/** Primary buttons whose light follows the cursor — kept in step with the
 *  lit-edge button list in globals.css. They read the same --mx/--my. */
const LIT =
  ".btn-primary, .btn-card, .btn-submit, .pw-submit, .processing-btn, " +
  ".dash-primary-btn, .hero-btn.primary-btn, .crm-btn-primary, .cms-btn-primary, " +
  ".co-add-btn, .ex-add-btn, .staff-add-btn, .diet-add-btn, .promo-popup-cta, " +
  ".upw-close, .form-btn--primary, .boundary-btn:not(.boundary-btn--ghost)";

/** Buttons that ripple — kept in step with the button list in globals.css. */
const RIPPLE =
  ".btn-primary, .btn-secondary, .btn-card, .nav-cta, .btn-submit, .btn-social, " +
  ".btn-nav-register, .btn-register-card, .pw-submit, .processing-btn, " +
  ".dash-primary-btn, .hero-btn, .crm-btn-primary, .crm-btn-secondary, " +
  ".cms-btn-primary, .cms-btn-secondary, .co-add-btn, .ex-add-btn, " +
  ".staff-add-btn, .diet-add-btn, .diet-btn-secondary, .promo-popup-cta, " +
  ".upw-close, .form-btn, .boundary-btn";

export default function GlassPointer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let current: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;

    const paint = () => {
      frame = 0;
      if (!last) return;
      const target = last.target instanceof Element ? last.target : null;

      const button = target?.closest<HTMLElement>(LIT);
      if (button) {
        const b = button.getBoundingClientRect();
        button.style.setProperty("--mx", `${last.clientX - b.left}px`);
        button.style.setProperty("--my", `${last.clientY - b.top}px`);
      }

      const card = target?.closest<HTMLElement>(GLOW) ?? null;

      if (card !== current) {
        current?.removeAttribute("data-glow");
        current = card;
        card?.setAttribute("data-glow", "");
      }
      if (!card) return;

      const box = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${last.clientX - box.left}px`);
      card.style.setProperty("--my", `${last.clientY - box.top}px`);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onLeave = () => {
      current?.removeAttribute("data-glow");
      current = null;
    };

    /* Restarting the ripple on a second quick press needs the class off for
       one style pass, which reading `offsetWidth` forces. */
    const onDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const button = target?.closest<HTMLElement>(RIPPLE);
      if (!button || button.matches(":disabled")) return;
      const box = button.getBoundingClientRect();
      button.style.setProperty("--bx", `${e.clientX - box.left}px`);
      button.style.setProperty("--by", `${e.clientY - box.top}px`);
      button.classList.remove("is-rippling");
      void button.offsetWidth;
      button.classList.add("is-rippling");
    };

    const onRippleEnd = (e: AnimationEvent) => {
      if (e.animationName !== "btn-ripple") return;
      (e.target as HTMLElement).classList.remove("is-rippling");
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("animationend", onRippleEnd);
    if (fine) {
      document.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("animationend", onRippleEnd);
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      onLeave();
    };
  }, []);

  return (
    <div className="ambient" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
