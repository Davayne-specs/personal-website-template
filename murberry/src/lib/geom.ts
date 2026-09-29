export type Pt = {x: number; y: number};

export const pt = (x: number, y: number): Pt => ({x, y});
export const add = (a: Pt, b: Pt): Pt => ({x: a.x + b.x, y: a.y + b.y});
export const sub = (a: Pt, b: Pt): Pt => ({x: a.x - b.x, y: a.y - b.y});
export const mul = (a: Pt, k: number): Pt => ({x: a.x * k, y: a.y * k});
export const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
export const len = (a: Pt) => Math.hypot(a.x, a.y);
export const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return {x: a.x / l, y: a.y / l};
};
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const angleOf = (v: Pt) => deg(Math.atan2(v.y, v.x));

/** Rotate p by d degrees (SVG sense: clockwise on screen) about c. */
export const rotAbout = (p: Pt, d: number, c: Pt): Pt => {
  const r = rad(d);
  const cs = Math.cos(r);
  const sn = Math.sin(r);
  const v = sub(p, c);
  return {x: c.x + v.x * cs - v.y * sn, y: c.y + v.x * sn + v.y * cs};
};

/**
 * Two-bone inverse kinematics. Returns the elbow for a shoulder S reaching a
 * wrist target T with bone lengths l1, l2. side = +1 bends the elbow to the
 * clockwise side of the S->T line (below it, for an arm reaching right).
 */
export const solveIK = (S: Pt, T: Pt, l1: number, l2: number, side = 1) => {
  const v = sub(T, S);
  const dRaw = len(v);
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(l1 + l2 - 1e-3, dRaw));
  const base = Math.atan2(v.y, v.x);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const E = {
    x: S.x + l1 * Math.cos(base + side * a),
    y: S.y + l1 * Math.sin(base + side * a),
  };
  const W = add(S, mul(norm(v), Math.min(dRaw, l1 + l2)));
  return {E, W: dRaw > l1 + l2 ? W : T};
};

/** Keep the part of a polygon where dot(p, n) <= s (keepBelow) or >= s. */
export const clipHalfPlane = (
  poly: Pt[],
  n: Pt,
  s: number,
  keepBelow: boolean,
): Pt[] => {
  const inside = (p: Pt) => (keepBelow ? dot(p, n) <= s : dot(p, n) >= s);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const da = dot(a, n) - s;
      const db = dot(b, n) - s;
      const t = da / (da - db);
      out.push({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});
    }
  }
  return out;
};

/** Reflect p across the line dot(p, n) = s. */
export const reflect = (p: Pt, n: Pt, s: number): Pt => {
  const d = dot(p, n) - s;
  return {x: p.x - 2 * d * n.x, y: p.y - 2 * d * n.y};
};

export const polyPath = (poly: Pt[]) =>
  poly.length
    ? 'M ' + poly.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z'
    : '';

export const polyCss = (poly: Pt[]) =>
  `polygon(${poly.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(', ')})`;

/** Point on a cubic bezier. */
export const cubicAt = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
};

/** Point at fraction f of a polyline, by length. */
export const alongPolyline = (pts: Pt[], f: number): Pt => {
  const segs = pts.slice(1).map((p, i) => len(sub(p, pts[i])));
  const total = segs.reduce((a, b) => a + b, 0);
  let target = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] ? target / segs[i] : 0;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
      };
    }
    target -= segs[i];
  }
  return pts[pts.length - 1];
};
