"use client";
import "./seasonal.css";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { seeded } from "./crystals";
import { recallSeason } from "./season-memory";

const SnowCanvas = dynamic(() => import("./SnowCanvas"), { ssr: false });

/* The Christmas dress of the loading screens: the logo set inside a wreath,
 * and snow falling behind it. Shown only when the last visit found the
 * Christmas effect on; otherwise the logo alone, and the loading screen is
 * exactly what it was. (Given no logo, the wreath stands on its own.)
 *
 * Drawn here rather than played from a file: the loading screen is the one
 * place that must be quick, and this needs no player and no download. Fir
 * sprigs in three depths of green round a ring, berries, two small gold
 * baubles, snow on the upper rim and a satin bow at the foot. A string of
 * warm lights is wound round it, and a light runs round that string for as
 * long as the page is loading. The colours are the `--wreath-*` properties in
 * seasonal.css. */

/* The drawing's own units: 200 × 200, the ring centred, its middle at R. */
const C = 100;
const R = 70; /* wide enough a hole for the logo to sit in */
const f = (v: number) => Math.round(v * 10) / 10;
const at = (angle: number, radius: number): [number, number] => [
  C + Math.cos(angle) * radius,
  C + Math.sin(angle) * radius,
];

/* One sprig: a short stem with needles in pairs either side, shorter towards
   the tip. Returned as one path of strokes. */
function sprig(x: number, y: number, dir: number, len: number, rnd: () => number) {
  const parts = [`M${f(x)} ${f(y)}L${f(x + Math.cos(dir) * len)} ${f(y + Math.sin(dir) * len)}`];
  const pairs = 6;
  for (let k = 1; k <= pairs; k++) {
    const t = (k / (pairs + 1)) * len;
    const px = x + Math.cos(dir) * t;
    const py = y + Math.sin(dir) * t;
    const n = (7.5 - k * 0.6) * (0.85 + rnd() * 0.3);
    for (const side of [-1, 1]) {
      const a = dir + side * (0.75 + rnd() * 0.25);
      parts.push(`M${f(px)} ${f(py)}L${f(px + Math.cos(a) * n)} ${f(py + Math.sin(a) * n)}`);
    }
  }
  return parts.join("");
}

/* Three layers of sprigs, back to front. Light falls from the top left, so a
   sprig there is a shade lighter than its twin at the bottom right. */
const LAYERS = (() => {
  const rnd = seeded(1225);
  const layers: { d: string; tone: string }[][] = [[], [], []];
  const counts = [34, 40, 30];
  counts.forEach((count, layer) => {
    for (let i = 0; i < count; i++) {
      const a = ((i + rnd() * 0.8) / count) * Math.PI * 2;
      const radius = R + (rnd() - 0.5) * (layer === 2 ? 16 : 24);
      const [x, y] = at(a, radius);
      // Mostly along the ring, leaning in or out a little.
      const dir = a + Math.PI / 2 + (rnd() - 0.5) * 1.1;
      const len = 14 + rnd() * 9 - layer * 2;
      const lit = Math.cos(a - (-Math.PI * 3) / 4); // 1 at the top left
      const tone =
        layer === 0 ? "back" : lit > 0.35 ? (layer === 2 ? "tip" : "front") : lit > -0.4 ? "mid" : "back";
      layers[layer].push({ d: sprig(x, y, dir, len, rnd), tone });
    }
  });
  return layers;
})();

/* Berries in threes, two baubles, and snow on the upper rim. */
const BERRIES = [-2.5, -1.2, 0.35, 0.95, 2.35].flatMap((a, i) => {
  const [x, y] = at(a, R + (i % 2 ? 6 : -5));
  return [
    [x, y],
    [x + 5, y + 2],
    [x + 1.5, y + 5.5],
  ] as [number, number][];
});
const BAUBLES: [number, number][] = [at(-0.55, R + 3), at(3.55, R - 4)];
const SNOW = (() => {
  const rnd = seeded(77);
  /* Soft clumps settled on the upper rim, each a few overlapping lumps. */
  return Array.from({ length: 9 }, (_, i) => {
    const a = -Math.PI * 0.86 + (i / 8) * Math.PI * 0.72 + (rnd() - 0.5) * 0.1;
    const [x, y] = at(a, R - 6 + rnd() * 14);
    return Array.from({ length: 3 }, (_, k) => ({
      x: x + (k - 1) * (2.4 + rnd()),
      y: y + (k === 1 ? -0.8 : 0.4) + rnd() * 0.6,
      r: 1.5 + rnd() * 1.3 + (k === 1 ? 0.6 : 0),
    }));
  }).flat();
})();

/* The light string: a wire wound in and out of the ring, bulbs along it. */
const WIRE_WAVES = 9;
const wireAt = (a: number) => at(a, R + Math.sin(a * WIRE_WAVES) * 9);
const WIRE = Array.from({ length: 181 }, (_, i) => {
  const [x, y] = wireAt((i / 180) * Math.PI * 2);
  return `${i ? "L" : "M"}${f(x)} ${f(y)}`;
}).join("") + "Z";
const BULBS = 18;
const CHASE_S = 1.8;

/* The bow's own units (140 × 110, knot at 70,44) — the same drawing as the
   promotional window's, kept apart so the loading screen does not pull in
   the landing page's decorations. */
const BOW_LOOP = "M70 42 C60 24 40 6 20 10 C4 14 2 36 12 48 C22 60 50 56 70 50 Z";
const BOW_HOLLOW = "M66 43 C56 30 38 18 24 21 C14 24 14 34 22 40 C32 46 52 46 66 46 Z";
const BOW_TAIL_L = "M63 50 C58 66 50 86 40 106 L52 100 L58 110 C66 92 74 72 76 52 Z";
const BOW_TAIL_R = "M77 50 C84 66 94 84 106 102 L94 99 L90 110 C80 90 72 72 64 52 Z";
const BOW_KNOT = "M60 35 Q70 30 80 35 Q85 46 80 57 Q70 61 60 57 Q55 46 60 35 Z";
const MIRROR = "translate(140 0) scale(-1 1)";
const BOW_SCALE = 0.46;

/* `style`, not the attributes: presentation attributes do not resolve var(). */
function Stop({ at: offset, color, opacity }: { at: number; color: string; opacity?: number }) {
  return <stop offset={offset} style={{ stopColor: color, stopOpacity: opacity }} />;
}

export function Wreath({ className = "xmas-loader", children }: { className?: string; children?: ReactNode }) {
  const id = useId().replace(/:/g, "");
  const [bx, by] = at(Math.PI / 2, R + 2);
  return (
    <div className={className} aria-hidden="true">
      <svg className="xmas-wreath" viewBox="0 0 200 200">
        <defs>
          <radialGradient id={`${id}-berry`} cx="0.35" cy="0.3" r="0.8">
            <Stop at={0} color="var(--wreath-berry-light)" />
            <Stop at={0.45} color="var(--wreath-berry)" />
            <Stop at={1} color="var(--wreath-berry-dark)" />
          </radialGradient>
          <radialGradient id={`${id}-gold`} cx="0.35" cy="0.3" r="0.8">
            <Stop at={0} color="var(--wreath-gold-light)" />
            <Stop at={0.45} color="var(--wreath-gold)" />
            <Stop at={1} color="var(--wreath-gold-dark)" />
          </radialGradient>
          <radialGradient id={`${id}-glow`}>
            <Stop at={0} color="var(--wreath-bulb)" opacity={0.9} />
            <Stop at={0.35} color="var(--wreath-bulb)" opacity={0.35} />
            <Stop at={1} color="var(--wreath-bulb)" opacity={0} />
          </radialGradient>
          <linearGradient id={`${id}-satin`} x1="0" y1="0" x2="0" y2="1">
            <Stop at={0} color="var(--wreath-ribbon-light)" />
            <Stop at={0.45} color="var(--wreath-ribbon)" />
            <Stop at={1} color="var(--wreath-ribbon-dark)" />
          </linearGradient>
          <linearGradient id={`${id}-tail`} x1="0" y1="0" x2="1" y2="0">
            <Stop at={0} color="var(--wreath-ribbon-dark)" />
            <Stop at={0.5} color="var(--wreath-ribbon)" />
            <Stop at={0.75} color="var(--wreath-ribbon-light)" />
            <Stop at={1} color="var(--wreath-ribbon)" />
          </linearGradient>
          <linearGradient id={`${id}-knot`} x1="0" y1="0" x2="1" y2="0">
            <Stop at={0} color="var(--wreath-ribbon-dark)" />
            <Stop at={0.5} color="var(--wreath-ribbon-light)" />
            <Stop at={1} color="var(--wreath-ribbon-dark)" />
          </linearGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <Stop at={0} color="rgb(var(--text-rgb))" opacity={0} />
            <Stop at={0.5} color="rgb(var(--text-rgb))" opacity={0.6} />
            <Stop at={1} color="rgb(var(--text-rgb))" opacity={0} />
          </linearGradient>
          <clipPath id={`${id}-bow`}>
            <path d={BOW_TAIL_L} />
            <path d={BOW_TAIL_R} />
            <path d={BOW_LOOP} />
            <path d={BOW_LOOP} transform={MIRROR} />
            <path d={BOW_KNOT} />
          </clipPath>
        </defs>

        <g className="xmas-wreath-body">
          {/* The dark heart of the ring, so no gap between sprigs shows through. */}
          <circle className="xmas-wreath-core" cx={C} cy={C} r={R} />

          {LAYERS.map((layer, i) => (
            <g key={i} className={`xmas-wreath-layer is-${i}`}>
              {layer.map((s, j) => (
                <path key={j} d={s.d} className={`xmas-wreath-sprig is-${s.tone}`} />
              ))}
            </g>
          ))}

          <g className="xmas-wreath-snow">
            {SNOW.map((s, i) => (
              <circle key={i} cx={f(s.x)} cy={f(s.y)} r={f(s.r)} />
            ))}
          </g>

          {/* The light string, under the berries and baubles. */}
          <path className="xmas-wreath-wire" d={WIRE} />
          {Array.from({ length: BULBS }, (_, i) => {
            const [x, y] = wireAt((i / BULBS) * Math.PI * 2 - Math.PI / 2);
            return (
              <g
                key={i}
                className="xmas-wreath-bulb"
                style={{ animationDelay: `${f(((i / BULBS) * CHASE_S - CHASE_S) * 100) / 100}s` }}
              >
                <circle cx={f(x)} cy={f(y)} r={9} fill={`url(#${id}-glow)`} />
                <circle className="xmas-wreath-filament" cx={f(x)} cy={f(y)} r={2.3} />
              </g>
            );
          })}

          {BERRIES.map(([x, y], i) => (
            <g key={i}>
              <circle cx={f(x)} cy={f(y)} r={3.2} fill={`url(#${id}-berry)`} />
              <circle className="xmas-wreath-spark" cx={f(x - 1)} cy={f(y - 1.1)} r={0.7} />
            </g>
          ))}
          {BAUBLES.map(([x, y], i) => (
            <g key={i}>
              <rect className="xmas-wreath-cap" x={f(x - 2)} y={f(y - 8.4)} width={4} height={3} rx={0.6} />
              <circle cx={f(x)} cy={f(y)} r={5.6} fill={`url(#${id}-gold)`} />
              <circle className="xmas-wreath-spark" cx={f(x - 1.8)} cy={f(y - 2)} r={1.1} />
            </g>
          ))}

          {/* The bow at the foot. */}
          <g
            className="xmas-wreath-bow"
            transform={`translate(${f(bx - 70 * BOW_SCALE)} ${f(by - 44 * BOW_SCALE)}) scale(${BOW_SCALE})`}
          >
            <path d={BOW_TAIL_L} fill={`url(#${id}-tail)`} />
            <path d={BOW_TAIL_R} fill={`url(#${id}-tail)`} />
            {["", MIRROR].map((t) => (
              <g key={t || "l"} transform={t || undefined}>
                <path d={BOW_LOOP} fill={`url(#${id}-satin)`} />
                <path d={BOW_HOLLOW} className="xmas-wreath-hollow" />
              </g>
            ))}
            <path d={BOW_KNOT} fill={`url(#${id}-knot)`} />
            <g clipPath={`url(#${id}-bow)`}>
              <rect className="xmas-wreath-sheen" x="-50" y="-20" width="34" height="150" fill={`url(#${id}-sheen)`} />
            </g>
          </g>
        </g>
      </svg>
      {children && <div className="xmas-loader-center">{children}</div>}
    </div>
  );
}

/* The falling snow, from the first frame of the loading screen — the page's
   own (SeasonalLayer) waits on the server for the switch, and is usually not
   up before the loading screen is gone. Not drawn if a page is already
   snowing, so it never falls twice as thick.

   Drawn on <body>, not where the loading screen is: the panel slides each
   page in with a transform (adminFadeUp, admin.css), and a transformed
   ancestor turns `position: fixed` into "fixed to that box" — the snow and
   its frost were boxed inside the content area, with a visible edge. */
function LoaderSnow() {
  const [snowing, setSnowing] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the DOM on mount
    setSnowing(document.querySelector(".xmas-overlay") !== null);
  }, []);
  return snowing ? null : createPortal(<SnowCanvas />, document.body);
}

const noSubscription = () => () => {};

export default function SeasonalLoader({ children }: { children?: ReactNode }) {
  // Off on the server, which cannot see the browser's storage; read on hydration.
  const on = useSyncExternalStore(noSubscription, recallSeason, () => false);
  if (!on) return <>{children}</>;
  return (
    <>
      <LoaderSnow />
      <Wreath className={children ? "xmas-loader xmas-loader--framed" : "xmas-loader"}>{children}</Wreath>
    </>
  );
}
