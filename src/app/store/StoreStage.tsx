"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type StoreProduct } from "@/lib/store/types";
import { FLAVOR_IMAGES } from "@/lib/store/flavorImages";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import { ProductVisual } from "./ProductVisual";

/* The store's opening stage — one product at a time, centred, with its type
 * written huge behind it and pieces of what it is made of floating around it
 * at different depths, some sharp, some out of focus.
 *
 * On a change the product stays where it is and swaps, the word slides in from
 * the side it is coming from with a motion blur, the floating pieces are thrown
 * back in, and the light behind everything turns to the new product's colour
 * (`--stage-accent`, registered in store.css so it can transition).
 *
 * It moves on by itself every few seconds — not while a pointer or focus is on
 * it, not in a hidden tab, and never under reduced motion. Arrows beside the
 * product, the dots, the arrow keys and a swipe all change it by hand. */

const AUTOPLAY_MS = 6500;

/** The word behind the product: what it is, in one short Arabic word. */
const CATEGORY_WORD: Record<string, string> = {
  protein: "بروتين",
  creatine: "كرياتين",
  preworkout: "طاقة",
  gainer: "ضخامة",
  aminos: "تعافي",
  vitamins: "فيتامين",
};

type Piece = "scoop" | "powder" | "crystal" | "bolt" | "capsule" | "softgel" | "drop";

/** What floats around each kind of product — one per slot, in slot order. */
const PIECES: Record<string, Piece[]> = {
  protein: ["scoop", "powder", "powder", "scoop", "powder"],
  gainer: ["powder", "scoop", "scoop", "powder", "powder"],
  creatine: ["crystal", "crystal", "crystal", "crystal", "crystal"],
  preworkout: ["bolt", "crystal", "bolt", "bolt", "drop"],
  aminos: ["drop", "capsule", "drop", "crystal", "drop"],
  vitamins: ["capsule", "softgel", "capsule", "softgel", "capsule"],
};

export default function StoreStage({ products }: { products: StoreProduct[] }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  /* Which of the banner's flavours stands in the middle. */
  const [flavor, setFlavor] = useState(0);
  const centerRef = useRef<HTMLAnchorElement>(null);
  const keyboardPickRef = useRef(false);
  const stageRef = useRef<HTMLElement>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const count = products.length;

  const go = useCallback(
    (step: 1 | -1) => {
      if (count < 2) return;
      setDir(step);
      setFlavor(0);
      setIndex((i) => (i + step + count) % count);
    },
    [count]
  );

  const goTo = (i: number) => {
    if (i === index) return;
    setDir(i > index ? 1 : -1);
    setFlavor(0);
    setIndex(i);
  };

  /* The tub a keyboard user pressed turns into the link in the middle, so the
     focus follows it there rather than falling back to the page. */
  useEffect(() => {
    if (!keyboardPickRef.current) return;
    keyboardPickRef.current = false;
    centerRef.current?.focus({ preventScroll: true });
  }, [flavor]);

  /* Autoplay. Restarts after every change, so a click never lands half-way
     through a countdown. */
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") go(1);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [index, flavor, paused, count, go]);

  /* The pieces drift a little with the pointer, the near ones more — depth.
     Written straight onto the element: no re-render per mouse move. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          stage.style.setProperty("--px", px.toFixed(3));
          stage.style.setProperty("--py", py.toFixed(3));
        });
      }
    };
    stage.addEventListener("pointermove", onMove);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (count === 0) return null;
  const p = products[Math.min(index, count - 1)];
  const word = CATEGORY_WORD[p.category] ?? p.name.split(" ")[0];
  const pieces = PIECES[p.category] ?? PIECES.protein;
  const flavors = FLAVOR_IMAGES[p.slug] ?? [];
  const hasFlavors = flavors.length > 1;

  return (
    <section
      ref={stageRef}
      className="st-stage"
      style={{ "--stage-accent": p.accent, "--accent": p.accent } as React.CSSProperties}
      aria-roledescription="carousel"
      aria-label="منتجات مميزة"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        /* RTL: the arrow pointing left moves forward. */
        if (e.key === "ArrowLeft") go(1);
        if (e.key === "ArrowRight") go(-1);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") swipeRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const start = swipeRef.current;
        swipeRef.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(dx > 0 ? 1 : -1);
      }}
    >
      <div className="st-stage-glow" aria-hidden="true" />

      {/* The word, behind everything. Keyed so each change replays its entrance. */}
      <div className="st-stage-word-wrap" aria-hidden="true">
        <span key={`w-${index}`} className="st-stage-word" data-dir={dir}>
          {word}
        </span>
      </div>

      {/* Floating pieces. Slots 0, 1 and 4 sit behind the product; 2 and 3 in front. */}
      <div key={`f-${index}`} className="st-stage-pieces" aria-hidden="true">
        {pieces.map((piece, i) => (
          <span key={i} className={`st-piece st-piece--${i}`}>
            <span className="st-piece-spin">
              <PieceArt kind={piece} />
            </span>
          </span>
        ))}
      </div>

      <div className="st-stage-center">
        <div className="st-stage-product">
          {count > 1 && (
            <button type="button" className="st-stage-arrow st-stage-arrow--prev" onClick={() => go(-1)} aria-label="المنتج السابق">
              <ChevronRight aria-hidden="true" />
            </button>
          )}
          {hasFlavors ? (
            <div key={`p-${index}`} className="st-stage-visual" data-dir={dir}>
              <div className="st-visual st-stage-flavors" style={{ "--count": flavors.length } as React.CSSProperties}>
                {/* One row of equal tubs, first flavour on the reading side. Picking
                    one lights it where it stands; pressing it again opens the product. */}
                {flavors.map((f, i) => {
                  const isChosen = i === flavor;
                  return (
                    <div
                      key={f.src}
                      className={`st-stage-flavor${isChosen ? " is-chosen" : ""}`}
                      style={{ "--pos": (flavors.length - 1) / 2 - i, "--fit": f.fit ?? 1 } as React.CSSProperties}
                    >
                      {isChosen ? (
                        <Link ref={centerRef} href={`/store/${p.slug}`} className="st-stage-flavor-hit" aria-label={`${p.name} — ${f.label}`} />
                      ) : (
                        <button
                          type="button"
                          className="st-stage-flavor-hit"
                          aria-label={`اختر نكهة ${f.label}`}
                          onClick={(e) => {
                            keyboardPickRef.current = e.detail === 0;
                            setFlavor(i);
                          }}
                        />
                      )}
                      <img
                        src={optimizedSrc(f.src, 828)}
                        srcSet={optimizedSrcSet(f.src, [384, 640, 828])}
                        sizes="(max-width: 768px) 300px, 420px"
                        alt=""
                        decoding="async"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Link href={`/store/${p.slug}`} key={`p-${index}`} className="st-stage-visual" data-dir={dir} aria-label={p.name}>
              <ProductVisual name={p.name} category={p.category} accent={p.accent} image_url={p.image_url} size={460} priority />
            </Link>
          )}
          {count > 1 && (
            <button type="button" className="st-stage-arrow st-stage-arrow--next" onClick={() => go(1)} aria-label="المنتج التالي">
              <ChevronLeft aria-hidden="true" />
            </button>
          )}
        </div>

        <Link href={`/store/${p.slug}`} className="st-stage-shop">
          اشتريه الان
        </Link>

        {count > 1 && (
          <div className="st-stage-dots" role="tablist" aria-label="اختر المنتج">
            {products.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={item.name}
                className={`st-stage-dot${i === index ? " is-active" : ""}`}
                onClick={() => goTo(i)}
              >
                {i === index && !paused && <span key={flavor} className="st-stage-dot-fill" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The floating pieces — drawn, not photographed, in the product's colour
 * ------------------------------------------------------------------ */

const fill = (mix: number) => ({ fill: `color-mix(in srgb, var(--stage-accent) ${mix}%, var(--text))` });
const shade = (mix: number) => ({ fill: `color-mix(in srgb, var(--stage-accent) ${mix}%, var(--bg))` });

function PieceArt({ kind }: { kind: Piece }) {
  switch (kind) {
    case "scoop":
      return (
        <svg viewBox="0 0 120 120">
          <rect x="78" y="56" width="40" height="12" rx="6" transform="rotate(-18 78 56)" style={shade(55)} />
          <path d="M14 58 h68 l-6 34 q-2 10 -12 10 h-32 q-10 0 -12 -10 z" style={shade(70)} />
          <path d="M14 58 h68 l-2 8 h-64 z" style={{ fill: "var(--bg)", opacity: 0.25 }} />
          <path d="M12 60 q8 -30 36 -32 q30 2 36 32 z" style={fill(18)} />
          <circle cx="36" cy="44" r="5" style={fill(8)} />
          <circle cx="56" cy="38" r="4" style={fill(8)} />
        </svg>
      );
    case "powder":
      return (
        <svg viewBox="0 0 120 120">
          <path d="M20 78 q-6 -22 16 -30 q4 -22 28 -20 q22 -4 30 16 q22 6 14 30 q-4 18 -26 16 q-14 12 -34 4 q-26 4 -28 -16 z" style={fill(16)} />
          <circle cx="44" cy="52" r="6" style={fill(4)} />
          <circle cx="74" cy="60" r="4" style={fill(30)} />
          <circle cx="58" cy="80" r="5" style={fill(30)} />
        </svg>
      );
    case "crystal":
      return (
        <svg viewBox="0 0 120 120">
          <path d="M60 8 l34 26 -10 58 -24 20 -24 -20 -10 -58 z" style={fill(55)} />
          <path d="M60 8 l34 26 -34 12 z" style={fill(20)} />
          <path d="M60 8 l-34 26 34 12 z" style={fill(40)} />
          <path d="M60 46 l34 -12 -10 58 -24 20 z" style={shade(70)} />
          <path d="M60 46 l-34 -12 10 58 24 20 z" style={shade(50)} />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 120 120">
          <path d="M70 6 l-44 62 h28 l-10 46 l50 -66 h-30 z" style={fill(70)} />
          <path d="M70 6 l-44 62 h14 l30 -62 z" style={fill(25)} />
        </svg>
      );
    case "capsule":
      return (
        <svg viewBox="0 0 120 120">
          <g transform="rotate(-35 60 60)">
            <path d="M30 42 h30 v36 h-30 a18 18 0 0 1 0 -36 z" style={fill(75)} />
            <path d="M60 42 h30 a18 18 0 0 1 0 36 h-30 z" style={fill(12)} />
            <rect x="22" y="48" width="70" height="6" rx="3" style={{ fill: "var(--text)", opacity: 0.35 }} />
          </g>
        </svg>
      );
    case "softgel":
      return (
        <svg viewBox="0 0 120 120">
          <ellipse cx="60" cy="60" rx="42" ry="26" transform="rotate(25 60 60)" style={{ ...fill(60), opacity: 0.9 }} />
          <ellipse cx="48" cy="50" rx="14" ry="6" transform="rotate(25 48 50)" style={{ fill: "var(--text)", opacity: 0.45 }} />
        </svg>
      );
    case "drop":
    default:
      return (
        <svg viewBox="0 0 120 120">
          <path d="M60 8 q36 46 36 68 a36 36 0 0 1 -72 0 q0 -22 36 -68 z" style={{ ...fill(55), opacity: 0.92 }} />
          <ellipse cx="46" cy="76" rx="8" ry="14" transform="rotate(20 46 76)" style={{ fill: "var(--text)", opacity: 0.4 }} />
        </svg>
      );
  }
}
