"use client";
import "./seasonal.css";
import { useEffect, useRef } from "react";
import { snowflakePath } from "./crystals";

/* The falling snow, shared by the whole site: SeasonalLayer mounts it on every
 * page while `christmas_effect_active` is on, and the landing page's
 * ChristmasEffect mounts it there (so the content manager's unsaved switch is
 * what the preview shows).
 *
 * One canvas fixed over the page, in three depths, pushed aside by the
 * visitor's finger or cursor, paused while the tab is hidden, a still frame
 * under reduced motion. `snowBurst` throws a handful of particles from a point:
 * gold sparks for the sleigh, puffs of snow for a button shaking its cap off. */

let activeBurst: ((x: number, y: number, kind: BurstKind, count?: number) => void) | null = null;

export type BurstKind = "gold" | "snow";

/** `count` overrides how many particles: a button losing one small lump throws only a few. */
export function snowBurst(x: number, y: number, kind: BurstKind = "snow", count?: number) {
  activeBurst?.(x, y, kind, count);
}

type Flake = {
  x: number;
  y: number;
  z: number; // depth, 0 far … 1 near
  r: number;
  a: number;
  sprite: 0 | 1 | 2;
  phase: number;
  freq: number;
  amp: number;
  px: number; // push from the pointer, decays
  py: number;
  crystal: number; // -1 for a soft flake, else which crystal sprite
  rot: number;
  spin: number;
};

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; kind: BurstKind };


/* One soft disc per depth, drawn once and stamped for every flake. */
function makeSprite(rgb: string, kind: 0 | 1 | 2) {
  const size = kind === 2 ? 96 : 48;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  if (kind === 0) {
    grad.addColorStop(0, `rgba(${rgb}, 1)`);
    grad.addColorStop(0.45, `rgba(${rgb}, 0.8)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
  } else if (kind === 1) {
    grad.addColorStop(0, `rgba(${rgb}, 1)`);
    grad.addColorStop(0.3, `rgba(${rgb}, 0.75)`);
    grad.addColorStop(0.7, `rgba(${rgb}, 0.2)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
  } else {
    // A near flake out of focus: an even disc with a soft rim, like a lens sees it.
    grad.addColorStop(0, `rgba(${rgb}, 0.32)`);
    grad.addColorStop(0.72, `rgba(${rgb}, 0.26)`);
    grad.addColorStop(0.88, `rgba(${rgb}, 0.12)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/* A six-armed crystal, stroked once onto its own small canvas with a faint
   glow, then stamped and turned like the soft flakes. */
function makeCrystal(rgb: string, seed: number) {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  g.translate(size / 2, size / 2);
  g.scale(size * 0.44, size * 0.44);
  g.lineCap = "round";
  g.lineWidth = 0.075;
  g.strokeStyle = `rgba(${rgb}, 0.95)`;
  g.shadowColor = `rgba(${rgb}, 0.9)`;
  g.shadowBlur = 3;
  g.stroke(new Path2D(snowflakePath(seed)));
  return c;
}

function cssRgb(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function SnowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const snowRgb = cssRgb("--text-rgb", "248, 250, 252");
    const sparkRgb = cssRgb("--plan-2-rgb", "255, 215, 0");
    const sprites = [makeSprite(snowRgb, 0), makeSprite(snowRgb, 1), makeSprite(snowRgb, 2)];
    const crystals = [11, 23, 37, 53].map((seed) => makeCrystal(snowRgb, seed));

    let w = 0;
    let h = 0;
    let dpr = 1;
    const flakes: Flake[] = [];
    const sparks: Spark[] = [];
    const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, t: 0 };
    let raf = 0;
    let last = 0;

    const spawn = (f: Partial<Flake> = {}): Flake => {
      // More far flakes than near ones, the way a real snowfall reads.
      const z = Math.random() ** 1.7;
      const sprite: Flake["sprite"] = z > 0.93 ? 2 : z > 0.5 ? 1 : 0;
      const r =
        sprite === 2 ? 7 + Math.random() * 9 : sprite === 1 ? 1.6 + z * 2.4 : 0.6 + z * 2;
      const a = sprite === 2 ? 0.55 + Math.random() * 0.3 : sprite === 1 ? 0.75 + Math.random() * 0.25 : 0.35 + z * 0.6;
      /* Some of the nearer flakes are close enough to see as crystals —
         six arms, turning slowly as they fall. */
      const isCrystal = sprite === 1 && z > 0.7 && Math.random() < 0.45;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        z,
        r,
        a,
        sprite,
        phase: Math.random() * Math.PI * 2,
        freq: 0.4 + Math.random() * 0.9,
        amp: 6 + Math.random() * 18 * (0.4 + z),
        px: 0,
        py: 0,
        crystal: isCrystal ? Math.floor(Math.random() * crystals.length) : -1,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 1.2,
        ...(isCrystal ? { r: 4.5 + z * 5, a: 0.75 + Math.random() * 0.25 } : null),
        ...f,
      };
    };

    /* About one flake per 6000px² of screen: ~55 on a phone, capped at 160. */
    const targetCount = () => {
      let n = Math.round((w * h) / 6000);
      if ((navigator.hardwareConcurrency || 8) <= 4) n = Math.round(n * 0.7);
      n = Math.max(40, Math.min(160, n));
      return reduce ? Math.round(n * 0.5) : n;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = targetCount();
      if (flakes.length > n) flakes.length = n;
      while (flakes.length < n) flakes.push(spawn());
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        ctx.globalAlpha = f.a;
        const d = f.r * 2;
        if (f.crystal >= 0) {
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          ctx.drawImage(crystals[f.crystal], -f.r, -f.r, d, d);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else {
          ctx.drawImage(sprites[f.sprite], f.x - f.r, f.y - f.r, d, d);
        }
      }
      for (const s of sparks) {
        const k = s.life / s.max;
        if (s.kind === "snow") {
          // A puff of loose snow: soft flakes, no glow.
          ctx.globalAlpha = Math.min(1, k * 1.4);
          const d = s.r * 2;
          ctx.drawImage(sprites[1], s.x - s.r, s.y - s.r, d, d);
          continue;
        }
        ctx.globalAlpha = k;
        ctx.fillStyle = `rgba(${sparkRgb}, 1)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.4 + k * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = k * 0.6;
        ctx.drawImage(sprites[1], s.x - s.r * 3, s.y - s.r * 3, s.r * 6, s.r * 6);
      }
      ctx.globalAlpha = 1;
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const t = now / 1000;
      const wind = 18 * Math.sin(t * 0.21) + 10 * Math.sin(t * 0.63 + 1.3) + 6 * Math.sin(t * 1.7);
      const pointerFresh = now - pointer.t < 1200;

      for (const f of flakes) {
        const fall = 16 + f.z * 70;
        let dx = wind * (0.35 + f.z) + Math.cos(t * f.freq + f.phase) * f.amp * 0.6;
        let dy = fall;

        if (pointerFresh) {
          const ox = f.x - pointer.x;
          const oy = f.y - pointer.y;
          const R = 90 + f.z * 70;
          const d2 = ox * ox + oy * oy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const k = (1 - d / R) * (420 + f.z * 380);
            f.px += (ox / d) * k * dt + pointer.vx * 0.08 * (1 - d / R);
            f.py += (oy / d) * k * dt + pointer.vy * 0.08 * (1 - d / R);
          }
        }
        const decay = Math.exp(-2.6 * dt);
        f.px *= decay;
        f.py *= decay;
        dx += f.px;
        dy += f.py;

        f.x += dx * dt;
        f.y += dy * dt;
        f.rot += f.spin * dt;

        if (f.y > h + f.r * 2) Object.assign(f, spawn({ y: -f.r * 2 }));
        else if (f.y < -40) f.y = h + f.r;
        if (f.x > w + 30) f.x = -30;
        else if (f.x < -30) f.x = w + 30;
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += (s.kind === "snow" ? 520 : 260) * dt;
        s.vx *= Math.exp((s.kind === "snow" ? -2.4 : -1.4) * dt);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }

      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (reduce || raf) return;
      last = 0;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onPointer = (e: PointerEvent) => {
      const now = performance.now();
      const gap = Math.max(16, now - pointer.t);
      if (pointer.t && now - pointer.t < 200) {
        pointer.vx = ((e.clientX - pointer.x) / gap) * 1000;
        pointer.vy = ((e.clientY - pointer.y) / gap) * 1000;
      } else {
        pointer.vx = pointer.vy = 0;
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.t = now;
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        if (reduce) draw();
      }, 150);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    activeBurst = (x, y, kind, count) => {
      if (reduce) return;
      if (kind === "snow") {
        // Snow knocked off a ledge: a little powder, thrown up a touch, mostly falls.
        for (let i = 0; i < (count ?? 10); i++) {
          const max = 0.6 + Math.random() * 0.7;
          sparks.push({
            x: x + (Math.random() - 0.5) * 14,
            y: y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 90,
            vy: -30 - Math.random() * 70,
            life: max,
            max,
            r: 1.2 + Math.random() * 1.8,
            kind,
          });
        }
      } else {
        for (let i = 0; i < (count ?? 46); i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 80 + Math.random() * 260;
          const max = 0.8 + Math.random() * 0.9;
          sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, life: max, max, r: 1 + Math.random() * 2.2, kind });
        }
      }
      if (!raf) draw();
    };

    resize();
    if (reduce) draw();
    else start();

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      activeBurst = null;
      stop();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="xmas-overlay" aria-hidden="true">
      <canvas ref={canvasRef} className="xmas-snow" />
      <div className="xmas-frost" />
    </div>
  );
}
