"use client";
import "./christmas-effect.css";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { keyOf, useAnchoredBox, useMatchingElements } from "@/components/seasonal/anchors";
import { frostPath, seeded, snowflakePath } from "@/components/seasonal/crystals";
import { snowBurst } from "@/components/seasonal/SnowCanvas";
import SantaSleigh from "./SantaSleigh";

/* The landing page's Christmas dressing below the hero — see ChristmasEffect,
 * which mounts all of it. Every piece is attached to markup LandingClient
 * already draws, found by class, so LandingClient itself does not change:
 *
 *  - snow lying along the top outline of buttons, badges, the
 *    photographs, the store card and the result cards — draped over their
 *    rounded corners, glinting, in places glazed with ice; on the things you
 *    press, a press knocks a few small lumps off;
 *  - snow along the inside top of the plan and offer cards, which clip;
 *  - frost feathering in from the corners of the photographs and cards;
 *  - icicles under the photographs, and under the nav once it turns solid;
 *  - a string of lights and a pair of large crystals in each section;
 *  - a drift along the top of the footer.
 *
 * Nothing here is portalled into an element with `data-i18n` (the page's DOM
 * pass rewrites their text): snow goes into the element's parent, or into the
 * element itself only where nothing inside it is rewritten. */

/* For the pieces portalled into the element itself rather than its parent. */
const self = (el: HTMLElement) => el;
const parent = (el: HTMLElement) => el.parentElement;

/* ── Shared drawing ────────────────────────────────────────────────────── */

const fx = (v: number) => v.toFixed(1);

/* A drift as overlapping mounds along a baseline (the footer's). */
function driftMounds(width: number, height: number, seed: number, spacing = 34) {
  const r = seeded(seed);
  const n = Math.max(3, Math.round(width / spacing));
  const step = width / n;
  return Array.from({ length: n }, (_, i) => {
    const x0 = Math.max(0, i * step - step * 0.3);
    const x1 = Math.min(width, (i + 1) * step + step * 0.3);
    const edge = i === 0 || i === n - 1 ? 0.7 : 1;
    const peak = height * (0.5 + r() * 0.5) * edge;
    const xm = (x0 + x1) / 2 + (r() - 0.5) * step * 0.35;
    const y = height - peak;
    return (
      `M${fx(x0)} ${height} ` +
      `C${fx(x0)} ${fx(height - peak * 0.55)} ${fx(xm - step * 0.42)} ${fx(y)} ${fx(xm)} ${fx(y)} ` +
      `S${fx(x1)} ${fx(height - peak * 0.55)} ${fx(x1)} ${height} Z`
    );
  });
}

/* The snow's fill, and the ice's: translucent blue-white with a band of light
   that slides across it every few seconds. */
function SnowDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-snow`} x1="0" y1="0" x2="0" y2="1">
        {/* `style`, not the attributes: presentation attributes do not resolve var(). */}
        <stop offset="0" style={{ stopColor: "rgb(var(--text-rgb))" }} />
        <stop offset="1" style={{ stopColor: "color-mix(in srgb, rgb(var(--text-rgb)) 80%, var(--primary-light))" }} />
      </linearGradient>
      <linearGradient id={`${id}-ice`} x1="-1" y1="0" x2="0" y2="0">
        <stop offset="0" style={{ stopColor: "var(--primary-light)", stopOpacity: 0.5 }} />
        <stop offset="0.44" style={{ stopColor: "var(--primary-light)", stopOpacity: 0.5 }} />
        <stop offset="0.5" style={{ stopColor: "rgb(var(--text-rgb))", stopOpacity: 0.95 }} />
        <stop offset="0.56" style={{ stopColor: "var(--primary-light)", stopOpacity: 0.5 }} />
        <stop offset="1" style={{ stopColor: "var(--primary-light)", stopOpacity: 0.5 }} />
        <animate attributeName="x1" values="-1;1;1" keyTimes="0;0.35;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="x2" values="0;2;2" keyTimes="0;0.35;1" dur="7s" repeatCount="indefinite" />
      </linearGradient>
    </defs>
  );
}

/* A four-pointed glint, centred on 0,0. */
const GLINT = "M0 -3.4L0.6 -0.6L3.4 0L0.6 0.6L0 3.4L-0.6 0.6L-3.4 0L-0.6 -0.6Z";

type Glint = { x: number; y: number; delay: number };

function Glints({ glints }: { glints: Glint[] }) {
  return (
    <>
      {glints.map((g, i) => (
        <path
          key={i}
          className="xmas-glint"
          d={GLINT}
          transform={`translate(${fx(g.x)} ${fx(g.y)})`}
          style={{ animationDelay: `${g.delay.toFixed(1)}s` }}
        />
      ))}
    </>
  );
}

/* ── Lights (also the hero's) ──────────────────────────────────────────── */

const BULB_TONES = ["red", "gold", "green", "blue", "warm"] as const;

export function Lights({ className, count, swags }: { className: string; count: number; swags: number }) {
  const sagAt = (u: number) => {
    const s = (u * swags) % 1;
    return 1 - (2 * s - 1) ** 2;
  };
  return (
    <div className={className} aria-hidden="true">
      <svg className="xmas-wire" viewBox="0 0 1000 100" preserveAspectRatio="none">
        <path
          d={Array.from({ length: 101 }, (_, i) => {
            const u = i / 100;
            return `${i ? "L" : "M"}${(u * 1000).toFixed(1)} ${(8 + sagAt(u) * 62).toFixed(1)}`;
          }).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {Array.from({ length: count }, (_, i) => {
        const u = (i + 0.5) / count;
        return (
          <span
            key={i}
            className={`xmas-bulb is-${BULB_TONES[i % BULB_TONES.length]}`}
            style={{
              left: `${u * 100}%`,
              top: `${8 + sagAt(u) * 62}%`,
              animationDelay: `${((i * 0.37) % 2.4).toFixed(2)}s`,
              animationDuration: `${(2.2 + ((i * 0.53) % 1.8)).toFixed(2)}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Snow along an element's outline ───────────────────────────────────── */

/* How long a gap stays before the snow fills it again. */
const REGROW_AFTER_MS = 4200;

type Lump = { d: string; cx: number; cy: number; dx: number; rot: number };

/* Snow lying on an element, in the overlay's own coordinates.
 *
 * The overlay sits `h` above the element and 1px past each side. The snow is
 * drawn along the element's actual top outline — the rounded corners read from
 * its border-radius, then the straight top — with its underside on that
 * outline (sunk 1.5px into the edge, so no gap shows) and its top surface
 * pushed out along the outline's normal. It is thickest across the top and
 * thins to nothing part-way down each corner, the way snow lies on a curve.
 *
 * On top of that body sit a few small lumps (what a press knocks off; the body
 * never falls), a few glints, and — where asked — a glaze of ice just under
 * the snow, over the element's own edge. */
function outlineSnow(width: number, h: number, radius: number, seed: number) {
  const rnd = seeded(seed);
  const pad = 1;
  const r = Math.max(1, radius);
  const drape = r * 0.8;
  const by = h;
  const bx0 = pad;
  const bx1 = width + pad;
  const ov = 1.5;
  const glazeDepth = Math.min(4, 1.6 + h * 0.15);
  const theta0 = Math.PI + Math.asin(Math.min(1, Math.max(0, (r - drape) / r)));
  const arcLen = r * (1.5 * Math.PI - theta0);
  const flat = Math.max(0, bx1 - bx0 - 2 * r);
  const total = 2 * arcLen + flat;
  const phases = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];

  const taperAt = (s: number) => {
    const edge = Math.min(1, s / (arcLen * 0.95 + 0.01), (total - s) / (arcLen * 0.95 + 0.01));
    return edge * edge * (3 - 2 * edge);
  };
  // Thickness along the outline: a gentle uneven surface, tapering on the corners.
  const thickness = (s: number) => {
    const u = s / total;
    const wave =
      0.12 * Math.sin(u * 9 + phases[0]) + 0.08 * Math.sin(u * 23 + phases[1]) + 0.05 * Math.sin(u * 41 + phases[2]);
    return Math.max(0, h * (0.58 + wave) * taperAt(s));
  };

  // A point on the element's top outline and its outward normal.
  const outline = (s: number) => {
    if (s < arcLen) {
      const t = theta0 + s / r;
      return { x: bx0 + r + r * Math.cos(t), y: by + r + r * Math.sin(t), nx: Math.cos(t), ny: Math.sin(t) };
    }
    if (s <= arcLen + flat) return { x: bx0 + r + (s - arcLen), y: by, nx: 0, ny: -1 };
    const t = 1.5 * Math.PI + (s - arcLen - flat) / r;
    return { x: bx1 - r + r * Math.cos(t), y: by + r + r * Math.sin(t), nx: Math.cos(t), ny: Math.sin(t) };
  };

  const n = Math.max(24, Math.round(total / 3));
  const top: [number, number][] = [];
  const under: [number, number][] = [];
  const glazeIn: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const sPos = (i / n) * total;
    const o = outline(sPos);
    const T = thickness(sPos);
    top.push([o.x + o.nx * T, o.y + o.ny * T]);
    under.push([o.x - o.nx * ov, o.y - o.ny * ov]);
    const g = ov + glazeDepth * taperAt(sPos);
    glazeIn.push([o.x - o.nx * g, o.y - o.ny * g]);
  }
  // The top surface through the midpoints of its samples, so it reads soft rather than faceted.
  let d = `M${fx(top[0][0])} ${fx(top[0][1])}`;
  for (let i = 1; i < top.length - 1; i++) {
    const mx = (top[i][0] + top[i + 1][0]) / 2;
    const my = (top[i][1] + top[i + 1][1]) / 2;
    d += ` Q${fx(top[i][0])} ${fx(top[i][1])} ${fx(mx)} ${fx(my)}`;
  }
  d += ` L${fx(top[top.length - 1][0])} ${fx(top[top.length - 1][1])}`;
  for (let i = under.length - 1; i >= 0; i--) d += ` L${fx(under[i][0])} ${fx(under[i][1])}`;
  d += " Z";

  // The ice: from the snow's underside a few pixels further into the element.
  let glaze = `M${fx(under[0][0])} ${fx(under[0][1])}`;
  for (let i = 1; i < under.length; i++) glaze += ` L${fx(under[i][0])} ${fx(under[i][1])}`;
  for (let i = glazeIn.length - 1; i >= 0; i--) glaze += ` L${fx(glazeIn[i][0])} ${fx(glazeIn[i][1])}`;
  glaze += " Z";

  // The loose lumps, spread along the straight top.
  const count = flat < 20 ? 1 : Math.max(2, Math.round(flat / 20));
  const lumps: Lump[] = Array.from({ length: count }, (_, i) => {
    const sPos = arcLen + (flat * (i + 0.5)) / count + (rnd() - 0.5) * Math.min(8, flat / count / 3);
    const o = outline(Math.min(total, Math.max(0, sPos)));
    const ySurf = o.y - thickness(sPos);
    const w = 9 + rnd() * 9;
    const lh = h * (0.28 + rnd() * 0.3);
    const x0 = o.x - w / 2;
    const x1 = o.x + w / 2;
    const base = ySurf + 2.5;
    const peak = ySurf - lh;
    return {
      d:
        `M${fx(x0)} ${fx(base)} C${fx(x0)} ${fx(peak + lh * 0.3)} ${fx(o.x - w * 0.3)} ${fx(peak)} ${fx(o.x)} ${fx(peak)} ` +
        `S${fx(x1)} ${fx(peak + lh * 0.3)} ${fx(x1)} ${fx(base)} Z`,
      cx: o.x,
      cy: ySurf,
      dx: (rnd() - 0.5) * 36,
      rot: (rnd() - 0.5) * 80,
    };
  });

  // A few glints on the surface, about one per 90px.
  const glints: Glint[] = Array.from({ length: Math.max(1, Math.round(flat / 90)) }, () => {
    const i = Math.floor(n * (0.15 + rnd() * 0.7));
    return { x: top[i][0], y: top[i][1] + 1.5, delay: rnd() * 6 };
  });

  return { d, glaze, lumps, glints, pad, height: h + drape + glazeDepth + 3 };
}

type LumpState = "on" | "fall" | "regrow";

type OutlineOptions = { interactive?: boolean; glaze?: boolean; thin?: boolean };

function OutlineCap({ target, seed, opts }: { target: HTMLElement; seed: number; opts: OutlineOptions }) {
  const ref = useRef<HTMLSpanElement>(null);
  const box = useAnchoredBox(target, ref);
  const id = useId().replace(/:/g, "");
  const [lumpStates, setLumpStates] = useState<Record<number, LumpState>>({});
  const statesRef = useRef(lumpStates);
  useEffect(() => {
    statesRef.current = lumpStates;
  }, [lumpStates]);

  const radius = box ? Math.min(box.height / 2, parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0) : 0;
  const h = !box
    ? 0
    : opts.thin
      ? Math.round(Math.max(6, Math.min(9, box.height * 0.22)))
      : Math.round(Math.max(8, Math.min(16, box.height * 0.26, box.width * 0.05)));
  const snow = box ? outlineSnow(box.width, h, radius, seed) : null;

  /* What the press handler needs from the last drawing: it runs outside
     render, so it reads these through a ref kept current after each commit. */
  const geom = useRef<{ lumps: Lump[]; pad: number; h: number } | null>(null);
  useEffect(() => {
    geom.current = snow ? { lumps: snow.lumps, pad: snow.pad, h } : null;
  });

  useEffect(() => {
    if (!opts.interactive) return;
    const timers: number[] = [];
    const onPress = () => {
      const g = geom.current;
      if (!g) return;
      // Two or three of the lumps still in place come loose.
      const free = g.lumps.map((_, i) => i).filter((i) => (statesRef.current[i] ?? "on") === "on");
      if (!free.length) return;
      const take = Math.min(free.length, 2 + Math.round(Math.random()));
      const picked: number[] = [];
      while (picked.length < take) picked.push(free.splice(Math.floor(Math.random() * free.length), 1)[0]);
      const r = target.getBoundingClientRect();
      for (const i of picked) {
        const l = g.lumps[i];
        snowBurst(r.left - g.pad + l.cx, r.top - g.h + l.cy, "snow", 4);
      }
      const next = { ...statesRef.current };
      for (const i of picked) next[i] = "fall";
      statesRef.current = next;
      setLumpStates(next);
      timers.push(
        window.setTimeout(() => {
          // Under reduced motion no regrow animation runs to end, so go straight back.
          const back: LumpState = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "on" : "regrow";
          setLumpStates((prev) => {
            const after = { ...prev };
            for (const i of picked) if (after[i] === "fall") after[i] = back;
            return after;
          });
        }, REGROW_AFTER_MS)
      );
    };
    target.addEventListener("pointerdown", onPress, { passive: true });
    return () => {
      target.removeEventListener("pointerdown", onPress);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [target, opts.interactive]);

  if (!box || !snow) {
    return <span ref={ref} className="xmas-btn-snow" style={{ visibility: "hidden" }} aria-hidden="true" />;
  }

  const w = box.width + snow.pad * 2;
  return (
    <span
      ref={ref}
      className="xmas-btn-snow"
      aria-hidden="true"
      style={{ left: box.left - snow.pad, top: box.top - h, width: w, height: snow.height }}
      onAnimationEnd={(e) => {
        const i = Number((e.target as SVGElement).dataset?.lump);
        if (e.animationName === "xmasRegrow" && !Number.isNaN(i)) {
          setLumpStates((prev) => ({ ...prev, [i]: "on" }));
        }
      }}
    >
      <svg width={w} height={snow.height} viewBox={`0 0 ${w} ${snow.height}`}>
        <SnowDefs id={id} />
        {opts.glaze && <path className="xmas-glaze" d={snow.glaze} fill={`url(#${id}-ice)`} />}
        <path d={snow.d} fill={`url(#${id}-snow)`} />
        {snow.lumps.map((l, i) => (
          <path
            key={i}
            d={l.d}
            data-lump={i}
            data-state={lumpStates[i] ?? "on"}
            fill={`url(#${id}-snow)`}
            style={{ ["--dx" as string]: `${l.dx.toFixed(1)}px`, ["--rot" as string]: `${l.rot.toFixed(0)}deg` }}
          />
        ))}
        <Glints glints={snow.glints} />
      </svg>
    </span>
  );
}

/* ── Snow inside the top of a card that clips ──────────────────────────── */

/* The plan and offer cards clip their own overflow and sit in a grid whose
   rules count its children, so their snow cannot hang outside them. It lies
   along the inside of the top edge instead — the card's own rounded corners
   trim it — with a soft, uneven underside, a few drips, and ice beneath. */
function insideSnow(width: number, h: number, seed: number) {
  const rnd = seeded(seed);
  const phases = [rnd() * 6.28, rnd() * 6.28];
  const drips = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => ({
    x: width * (0.1 + rnd() * 0.8),
    w: 4 + rnd() * 5,
    d: h * (0.4 + rnd() * 0.5),
  }));
  const depth = (x: number) => {
    const u = x / width;
    let t = h * (0.62 + 0.14 * Math.sin(u * 11 + phases[0]) + 0.08 * Math.sin(u * 29 + phases[1]));
    for (const dr of drips) t += dr.d * Math.exp(-(((x - dr.x) / dr.w) ** 2));
    return t;
  };
  const n = Math.max(20, Math.round(width / 4));
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const x = -1 + ((width + 2) * i) / n;
    return [x, depth(x)] as [number, number];
  });
  let d = `M-1 -1 L${fx(width + 1)} -1 L${fx(pts[n][0])} ${fx(pts[n][1])}`;
  for (let i = n - 1; i > 0; i--) {
    const mx = (pts[i][0] + pts[i - 1][0]) / 2;
    const my = (pts[i][1] + pts[i - 1][1]) / 2;
    d += ` Q${fx(pts[i][0])} ${fx(pts[i][1])} ${fx(mx)} ${fx(my)}`;
  }
  d += ` L${fx(pts[0][0])} ${fx(pts[0][1])} Z`;
  let glaze = `M${fx(pts[0][0])} ${fx(pts[0][1] - 1)}`;
  for (const [x, y] of pts) glaze += ` L${fx(x)} ${fx(y - 1)}`;
  for (let i = pts.length - 1; i >= 0; i--) glaze += ` L${fx(pts[i][0])} ${fx(pts[i][1] + 2.4)}`;
  glaze += " Z";
  const glints: Glint[] = Array.from({ length: Math.max(1, Math.round(width / 110)) }, () => ({
    x: width * (0.1 + rnd() * 0.8),
    y: h * 0.3,
    delay: rnd() * 6,
  }));
  return { d, glaze, glints, height: h * 2.2 };
}

function InsideCap({ card, seed }: { card: HTMLElement; seed: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const box = useAnchoredBox(card, ref);
  const id = useId().replace(/:/g, "");
  const w = box?.width ?? 0;
  const snow = w > 0 ? insideSnow(w, 14, seed) : null;
  return (
    <span ref={ref} className="xmas-card-snow" aria-hidden="true" style={{ visibility: snow ? undefined : "hidden" }}>
      {snow && (
        <svg width={w} height={snow.height} viewBox={`0 0 ${w} ${snow.height}`}>
          <SnowDefs id={id} />
          <path className="xmas-glaze" d={snow.glaze} fill={`url(#${id}-ice)`} />
          <path d={snow.d} fill={`url(#${id}-snow)`} />
          <Glints glints={snow.glints} />
        </svg>
      )}
    </span>
  );
}

/* ── Frost in the corners ──────────────────────────────────────────────── */

type Corner = "tl" | "tr" | "bl" | "br";
/* The frost grows from 0,0 into +x/+y; these turn it to face each corner. */
const CORNER_FLIP: Record<Corner, string> = {
  tl: "",
  tr: "translate(1 0) scale(-1 1)",
  bl: "translate(0 1) scale(1 -1)",
  br: "translate(1 1) scale(-1 -1)",
};

function FrostCorners({ target, corners, seed }: { target: HTMLElement; corners: Corner[]; seed: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const box = useAnchoredBox(target, ref);
  if (!box) return <span ref={ref} className="xmas-frost-corners" style={{ visibility: "hidden" }} aria-hidden="true" />;
  const size = Math.round(Math.max(70, Math.min(170, Math.min(box.width, box.height) * 0.4)));
  return (
    <span
      ref={ref}
      className="xmas-frost-corners"
      aria-hidden="true"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        borderRadius: getComputedStyle(target).borderRadius,
      }}
    >
      {corners.map((c, i) => (
        <svg
          key={c}
          className={`xmas-frost-patch is-${c}`}
          width={size}
          height={size}
          viewBox="0 0 1 1"
          style={{ animationDelay: `${(i * 3.1).toFixed(1)}s` }}
        >
          <path d={frostPath(seed + i * 101)} transform={CORNER_FLIP[c]} vectorEffect="non-scaling-stroke" />
        </svg>
      ))}
    </span>
  );
}

/* ── Icicles under an element ──────────────────────────────────────────── */

function HangingIcicles({ target, seed }: { target: HTMLElement; seed: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const box = useAnchoredBox(target, ref);
  if (!box) return <span ref={ref} className="xmas-hang" style={{ visibility: "hidden" }} aria-hidden="true" />;
  const radius = Math.min(box.height / 2, parseFloat(getComputedStyle(target).borderBottomLeftRadius) || 0);
  const inset = radius * 0.7;
  const width = Math.max(0, box.width - inset * 2);
  const r = seeded(seed);
  const count = Math.max(4, Math.round(width / 16));
  return (
    <span
      ref={ref}
      className="xmas-hang"
      aria-hidden="true"
      style={{ left: box.left + inset, top: box.top + box.height - 1, width }}
    >
      {Array.from({ length: count }, (_, i) => {
        const len = 8 + r() * 24 * (0.4 + Math.sin((i / count) * Math.PI) * 0.6);
        const drip = r() < 0.3;
        return (
          <span
            key={i}
            className="xmas-icicle"
            style={{ left: `${(((i + 0.2 + r() * 0.6) / count) * 100).toFixed(2)}%`, height: len, width: 4 + r() * 5 }}
          >
            {drip && <i className="xmas-icicle-drop" style={{ animationDelay: `${(r() * 9).toFixed(1)}s` }} />}
          </span>
        );
      })}
    </span>
  );
}

/* ── What gets dressed, and how ────────────────────────────────────────── */

type Dressing = {
  selector: string;
  /* Where the overlays live. The parent by default: most of these clip their
     overflow or carry `data-i18n`. */
  container?: (el: HTMLElement) => Element | null;
  outline?: OutlineOptions;
  frost?: Corner[];
  icicles?: boolean;
};

const DRESSINGS: Dressing[] = [
  {
    /* `.nav-highlight-btn` only in the nav: the footer's copy of that link is
       drawn as plain text, and snow would float over a word. */
    selector:
      ".landing-wrapper :is(.btn-primary, .btn-secondary, .btn-card, .hero-store-btn), .landing-wrapper #navbar .nav-highlight-btn",
    outline: { interactive: true },
  },
  { selector: ".landing-wrapper :is(.hero-eyebrow, .section-eyebrow, .membership-badge)", outline: { thin: true } },
  {
    selector: ".landing-wrapper :is(.coach-img, .trainer-image)",
    outline: { glaze: true },
    frost: ["tl", "br"],
    icicles: true,
  },
  { selector: ".landing-wrapper .ssc-card", outline: { glaze: true }, frost: ["bl"] },
  { selector: ".landing-wrapper .testimonial-card", container: self, outline: { glaze: true }, frost: ["br"] },
  /* The promotional window. Its button is not `interactive`: a press closes
     the window and leaves the page, so a knocked-off lump would never be seen. */
  { selector: ".landing-wrapper .promo-popup-cta", outline: {} },
  { selector: ".landing-wrapper .promo-popup-eyebrow", outline: { thin: true } },
];

function Dress({ dressing, salt }: { dressing: Dressing; salt: number }) {
  const containerOf = dressing.container ?? parent;
  const targets = useMatchingElements(dressing.selector, containerOf);
  return (
    <>
      {targets.map((el, i) => {
        const host = containerOf(el);
        if (!host) return null;
        const seed = salt * 7919 + i * 104729 + 13;
        return createPortal(
          <>
            {dressing.frost && <FrostCorners target={el} corners={dressing.frost} seed={seed} />}
            {dressing.icicles && <HangingIcicles target={el} seed={seed} />}
            {dressing.outline && <OutlineCap target={el} seed={seed} opts={dressing.outline} />}
          </>,
          host,
          keyOf(el)
        );
      })}
    </>
  );
}

/* The plan and offer cards — see insideSnow. */
function CardSnow() {
  const cards = useMatchingElements(".landing-wrapper .membership-card", self);
  return (
    <>
      {cards.map((card, i) =>
        createPortal(
          <>
            <InsideCap card={card} seed={i * 104729 + 7} />
            <FrostCorners target={card} corners={["br"]} seed={i * 31 + 3} />
          </>,
          card,
          keyOf(card)
        )
      )}
    </>
  );
}

/* ── Lights and crystals in the sections ───────────────────────────────── */

function SectionDecor() {
  const sections = useMatchingElements(".landing-wrapper section[id]:not(#home)", self);
  return (
    <>
      {sections.map((s, i) =>
        createPortal(
          <>
            <Lights className="xmas-lights xmas-section-lights" count={13} swags={3} />
            {(["a", "b"] as const).map((k, j) => (
              <svg key={k} className={`xmas-crystal is-${k}`} viewBox="-1.15 -1.15 2.3 2.3" aria-hidden="true">
                <path d={snowflakePath(i * 17 + j * 5 + 3)} vectorEffect="non-scaling-stroke" />
              </svg>
            ))}
          </>,
          s,
          keyOf(s)
        )
      )}
    </>
  );
}

/* ── Icicles under the nav ─────────────────────────────────────────────── */

const ICICLES = Array.from({ length: 34 }, (_, i) => {
  const r = seeded(i * 31 + 5);
  return {
    left: (i + 0.2 + r() * 0.6) / 34,
    len: 7 + r() * 17,
    wid: 4 + r() * 5,
    drip: r() < 0.25,
    delay: r() * 9,
  };
});

function Icicles() {
  const navs = useMatchingElements(".landing-wrapper #navbar", self);
  return (
    <>
      {navs.map((nav) =>
        createPortal(
          <div className="xmas-icicles" aria-hidden="true">
            {ICICLES.map((c, i) => (
              <span
                key={i}
                className="xmas-icicle"
                style={{ left: `${(c.left * 100).toFixed(2)}%`, height: c.len, width: c.wid }}
              >
                {c.drip && <i className="xmas-icicle-drop" style={{ animationDelay: `${c.delay.toFixed(1)}s` }} />}
              </span>
            ))}
          </div>,
          nav,
          keyOf(nav)
        )
      )}
    </>
  );
}

/* ── A drift on the footer ─────────────────────────────────────────────── */

function FooterDrift({ footer }: { footer: HTMLElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  const box = useAnchoredBox(footer, ref);
  const id = useId().replace(/:/g, "");
  const w = box?.width ?? 0;
  const h = 26;
  return (
    <span ref={ref} className="xmas-footer-snow" aria-hidden="true" style={{ visibility: w ? undefined : "hidden" }}>
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <SnowDefs id={id} />
          {driftMounds(w, h, 4242, 70).map((d, i) => (
            <path key={i} d={d} fill={`url(#${id}-snow)`} />
          ))}
        </svg>
      )}
    </span>
  );
}

function FooterSnow() {
  const footers = useMatchingElements(".landing-wrapper footer", self);
  return <>{footers.map((f) => createPortal(<FooterDrift footer={f} />, f, keyOf(f)))}</>;
}

/* ── The promotional window, wrapped as a gift ─────────────────────────── */

/* A satin bow: two loops, the knot, two tails cut in a V. Drawn once facing
   up; the right loop is the left one mirrored. Coordinates are the bow's own
   (0 0 140 110), knot at 70,44. */
const BOW_LOOP = "M70 42 C60 24 40 6 20 10 C4 14 2 36 12 48 C22 60 50 56 70 50 Z";
/* The inside of the loop, seen through its opening. */
const BOW_HOLLOW = "M66 43 C56 30 38 18 24 21 C14 24 14 34 22 40 C32 46 52 46 66 46 Z";
/* The ribbon coming back along the bottom of the loop to the knot. */
const BOW_LIP = "M70 50 C54 55 28 58 13 47 C26 51 48 49 66 44 Z";
const BOW_CREASE = "M66 45 C52 40 36 37 22 38";
const BOW_EDGE = "M66 39 C54 22 34 11 19 14";
const BOW_TAIL_L = "M63 50 C58 66 50 86 40 106 L52 100 L58 110 C66 92 74 72 76 52 Z";
const BOW_TAIL_R = "M77 50 C84 66 94 84 106 102 L94 99 L90 110 C80 90 72 72 64 52 Z";
const BOW_KNOT = "M60 35 Q70 30 80 35 Q85 46 80 57 Q70 61 60 57 Q55 46 60 35 Z";
const BOW_KNOT_FOLDS = "M64 38 Q62 46 64 54 M76 38 Q78 46 76 54";
const MIRROR = "translate(140 0) scale(-1 1)";

/* The bow itself, in its own 140×110 units: drawn on the promotional window
   (Bow) and on top of each gift in the hero (GiftPile). */
function BowShape() {
  const id = useId().replace(/:/g, "");
  /* `style`, not the attributes: presentation attributes do not resolve var(). */
  const stop = (offset: number, color: string) => <stop offset={offset} style={{ stopColor: color }} />;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-satin`} x1="0" y1="0" x2="0" y2="1">
          {stop(0, "var(--ribbon-light)")}
          {stop(0.45, "var(--ribbon)")}
          {stop(1, "var(--ribbon-dark)")}
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="0" y1="0" x2="1" y2="0">
          {stop(0, "var(--ribbon-dark)")}
          {stop(0.45, "var(--ribbon)")}
          {stop(0.7, "var(--ribbon-light)")}
          {stop(1, "var(--ribbon)")}
        </linearGradient>
        <linearGradient id={`${id}-knot`} x1="0" y1="0" x2="1" y2="0">
          {stop(0, "var(--ribbon-dark)")}
          {stop(0.5, "var(--ribbon-light)")}
          {stop(1, "var(--ribbon-dark)")}
        </linearGradient>
        <linearGradient id={`${id}-hollow`} x1="1" y1="0" x2="0" y2="0">
          {stop(0, "var(--ribbon-dark)")}
          {stop(1, "var(--ribbon)")}
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "rgb(var(--text-rgb))", stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: "rgb(var(--text-rgb))", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--text-rgb))", stopOpacity: 0 }} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={BOW_TAIL_L} />
          <path d={BOW_TAIL_R} />
          <path d={BOW_LOOP} />
          <path d={BOW_LOOP} transform={MIRROR} />
          <path d={BOW_KNOT} />
        </clipPath>
      </defs>

      <path d={BOW_TAIL_L} fill={`url(#${id}-tail)`} />
      <path d={BOW_TAIL_R} fill={`url(#${id}-tail)`} />
      {["", MIRROR].map((t) => (
        <g key={t || "l"} transform={t || undefined}>
          <path d={BOW_LOOP} fill={`url(#${id}-satin)`} />
          <path d={BOW_HOLLOW} fill={`url(#${id}-hollow)`} />
          <path d={BOW_LIP} fill={`url(#${id}-satin)`} />
          <path className="xmas-bow-crease" d={BOW_CREASE} />
          <path className="xmas-bow-edge" d={BOW_EDGE} />
        </g>
      ))}
      {/* The knot's shadow on the loops, then the knot and its gathers. */}
      <ellipse className="xmas-bow-shade" cx="70" cy="47" rx="15" ry="13" />
      <path d={BOW_KNOT} fill={`url(#${id}-knot)`} />
      <path className="xmas-bow-crease" d={BOW_KNOT_FOLDS} />

      {/* Light running over the satin now and then. */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect className="xmas-bow-sheen" x="-50" y="-20" width="34" height="150" fill={`url(#${id}-sheen)`} />
      </g>
    </g>
  );
}

function Bow() {
  return (
    <svg className="xmas-bow" viewBox="0 0 140 110" aria-hidden="true">
      <BowShape />
    </svg>
  );
}

/* The window's own box, in the scrim it is centred in — the window clips its
   overflow, so the bow, which sits over its corner, cannot live inside it. */
function GiftWrap({ card }: { card: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useAnchoredBox(card, ref);
  return (
    <div
      ref={ref}
      className="xmas-scope xmas-gift"
      aria-hidden="true"
      style={
        box
          ? { left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: getComputedStyle(card).borderRadius }
          : { visibility: "hidden" }
      }
    >
      <div className="xmas-gift-clip">
        <span className="xmas-gift-sash" />
      </div>
      <Lights className="xmas-lights xmas-gift-lights" count={9} swags={2} />
      <Bow />
    </div>
  );
}

function PromoGift() {
  const cards = useMatchingElements(".landing-wrapper .promo-popup-card");
  return (
    <>
      {cards.map((card) => {
        const host = card.parentElement;
        return host ? createPortal(<GiftWrap card={card} />, host, keyOf(card)) : null;
      })}
    </>
  );
}

/* ── The hero's corner: glass baubles and a pile of gifts ──────────────── */

/* `style`, not the attributes: presentation attributes do not resolve var(). */
function Stop({ at, color, opacity }: { at: number; color: string; opacity?: number }) {
  return <stop offset={at} style={{ stopColor: color, stopOpacity: opacity }} />;
}

/* Four glass baubles on threads of different lengths, in the drawing's own
   220×210 units. Each sways on its own thread at its own pace. The colours
   are the `--bauble-*` properties in christmas-effect.css. */
const BAUBLES = [
  { tone: "red", cx: 45, capTop: 70, r: 28, dur: 5.6, delay: 0 },
  { tone: "gold", cx: 112, capTop: 34, r: 21, dur: 4.4, delay: -1.3 },
  { tone: "silver", cx: 80, capTop: 150, r: 16, dur: 3.9, delay: -2.1 },
  { tone: "blue", cx: 165, capTop: 112, r: 32, dur: 6.2, delay: -0.7 },
] as const;

export function Baubles({ className, onClick }: { className: string; onClick?: (e: React.MouseEvent) => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={className} onClick={onClick} aria-hidden="true">
      <svg viewBox="0 0 220 210">
        <defs>
          {/* The cap: brushed gold, light down the middle. */}
          <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="1" y2="0">
            <Stop at={0} color="var(--cap-dark)" />
            <Stop at={0.45} color="var(--cap-light)" />
            <Stop at={0.6} color="var(--cap)" />
            <Stop at={1} color="var(--cap-dark)" />
          </linearGradient>
          {/* The glint of the room's light on the glass, soft-edged. */}
          <radialGradient id={`${id}-glint`}>
            <Stop at={0} color="rgb(var(--text-rgb))" opacity={0.95} />
            <Stop at={0.4} color="rgb(var(--text-rgb))" opacity={0.35} />
            <Stop at={1} color="rgb(var(--text-rgb))" opacity={0} />
          </radialGradient>
          {/* The far side catching light from behind: a rim along the bottom. */}
          <radialGradient id={`${id}-rim`} cx="0.5" cy="0.35" r="0.65">
            <Stop at={0.78} color="rgb(var(--text-rgb))" opacity={0} />
            <Stop at={0.96} color="rgb(var(--text-rgb))" opacity={0.22} />
            <Stop at={1} color="rgb(var(--text-rgb))" opacity={0} />
          </radialGradient>
          {BAUBLES.map((b) => (
            <radialGradient key={b.tone} id={`${id}-${b.tone}`} cx="0.36" cy="0.32" r="0.75">
              <Stop at={0} color={`var(--bauble-${b.tone}-light)`} />
              <Stop at={0.4} color={`var(--bauble-${b.tone})`} />
              <Stop at={0.85} color={`var(--bauble-${b.tone}-dark)`} />
              <Stop at={1} color={`var(--bauble-${b.tone}-dark)`} />
            </radialGradient>
          ))}
        </defs>

        {BAUBLES.map((b) => {
          const capW = b.r * 0.5;
          const capH = b.r * 0.32;
          const cy = b.capTop + capH + b.r - 2;
          return (
            <g
              key={b.tone}
              className="xmas-bauble"
              style={{
                transformOrigin: `${b.cx}px 0px`,
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
              }}
            >
              <line className="xmas-bauble-thread" x1={b.cx} y1={0} x2={b.cx} y2={b.capTop - 3} />
              {/* The wire loop the thread is tied through. */}
              <ellipse className="xmas-bauble-loop" cx={b.cx} cy={b.capTop - 2} rx={capW * 0.22} ry={3} />
              <circle cx={b.cx} cy={cy} r={b.r} fill={`url(#${id}-${b.tone})`} />
              <circle cx={b.cx} cy={cy} r={b.r} fill={`url(#${id}-rim)`} />
              <ellipse
                cx={b.cx - b.r * 0.36}
                cy={cy - b.r * 0.42}
                rx={b.r * 0.34}
                ry={b.r * 0.22}
                transform={`rotate(-35 ${b.cx - b.r * 0.36} ${cy - b.r * 0.42})`}
                fill={`url(#${id}-glint)`}
              />
              <circle className="xmas-bauble-spark" cx={b.cx - b.r * 0.42} cy={cy - b.r * 0.46} r={Math.max(1.2, b.r * 0.07)} />
              <rect x={b.cx - capW / 2} y={b.capTop} width={capW} height={capH} rx={1.5} fill={`url(#${id}-cap)`} />
              {/* The ridges pressed into the cap. */}
              <path
                className="xmas-bauble-ridges"
                d={[0.25, 0.5, 0.75].map((f) => `M${b.cx - capW / 2 + capW * f} ${b.capTop + 1}V${b.capTop + capH - 1}`).join("")}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* Three wrapped boxes, seen from a little above: a front, the lid's band and
   the lid's top, a satin ribbon round each and a bow where it crosses, and
   snow settled on the lids. In the drawing's own 300×200 units, standing on
   y = 198. The colours are the `--gift-*` properties in christmas-effect.css. */
const GIFTS = [
  { tone: "red", ribbon: "gold", x: 28, w: 112, top: 96, depth: 16, bow: 0.5, paper: "dots" },
  { tone: "blue", ribbon: "silver", x: 152, w: 92, top: 126, depth: 13, bow: 0.4, paper: "stripes" },
  { tone: "gold", ribbon: "red", x: 116, w: 58, top: 158, depth: 9, bow: 0.3, paper: "" },
] as const;
const GROUND = 198;

export function GiftPile({ className, onClick }: { className: string; onClick?: (e: React.MouseEvent) => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={className} onClick={onClick} aria-hidden="true">
      <svg viewBox="0 0 300 200">
        <defs>
          {/* Light from above: brighter towards the lid, darker at the foot. */}
          {GIFTS.map((g) => (
            <linearGradient key={g.tone} id={`${id}-${g.tone}`} x1="0" y1="0" x2="0" y2="1">
              <Stop at={0} color={`var(--gift-${g.tone}-light)`} />
              <Stop at={0.35} color={`var(--gift-${g.tone})`} />
              <Stop at={1} color={`var(--gift-${g.tone}-dark)`} />
            </linearGradient>
          ))}
          {/* Turning away at both sides: the box is a box, not a card. */}
          <linearGradient id={`${id}-turn`} x1="0" y1="0" x2="1" y2="0">
            <Stop at={0} color="rgb(2, 6, 23)" opacity={0.4} />
            <Stop at={0.18} color="rgb(2, 6, 23)" opacity={0} />
            <Stop at={0.8} color="rgb(2, 6, 23)" opacity={0} />
            <Stop at={1} color="rgb(2, 6, 23)" opacity={0.45} />
          </linearGradient>
          <linearGradient id={`${id}-snow`} x1="0" y1="0" x2="0" y2="1">
            <Stop at={0} color="rgb(var(--text-rgb))" />
            <Stop at={1} color="var(--primary-light)" opacity={0.85} />
          </linearGradient>
          <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.1" className="xmas-gift-print" />
            <circle cx="7" cy="7" r="0.8" className="xmas-gift-print" />
          </pattern>
          <pattern id={`${id}-stripes`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="2" height="8" className="xmas-gift-print" />
          </pattern>
          {(["gold", "silver", "red"] as const).map((t) => (
            <linearGradient key={t} id={`${id}-rib-${t}`} x1="0" y1="0" x2="1" y2="0">
              <Stop at={0} color={`var(--ribbon-${t}-dark)`} />
              <Stop at={0.45} color={`var(--ribbon-${t}-light)`} />
              <Stop at={0.6} color={`var(--ribbon-${t})`} />
              <Stop at={1} color={`var(--ribbon-${t}-dark)`} />
            </linearGradient>
          ))}
        </defs>

        {/* The shadow the pile casts on the snow. */}
        <ellipse className="xmas-gift-shadow" cx="150" cy={GROUND - 1} rx="132" ry="7" />

        {GIFTS.map((g) => {
          const lidH = Math.round(g.depth * 0.9);
          const over = 3; // the lid is a little wider than the box
          const lidY = g.top - lidH;
          const backY = lidY - g.depth;
          const inset = g.depth * 0.7; // the back edge, smaller with distance
          const mid = g.x + g.w / 2;
          const rw = Math.max(6, g.w * 0.13); // ribbon width
          const rib = `url(#${id}-rib-${g.ribbon})`;
          const topFace = `M${g.x - over} ${lidY} L${g.x + g.w + over} ${lidY} L${g.x + g.w + over - inset} ${backY} L${g.x - over + inset} ${backY} Z`;
          const bowScale = (g.w * g.bow * 1.6) / 140;
          const knotY = lidY - g.depth * 0.5;
          return (
            <g
              key={g.tone}
              style={{
                ["--ribbon" as string]: `var(--ribbon-${g.ribbon})`,
                ["--ribbon-light" as string]: `var(--ribbon-${g.ribbon}-light)`,
                ["--ribbon-dark" as string]: `var(--ribbon-${g.ribbon}-dark)`,
              }}
            >
              {/* The box. */}
              <rect x={g.x} y={g.top} width={g.w} height={GROUND - g.top} fill={`url(#${id}-${g.tone})`} />
              {g.paper && <rect x={g.x} y={g.top} width={g.w} height={GROUND - g.top} fill={`url(#${id}-${g.paper})`} />}
              <rect x={g.x} y={g.top} width={g.w} height={GROUND - g.top} fill={`url(#${id}-turn)`} />
              {/* The lid's shadow on the box, then the lid's band and top. */}
              <rect className="xmas-gift-lidshade" x={g.x} y={g.top} width={g.w} height={4} />
              <rect x={g.x - over} y={lidY} width={g.w + over * 2} height={lidH} fill={`url(#${id}-${g.tone})`} />
              <rect x={g.x - over} y={lidY} width={g.w + over * 2} height={lidH} fill={`url(#${id}-turn)`} />
              <path d={topFace} className={`xmas-gift-top is-${g.tone}`} />
              <line className="xmas-gift-edge" x1={g.x - over} y1={lidY} x2={g.x + g.w + over} y2={lidY} />

              {/* The ribbon: down the front, across the lid both ways. */}
              <rect x={mid - rw / 2} y={lidY} width={rw} height={GROUND - lidY} fill={rib} />
              <path
                d={`M${mid - rw / 2} ${lidY} L${mid + rw / 2} ${lidY} L${mid + rw * 0.4} ${backY} L${mid - rw * 0.4} ${backY} Z`}
                fill={rib}
              />
              <path
                d={`M${g.x - over + inset * 0.5} ${knotY - rw * 0.3} L${g.x + g.w + over - inset * 0.5} ${knotY - rw * 0.3} L${g.x + g.w + over - inset * 0.5} ${knotY + rw * 0.3} L${g.x - over + inset * 0.5} ${knotY + rw * 0.3} Z`}
                fill={rib}
              />

              {/* Snow settled along the back of the lid. */}
              <path
                className="xmas-gift-snow"
                fill={`url(#${id}-snow)`}
                d={`M${g.x - over + inset} ${backY} L${g.x + g.w + over - inset} ${backY}
                    C${g.x + g.w + over - inset * 0.6} ${backY + 2} ${g.x + g.w * 0.82} ${backY + g.depth * 0.45} ${g.x + g.w * 0.7} ${backY + g.depth * 0.3}
                    C${g.x + g.w * 0.58} ${backY + g.depth * 0.55} ${g.x + g.w * 0.42} ${backY + g.depth * 0.2} ${g.x + g.w * 0.3} ${backY + g.depth * 0.4}
                    C${g.x + g.w * 0.18} ${backY + g.depth * 0.55} ${g.x - over + inset * 0.6} ${backY + 3} ${g.x - over + inset} ${backY} Z`}
              />

              {/* The bow, its knot where the ribbons cross. */}
              <g transform={`translate(${mid - 70 * bowScale} ${knotY - 44 * bowScale}) scale(${bowScale})`}>
                <BowShape />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ChristmasDecor() {
  return (
    <>
      {DRESSINGS.map((d, i) => (
        <Dress key={d.selector} dressing={d} salt={i + 1} />
      ))}
      <PromoGift />
      <CardSnow />
      <SectionDecor />
      <Icicles />
      <FooterSnow />
    </>
  );
}

/* ── The store (/store) ────────────────────────────────────────────────────
 * The same dressing on the customer's store, mounted by SeasonalLayer under
 * the same switch. Only the header and the page itself: the cart drawer and
 * the checkout are places people work, like the panels. The stage (the
 * store's hero) gets a string of lights and Santa's sleigh. */

const STORE_DRESSINGS: Dressing[] = [
  {
    selector:
      ".st-root :is(.st-header, .st-main) :is(.btn-primary, .btn-secondary, .st-add-btn, .st-cart-btn, .st-header-main)",
    outline: { interactive: true },
  },
  { selector: ".st-root :is(.st-header-tag, .st-main .st-badge)", outline: { thin: true } },
  { selector: ".st-main .st-card", outline: { glaze: true }, frost: ["bl"] },
  { selector: ".st-main .st-gallery-main", outline: { glaze: true }, frost: ["tl", "br"], icicles: true },
];

function StoreStageDecor() {
  const stages = useMatchingElements(".st-main .st-stage", self);
  return (
    <>
      {stages.map((stage) =>
        createPortal(
          <div className="xmas-scope xmas-hero" aria-hidden="true">
            <Lights className="xmas-lights xmas-section-lights" count={15} swags={4} />
            <div className="xmas-sleigh-track">
              <div className="xmas-sleigh">
                <SantaSleigh />
              </div>
            </div>
          </div>,
          stage,
          keyOf(stage)
        )
      )}
    </>
  );
}

function StoreSectionDecor() {
  const sections = useMatchingElements(".st-main .st-catalog", self);
  return (
    <>
      {sections.map((s, i) =>
        createPortal(
          <>
            <Lights className="xmas-lights xmas-section-lights" count={13} swags={3} />
            {(["a", "b"] as const).map((k, j) => (
              <svg key={k} className={`xmas-crystal is-${k}`} viewBox="-1.15 -1.15 2.3 2.3" aria-hidden="true">
                <path d={snowflakePath(i * 17 + j * 5 + 3)} vectorEffect="non-scaling-stroke" />
              </svg>
            ))}
          </>,
          s,
          keyOf(s)
        )
      )}
    </>
  );
}

function StoreIcicles() {
  const headers = useMatchingElements(".st-root .st-header", self);
  return (
    <>
      {headers.map((header) =>
        createPortal(
          <div className="xmas-icicles" aria-hidden="true">
            {ICICLES.map((c, i) => (
              <span
                key={i}
                className="xmas-icicle"
                style={{ left: `${(c.left * 100).toFixed(2)}%`, height: c.len, width: c.wid }}
              >
                {c.drip && <i className="xmas-icicle-drop" style={{ animationDelay: `${c.delay.toFixed(1)}s` }} />}
              </span>
            ))}
          </div>,
          header,
          keyOf(header)
        )
      )}
    </>
  );
}

function StoreFooterSnow() {
  const footers = useMatchingElements(".st-root .st-footer", self);
  return <>{footers.map((f) => createPortal(<FooterDrift footer={f} />, f, keyOf(f)))}</>;
}

export function StoreChristmasDecor() {
  return (
    <>
      {STORE_DRESSINGS.map((d, i) => (
        <Dress key={d.selector} dressing={d} salt={i + 21} />
      ))}
      <StoreStageDecor />
      <StoreSectionDecor />
      <StoreIcicles />
      <StoreFooterSnow />
    </>
  );
}
