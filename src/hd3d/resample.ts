/**
 * Exact area-average resampling to the print size. CMY and the two masks go through
 * the SAME pixel mapping, so the three layers can never drift apart.
 * Pure (no DOM): runs in Node tests and in the export worker.
 */

/** For each output column/row: the source span [start, end) in source pixels (fractional). */
function spans(src: number, dst: number): Float64Array {
  const s = new Float64Array(dst + 1);
  for (let i = 0; i <= dst; i++) s[i] = (i * src) / dst;
  return s;
}

/** Area weights of source pixel k inside [a, b). */
function forEachCovered(a: number, b: number, fn: (k: number, wgt: number) => void) {
  const k0 = Math.floor(a), k1 = Math.min(Math.ceil(b), Number.MAX_SAFE_INTEGER);
  for (let k = k0; k < k1; k++) {
    const wgt = Math.min(b, k + 1) - Math.max(a, k);
    if (wgt > 0) fn(k, wgt);
  }
}

/**
 * Resamples RGBA (straight alpha) to dw × dh. Colours are averaged with alpha
 * weighting (no dark/light fringes on soft edges).
 */
export function resampleRgba(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  if (sw === dw && sh === dh) return new Uint8ClampedArray(src);
  const xs = spans(sw, dw), ys = spans(sh, dh);
  // Horizontal pass into premultiplied float rows.
  const tmp = new Float32Array(dw * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0, tot = 0;
      forEachCovered(xs[x], xs[x + 1], (k, wgt) => {
        const o = (y * sw + Math.min(k, sw - 1)) * 4;
        const al = src[o + 3] * wgt;
        r += src[o] * al; g += src[o + 1] * al; b += src[o + 2] * al; a += al; tot += wgt;
      });
      const t = (y * dw + x) * 4;
      tmp[t] = r / tot; tmp[t + 1] = g / tot; tmp[t + 2] = b / tot; tmp[t + 3] = a / tot;
    }
  }
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let x = 0; x < dw; x++) {
    for (let y = 0; y < dh; y++) {
      let r = 0, g = 0, b = 0, a = 0, tot = 0;
      forEachCovered(ys[y], ys[y + 1], (k, wgt) => {
        const t = (Math.min(k, sh - 1) * dw + x) * 4;
        r += tmp[t] * wgt; g += tmp[t + 1] * wgt; b += tmp[t + 2] * wgt; a += tmp[t + 3] * wgt; tot += wgt;
      });
      const o = (y * dw + x) * 4;
      const al = a / tot;
      out[o + 3] = Math.round(al);
      if (al > 0) { out[o] = Math.round(r / tot / al); out[o + 1] = Math.round(g / tot / al); out[o + 2] = Math.round(b / tot / al); }
    }
  }
  return out;
}

/**
 * Resamples a binary mask to dw × dh: a print pixel gets 100 % ink when at least half
 * of its area is selected, otherwise 0 % (spot channels stay strictly 0 / 100 %).
 */
export function resampleMask(src: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  if (sw === dw && sh === dh) return new Uint8Array(src);
  const xs = spans(sw, dw), ys = spans(sh, dh);
  const tmp = new Float32Array(dw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      let v = 0, tot = 0;
      forEachCovered(xs[x], xs[x + 1], (k, wgt) => { v += src[y * sw + Math.min(k, sw - 1)] * wgt; tot += wgt; });
      tmp[y * dw + x] = v / tot;
    }
  }
  const out = new Uint8Array(dw * dh);
  for (let x = 0; x < dw; x++) {
    for (let y = 0; y < dh; y++) {
      let v = 0, tot = 0;
      forEachCovered(ys[y], ys[y + 1], (k, wgt) => { v += tmp[Math.min(k, sh - 1) * dw + x] * wgt; tot += wgt; });
      out[y * dw + x] = v / tot >= 127.5 ? 255 : 0;
    }
  }
  return out;
}
