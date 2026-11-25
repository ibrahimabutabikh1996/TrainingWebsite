"use client";
import "./christmas-effect.css";
import { useState } from "react";
import { createPortal } from "react-dom";
import SnowCanvas, { snowBurst } from "@/components/seasonal/SnowCanvas";
import ChristmasDecor, { Baubles, GiftPile, Lights } from "./ChristmasDecor";
import SantaSleigh from "./SantaSleigh";

/* The seasonal layer on the landing page, switched by `christmas_effect_active`
 * in the content manager. LandingClient loads this file through `next/dynamic`
 * only when that switch is on, so with it off none of this reaches the visitor.
 *
 * What it draws:
 *  - the falling snow — the same the rest of the site gets from SeasonalLayer
 *    (components/seasonal), drawn here instead so the content manager's
 *    preview follows its unsaved switch. (The Santa hat on the logo was taken
 *    off and deleted at the owner's request.)
 *  - the dressing below the hero: ChristmasDecor;
 *  - inside the hero (a portal into #home): a string of lights, a bank of snow
 *    along its bottom edge, Santa's sleigh and reindeer crossing the sky
 *    (SantaSleigh, drawn and animated), glass baubles swinging from the top
 *    corner and gifts hopping on the snowbank (Baubles, GiftPile — drawn).
 *
 * Nothing here takes a click except the sleigh, the balls and the gifts, so
 * the page underneath works
 * exactly as it does without the effect. (The buttons' snow listens to the
 * buttons' own presses without intercepting them.) */

/* The hanging baubles and the gifts on the snowbank are drawn, not Lottie
   files: Baubles and GiftPile in ChristmasDecor. */

export default function ChristmasEffect() {
  /* Rendered client-side only (ssr: false) and after the landing page itself,
     so the hero is already in the document on this first render. */
  const [hero] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.getElementById("home")
  );
  const [greet, setGreet] = useState<{ x: number; y: number; id: number } | null>(null);


  const onSleigh = (e: React.MouseEvent) => {
    snowBurst(e.clientX, e.clientY, "gold");
    setGreet({ x: e.clientX, y: e.clientY, id: Date.now() });
  };

  /* A tap on the hanging balls knocks snow off them and sets them swinging;
     a tap on the gifts throws gold sparks and makes the pile hop. */
  const nudge = (el: Element, frames: Keyframe[]) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(frames, { duration: 900, easing: "ease-out" });
  };
  const onBalls = (e: React.MouseEvent) => {
    snowBurst(e.clientX, e.clientY, "snow", 14);
    nudge(e.currentTarget, [
      { rotate: "0deg" }, { rotate: "-5deg" }, { rotate: "3.5deg" }, { rotate: "-1.5deg" }, { rotate: "0deg" },
    ]);
  };
  const onGifts = (e: React.MouseEvent) => {
    snowBurst(e.clientX, e.clientY, "gold");
    nudge(e.currentTarget, [
      { translate: "0 0" }, { translate: "0 -10%" }, { translate: "0 0" }, { translate: "0 -3%" }, { translate: "0 0" },
    ]);
  };

  return (
    <>
      <SnowCanvas />
      <ChristmasDecor />

      <div className="xmas-greet-layer" aria-hidden="true">
        {greet && (
          <span
            key={greet.id}
            className="xmas-greet"
            style={{ top: greet.y, left: greet.x }}
            onAnimationEnd={() => setGreet(null)}
          >
            عيد ميلاد مجيد 🎄
          </span>
        )}
      </div>

      {hero &&
        createPortal(
          <div className="xmas-scope xmas-hero" aria-hidden="true">
            <Lights className="xmas-lights" count={15} swags={4} />

            <div className="xmas-sleigh-track">
              <div className="xmas-sleigh">
                <SantaSleigh onClick={onSleigh} />
              </div>
            </div>

            <div className="xmas-snowbank">
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="xmasBank" x1="0" y1="0" x2="0" y2="1">
                    {/* `style`, not the attributes: presentation attributes do not resolve var(). */}
                    <stop offset="0" style={{ stopColor: "rgb(var(--text-rgb))" }} />
                    <stop offset="0.55" style={{ stopColor: "rgb(var(--text-rgb))", stopOpacity: 0.92 }} />
                    <stop offset="1" style={{ stopColor: "var(--primary-light)", stopOpacity: 0.12 }} />
                  </linearGradient>
                </defs>
                <path
                  className="xmas-bank-back"
                  d="M0 70 C120 40 220 62 340 48 S560 30 700 52 S940 34 1060 50 S1170 44 1200 46 L1200 120 L0 120 Z"
                />
                <path
                  fill="url(#xmasBank)"
                  d="M0 86 C90 64 190 82 300 70 S500 58 620 76 S840 60 960 74 S1130 64 1200 70 L1200 120 L0 120 Z"
                />
              </svg>
            </div>
          </div>,
          hero
        )}

      {/* The balls and the gifts take taps, so they sit above the hero's text
          layer, which covers the whole hero; the box around the gifts is the
          snowbank's, so they still stand on it. */}
      {hero &&
        createPortal(
          <div className="xmas-scope xmas-hero xmas-hero-front" aria-hidden="true">
            <Baubles className="xmas-balls" onClick={onBalls} />
            <div className="xmas-snowbank">
              <GiftPile className="xmas-gifts" onClick={onGifts} />
            </div>
          </div>,
          hero
        )}
    </>
  );
}
