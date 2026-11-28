/**
 * Clean-up of the AI background-removal matte using the image itself.
 * Pure functions on raw RGBA pixels (testable in Node).
 *
 * Why: the AI model predicts a soft matte. On glossy artwork (car paint, chrome,
 * white highlights) it is often unsure INSIDE the object, which leaves see-through
 * patches that look blurry/washed out on screen and print faded on DTF film.
 * It also tends to drop the white die-cut border of sticker artwork.
 *
 * Two cases:
 *  A. Plain background (stickers, logos, product shots on a flat backdrop).
 *     The background is found by growing from the image border:
 *       - pixels of the backdrop colour join;
 *       - the soft drop shadow around a sticker joins as long as it keeps getting
 *         darker, so the cut lands on the sticker's outline and the white sticker
 *         border inside it is kept;
 *       - a pixel the AI is confident belongs to the object never joins.
 *     Enclosed backdrop-coloured holes (inside letters) are cut only where the AI
 *     agrees they are background. Everything else becomes fully opaque, so the
 *     object is never see-through.
 *  B. Any other background (photos): the AI matte is kept, but semi-transparent
 *     pixels inside the object (more than EDGE px from the background) are made
 *     fully opaque. Soft edges (hair, fur) keep their alpha.
 */

const BG_TOL = 12; // max channel difference to count as the backdrop colour
const SHADOW_MAX = 60; // a drop shadow is at most this much darker than the backdrop
const SHADOW_CHROMA = 14; // shadow = backdrop darkened evenly on R, G and B
const AI_OBJECT = 200; // AI matte at/above this: definitely object, never removed
const EDGE = 2; // photos: soft-alpha band kept along the outside edge (px)
const HOLE_MIN = 6; // enclosed backdrop areas smaller than this (px) are noise, kept
const HOLE_AI_MAX = 64; // enclosed backdrop area is cut only if the AI's mean matte is below this (confident background)

export interface CutoutInfo {
  mode: 'plain-background' | 'photo';
  background?: { r: number; g: number; b: number };
}

/** Backdrop colour if the image border is (almost) one flat colour, else null. */
export function detectPlainBackground(
  rgba: Uint8ClampedArray,
  w: number,
  h: number
): { r: number; g: number; b: number } | null {
  const idx: number[] = [];
  for (let x = 0; x < w; x++) idx.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) idx.push(y * w, y * w + w - 1);
  // Most common colour (quantised to 8 levels per channel), then its exact mean.
  const counts = new Map<number, number>();
  let opaque = 0;
  for (const p of idx) {
    if (rgba[p * 4 + 3] < 250) continue;
    opaque++;
    const k = ((rgba[p * 4] >> 3) << 10) | ((rgba[p * 4 + 1] >> 3) << 5) | (rgba[p * 4 + 2] >> 3);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (opaque < idx.length * 0.95) return null; // already transparent / irregular border
  let bestK = -1, bestN = 0;
  counts.forEach((n, k) => { if (n > bestN) { bestN = n; bestK = k; } });
  let r = 0, g = 0, b = 0, n = 0;
  for (const p of idx) {
    const o = p * 4;
    const k = ((rgba[o] >> 3) << 10) | ((rgba[o + 1] >> 3) << 5) | (rgba[o + 2] >> 3);
    if (k === bestK) { r += rgba[o]; g += rgba[o + 1]; b += rgba[o + 2]; n++; }
  }
  const bg = { r: r / n, g: g / n, b: b / n };
  let near = 0;
  for (const p of idx) {
    const o = p * 4;
    if (Math.max(Math.abs(rgba[o] - bg.r), Math.abs(rgba[o + 1] - bg.g), Math.abs(rgba[o + 2] - bg.b)) <= BG_TOL) near++;
  }
  return near >= idx.length * 0.85 ? { r: Math.round(bg.r), g: Math.round(bg.g), b: Math.round(bg.b) } : null;
}

/**
 * Returns the final alpha (0–255 per pixel) from the AI alpha and the image.
 * `ai` is the AI matte after refineMatte (0 background … 255 object).
 */
export function refineCutout(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  ai: Uint8Array
): { alpha: Uint8Array; info: CutoutInfo } {
  const bg = detectPlainBackground(rgba, w, h);
  if (bg) return { alpha: plainBackgroundCut(rgba, w, h, ai, bg), info: { mode: 'plain-background', background: bg } };
  return { alpha: fillObjectInterior(ai, w, h), info: { mode: 'photo' } };
}

function plainBackgroundCut(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  ai: Uint8Array,
  bg: { r: number; g: number; b: number }
): Uint8Array {
  const N = w * h;
  const dist = new Uint8Array(N); // max channel difference from the backdrop
  const shadow = new Uint8Array(N); // evenly darker than the backdrop (drop shadow)
  const lum = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const o = p * 4;
    const dr = rgba[o] - bg.r, dg = rgba[o + 1] - bg.g, db = rgba[o + 2] - bg.b;
    dist[p] = Math.min(255, Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)));
    shadow[p] = dr <= 2 && dg <= 2 && db <= 2 && Math.max(dr, dg, db) - Math.min(dr, dg, db) <= SHADOW_CHROMA && dist[p] <= SHADOW_MAX ? 1 : 0;
    lum[p] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }

  // 1. Grow the background from the border.
  const outside = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  const seed = (p: number) => {
    if (!outside[p] && dist[p] <= BG_TOL && ai[p] < AI_OBJECT) { outside[p] = 1; queue[tail++] = p; }
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  const tryJoin = (p: number, q: number) => {
    if (outside[q] || ai[q] >= AI_OBJECT) return;
    const fromBackdrop = dist[p] <= BG_TOL;
    let ok: boolean;
    if (fromBackdrop) ok = dist[q] <= BG_TOL || shadow[q] === 1;
    else ok = shadow[q] === 1 && dist[q] > BG_TOL && lum[q] <= lum[p] + 1; // keep descending into the shadow
    if (ok) { outside[q] = 1; queue[tail++] = q; }
  };
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) tryJoin(p, p - 1);
    if (x < w - 1) tryJoin(p, p + 1);
    if (p >= w) tryJoin(p, p - w);
    if (p < N - w) tryJoin(p, p + w);
  }

  const alpha = new Uint8Array(N);
  for (let p = 0; p < N; p++) alpha[p] = outside[p] ? 0 : 255;

  // 2. Enclosed areas of the backdrop colour (the inside of letters such as
  //    O, A, B, e, ®, gaps between design parts) are cut only when the AI also
  //    sees them as background. Highlights on glossy artwork (headlights,
  //    windscreen reflections) are often exactly the backdrop colour too, but the
  //    AI marks those as object, so they stay.
  const seen = new Uint8Array(N);
  const comp: number[] = [];
  for (let s = 0; s < N; s++) {
    if (seen[s] || outside[s] || dist[s] > BG_TOL) continue;
    comp.length = 0;
    let aiSum = 0;
    seen[s] = 1;
    queue[0] = s;
    head = 0; tail = 1;
    while (head < tail) {
      const p = queue[head++];
      comp.push(p);
      aiSum += ai[p];
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1]) {
        if (q >= 0 && !seen[q] && !outside[q] && dist[q] <= BG_TOL) { seen[q] = 1; queue[tail++] = q; }
      }
    }
    if (comp.length >= HOLE_MIN && aiSum / comp.length < HOLE_AI_MAX) for (const p of comp) outside[p] = 1;
  }
  for (let p = 0; p < N; p++) alpha[p] = outside[p] ? 0 : 255;

  // 3. One-pixel anti-aliased rim on the outer cut (no jagged edge, no halo).
  for (let p = 0; p < N; p++) {
    if (alpha[p] !== 255) continue;
    const x = p % w;
    const touches = (x > 0 && alpha[p - 1] === 0) || (x < w - 1 && alpha[p + 1] === 0) || (p >= w && alpha[p - w] === 0) || (p < N - w && alpha[p + w] === 0);
    if (touches && dist[p] <= BG_TOL) alpha[p] = 128; // a backdrop-coloured rim pixel is half background
  }
  return alpha;
}

/** Photos: semi-transparent pixels deep inside the object become fully opaque. */
function fillObjectInterior(ai: Uint8Array, w: number, h: number): Uint8Array {
  const N = w * h;
  const out = new Uint8Array(ai);
  // Distance (in px, up to EDGE+1) from the background: background = AI alpha < 128
  // connected to the image border.
  const outside = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  const seed = (p: number) => { if (!outside[p] && ai[p] < 128) { outside[p] = 1; queue[tail++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1]) {
      if (q >= 0 && !outside[q] && ai[q] < 128) { outside[q] = 1; queue[tail++] = q; }
    }
  }
  const d = new Uint8Array(N).fill(255);
  head = 0; tail = 0;
  for (let p = 0; p < N; p++) if (outside[p]) { d[p] = 0; queue[tail++] = p; }
  while (head < tail) {
    const p = queue[head++];
    if (d[p] > EDGE) continue;
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1]) {
      if (q >= 0 && d[q] === 255) { d[q] = d[p] + 1; queue[tail++] = q; }
    }
  }
  for (let p = 0; p < N; p++) if (!outside[p] && d[p] > EDGE && out[p] > 0) out[p] = 255;
  return out;
}
