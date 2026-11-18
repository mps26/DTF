/**
 * Background removal for photos and artwork (JPEG, PNG, WEBP), on raw RGBA pixels.
 *
 * Designed for DTF artwork and product/portrait photos on plain, studio or
 * gradient backgrounds:
 *
 *  1. Denoise: decisions are made on a 3×3 box-blurred copy, so JPEG block
 *     artefacts and sensor noise do not break colour matching. Output pixels
 *     always come from the original image.
 *  2. Background palette: every border pixel is sampled and clustered (k-means),
 *     so gradients (sky → white), vignettes and two-tone backdrops are all
 *     recognised, not just the average of the four corners.
 *  3. Region growing from the image border only: a pixel joins the background if
 *     it is close to the palette, or if it continues a smooth gradient from an
 *     adjacent background pixel. Enclosed areas (white text inside a logo, a
 *     white shirt surrounded by the subject) are never reachable, so they stay.
 *  4. Clean-up: tiny isolated specks left in the background are removed.
 *  5. Edges: only a 2 px band along the cut gets a soft alpha, computed from how
 *     much background colour is mixed into each pixel relative to the nearby
 *     solid subject colour; the background is then un-mixed (no halo, no dark
 *     rim). The interior of the subject always stays fully opaque.
 */

export interface BackgroundRemovalOptions {
  /** Force a background colour instead of detecting it from the border. */
  targetColor?: { r: number; g: number; b: number };
  /** Colour tolerance (UI slider 5–80, default 25). Higher removes more. */
  tolerance?: number;
}

export interface BackgroundRemovalStats {
  removedFraction: number; // share of pixels made fully transparent
  palette: { r: number; g: number; b: number }[];
}

/** Perceptual-ish RGB distance ("redmean"), roughly on a 0–765 scale. */
function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3;
}

/** 3×3 box blur of the RGB channels (alpha ignored), separable sliding window. */
function boxBlurRgb(src: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const tmp = new Float32Array(w * h * 3);
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let c = 0; c < 3; c++) {
      for (let x = 0; x < w; x++) {
        const l = x > 0 ? src[(row + x - 1) * 4 + c] : src[(row + x) * 4 + c];
        const r = x < w - 1 ? src[(row + x + 1) * 4 + c] : src[(row + x) * 4 + c];
        tmp[(row + x) * 3 + c] = (l + src[(row + x) * 4 + c] + r) / 3;
      }
    }
  }
  const n3 = w * 3;
  for (let y = 0; y < h; y++) {
    const base = y * n3;
    const up = y > 0 ? base - n3 : base;
    const dn = y < h - 1 ? base + n3 : base;
    for (let k = 0; k < n3; k++) out[base + k] = Math.round((tmp[up + k] + tmp[base + k] + tmp[dn + k]) / 3);
  }
  return out;
}

/**
 * Typical colour difference between neighbouring pixels along the image border
 * (on the denoised copy): a robust estimate of the photo's grain / JPEG noise.
 * Large jumps (edges of a subject touching the border) are ignored.
 */
function borderGrain(sm: Uint8Array, w: number, h: number): number {
  const diffs: number[] = [];
  const at = (x: number, y: number) => (y * w + x) * 3;
  const row = Math.min(2, h - 1);
  const col = Math.min(2, w - 1);
  for (let x = 0; x + 1 < w; x += 2) {
    for (const y of [row, h - 1 - row]) {
      const a = at(x, y), b = at(x + 1, y);
      diffs.push(colorDist(sm[a], sm[a + 1], sm[a + 2], sm[b], sm[b + 1], sm[b + 2]));
    }
  }
  for (let y = 0; y + 1 < h; y += 2) {
    for (const x of [col, w - 1 - col]) {
      const a = at(x, y), b = at(x, y + 1);
      diffs.push(colorDist(sm[a], sm[a + 1], sm[a + 2], sm[b], sm[b + 1], sm[b + 2]));
    }
  }
  if (diffs.length === 0) return 0;
  diffs.sort((p, q) => p - q);
  return Math.min(8, diffs[Math.floor(diffs.length * 0.75)]);
}

/** Clusters border colours into up to `k` background colours (weighted k-means). */
function borderPalette(sm: Uint8Array, alpha: Uint8ClampedArray, w: number, h: number, chainDist: number, k = 6) {
  const samples: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (alpha[i * 4 + 3] === 0) return; // already transparent border: not a colour sample
    samples.push(sm[i * 3], sm[i * 3 + 1], sm[i * 3 + 2]);
  };
  const band = Math.max(1, Math.min(3, Math.floor(Math.min(w, h) / 50)));
  for (let b = 0; b < band; b++) {
    for (let x = 0; x < w; x++) {
      push(x, b);
      push(x, h - 1 - b);
    }
    for (let y = band; y < h - band; y++) {
      push(b, y);
      push(w - 1 - b, y);
    }
  }
  const n = samples.length / 3;
  if (n === 0) return [] as { r: number; g: number; b: number }[];

  // Farthest-point initialisation, then a few Lloyd iterations.
  const centers: number[][] = [[samples[0], samples[1], samples[2]]];
  while (centers.length < k) {
    let best = -1;
    let bestD = -1;
    for (let i = 0; i < n; i++) {
      let d = Infinity;
      for (const c of centers) d = Math.min(d, colorDist(samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2], c[0], c[1], c[2]));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD < 6) break; // border is essentially one colour
    centers.push([samples[best * 3], samples[best * 3 + 1], samples[best * 3 + 2]]);
  }
  const assign = new Int32Array(n);
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = colorDist(samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2], centers[c][0], centers[c][1], centers[c][2]);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      assign[i] = bi;
      sums[bi][0] += samples[i * 3];
      sums[bi][1] += samples[i * 3 + 1];
      sums[bi][2] += samples[i * 3 + 2];
      sums[bi][3]++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (sums[c][3] > 0) centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    }
  }
  const counts = new Array(centers.length).fill(0);
  for (let i = 0; i < n; i++) counts[assign[i]]++;
  // The dominant border colour is the backdrop. Other border colours count as
  // background only if they continue it smoothly (gradient / vignette steps) or
  // are themselves a major part of the border (two-tone backdrop). A subject that
  // touches the edge — e.g. shoulders across the bottom of a portrait — is a
  // minority, distinct colour and is therefore never taken as background.
  const clusters = centers
    .map((c, i) => ({ r: c[0], g: c[1], b: c[2], share: counts[i] / n }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
  const accepted = [clusters[0]];
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of clusters) {
      if (accepted.includes(c) || c.share < 0.03) continue;
      const nearAccepted = accepted.some((a) => colorDist(a.r, a.g, a.b, c.r, c.g, c.b) <= chainDist);
      if (nearAccepted || c.share >= 0.35) {
        accepted.push(c);
        changed = true;
      }
    }
  }
  return accepted.map(({ r, g, b }) => ({ r, g, b }));
}

/**
 * Removes the background in place (RGBA, row-major). Returns statistics.
 */
export function removeBackgroundPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  options: BackgroundRemovalOptions = {}
): BackgroundRemovalStats {
  const N = w * h;
  const tol = Math.max(1, Math.min(120, options.tolerance ?? 25));
  const sm = boxBlurRgb(data, w, h);

  const palette = options.targetColor ? [options.targetColor] : borderPalette(sm, data, w, h, tol * 1.2);
  const hasTransparentBorder = (() => {
    for (let x = 0; x < w; x++) if (data[x * 4 + 3] === 0 || data[((h - 1) * w + x) * 4 + 3] === 0) return true;
    for (let y = 0; y < h; y++) if (data[y * w * 4 + 3] === 0 || data[(y * w + w - 1) * 4 + 3] === 0) return true;
    return false;
  })();
  if (palette.length === 0 && !hasTransparentBorder) return { removedFraction: 0, palette: [] };

  // Distance of every pixel to the nearest background colour (on the denoised copy).
  const palDist = new Float32Array(N);
  const palIdx = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    let bd = Infinity;
    let bi = 0;
    for (let p = 0; p < palette.length; p++) {
      const d = colorDist(sm[i * 3], sm[i * 3 + 1], sm[i * 3 + 2], palette[p].r, palette[p].g, palette[p].b);
      if (d < bd) {
        bd = d;
        bi = p;
      }
    }
    palDist[i] = palette.length ? bd : Infinity;
    palIdx[i] = bi;
  }

  // --- Region growing from the border -------------------------------------
  const BG = 1;
  const mask = new Uint8Array(N); // 1 = background
  const queue = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  // A pixel matches the background directly within DIRECT. Gradients (sky,
  // vignette: well under 1 unit per pixel) are followed one pixel at a time when
  // the change is at most STEP; even a blurred subject edge changes several units
  // per pixel, so the fill can never creep into the subject.
  // Never go below the photo's own grain (measured along the border), otherwise
  // noisy JPEGs stall at low tolerance and leave patches of background.
  const grain = borderGrain(sm, w, h);
  const DIRECT = Math.max(tol * 0.4, grain * 2.5);
  const STEP = Math.max(1.5, tol * 0.06, grain * 1.5);
  const DRIFT = Math.max(tol * 2, DIRECT * 2);

  const isSeed = (i: number) => data[i * 4 + 3] === 0 || palDist[i] <= DIRECT;
  const seed = (i: number) => {
    if (!mask[i] && isSeed(i)) {
      mask[i] = BG;
      queue[qt++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }

  const tryGrow = (from: number, to: number) => {
    if (mask[to]) return;
    let ok = data[to * 4 + 3] === 0 || palDist[to] <= DIRECT;
    if (!ok && palDist[to] <= DRIFT) {
      const step = colorDist(sm[from * 3], sm[from * 3 + 1], sm[from * 3 + 2], sm[to * 3], sm[to * 3 + 1], sm[to * 3 + 2]);
      ok = step <= STEP;
    }
    if (ok) {
      mask[to] = BG;
      queue[qt++] = to;
    }
  };
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    if (x > 0) tryGrow(i, i - 1);
    if (x < w - 1) tryGrow(i, i + 1);
    if (i >= w) tryGrow(i, i - w);
    if (i < N - w) tryGrow(i, i + w);
  }

  // --- Remove tiny foreground specks left inside the background -------------
  // Each foreground region is measured completely; only regions that are both
  // tiny and background-coloured (JPEG noise) are removed. Real details stay.
  const minSpeck = Math.max(12, Math.round(N * 0.00015));
  const seen = new Uint8Array(N);
  const comp: number[] = [];
  for (let s = 0; s < N; s++) {
    if (mask[s] || seen[s] || data[s * 4 + 3] === 0) continue;
    comp.length = 0;
    comp.push(s);
    seen[s] = 1;
    let palSum = 0;
    for (let head = 0; head < comp.length; head++) {
      const i = comp[head];
      palSum += Math.min(palDist[i], 1000);
      const x = i % w;
      if (x > 0 && !seen[i - 1] && !mask[i - 1] && data[(i - 1) * 4 + 3] !== 0) { seen[i - 1] = 1; comp.push(i - 1); }
      if (x < w - 1 && !seen[i + 1] && !mask[i + 1] && data[(i + 1) * 4 + 3] !== 0) { seen[i + 1] = 1; comp.push(i + 1); }
      if (i >= w && !seen[i - w] && !mask[i - w] && data[(i - w) * 4 + 3] !== 0) { seen[i - w] = 1; comp.push(i - w); }
      if (i < N - w && !seen[i + w] && !mask[i + w] && data[(i + w) * 4 + 3] !== 0) { seen[i + w] = 1; comp.push(i + w); }
    }
    if (comp.length < minSpeck && palSum / comp.length <= DRIFT) {
      for (const i of comp) mask[i] = BG;
    }
  }

  // --- Alpha: background transparent, soft 2 px edge, interior untouched ---
  // Ring distance (Chebyshev, up to 3) from each subject pixel to the background,
  // built with three 8-neighbour passes (ring k touches ring k-1).
  const ring = new Uint8Array(N); // 0 = interior (>3 px away)
  for (let k = 1; k <= 3; k++) {
    for (let i = 0; i < N; i++) {
      if (mask[i] || ring[i]) continue;
      const x = i % w;
      const y = (i - x) / w;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
          const j = yy * w + xx;
          if (k === 1 ? mask[j] === BG : ring[j] === k - 1) {
            hit = true;
            break;
          }
        }
      }
      if (hit) ring[i] = k;
    }
  }

  let removed = 0;
  const out = new Uint8ClampedArray(data); // edge colours are estimated from the original pixels
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (mask[i]) {
      removed++;
      out[o + 3] = 0;
      continue;
    }
    if (palette.length === 0 || ring[i] === 0 || ring[i] > 2) continue;
    // Edge pixel = mix of background colour (bg) and subject colour (fg). fg is
    // sampled from nearby solid subject pixels (ring 3 / interior); the mix
    // ratio gives the alpha, and the background is un-mixed from the colour.
    const x = i % w;
    const y = (i - x) / w;
    let fr = 0, fgc = 0, fb = 0, fn = 0;
    for (let dy = -3; dy <= 3; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (mask[j] || (ring[j] !== 0 && ring[j] < 3)) continue;
        fr += data[j * 4]; fgc += data[j * 4 + 1]; fb += data[j * 4 + 2]; fn++;
      }
    }
    const bg = palette[palIdx[i]];
    let a = 1;
    if (fn > 0) {
      fr /= fn; fgc /= fn; fb /= fn;
      const vx = fr - bg.r, vy = fgc - bg.g, vz = fb - bg.b;
      const len2 = vx * vx + vy * vy + vz * vz;
      if (colorDist(fr, fgc, fb, bg.r, bg.g, bg.b) > DIRECT) {
        a = ((data[o] - bg.r) * vx + (data[o + 1] - bg.g) * vy + (data[o + 2] - bg.b) * vz) / len2;
        a = Math.max(0, Math.min(1, a));
      }
    }
    if (ring[i] === 2) a = Math.max(a, 0.5); // second ring is mostly subject
    if (a >= 0.98) continue;
    if (a > 0.04) {
      out[o] = Math.max(0, Math.min(255, Math.round(bg.r + (data[o] - bg.r) / a)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round(bg.g + (data[o + 1] - bg.g) / a)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round(bg.b + (data[o + 2] - bg.b) / a)));
    }
    out[o + 3] = Math.round(data[o + 3] * a);
  }
  data.set(out);

  return { removedFraction: removed / N, palette };
}
