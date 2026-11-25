/* Shapes for the Christmas effect, drawn from a seed so each one is different
 * and the same one comes back on every render.
 *
 *  - `snowflakePath`: a six-armed dendrite crystal — a spine per arm with pairs
 *    of side branches at 60°, the angle ice actually grows at — in a unit
 *    circle, centred on 0,0. Meant to be stroked.
 *  - `frostPath`: feathered frost creeping out of a corner, the way it grows on
 *    a cold window: a few main stems, each throwing short spikes to both sides
 *    and splitting once or twice. Grows from 0,0 into +x/+y, in a unit square.
 *    Mirror it with a transform for the other corners.
 *
 * Both return a single SVG path of line segments, which also works as a Path2D
 * on a canvas. */

export function seeded(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const f = (v: number) => (Math.round(v * 1000) / 1000).toString();

export function snowflakePath(seed: number): string {
  const r = seeded(seed);
  // One arm, pointing up (−y). Every arm is the same arm turned by 60°.
  const segs: [number, number, number, number][] = [[0, 0, 0, -1]];
  const pairs = 2 + Math.floor(r() * 3);
  for (let i = 0; i < pairs; i++) {
    const t = 0.28 + (i / pairs) * 0.55 + r() * 0.06;
    const len = (1 - t) * (0.42 + r() * 0.28);
    const a = Math.PI / 3; // 60° off the spine
    for (const side of [-1, 1]) {
      const ex = side * Math.sin(a) * len;
      const ey = -t - Math.cos(a) * len;
      segs.push([0, -t, ex, ey]);
      // A small twig near the end of the longer branches.
      if (len > 0.22 && r() < 0.6) {
        const u = 0.55;
        const bx = side * Math.sin(a) * len * u;
        const by = -t - Math.cos(a) * len * u;
        const tl = len * 0.32;
        segs.push([bx, by, bx, by - tl]);
      }
    }
  }
  // A plate at the heart of many real flakes.
  const plate = 0.1 + r() * 0.08;

  let d = "";
  for (let k = 0; k < 6; k++) {
    const ang = (k * Math.PI) / 3;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    for (const [x1, y1, x2, y2] of segs) {
      d += `M${f(x1 * c - y1 * s)} ${f(x1 * s + y1 * c)}L${f(x2 * c - y2 * s)} ${f(x2 * s + y2 * c)}`;
    }
    const a1 = ang + Math.PI / 6;
    const a2 = ang + Math.PI / 2;
    d += `M${f(Math.cos(a1) * plate)} ${f(Math.sin(a1) * plate)}L${f(Math.cos(a2) * plate)} ${f(Math.sin(a2) * plate)}`;
  }
  return d;
}

export function frostPath(seed: number): string {
  const r = seeded(seed);
  let d = "";
  let budget = 260; // segments: enough to read as frost, few enough to stay cheap

  const grow = (x: number, y: number, ang: number, len: number, depth: number) => {
    const steps = 7;
    let cx = x;
    let cy = y;
    for (let i = 0; i < steps && budget > 0; i++) {
      ang += (r() - 0.5) * 0.22;
      const step = (len / steps) * (0.8 + r() * 0.4);
      const nx = cx + Math.cos(ang) * step;
      const ny = cy + Math.sin(ang) * step;
      d += `M${f(cx)} ${f(cy)}L${f(nx)} ${f(ny)}`;
      budget--;
      // Feathering: short spikes to both sides, shorter towards the tip.
      const spike = len * 0.16 * (1 - i / steps) * (0.6 + r() * 0.6);
      for (const side of [-1, 1]) {
        if (budget <= 0) break;
        const sa = ang + side * (0.9 + r() * 0.3);
        d += `M${f(nx)} ${f(ny)}L${f(nx + Math.cos(sa) * spike)} ${f(ny + Math.sin(sa) * spike)}`;
        budget--;
      }
      if (depth > 0 && (i === 2 || i === 4) && r() < 0.8) {
        grow(nx, ny, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.3), len * 0.5, depth - 1);
      }
      cx = nx;
      cy = ny;
    }
  };

  const stems = 3 + Math.floor(r() * 2);
  for (let i = 0; i < stems; i++) {
    const ang = 0.15 + (i / (stems - 1)) * 1.25 + (r() - 0.5) * 0.15;
    grow(0, 0, ang, 0.55 + r() * 0.4, 2);
  }
  return d;
}
