"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scratch/test_hd3d_pipeline.ts
var fs = __toESM(require("fs"), 1);

// src/hd3d/builtinTextures.ts
var S = 256;
var TAU = Math.PI * 2;
function make(fn) {
  const out = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      out[y * S + x] = Math.max(0, Math.min(255, Math.round(fn((x + 0.5) / S, (y + 0.5) / S) * 255)));
    }
  }
  return out;
}
function periodicNoise(seed, cells) {
  const rnd = new Float32Array(cells * cells);
  let s = seed >>> 0;
  for (let i = 0; i < rnd.length; i++) {
    s = s + 1831565813 >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    rnd[i] = ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const at = (i, j) => rnd[(j % cells + cells) % cells * cells + (i % cells + cells) % cells];
  const sm = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * cells, y = v * cells;
    const i = Math.floor(x), j = Math.floor(y);
    const fx = sm(x - i), fy = sm(y - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
var carbonFibre = () => make((u, v) => {
  const n = 8;
  const cx = Math.floor(u * n), cy = Math.floor(v * n);
  const fu = u * n - cx, fv = v * n - cy;
  const horizontal = (cx + cy & 3) < 2;
  const across = horizontal ? fv : fu;
  const along = horizontal ? fu : fv;
  const profile = Math.sin(Math.PI * across);
  const fibres = 0.12 * Math.sin(TAU * 6 * across);
  const end = Math.min(1, Math.sin(Math.PI * along) * 3);
  return 0.15 + 0.75 * profile * end + fibres;
});
var honeycomb = () => make((u, v) => {
  const cols = 6;
  const sx = u * cols, sy = v * cols * (Math.sqrt(3) / 2) * (2 / Math.sqrt(3));
  let best = 1e9, second = 1e9;
  for (let j = -1; j <= cols; j++) {
    for (let i = -1; i <= cols; i++) {
      const cxp = i + (j & 1 ? 0.5 : 0);
      const cyp = j;
      const d = Math.hypot(sx - cxp, sy - cyp);
      if (d < best) {
        second = best;
        best = d;
      } else if (d < second) second = d;
    }
  }
  const edge = second - best;
  return edge < 0.08 ? 1 : edge < 0.16 ? 1 - (edge - 0.08) / 0.08 * 0.75 : 0.25;
});
var diamondPlate = () => make((u, v) => {
  const n = 6;
  const cx = Math.floor(u * n), cy = Math.floor(v * n);
  let fu = u * n - cx - 0.5, fv = v * n - cy - 0.5;
  const flip = cx + cy & 1;
  const a = flip ? Math.PI / 4 : -Math.PI / 4;
  const ru = fu * Math.cos(a) - fv * Math.sin(a);
  const rv = fu * Math.sin(a) + fv * Math.cos(a);
  const d = Math.abs(ru) / 0.42 + Math.abs(rv) / 0.11;
  return d < 1 ? 0.55 + 0.45 * Math.sqrt(1 - d) : 0.12;
});
var knurled = () => make((u, v) => {
  const n = 16;
  const a = Math.abs(Math.sin(Math.PI * n * (u + v)));
  const b = Math.abs(Math.sin(Math.PI * n * (u - v)));
  return Math.min(a, b) ** 0.6;
});
var engravedGuilloche = () => make((u, v) => {
  const w12 = Math.sin(TAU * (u * 12 + 0.35 * Math.sin(TAU * v * 2)));
  const w22 = Math.sin(TAU * (v * 12 + 0.35 * Math.sin(TAU * u * 3)));
  const lines = Math.abs(w12 * 0.6 + w22 * 0.4);
  return lines < 0.25 ? 1 - lines / 0.25 * 0.4 : 0.15;
});
var pebbleEmboss = () => {
  const n1 = periodicNoise(7, 16), n2 = periodicNoise(11, 32), n3 = periodicNoise(23, 64);
  return make((u, v) => {
    const h = 0.55 * n1(u, v) + 0.3 * n2(u, v) + 0.15 * n3(u, v);
    return Math.min(1, Math.max(0, (h - 0.25) * 1.9));
  });
};
var concentricRings = () => make((u, v) => {
  const n = 2;
  const fu = u * n - Math.floor(u * n) - 0.5, fv = v * n - Math.floor(v * n) - 0.5;
  const r = Math.hypot(fu, fv);
  return 0.5 + 0.5 * Math.cos(TAU * r * 14);
});
var brushedMetal = () => {
  const n = periodicNoise(5, 256);
  return make((u, v) => {
    const streak = n(u * 0.0625, v) * 0.7 + n(u * 0.25, v * 0.5) * 0.3;
    return 0.2 + 0.8 * streak;
  });
};
var diamondLattice = () => make((u, v) => {
  const n = 10;
  const a = Math.abs((u + v) * n % 1 - 0.5);
  const b = Math.abs((u - v + 1) * n % 1 - 0.5);
  const line = Math.max(a, b);
  return line > 0.42 ? 1 : line > 0.36 ? (line - 0.36) / 0.06 : 0;
});
var halftoneDots = () => make((u, v) => {
  const n = 16;
  const row = Math.floor(v * n);
  const fu = (u * n + (row & 1) * 0.5) % 1 - 0.5, fv = v * n - row - 0.5;
  const r = Math.hypot(fu, fv);
  return r < 0.3 ? 1 : r < 0.36 ? 1 - (r - 0.3) / 0.06 : 0;
});
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function hash(i, j, k) {
  let h = i * 374761393 + j * 668265263 + k * 2147483647 | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
var fernFoliage = () => {
  const n = 4;
  const segs = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    for (let f2 = 0; f2 < 2; f2++) {
      const cx = (i + 0.25 + 0.5 * hash(i, j, f2 * 3 + 1)) / n, cy = (j + 0.25 + 0.5 * hash(i, j, f2 * 3 + 2)) / n;
      const ang = -Math.PI / 2 + (hash(i, j, f2 * 3 + 3) - 0.5) * 1.6;
      const L = 0.2 + 0.08 * hash(i, j, f2 + 9);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const sx = cx - dx * L / 2, sy = cy - dy * L / 2;
      segs.push([sx, sy, sx + dx * L, sy + dy * L, 6e-3]);
      const leaves = 9;
      for (let k = 1; k <= leaves; k++) {
        const t = k / (leaves + 1);
        const px = sx + dx * L * t, py = sy + dy * L * t;
        const len = 0.055 * (1 - t * 0.75);
        for (const side of [-1, 1]) {
          const la = ang + side * 0.95;
          segs.push([px, py, px + Math.cos(la) * len, py + Math.sin(la) * len, 45e-4]);
        }
      }
    }
  }
  const f = new Float32Array(S * S);
  for (const [ax, ay, bx, by, wd] of segs) {
    const pad = wd * 1.8;
    const x0 = Math.floor((Math.min(ax, bx) - pad) * S), x1 = Math.ceil((Math.max(ax, bx) + pad) * S);
    const y0 = Math.floor((Math.min(ay, by) - pad) * S), y1 = Math.ceil((Math.max(ay, by) + pad) * S);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = segDist((x + 0.5) / S, (y + 0.5) / S, ax, ay, bx, by);
      if (d >= pad) continue;
      const val = 1 - d / pad;
      const i = (y % S + S) % S * S + (x % S + S) % S;
      if (val > f[i]) f[i] = val;
    }
  }
  const out = new Uint8Array(S * S);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, f[i])) * 255);
  return out;
};
var floralLace = () => make((u, v) => {
  const n = 3;
  const fu = u * n % 1 - 0.5, fv = v * n % 1 - 0.5;
  const r = Math.hypot(fu, fv), th = Math.atan2(fv, fu);
  const petal = 0.36 * (0.62 + 0.38 * Math.cos(6 * th));
  const line = (d, w) => Math.max(0, 1 - d / (w * 1.6));
  const outline = line(Math.abs(r - petal), 0.018);
  const ring = line(Math.abs(r - 0.1), 0.014);
  const corner = line(Math.hypot(Math.abs(fu) - 0.5, Math.abs(fv) - 0.5) - 0.05, 0.02);
  const vein = r < petal ? line(Math.abs(Math.sin(6 * th / 2)) * r, 0.01) * (r > 0.1 ? 1 : 0) : 0;
  return Math.max(outline, ring, corner, vein);
});
var DEFS = [
  { id: "builtin-fern-foliage", name: "Fern Foliage", category: "Fine 3D pattern", gen: fernFoliage },
  { id: "builtin-floral-lace", name: "Floral Lace", category: "Decorative engraved", gen: floralLace },
  { id: "builtin-diamond-lattice", name: "Diamond Lattice", category: "Fine 3D pattern", gen: diamondLattice },
  { id: "builtin-halftone", name: "Halftone Dots", category: "Fine 3D pattern", gen: halftoneDots },
  { id: "builtin-carbon-fibre", name: "Carbon Fibre Weave", category: "Carbon fibre", gen: carbonFibre },
  { id: "builtin-honeycomb", name: "Honeycomb", category: "Honeycomb", gen: honeycomb },
  { id: "builtin-diamond-plate", name: "Diamond Tread Plate", category: "Mechanical", gen: diamondPlate },
  { id: "builtin-brushed-metal", name: "Brushed Metal", category: "Mechanical", gen: brushedMetal },
  { id: "builtin-knurled", name: "Fine Knurl", category: "Fine 3D pattern", gen: knurled },
  { id: "builtin-pebble-emboss", name: "Pebble Emboss", category: "Raised emboss", gen: pebbleEmboss },
  { id: "builtin-guilloche", name: "Engraved Guilloche", category: "Decorative engraved", gen: engravedGuilloche },
  { id: "builtin-rings", name: "Engraved Rings", category: "Decorative engraved", gen: concentricRings }
];
var cache = null;
function builtInTextures() {
  if (!cache) {
    cache = DEFS.map((d) => ({ id: d.id, name: d.name, category: d.category, size: S, tile: d.gen(), builtIn: true }));
  }
  return cache;
}

// src/hd3d/maskOps.ts
function emptyMask(w, h) {
  return new Uint8Array(w * h);
}
function countOn(m) {
  let n = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) n++;
  return n;
}
function paintDisc(m, w, h, cx, cy, r, value) {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * w;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) m[row + x] = value;
    }
  }
}
function paintStroke(m, w, h, x0, y0, x1, y1, r, value) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const step = Math.max(0.5, r / 3);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    paintDisc(m, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, value);
  }
}
function selectArtwork(rgba2, w, h, alphaMin = 128) {
  const m = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (rgba2[p * 4 + 3] >= alphaMin) m[p] = 255;
  return m;
}
function selectObject(rgba2, w, h, x, y, tol, alphaMin = 128) {
  const N = w * h;
  const m = new Uint8Array(N);
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return m;
  const s0 = y * w + x;
  if (rgba2[s0 * 4 + 3] < alphaMin) return m;
  const r = rgba2[s0 * 4], g = rgba2[s0 * 4 + 1], b = rgba2[s0 * 4 + 2];
  const ok = (q) => {
    const o = q << 2;
    return rgba2[o + 3] >= alphaMin && Math.abs(rgba2[o] - r) <= tol && Math.abs(rgba2[o + 1] - g) <= tol && Math.abs(rgba2[o + 2] - b) <= tol;
  };
  const stack = new Int32Array(Math.max(1024, Math.min(N, 1 << 22)));
  let sp = 0;
  let st = stack;
  const push = (q) => {
    if (sp >= st.length) {
      const g2 = new Int32Array(st.length * 2);
      g2.set(st);
      st = g2;
    }
    st[sp++] = q;
  };
  push(s0);
  while (sp > 0) {
    const p = st[--sp];
    if (m[p]) continue;
    const row = p - p % w;
    let l = p, rr = p;
    while (l > row && !m[l - 1] && ok(l - 1)) l--;
    while (rr < row + w - 1 && !m[rr + 1] && ok(rr + 1)) rr++;
    let upOpen = false, downOpen = false;
    for (let q = l; q <= rr; q++) {
      m[q] = 255;
      if (q >= w) {
        const u = q - w;
        const can = !m[u] && ok(u);
        if (can && !upOpen) push(u);
        upOpen = can;
      }
      if (q < N - w) {
        const d = q + w;
        const can = !m[d] && ok(d);
        if (can && !downOpen) push(d);
        downOpen = can;
      }
    }
  }
  return m;
}
function combineInto(target, sel, mode) {
  for (let i = 0; i < target.length; i++) {
    const s = sel[i] !== 0;
    if (mode === "add") {
      if (s) target[i] = 255;
    } else if (mode === "subtract") {
      if (s) target[i] = 0;
    } else if (mode === "replace") target[i] = s ? 255 : 0;
    else target[i] = target[i] && s ? 255 : 0;
  }
}
function distanceTransform(d, w, h) {
  const INF = 1e20;
  const n = Math.max(w, h);
  const f = new Float32Array(n), dd = new Float32Array(n), z = new Float32Array(n + 1);
  const v = new Int32Array(n);
  const pass = (len) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      const fq = f[q] + q * q;
      let vk = v[k];
      let s = (fq - (f[vk] + vk * vk)) / (2 * q - 2 * vk);
      while (s <= z[k]) {
        k--;
        vk = v[k];
        s = (fq - (f[vk] + vk * vk)) / (2 * q - 2 * vk);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      const vk = v[k];
      dd[q] = (q - vk) * (q - vk) + f[vk];
    }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0, p = x; y < h; y++, p += w) f[y] = d[p];
    pass(h);
    for (let y = 0, p = x; y < h; y++, p += w) d[p] = dd[y];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = d[row + x];
    pass(w);
    for (let x = 0; x < w; x++) d[row + x] = dd[x];
  }
  return d;
}
function growShrink(m, w, h, px, limit) {
  const out = new Uint8Array(m.length);
  if (px === 0) {
    out.set(m);
    return out;
  }
  const d = new Float32Array(m.length);
  const BIG = 1e20;
  const r2 = px * px;
  if (px > 0) {
    for (let p = 0; p < m.length; p++) d[p] = m[p] ? 0 : BIG;
    distanceTransform(d, w, h);
    for (let p = 0; p < m.length; p++) out[p] = d[p] <= r2 && (!limit || limit[p] || m[p]) ? 255 : 0;
  } else {
    for (let p = 0; p < m.length; p++) d[p] = m[p] ? BIG : 0;
    distanceTransform(d, w, h);
    for (let p = 0; p < m.length; p++) out[p] = m[p] && d[p] > r2 ? 255 : 0;
  }
  return out;
}
function tileValue(tile, size, x, y, t) {
  const tx = Math.floor((x - t.offsetX) / t.scale);
  const ty = Math.floor((y - t.offsetY) / t.scale);
  const u = (tx % size + size) % size;
  const v = (ty % size + size) % size;
  return tile[v * size + u];
}
function patternThreshold(intensity) {
  return Math.round(255 * (1 - Math.max(0, Math.min(1, intensity))));
}
function maskWithTextures(base, w, h, artwork, textures, target, lookup2) {
  const out = new Uint8Array(base);
  for (const t of textures) {
    if (t.target !== target) continue;
    const tex2 = lookup2(t.textureId);
    if (!tex2) continue;
    const thr = patternThreshold(t.intensity);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const p = row + x;
        if (!t.clip[p]) continue;
        out[p] = artwork[p] && tileValue(tex2.tile, tex2.size, x, y, t) > thr ? 255 : 0;
      }
    }
  }
  return out;
}
function finalMasks(rgba2, w, h, layers2, lookup2, artworkMask) {
  const artwork = artworkMask ?? selectArtwork(rgba2, w, h, 1);
  const w12 = maskWithTextures(layers2.w1, w, h, artwork, layers2.textures, "w1", lookup2);
  const w2raw = maskWithTextures(layers2.w2, w, h, artwork, layers2.textures, "w2", lookup2);
  if (layers2.w2ExcludesW1) {
    for (let i = 0; i < w2raw.length; i++) if (w12[i]) w2raw[i] = 0;
  }
  return { w1: w12, w2: w2raw };
}
function bakeCmy(rgba2, _w, _h, _textures, _lookup) {
  return rgba2;
}

// src/hd3d/resample.ts
function spans(src, dst) {
  const s = new Float64Array(dst + 1);
  for (let i = 0; i <= dst; i++) s[i] = i * src / dst;
  return s;
}
function forEachCovered(a, b, fn) {
  const k0 = Math.floor(a), k1 = Math.min(Math.ceil(b), Number.MAX_SAFE_INTEGER);
  for (let k = k0; k < k1; k++) {
    const wgt = Math.min(b, k + 1) - Math.max(a, k);
    if (wgt > 0) fn(k, wgt);
  }
}
function resampleRgba(src, sw, sh, dw, dh) {
  if (sw === dw && sh === dh) return new Uint8ClampedArray(src);
  const xs = spans(sw, dw), ys = spans(sh, dh);
  const tmp = new Float32Array(dw * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0, tot = 0;
      forEachCovered(xs[x], xs[x + 1], (k, wgt) => {
        const o = (y * sw + Math.min(k, sw - 1)) * 4;
        const al = src[o + 3] * wgt;
        r += src[o] * al;
        g += src[o + 1] * al;
        b += src[o + 2] * al;
        a += al;
        tot += wgt;
      });
      const t = (y * dw + x) * 4;
      tmp[t] = r / tot;
      tmp[t + 1] = g / tot;
      tmp[t + 2] = b / tot;
      tmp[t + 3] = a / tot;
    }
  }
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let x = 0; x < dw; x++) {
    for (let y = 0; y < dh; y++) {
      let r = 0, g = 0, b = 0, a = 0, tot = 0;
      forEachCovered(ys[y], ys[y + 1], (k, wgt) => {
        const t = (Math.min(k, sh - 1) * dw + x) * 4;
        r += tmp[t] * wgt;
        g += tmp[t + 1] * wgt;
        b += tmp[t + 2] * wgt;
        a += tmp[t + 3] * wgt;
        tot += wgt;
      });
      const o = (y * dw + x) * 4;
      const al = a / tot;
      out[o + 3] = Math.round(al);
      if (al > 0) {
        out[o] = Math.round(r / tot / al);
        out[o + 1] = Math.round(g / tot / al);
        out[o + 2] = Math.round(b / tot / al);
      }
    }
  }
  return out;
}
function resampleMask(src, sw, sh, dw, dh) {
  if (sw === dw && sh === dh) return new Uint8Array(src);
  const xs = spans(sw, dw), ys = spans(sh, dh);
  const tmp = new Float32Array(dw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      let v = 0, tot = 0;
      forEachCovered(xs[x], xs[x + 1], (k, wgt) => {
        v += src[y * sw + Math.min(k, sw - 1)] * wgt;
        tot += wgt;
      });
      tmp[y * dw + x] = v / tot;
    }
  }
  const out = new Uint8Array(dw * dh);
  for (let x = 0; x < dw; x++) {
    for (let y = 0; y < dh; y++) {
      let v = 0, tot = 0;
      forEachCovered(ys[y], ys[y + 1], (k, wgt) => {
        v += tmp[Math.min(k, sh - 1) * dw + x] * wgt;
        tot += wgt;
      });
      out[y * dw + x] = v / tot >= 127.5 ? 255 : 0;
    }
  }
  return out;
}

// src/hd3d/tiffWriter.ts
function lzwEncode(src) {
  const CLEAR = 256, EOI = 257;
  const dict = new Int32Array(4096 * 256);
  const used = [];
  let out = new Uint8Array(Math.max(64, src.length * 3 >> 1));
  let o = 0, acc = 0, accBits = 0;
  let nbits = 9, next = 258, maxcode = 511;
  const put = (code) => {
    acc = acc << nbits | code;
    accBits += nbits;
    while (accBits >= 8) {
      if (o >= out.length) {
        const g = new Uint8Array(out.length * 2);
        g.set(out);
        out = g;
      }
      out[o++] = acc >>> accBits - 8 & 255;
      accBits -= 8;
    }
    acc &= (1 << accBits) - 1;
  };
  put(CLEAR);
  if (src.length === 0) {
    put(EOI);
    if (accBits) out[o++] = acc << 8 - accBits & 255;
    return out.slice(0, o);
  }
  let w = src[0];
  for (let i = 1; i < src.length; i++) {
    const b = src[i];
    const key = w << 8 | b;
    const hit = dict[key];
    if (hit) {
      w = hit - 1;
      continue;
    }
    put(w);
    dict[key] = next + 1;
    used.push(key);
    next++;
    if (next === 4094) {
      put(CLEAR);
      for (const k of used) dict[k] = 0;
      used.length = 0;
      next = 258;
      nbits = 9;
      maxcode = 511;
    } else if (next > maxcode) {
      nbits++;
      maxcode = (1 << nbits) - 1;
    }
    w = b;
  }
  put(w);
  if (next + 1 > maxcode && nbits < 12) nbits++;
  put(EOI);
  if (accBits) out[o++] = acc << 8 - accBits & 255;
  return out.slice(0, o);
}
function lzwDecode(src, expected) {
  const out = new Uint8Array(expected);
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), first = new Uint8Array(4096), length = new Int32Array(4096);
  for (let i = 0; i < 256; i++) {
    prefix[i] = -1;
    suffix[i] = i;
    first[i] = i;
    length[i] = 1;
  }
  let o = 0, pos = 0, bitBuf = 0, bitCnt = 0;
  let nbits = 9, next = 258, prev = -1;
  const read = () => {
    while (bitCnt < nbits) {
      if (pos >= src.length) return 257;
      bitBuf = (bitBuf << 8 | src[pos++]) >>> 0;
      bitCnt += 8;
    }
    const code = bitBuf >>> bitCnt - nbits & (1 << nbits) - 1;
    bitCnt -= nbits;
    bitBuf &= (1 << bitCnt) - 1;
    return code;
  };
  const emit = (code) => {
    const len = length[code];
    let c = code;
    for (let k = len - 1; k >= 0; k--) {
      if (o + k < expected) out[o + k] = suffix[c];
      c = prefix[c];
    }
    o += len;
  };
  while (o < expected) {
    const code = read();
    if (code === 257) break;
    if (code === 256) {
      nbits = 9;
      next = 258;
      prev = -1;
      continue;
    }
    if (prev < 0) {
      emit(code);
      prev = code;
      continue;
    }
    if (code < next) {
      emit(code);
      prefix[next] = prev;
      suffix[next] = first[code];
      first[next] = first[prev];
      length[next] = length[prev] + 1;
    } else {
      prefix[next] = prev;
      suffix[next] = first[prev];
      first[next] = first[prev];
      length[next] = length[prev] + 1;
      emit(next);
    }
    next++;
    if (next + 1 > (1 << nbits) - 1 && nbits < 12) nbits++;
    prev = code;
  }
  return out;
}
function packBits(src) {
  const out = new Uint8Array(src.length * 2 + 2);
  let o = 0, i = 0;
  const n = src.length;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 128 && src[i + run] === src[i]) run++;
    if (run >= 2) {
      out[o++] = 257 - run & 255;
      out[o++] = src[i];
      i += run;
      continue;
    }
    const start = i;
    let len = 0;
    while (i < n && len < 128) {
      if (i + 1 < n && src[i] === src[i + 1]) break;
      i++;
      len++;
    }
    out[o++] = len - 1;
    out.set(src.subarray(start, start + len), o);
    o += len;
  }
  return out.slice(0, o);
}
function unpackBits(src, expected) {
  const out = new Uint8Array(expected);
  let i = 0, o = 0;
  while (i < src.length && o < expected) {
    const c = src[i++];
    if (c < 128) {
      const len = c + 1;
      out.set(src.subarray(i, i + len), o);
      i += len;
      o += len;
    } else if (c > 128) {
      const len = 257 - c;
      out.fill(src[i++], o, o + len);
      o += len;
    }
  }
  return out;
}
function pascal(name) {
  const bytes = Array.from(name).map((c) => c.charCodeAt(0) & 255).slice(0, 255);
  return [bytes.length, ...bytes];
}
function resource(id, data) {
  const out = [56, 66, 73, 77, id >> 8 & 255, id & 255, 0, 0];
  const len = data.length;
  out.push(len >>> 24 & 255, len >>> 16 & 255, len >>> 8 & 255, len & 255, ...data);
  if (len % 2) out.push(0);
  return out;
}
function photoshopChannelResources(extra) {
  const names = [];
  for (const c of extra) names.push(...pascal(c.name));
  const uni = [];
  for (const c of extra) {
    const s = c.name + "\0";
    uni.push(s.length >>> 24 & 255, s.length >>> 16 & 255, s.length >>> 8 & 255, s.length & 255);
    for (let i = 0; i < s.length; i++) uni.push(s.charCodeAt(i) >> 8 & 255, s.charCodeAt(i) & 255);
  }
  const di = [0, 0, 0, 1];
  for (const c of extra) {
    const [r, g, b] = c.display ?? (c.kind === "spot" ? [255, 0, 0] : [0, 0, 0]);
    di.push(0, 0, r, r, g, g, b, b, 0, 0, 0, 100, c.kind === "spot" ? 2 : 0);
  }
  return new Uint8Array([...resource(1006, names), ...resource(1045, uni), ...resource(1077, di)]);
}
var TiffStripWriter = class {
  constructor(spec) {
    this.spec = spec;
    this.spp = (spec.photometric === "rgb" ? 3 : 1) + spec.extra.length;
    this.stripCount = Math.ceil(spec.height / spec.rowsPerStrip);
  }
  parts = [];
  offsets = [];
  counts = [];
  pos = 8;
  // after the header
  written = 0;
  spp;
  stripCount;
  /** Raw interleaved bytes (rows × width × spp) for the next strip. */
  addStrip(raw) {
    const rows = Math.min(this.spec.rowsPerStrip, this.spec.height - this.written);
    const expected = rows * this.spec.width * this.spp;
    if (raw.length !== expected) throw new Error(`TIFF strip has ${raw.length} bytes, expected ${expected}`);
    const packed = lzwEncode(raw);
    this.parts.push(packed);
    this.offsets.push(this.pos);
    this.counts.push(packed.length);
    this.pos += packed.length;
    this.written += rows;
  }
  /** Header + strips + IFD, ready for `new Blob(parts, { type: 'image/tiff' })`. */
  finish() {
    if (this.written !== this.spec.height) throw new Error("TIFF is missing strips");
    const { width, height, dpi, photometric, extra, rowsPerStrip } = this.spec;
    const spp = this.spp;
    const software = (this.spec.software ?? "DTF Set Files 3D HD") + "\0";
    const irb = extra.length ? photoshopChannelResources(extra) : null;
    let dataEnd = this.pos;
    const pad = dataEnd % 2;
    dataEnd += pad;
    const u16 = (vals) => {
      const b = new Uint8Array(vals.length * 2);
      const v = new DataView(b.buffer);
      vals.forEach((x, i) => v.setUint16(i * 2, x, true));
      return b;
    };
    const u32 = (vals) => {
      const b = new Uint8Array(vals.length * 4);
      const v = new DataView(b.buffer);
      vals.forEach((x, i) => v.setUint32(i * 4, x, true));
      return b;
    };
    const entries = [
      { tag: 256, type: 4, count: 1, bytes: u32([width]) },
      { tag: 257, type: 4, count: 1, bytes: u32([height]) },
      { tag: 258, type: 3, count: spp, bytes: u16(new Array(spp).fill(8)) },
      { tag: 259, type: 3, count: 1, bytes: u16([5]) },
      // LZW
      { tag: 262, type: 3, count: 1, bytes: u16([photometric === "rgb" ? 2 : 1]) },
      { tag: 273, type: 4, count: this.offsets.length, bytes: u32(this.offsets) },
      { tag: 277, type: 3, count: 1, bytes: u16([spp]) },
      { tag: 278, type: 4, count: 1, bytes: u32([rowsPerStrip]) },
      { tag: 279, type: 4, count: this.counts.length, bytes: u32(this.counts) },
      { tag: 282, type: 5, count: 1, bytes: u32([Math.round(dpi * 100), 100]) },
      { tag: 283, type: 5, count: 1, bytes: u32([Math.round(dpi * 100), 100]) },
      { tag: 284, type: 3, count: 1, bytes: u16([1]) },
      { tag: 296, type: 3, count: 1, bytes: u16([2]) },
      { tag: 305, type: 2, count: software.length, bytes: new Uint8Array(Array.from(software).map((c) => c.charCodeAt(0) & 127)) }
    ];
    if (extra.length) {
      entries.push({ tag: 338, type: 3, count: extra.length, bytes: u16(extra.map((c) => c.kind === "alpha" ? 2 : 0)) });
    }
    if (irb) entries.push({ tag: 34377, type: 1, count: irb.length, bytes: irb });
    const ifdOffset = dataEnd;
    const ifdSize = 2 + entries.length * 12 + 4;
    let extOffset = ifdOffset + ifdSize;
    const ifd = new Uint8Array(ifdSize);
    const iv = new DataView(ifd.buffer);
    iv.setUint16(0, entries.length, true);
    const ext = [];
    entries.forEach((e, i) => {
      const o = 2 + i * 12;
      iv.setUint16(o, e.tag, true);
      iv.setUint16(o + 2, e.type, true);
      iv.setUint32(o + 4, e.count, true);
      if (e.bytes.length <= 4) {
        ifd.set(e.bytes, o + 8);
      } else {
        iv.setUint32(o + 8, extOffset, true);
        const padded = e.bytes.length % 2 ? new Uint8Array([...e.bytes, 0]) : e.bytes;
        ext.push(padded);
        extOffset += padded.length;
      }
    });
    iv.setUint32(2 + entries.length * 12, 0, true);
    const header = new Uint8Array(8);
    const hv = new DataView(header.buffer);
    hv.setUint16(0, 18761, false);
    hv.setUint16(2, 42, true);
    hv.setUint32(4, ifdOffset, true);
    const out = [header, ...this.parts];
    if (pad) out.push(new Uint8Array(1));
    out.push(ifd, ...ext);
    this.parts = [];
    return out;
  }
};

// src/hd3d/sheetCompose.ts
var MM_PER_INCH = 25.4;
var W1_INFO = { name: "W1", kind: "spot", display: [255, 255, 255] };
var W2_INFO = { name: "W2", kind: "spot", display: [0, 174, 239] };
var ALPHA_INFO = { name: "Transparency", kind: "alpha" };
function placementBox(p, dpi) {
  const k = dpi / MM_PER_INCH;
  return { x: Math.round(p.xMm * k), y: Math.round(p.yMm * k), w: Math.max(1, Math.round(p.widthMm * k)), h: Math.max(1, Math.round(p.heightMm * k)) };
}
function composeSheets(job2, onProgress, isCancelled) {
  const dpi = job2.dpi;
  const W2 = Math.round(job2.sheetWidthIn * dpi);
  const H2 = Math.round(job2.sheetLengthIn * dpi);
  const rows = job2.rowsPerStrip ?? 64;
  const designs = new Map(job2.designs.map((d) => [d.id, d]));
  const rasters = /* @__PURE__ */ new Map();
  const files = [];
  const stats = [];
  const spotOn = job2.invertSpots ? 0 : 255;
  const spotOff = job2.invertSpots ? 255 : 0;
  const rasterFor = (designId, w, h) => {
    const key = `${designId}:${w}x${h}`;
    let r = rasters.get(key);
    if (!r) {
      const d = designs.get(designId);
      if (!d) throw new Error(`Design ${designId} is missing`);
      r = {
        w,
        h,
        rgba: resampleRgba(d.rgba, d.width, d.height, w, h),
        w1: resampleMask(d.w1, d.width, d.height, w, h),
        w2: resampleMask(d.w2, d.width, d.height, w, h)
      };
      if (d.w2ExcludesW1) {
        for (let i = 0; i < r.w2.length; i++) if (r.w1[i]) r.w2[i] = 0;
      }
      rasters.set(key, r);
    }
    return r;
  };
  const totalSheets = job2.sheets.length;
  job2.sheets.forEach((placements, sIdx) => {
    const boxes = placements.map((p) => {
      const b = placementBox(p, dpi);
      const raster = p.rotated ? rasterFor(p.designId, b.h, b.w) : rasterFor(p.designId, b.w, b.h);
      return { ...b, rotated: p.rotated, raster };
    });
    onProgress?.((sIdx + 0.05) / totalSheets, `Sheet ${sIdx + 1}: preparing layers`);
    const n = sIdx + 1;
    const single = job2.format === "single";
    const main = new TiffStripWriter({
      width: W2,
      height: H2,
      dpi,
      photometric: "rgb",
      rowsPerStrip: rows,
      extra: single ? [ALPHA_INFO, W1_INFO, W2_INFO] : [ALPHA_INFO]
    });
    const w1w = single ? null : new TiffStripWriter({ width: W2, height: H2, dpi, photometric: "gray", rowsPerStrip: rows, extra: [] });
    const w2w = single ? null : new TiffStripWriter({ width: W2, height: H2, dpi, photometric: "gray", rowsPerStrip: rows, extra: [] });
    const st = { widthPx: W2, heightPx: H2, w1Pixels: 0, w2Pixels: 0, artworkPixels: 0 };
    for (let y0 = 0; y0 < H2; y0 += rows) {
      if (isCancelled?.()) throw new Error("cancelled");
      const rh = Math.min(rows, H2 - y0);
      const rgba2 = new Uint8ClampedArray(W2 * rh * 4);
      const m1 = new Uint8Array(W2 * rh);
      const m2 = new Uint8Array(W2 * rh);
      for (const b of boxes) {
        const yy0 = Math.max(y0, b.y), yy1 = Math.min(y0 + rh, b.y + b.h);
        if (yy0 >= yy1) continue;
        const xx0 = Math.max(0, b.x), xx1 = Math.min(W2, b.x + b.w);
        const R = b.raster;
        for (let sy = yy0; sy < yy1; sy++) {
          const ly = sy - b.y;
          for (let sx = xx0; sx < xx1; sx++) {
            const lx = sx - b.x;
            const u = b.rotated ? ly : lx;
            const v = b.rotated ? b.w - 1 - lx : ly;
            const sp = v * R.w + u;
            const dp = (sy - y0) * W2 + sx;
            const a = R.rgba[sp * 4 + 3];
            if (a) {
              rgba2[dp * 4] = R.rgba[sp * 4];
              rgba2[dp * 4 + 1] = R.rgba[sp * 4 + 1];
              rgba2[dp * 4 + 2] = R.rgba[sp * 4 + 2];
              rgba2[dp * 4 + 3] = a;
            }
            if (R.w1[sp]) m1[dp] = 1;
            if (R.w2[sp]) m2[dp] = 1;
          }
        }
      }
      const spp = single ? 6 : 4;
      const raw = new Uint8Array(W2 * rh * spp);
      const g1 = single ? null : new Uint8Array(W2 * rh);
      const g2 = single ? null : new Uint8Array(W2 * rh);
      for (let p = 0, o = 0; p < W2 * rh; p++, o += spp) {
        const a = rgba2[p * 4 + 3];
        if (a) {
          raw[o] = rgba2[p * 4];
          raw[o + 1] = rgba2[p * 4 + 1];
          raw[o + 2] = rgba2[p * 4 + 2];
          st.artworkPixels++;
        } else {
          raw[o] = 255;
          raw[o + 1] = 255;
          raw[o + 2] = 255;
        }
        raw[o + 3] = a;
        if (m1[p]) st.w1Pixels++;
        if (m2[p]) st.w2Pixels++;
        if (single) {
          raw[o + 4] = m1[p] ? spotOn : spotOff;
          raw[o + 5] = m2[p] ? spotOn : spotOff;
        } else {
          g1[p] = m1[p] ? 0 : 255;
          g2[p] = m2[p] ? 0 : 255;
        }
      }
      main.addStrip(raw);
      w1w?.addStrip(g1);
      w2w?.addStrip(g2);
      onProgress?.((sIdx + 0.1 + 0.9 * ((y0 + rh) / H2)) / totalSheets, `Sheet ${sIdx + 1}: writing rows ${y0 + rh} / ${H2}`);
    }
    const base = `3DHD_11x17_sheet${n}`;
    if (single) {
      files.push({ name: `${base}_CMY+W1+W2.tif`, parts: main.finish() });
    } else {
      files.push({ name: `${base}_CMY.tif`, parts: main.finish() });
      files.push({ name: `${base}_W1.tif`, parts: w1w.finish() });
      files.push({ name: `${base}_W2.tif`, parts: w2w.finish() });
    }
    stats.push(st);
  });
  return { files, stats };
}

// src/hd3d/tiffReader.ts
function readTiff(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (v.getUint16(0, false) !== 18761 || v.getUint16(2, true) !== 42) throw new Error("Not a little-endian TIFF");
  const ifd = v.getUint32(4, true);
  const n = v.getUint16(ifd, true);
  const tags = /* @__PURE__ */ new Map();
  const raw = /* @__PURE__ */ new Map();
  const size = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    const tag = v.getUint16(o, true), type = v.getUint16(o + 2, true), count = v.getUint32(o + 4, true);
    const bytes = (size[type] ?? 1) * count;
    const at = bytes <= 4 ? o + 8 : v.getUint32(o + 8, true);
    raw.set(tag, buf.subarray(at, at + bytes));
    const vals = [];
    for (let k = 0; k < count && type !== 2 && type !== 1; k++) {
      if (type === 3) vals.push(v.getUint16(at + k * 2, true));
      else if (type === 4) vals.push(v.getUint32(at + k * 4, true));
      else if (type === 5) vals.push(v.getUint32(at + k * 8, true) / v.getUint32(at + k * 8 + 4, true));
    }
    tags.set(tag, vals);
  }
  const width = tags.get(256)[0], height = tags.get(257)[0];
  const spp = tags.get(277)?.[0] ?? 1;
  const compression = tags.get(259)?.[0] ?? 1;
  const rowsPerStrip = tags.get(278)?.[0] ?? height;
  const offsets = tags.get(273), counts = tags.get(279);
  const pixels = new Uint8Array(width * height * spp);
  let pos = 0;
  offsets.forEach((off, i) => {
    const rows = Math.min(rowsPerStrip, height - i * rowsPerStrip);
    const expected = rows * width * spp;
    const data = buf.subarray(off, off + counts[i]);
    pixels.set(compression === 32773 ? unpackBits(data, expected) : compression === 5 ? lzwDecode(data, expected) : data.subarray(0, expected), pos);
    pos += expected;
  });
  const channelNames = [];
  const spotKinds = [];
  const irb = raw.get(34377);
  if (irb) {
    let p = 0;
    while (p + 12 <= irb.length && irb[p] === 56) {
      const id = irb[p + 4] << 8 | irb[p + 5];
      const nameLen = irb[p + 6];
      let q = p + 6 + 1 + nameLen;
      if ((1 + nameLen) % 2) q++;
      const len = irb[q] << 24 | irb[q + 1] << 16 | irb[q + 2] << 8 | irb[q + 3];
      const data = irb.subarray(q + 4, q + 4 + len);
      if (id === 1006) {
        let k = 0;
        while (k < data.length) {
          const l = data[k];
          channelNames.push(String.fromCharCode(...data.subarray(k + 1, k + 1 + l)));
          k += 1 + l;
        }
      } else if (id === 1077) {
        for (let k = 4; k + 13 <= data.length; k += 13) spotKinds.push(data[k + 12]);
      }
      p = q + 4 + len + len % 2;
    }
  }
  return {
    width,
    height,
    samplesPerPixel: spp,
    photometric: tags.get(262)?.[0] ?? 0,
    compression,
    dpi: tags.get(282)?.[0] ?? 0,
    extraSamples: tags.get(338) ?? [],
    channelNames,
    spotKinds,
    pixels
  };
}

// src/utils/units.ts
var MM_PER_INCH2 = 25.4;

// src/utils/sheetPresets.ts
var DTF_PRESETS = [
  {
    id: "dtf-22x100",
    printType: "dtf",
    label: '22" \xD7 100"',
    shortLabel: "22 \xD7 100",
    widthIn: 22,
    minLengthIn: 39,
    maxLengthIn: 100,
    defaultLengthIn: 39,
    isFixedLength: false,
    isLocked: false,
    description: 'Standard DTF roll, 22" wide (length 39"\u2013100")'
  },
  {
    id: "dtf-22.5x100",
    printType: "dtf",
    label: '22.5" \xD7 100"',
    shortLabel: "22.5 \xD7 100",
    widthIn: 22.5,
    minLengthIn: 1,
    maxLengthIn: 100,
    defaultLengthIn: 24,
    isFixedLength: false,
    isLocked: true,
    description: 'Pro DTF roll, 22.5" wide (Authorized Email Only)'
  }
];
var UVDTF_PRESETS = [
  {
    id: "uvdtf-a4",
    printType: "uvdtf",
    label: 'A4 \u2014 11" \xD7 8"',
    shortLabel: "A4 (11 \xD7 8)",
    widthIn: 11,
    minLengthIn: 8,
    maxLengthIn: 8,
    defaultLengthIn: 8,
    isFixedLength: true,
    isLocked: false,
    description: 'A4 UVDTF sheet (11" \xD7 8")'
  },
  {
    id: "uvdtf-a3",
    printType: "uvdtf",
    label: 'A3 \u2014 11" \xD7 17"',
    shortLabel: "A3 (11 \xD7 17)",
    widthIn: 11,
    minLengthIn: 17,
    maxLengthIn: 17,
    defaultLengthIn: 17,
    isFixedLength: true,
    isLocked: false,
    description: 'A3 UVDTF sheet (11" \xD7 17")'
  },
  {
    id: "uvdtf-meter",
    printType: "uvdtf",
    label: 'Meter \u2014 22" \xD7 39"',
    shortLabel: "Meter (22 \xD7 39)",
    widthIn: 22,
    minLengthIn: 39,
    maxLengthIn: 39,
    defaultLengthIn: 39,
    isFixedLength: true,
    isLocked: false,
    description: '1 Meter UVDTF sheet (22" \xD7 39")'
  },
  {
    id: "uvdtf-23x100",
    printType: "uvdtf",
    label: '23" \xD7 100"',
    shortLabel: "23 \xD7 100",
    widthIn: 23,
    minLengthIn: 1,
    maxLengthIn: 100,
    defaultLengthIn: 24,
    isFixedLength: false,
    isLocked: true,
    description: 'Team UVDTF roll, 23" wide (Authorized Email Only)'
  }
];
var ALL_ROLL_PRESETS = [...DTF_PRESETS, ...UVDTF_PRESETS];
function findPresetById(presetId) {
  return ALL_ROLL_PRESETS.find((p) => p.id === presetId);
}
function getSettingsUpdatesForPreset(preset2) {
  return {
    printType: preset2.printType,
    filmWidthPreset: preset2.id,
    filmWidth: preset2.widthIn,
    filmWidthMm: preset2.widthIn * 25.4,
    lengthMode: preset2.isFixedLength ? "fixed" : "auto",
    fixedLength: preset2.defaultLengthIn,
    fixedLengthMm: preset2.defaultLengthIn * 25.4
  };
}

// src/utils/dtfNesting.ts
var DTF_ROLL_WIDTH_IN = 22;
var DTF_MIN_LENGTH_IN = 39;
var DTF_MAX_LENGTH_IN = 100;
var EPS = 1e-6;
var HEURISTICS = ["BL", "BSSF", "BAF", "BLSF", "CP"];
var MaxRectsBin = class {
  constructor(binW, binH) {
    this.binW = binW;
    this.binH = binH;
    this.free = [{ x: 0, y: 0, w: binW, h: binH }];
  }
  free;
  used = [];
  /**
   * Best position for a design over all free rectangles and orientations.
   * Works on FOOTPRINTS (image box + per-side clearance). The image box itself
   * must stay inside the usable area [S, S + usable].
   */
  find(orients, heur, geo) {
    let best = null;
    for (const r of this.free) {
      for (const o of orients) {
        const w = o.e.l + o.w + o.e.r;
        const h = o.e.t + o.h + o.e.b;
        const x = Math.max(r.x, geo.S - o.e.l);
        const y = Math.max(r.y, geo.S - o.e.t);
        if (x + w > r.x + r.w + EPS || y + h > r.y + r.h + EPS) continue;
        if (x + o.e.l + o.w > geo.S + geo.usableW + EPS || y + o.e.t + o.h > geo.S + geo.usableL + EPS) continue;
        let s1;
        let s2;
        const leftoverW = r.x + r.w - (x + w);
        const leftoverH = r.y + r.h - (y + h);
        switch (heur) {
          case "BL":
            s1 = y + h;
            s2 = x;
            break;
          case "BSSF":
            s1 = Math.min(leftoverW, leftoverH);
            s2 = Math.max(leftoverW, leftoverH);
            break;
          case "BLSF":
            s1 = Math.max(leftoverW, leftoverH);
            s2 = Math.min(leftoverW, leftoverH);
            break;
          case "BAF":
            s1 = r.w * r.h - w * h;
            s2 = Math.min(leftoverW, leftoverH);
            break;
          case "CP":
          default:
            s1 = -this.contact(x, y, w, h);
            s2 = y + h;
            break;
        }
        const s3 = y * 1e4 + x;
        if (!best || s1 < best.s1 - EPS || Math.abs(s1 - best.s1) <= EPS && (s2 < best.s2 - EPS || Math.abs(s2 - best.s2) <= EPS && s3 < best.s3)) {
          best = { x, y, w, h, rotated: o.rotated, s1, s2, s3, orient: o };
        }
      }
    }
    return best;
  }
  /** Shared edge length with sheet sides (left/right/top) and placed rects. */
  contact(x, y, w, h) {
    let score = 0;
    if (x <= EPS) score += h;
    if (Math.abs(x + w - this.binW) <= EPS) score += h;
    if (y <= EPS) score += w;
    for (const u of this.used) {
      if (Math.abs(u.x - (x + w)) <= EPS || Math.abs(u.x + u.w - x) <= EPS) {
        score += Math.max(0, Math.min(u.y + u.h, y + h) - Math.max(u.y, y));
      }
      if (Math.abs(u.y - (y + h)) <= EPS || Math.abs(u.y + u.h - y) <= EPS) {
        score += Math.max(0, Math.min(u.x + u.w, x + w) - Math.max(u.x, x));
      }
    }
    return score;
  }
  place(x, y, w, h) {
    const next = [];
    for (const f of this.free) {
      if (x >= f.x + f.w - EPS || x + w <= f.x + EPS || y >= f.y + f.h - EPS || y + h <= f.y + EPS) {
        next.push(f);
        continue;
      }
      if (x > f.x + EPS) next.push({ x: f.x, y: f.y, w: x - f.x, h: f.h });
      if (x + w < f.x + f.w - EPS) next.push({ x: x + w, y: f.y, w: f.x + f.w - (x + w), h: f.h });
      if (y > f.y + EPS) next.push({ x: f.x, y: f.y, w: f.w, h: y - f.y });
      if (y + h < f.y + f.h - EPS) next.push({ x: f.x, y: y + h, w: f.w, h: f.y + f.h - (y + h) });
    }
    const pruned = [];
    for (let i = 0; i < next.length; i++) {
      const a = next[i];
      if (a.w <= EPS || a.h <= EPS) continue;
      let contained = false;
      for (let j = 0; j < next.length; j++) {
        if (i === j) continue;
        const b = next[j];
        if (a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS) {
          const identical = Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS && Math.abs(a.w - b.w) <= EPS && Math.abs(a.h - b.h) <= EPS;
          if (!identical || j < i) {
            contained = true;
            break;
          }
        }
      }
      if (!contained) pruned.push(a);
    }
    this.free = pruned;
    this.used.push({ x, y, w, h });
  }
};
function orientsFor(it, allowRotate) {
  const o = [{ w: it.w, h: it.h, e: it.ext, rotated: false }];
  if (allowRotate && it.canRotate && Math.abs(it.w - it.h) > EPS) {
    o.push({ w: it.h, h: it.w, e: it.extRot, rotated: true });
  }
  return o;
}
function toPlaced(it, pos) {
  return {
    item: it,
    x: pos.x + pos.orient.e.l,
    y: pos.y + pos.orient.e.t,
    w: pos.orient.w,
    h: pos.orient.h,
    rotated: pos.orient.rotated,
    e: pos.orient.e,
    inset: pos.orient.rotated ? it.insetRot : it.inset
  };
}
var footprint = (p) => ({
  x: p.x - p.e.l,
  y: p.y - p.e.t,
  w: p.e.l + p.w + p.e.r,
  h: p.e.t + p.h + p.e.b
});
function packSequence(order, heur, binW, binH, geo, plan) {
  const sheets = [];
  let remaining = order;
  while (remaining.length > 0) {
    const bin = new MaxRectsBin(binW, binH);
    const placed = [];
    const left = [];
    for (const it of remaining) {
      const pos = bin.find(plan(it), heur, geo);
      if (!pos) {
        left.push(it);
        continue;
      }
      bin.place(pos.x, pos.y, pos.w, pos.h);
      placed.push(toPlaced(it, pos));
    }
    if (placed.length === 0) {
      break;
    }
    sheets.push(placed);
    remaining = left;
  }
  return sheets;
}
function compactSheet(placed, geo) {
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    placed.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const a of placed) {
      const fa = footprint(a);
      let limit = geo.S;
      for (const b of placed) {
        if (b === a) continue;
        const fb = footprint(b);
        const xOverlap = fa.x < fb.x + fb.w - EPS && fb.x < fa.x + fa.w - EPS;
        if (xOverlap && fb.y + fb.h <= fa.y + EPS) {
          limit = Math.max(limit, fb.y + fb.h + a.e.t);
        }
      }
      if (limit < a.y - 1e-4) {
        a.y = limit;
        moved = true;
      }
    }
    placed.sort((a, b) => a.x - b.x || a.y - b.y);
    for (const a of placed) {
      const fa = footprint(a);
      let limit = geo.S;
      for (const b of placed) {
        if (b === a) continue;
        const fb = footprint(b);
        const yOverlap = fa.y < fb.y + fb.h - EPS && fb.y < fa.y + fa.h - EPS;
        if (yOverlap && fb.x + fb.w <= fa.x + EPS) {
          limit = Math.max(limit, fb.x + fb.w + a.e.l);
        }
      }
      if (limit < a.x - 1e-4) {
        a.x = limit;
        moved = true;
      }
    }
    if (!moved) break;
  }
}
function repositionSheet(placed, binW, binH, geo, plan, deadline) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    const byBottom = [...placed].sort((a, b) => b.y + b.h - (a.y + a.h) || b.x - a.x);
    for (const a of byBottom) {
      if (performance.now() > deadline) return;
      const bin = new MaxRectsBin(binW, binH);
      for (const b of placed) {
        if (b === a) continue;
        const f = footprint(b);
        bin.place(f.x, f.y, f.w, f.h);
      }
      const pos = bin.find(plan(a.item), "BL", geo);
      if (!pos) continue;
      const np = toPlaced(a.item, pos);
      const gain = np.rotated !== a.rotated ? 2 : 0.05;
      const improves = np.y + np.h < a.y + a.h - gain || np.rotated === a.rotated && Math.abs(np.y + np.h - (a.y + a.h)) <= 0.05 && np.y < a.y - 0.05;
      if (improves) {
        Object.assign(a, np);
        moved = true;
      }
    }
    compactSheet(placed, geo);
    if (!moved) break;
  }
}
function countRotated(sheets) {
  let n = 0;
  for (const sh of sheets) for (const p of sh) if (p.rotated) n++;
  return n;
}
function sheetExtent(placed, geo) {
  let max = 0;
  for (const p of placed) max = Math.max(max, p.y + p.h - geo.S);
  return max;
}
function groupingScore(sheets) {
  const byAsset = /* @__PURE__ */ new Map();
  sheets.forEach((sheet, si) => {
    for (const p of sheet) {
      const list = byAsset.get(p.item.assetId) ?? [];
      list.push({ sheet: si, cx: p.x + p.w / 2, cy: p.y + p.h / 2, size: Math.sqrt(p.w * p.h) });
      byAsset.set(p.item.assetId, list);
    }
  });
  let score = 0;
  for (const list of byAsset.values()) {
    if (list.length < 2) continue;
    const sheetSet = new Set(list.map((l) => l.sheet));
    score += (sheetSet.size - 1) * 50;
    for (const s of sheetSet) {
      const pts = list.filter((l) => l.sheet === s);
      const mx = pts.reduce((a, p) => a + p.cx, 0) / pts.length;
      const my = pts.reduce((a, p) => a + p.cy, 0) / pts.length;
      for (const p of pts) {
        score += Math.hypot(p.cx - mx, p.cy - my) / Math.max(1, p.size);
      }
    }
  }
  return score;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function better(a, b) {
  if (a.sheetCount !== b.sheetCount) return a.sheetCount < b.sheetCount;
  if (Math.abs(a.filmLengthMm - b.filmLengthMm) > 1e-3) return a.filmLengthMm < b.filmLengthMm;
  if (Math.abs(a.extentMm - b.extentMm) > 1e-3) return a.extentMm < b.extentMm;
  return a.groupScore < b.groupScore - 1e-6;
}
function packDtfGangSheet(assets2, settings2, options = {}) {
  const withInk = nestDtf(assets2, settings2, options);
  if (!options.inkBounds) return withInk;
  const plain = nestDtf(assets2, settings2, { ...options, inkBounds: void 0 });
  return layoutIsBetter(plain, withInk) ? plain : withInk;
}
function layoutIsBetter(a, b) {
  const invalidA = (a.validationErrors?.length ?? 0) > 0;
  const invalidB = (b.validationErrors?.length ?? 0) > 0;
  if (invalidA !== invalidB) return !invalidA;
  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length;
  if (Math.abs(a.usedLengthMm - b.usedLengthMm) > 0.05) return a.usedLengthMm < b.usedLengthMm;
  const extent = (r) => r.sheets.reduce((sum, sh) => sum + Math.max(0, ...sh.placements.map((p) => p.yMm + p.heightMm)), 0);
  return extent(a) < extent(b) - 0.05;
}
function nestDtf(assets2, settings2, options) {
  const startTime = performance.now();
  const preset2 = findPresetById(settings2.filmWidthPreset);
  const isUvdtf = (settings2.printType || "dtf") === "uvdtf";
  const sheetPreset = preset2 && preset2.printType === (isUvdtf ? "uvdtf" : "dtf") ? preset2 : void 0;
  let filmWidthMm;
  let minLengthMm;
  let maxLengthMm;
  if (isUvdtf) {
    const widthMm = settings2.filmWidthMm > 0 ? settings2.filmWidthMm : (sheetPreset?.widthIn ?? 22) * MM_PER_INCH2;
    filmWidthMm = Math.min(23 * MM_PER_INCH2, Math.max(MM_PER_INCH2, widthMm));
    minLengthMm = (sheetPreset?.minLengthIn ?? 1) * MM_PER_INCH2;
    maxLengthMm = (sheetPreset?.maxLengthIn ?? (filmWidthMm <= 11.1 * MM_PER_INCH2 ? 17 : 100)) * MM_PER_INCH2;
  } else {
    filmWidthMm = (sheetPreset?.widthIn ?? DTF_ROLL_WIDTH_IN) * MM_PER_INCH2;
    minLengthMm = (sheetPreset?.minLengthIn ?? DTF_MIN_LENGTH_IN) * MM_PER_INCH2;
    maxLengthMm = (sheetPreset?.maxLengthIn ?? DTF_MAX_LENGTH_IN) * MM_PER_INCH2;
  }
  const isFixed = settings2.lengthMode === "fixed" || Boolean(sheetPreset?.isFixedLength);
  const fixedLengthMm = sheetPreset?.isFixedLength ? maxLengthMm : Math.min(maxLengthMm, Math.max(minLengthMm, settings2.fixedLengthMm || minLengthMm));
  const sheetMaxLengthMm = isFixed ? fixedLengthMm : maxLengthMm;
  const spacingMm = Math.max(5, settings2.spacingMm ?? 5);
  const marginMm = Math.max(0, settings2.marginMm ?? 5);
  const keepTogether = settings2.keepDesignsTogether ?? true;
  const rotationEnabled = Boolean(settings2.allowItemRotation);
  const usableW = Math.max(1, filmWidthMm - marginMm * 2);
  const usableL = Math.max(1, sheetMaxLengthMm - marginMm * 2);
  const S2 = spacingMm / 2;
  const geo = { S: S2, usableW, usableL };
  const binW = usableW + spacingMm;
  const binH = usableL + spacingMm;
  const INK_SAFETY_MM = 0.25;
  const activeAssets = settings2.mode === "repeat" && assets2.length > 0 ? [assets2[0]] : assets2;
  const items = [];
  let scaledToFitCount = 0;
  activeAssets.forEach((asset, assetOrder) => {
    let w = asset.targetWidthMm || 50;
    let h = asset.targetHeightMm || 50;
    const canRotate = rotationEnabled;
    const fitsUpright = w <= usableW + EPS && h <= usableL + EPS;
    const fitsRotated2 = canRotate && h <= usableW + EPS && w <= usableL + EPS;
    if (!fitsUpright && !fitsRotated2) {
      const scale = Math.min(usableW / w, usableL / h);
      w *= scale;
      h *= scale;
      scaledToFitCount += Math.max(1, asset.copies || 1);
    }
    const ib = options.inkBounds?.[asset.id];
    const pad = (frac, dim) => Math.max(0, Math.min(dim / 2, (frac && frac > 0 ? frac : 0) * dim - INK_SAFETY_MM));
    const inset = ib ? { l: pad(ib.left, w), t: pad(ib.top, h), r: pad(ib.right, w), b: pad(ib.bottom, h) } : { l: 0, t: 0, r: 0, b: 0 };
    const insetRot = { l: inset.b, t: inset.l, r: inset.t, b: inset.r };
    const clear = (v) => ({
      l: Math.max(0, S2 - v.l),
      t: Math.max(0, S2 - v.t),
      r: Math.max(0, S2 - v.r),
      b: Math.max(0, S2 - v.b)
    });
    const ext = clear(inset);
    const extRot = clear(insetRot);
    const copies = Math.max(1, Math.floor(asset.copies || 1));
    for (let i = 0; i < copies; i++) {
      items.push({
        id: `${asset.id}_copy_${i}`,
        assetId: asset.id,
        assetOrder,
        copyIndex: i,
        w,
        h,
        canRotate,
        asset,
        inset,
        insetRot,
        ext,
        extRot
      });
    }
  });
  if (items.length === 0) {
    const emptyLengthMm = isFixed ? fixedLengthMm : 0;
    const emptyFilmAreaMm2 = filmWidthMm * emptyLengthMm;
    const emptySheet = {
      sheetIndex: 0,
      placements: [],
      usedWidthMm: filmWidthMm,
      usedLengthMm: Math.round(emptyLengthMm * 10) / 10,
      usedLengthInches: Math.round(emptyLengthMm / MM_PER_INCH2 * 100) / 100,
      usedLengthMeters: Math.round(emptyLengthMm / 1e3 * 100) / 100,
      totalCopies: 0,
      filmAreaMm2: emptyFilmAreaMm2,
      artworkAreaMm2: 0,
      wastePercent: emptyFilmAreaMm2 > 0 ? 100 : 0,
      utilizationPercent: 0,
      unusedAreaMm2: emptyFilmAreaMm2
    };
    return {
      placements: [],
      sheets: [emptySheet],
      totalCopies: 0,
      requestedCopies: 0,
      usedWidthMm: filmWidthMm,
      usedLengthMm: emptySheet.usedLengthMm,
      usedLengthInches: emptySheet.usedLengthInches,
      usedLengthMeters: emptySheet.usedLengthMeters,
      filmAreaMm2: emptyFilmAreaMm2,
      artworkAreaMm2: 0,
      unusedAreaMm2: emptyFilmAreaMm2,
      utilizationPercent: 0,
      wastePercent: emptyFilmAreaMm2 > 0 ? 100 : 0,
      overflow: false,
      overflowCount: 0,
      scaledToFitCount: 0,
      calculationTimeMs: 0
    };
  }
  const sheetFilmLength = (extent) => isFixed ? fixedLengthMm : Math.min(maxLengthMm, Math.max(minLengthMm, extent + marginMm * 2));
  const evaluate = (order, heuristic, plan) => {
    const sheets = packSequence(order, heuristic, binW, binH, geo, plan);
    let filmLengthMm = 0;
    let extentMm = 0;
    for (const s of sheets) {
      compactSheet(s, geo);
      const e = sheetExtent(s, geo);
      extentMm += e;
      filmLengthMm += sheetFilmLength(e);
    }
    return {
      order,
      heuristic,
      plan,
      sheets,
      sheetCount: sheets.length,
      filmLengthMm,
      extentMm,
      groupScore: groupingScore(sheets),
      rotatedCount: countRotated(sheets)
    };
  };
  const tie = (a, b) => a.assetOrder - b.assetOrder || a.copyIndex - b.copyIndex;
  const sortBy = (key) => [...items].sort((a, b) => key(b) - key(a) || tie(a, b));
  const orders = [
    sortBy((i) => i.w * i.h),
    sortBy((i) => i.h * 1e4 + i.w),
    sortBy((i) => i.w * 1e4 + i.h),
    sortBy((i) => Math.max(i.w, i.h) * 1e4 + Math.min(i.w, i.h)),
    sortBy((i) => i.w + i.h),
    [...items].sort(tie)
  ];
  if (!keepTogether) {
    const rr = [...items].sort(
      (a, b) => a.copyIndex - b.copyIndex || b.w * b.h - a.w * a.h || a.assetOrder - b.assetOrder
    );
    orders.push(rr);
  }
  const fitsRotated = (it) => it.canRotate && it.h <= usableW + EPS && it.w <= usableL + EPS && Math.abs(it.w - it.h) > EPS;
  const rotatedOnly = (it) => [{ w: it.h, h: it.w, e: it.extRot, rotated: true }];
  const planUpright = (it) => orientsFor(it, false);
  const planFree = (it) => orientsFor(it, true);
  const planForce = (assetIds, othersFree) => (it) => {
    const forced = assetIds === null || assetIds.has(it.assetId);
    if (forced && fitsRotated(it)) return rotatedOnly(it);
    return orientsFor(it, othersFree || forced);
  };
  const plans = [{ plan: planUpright, core: true }];
  if (rotationEnabled) {
    plans.push({ plan: planFree, core: true });
    plans.push({ plan: planForce(null, false), core: true });
    const rotatable = activeAssets.filter((a) => items.some((it) => it.assetId === a.id && fitsRotated(it)));
    if (rotatable.length > 1 && rotatable.length <= 8 && items.length <= 300) {
      for (const a of rotatable) {
        const one = /* @__PURE__ */ new Set([a.id]);
        plans.push({ plan: planForce(one, true), core: false });
        plans.push({ plan: planForce(one, false), core: false });
      }
    }
  }
  const timeBudgetMs = options.timeBudgetMs ?? 150;
  const deadline = startTime + timeBudgetMs;
  const pool = [];
  let best = null;
  for (let oi = 0; oi < orders.length; oi++) {
    const order = orders[oi];
    if (oi > 0 && performance.now() > deadline) break;
    for (const { plan, core } of plans) {
      if (!core && oi > 1) continue;
      for (const heur of HEURISTICS) {
        const c = evaluate(order, heur, plan);
        pool.push(c);
        if (!best || better(c, best)) best = c;
      }
    }
  }
  const n = items.length;
  const defaultIters = n <= 1 ? 0 : Math.max(20, Math.min(400, Math.floor(4e4 / n)));
  const maxIters = options.maxSearchIterations ?? defaultIters;
  const rand = mulberry32(n * 2654435761 + Math.round(filmWidthMm * 7 + sheetMaxLengthMm));
  let current = best;
  for (let it = 0; it < maxIters && performance.now() < deadline; it++) {
    const order = [...current.order];
    const moveType = rand();
    const i = Math.floor(rand() * n);
    let j = Math.floor(rand() * n);
    if (i === j) j = (j + 1) % n;
    if (moveType < 0.5) {
      [order[i], order[j]] = [order[j], order[i]];
    } else {
      const [moved] = order.splice(i, 1);
      order.splice(Math.min(i, j), 0, moved);
    }
    const heur = rand() < 0.7 ? current.heuristic : HEURISTICS[Math.floor(rand() * HEURISTICS.length)];
    const c = evaluate(order, heur, current.plan);
    if (!better(current, c)) {
      current = c;
      pool.push(c);
      if (better(c, best)) best = c;
    }
  }
  const preferOriginalOrientation = (candidates, top) => {
    if (!rotationEnabled) return top;
    const tol = Math.max(2, top.extentMm * 5e-3);
    let pick = top;
    for (const c of candidates) {
      if (c.sheetCount === top.sheetCount && c.filmLengthMm <= top.filmLengthMm + 1e-3 && c.extentMm <= top.extentMm + tol && (c.rotatedCount < pick.rotatedCount || c.rotatedCount === pick.rotatedCount && c.extentMm < pick.extentMm - 1e-3)) {
        pick = c;
      }
    }
    return pick;
  };
  const selectWithGrouping = (candidates, top) => {
    let pick = top;
    if (!keepTogether) return pick;
    const tol = Math.max(12.7, top.extentMm * 0.015);
    for (const c of candidates) {
      if (c.sheetCount === top.sheetCount && c.filmLengthMm <= top.filmLengthMm + 1e-3 && c.extentMm <= top.extentMm + tol && c.rotatedCount <= top.rotatedCount && c.groupScore < pick.groupScore - 1e-6) {
        pick = c;
      }
    }
    return pick;
  };
  let chosen = selectWithGrouping(pool, preferOriginalOrientation(pool, best));
  {
    const sheetsR = chosen.sheets.map((sh) => sh.map((p) => ({ ...p })));
    const repoDeadline = performance.now() + 250;
    for (const sh of sheetsR) {
      if (sh.length <= 400) repositionSheet(sh, binW, binH, geo, chosen.plan, repoDeadline);
    }
    let filmLengthMm = 0;
    let extentMm = 0;
    for (const sh of sheetsR) {
      const e = sheetExtent(sh, geo);
      extentMm += e;
      filmLengthMm += sheetFilmLength(e);
    }
    const repositioned = {
      ...chosen,
      sheets: sheetsR,
      filmLengthMm,
      extentMm,
      groupScore: groupingScore(sheetsR),
      rotatedCount: countRotated(sheetsR)
    };
    if (!better(chosen, repositioned)) {
      pool.push(repositioned);
      chosen = repositioned;
    }
  }
  const buildResult = (cand) => {
    const round3 = (v) => Math.round(v * 1e3) / 1e3;
    const placements = [];
    const sheets = [];
    let totalArtworkAreaMm2 = 0;
    cand.sheets.forEach((sheetPlaced, sheetIndex) => {
      const ordered = [...sheetPlaced].sort((a, b) => a.y - b.y || a.x - b.x);
      const sheetPlacements = ordered.map((p) => ({
        id: p.item.id,
        assetId: p.item.assetId,
        copyIndex: p.item.copyIndex,
        sheetIndex,
        xMm: round3(marginMm + p.x - S2),
        yMm: round3(marginMm + p.y - S2),
        widthMm: round3(p.w),
        heightMm: round3(p.h),
        rotated: p.rotated,
        inkInsetMm: { l: round3(p.inset.l), t: round3(p.inset.t), r: round3(p.inset.r), b: round3(p.inset.b) },
        asset: p.item.asset
      }));
      placements.push(...sheetPlacements);
      const lengthMm = sheetFilmLength(sheetExtent(sheetPlaced, geo));
      const filmAreaMm22 = filmWidthMm * lengthMm;
      const artworkAreaMm2 = sheetPlaced.reduce((sum, p) => sum + p.w * p.h, 0);
      totalArtworkAreaMm2 += artworkAreaMm2;
      const utilization2 = filmAreaMm22 > 0 ? artworkAreaMm2 / filmAreaMm22 * 100 : 0;
      sheets.push({
        sheetIndex,
        placements: sheetPlacements,
        usedWidthMm: filmWidthMm,
        // Round UP to 0.1 mm so the bottom margin is never shortened by rounding
        // (preview and export both use this exact length).
        usedLengthMm: Math.min(maxLengthMm, Math.ceil(lengthMm * 10 - 1e-6) / 10),
        usedLengthInches: Math.round(lengthMm / MM_PER_INCH2 * 100) / 100,
        usedLengthMeters: Math.round(lengthMm / 1e3 * 100) / 100,
        totalCopies: sheetPlacements.length,
        filmAreaMm2: filmAreaMm22,
        artworkAreaMm2,
        wastePercent: Math.max(0, Math.min(100, Math.round(100 - utilization2))),
        utilizationPercent: Math.round(utilization2 * 10) / 10,
        unusedAreaMm2: Math.max(0, filmAreaMm22 - artworkAreaMm2)
      });
    });
    const totalLengthMm = sheets.reduce((sum, s) => sum + s.usedLengthMm, 0);
    const filmAreaMm2 = sheets.reduce((sum, s) => sum + s.filmAreaMm2, 0);
    const utilization = filmAreaMm2 > 0 ? totalArtworkAreaMm2 / filmAreaMm2 * 100 : 0;
    const overflowCount = items.length - placements.length;
    return {
      placements,
      sheets,
      totalCopies: placements.length,
      requestedCopies: items.length,
      usedWidthMm: filmWidthMm,
      usedLengthMm: Math.round(totalLengthMm * 10) / 10,
      usedLengthInches: Math.round(totalLengthMm / MM_PER_INCH2 * 100) / 100,
      usedLengthMeters: Math.round(totalLengthMm / 1e3 * 100) / 100,
      filmAreaMm2,
      artworkAreaMm2: totalArtworkAreaMm2,
      unusedAreaMm2: Math.max(0, filmAreaMm2 - totalArtworkAreaMm2),
      utilizationPercent: Math.round(utilization * 10) / 10,
      wastePercent: Math.max(0, Math.min(100, Math.round(100 - utilization))),
      overflow: overflowCount > 0,
      overflowCount,
      scaledToFitCount,
      validationErrors: [],
      calculationTimeMs: Math.round(performance.now() - startTime)
    };
  };
  const ranked = [chosen, ...pool.filter((c) => c !== chosen).sort((a, b) => better(a, b) ? -1 : better(b, a) ? 1 : 0)];
  let firstResult = null;
  for (const cand of ranked) {
    const result = buildResult(cand);
    const errors = validateLayout(result, { spacingMm, marginMm });
    if (errors.length === 0) return result;
    if (!firstResult) firstResult = { ...result, validationErrors: errors };
  }
  return firstResult;
}
function validateLayout(layout2, rules) {
  const errors = [];
  const TOL = 0.01;
  const { spacingMm, marginMm } = rules;
  const zero = { l: 0, t: 0, r: 0, b: 0 };
  const seen = /* @__PURE__ */ new Set();
  for (const p of layout2.placements) {
    if (seen.has(p.id)) errors.push(`Duplicate placement ${p.id}`);
    seen.add(p.id);
  }
  if (layout2.requestedCopies !== void 0 && layout2.placements.length !== layout2.requestedCopies) {
    errors.push(`Placed ${layout2.placements.length} of ${layout2.requestedCopies} requested copies`);
  }
  for (const sheet of layout2.sheets) {
    const W2 = sheet.usedWidthMm;
    const L = sheet.usedLengthMm;
    const ps = sheet.placements;
    for (const p of ps) {
      if (!(p.widthMm > 0 && p.heightMm > 0)) errors.push(`${p.id} has invalid size`);
      if (p.xMm < marginMm - TOL || p.yMm < marginMm - TOL || p.xMm + p.widthMm > W2 - marginMm + TOL || p.yMm + p.heightMm > L - marginMm + TOL) {
        errors.push(`${p.id} is outside the printable area of sheet ${sheet.sheetIndex + 1}`);
      }
    }
    const byX = [...ps].sort((a, b) => a.xMm - b.xMm);
    for (let i = 0; i < byX.length; i++) {
      const a = byX[i];
      const ia = a.inkInsetMm ?? zero;
      for (let j = i + 1; j < byX.length; j++) {
        const b = byX[j];
        if (b.xMm - (a.xMm + a.widthMm) >= spacingMm - TOL) break;
        const ib = b.inkInsetMm ?? zero;
        const need = (inA, inB) => Math.max(0, spacingMm - inA - inB) - TOL;
        const ok = b.xMm - (a.xMm + a.widthMm) >= need(ia.r, ib.l) || a.xMm - (b.xMm + b.widthMm) >= need(ib.r, ia.l) || b.yMm - (a.yMm + a.heightMm) >= need(ia.b, ib.t) || a.yMm - (b.yMm + b.heightMm) >= need(ib.b, ia.t);
        if (!ok) {
          const gap = Math.max(
            b.xMm - (a.xMm + a.widthMm),
            a.xMm - (b.xMm + b.widthMm),
            b.yMm - (a.yMm + a.heightMm),
            a.yMm - (b.yMm + b.heightMm)
          );
          errors.push(
            gap < -TOL ? `${a.id} overlaps ${b.id} on sheet ${sheet.sheetIndex + 1}` : `${a.id} and ${b.id} artwork closer than ${spacingMm} mm on sheet ${sheet.sheetIndex + 1}`
          );
        }
      }
    }
  }
  return errors;
}

// src/utils/packing.ts
var MAX_PRINT_WIDTH_INCHES = 23;
var MAX_PRINT_HEIGHT_INCHES = 100;
var MAX_PRINT_WIDTH_MM = MAX_PRINT_WIDTH_INCHES * MM_PER_INCH2;
var MAX_PRINT_HEIGHT_MM = MAX_PRINT_HEIGHT_INCHES * MM_PER_INCH2;
function packGangSheet(assets2, settings2, inkBounds) {
  return packDtfGangSheet(assets2, settings2, { inkBounds });
}

// scratch/test_hd3d_pipeline.ts
var outDir = process.argv[2];
var failures = 0;
var check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  if (!ok) failures++;
};
{
  let ok = true;
  for (let t = 0; t < 200; t++) {
    const n = 1 + Math.floor(Math.random() * 3e3);
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.random() < 0.6 ? i > 0 ? a[i - 1] : 7 : Math.floor(Math.random() * 256);
    const b = unpackBits(packBits(a), n);
    if (b.some((x, i) => x !== a[i])) {
      ok = false;
      break;
    }
  }
  check(ok, "PackBits compress/decompress round trip (200 random buffers)");
}
{
  let ok = true;
  const cases = [new Uint8Array(0), new Uint8Array([7]), new Uint8Array(1e5).fill(255)];
  for (let t = 0; t < 60; t++) {
    const n = 1 + Math.floor(Math.random() * 2e5);
    const a = new Uint8Array(n);
    const mode = t % 3;
    for (let i = 0; i < n; i++) a[i] = mode === 0 ? Math.floor(Math.random() * 256) : mode === 1 ? [255, 255, 255, 0, 0, 0][i % 6] : i > 0 && Math.random() < 0.7 ? a[i - 1] : Math.floor(Math.random() * 16);
    cases.push(a);
  }
  for (const a of cases) {
    const b = lzwDecode(lzwEncode(a), a.length);
    if (b.length !== a.length || b.some((x, i) => x !== a[i])) {
      ok = false;
      break;
    }
  }
  check(ok, `LZW compress/decompress round trip (${cases.length} buffers incl. 12-bit codes and table resets)`);
}
var W = 600;
var H = 400;
var rgba = new Uint8ClampedArray(W * H * 4);
var inDisc = (x, y) => (x - 160) ** 2 + (y - 200) ** 2 <= 120 ** 2;
var inSquare = (x, y) => x >= 340 && x < 560 && y >= 90 && y < 310;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 4;
  if (inDisc(x, y)) {
    rgba[o] = 220;
    rgba[o + 1] = 20;
    rgba[o + 2] = 30;
    rgba[o + 3] = 255;
  } else if (inSquare(x, y)) {
    rgba[o] = 20;
    rgba[o + 1] = 60;
    rgba[o + 2] = 200;
    rgba[o + 3] = 255;
  }
}
var original = new Uint8ClampedArray(rgba);
var w1 = emptyMask(W, H);
combineInto(w1, selectObject(rgba, W, H, 160, 200, 30), "add");
var w2 = selectArtwork(rgba, W, H);
check(countOn(w1) > 0.95 * Math.PI * 120 ** 2 && countOn(w1) < 1.05 * Math.PI * 120 ** 2, `object selection picks the disc only (${countOn(w1)} px)`);
var grown = growShrink(w1, W, H, 5);
var shrunk = growShrink(w1, W, H, -5);
check(Math.abs(countOn(grown) - Math.PI * 125 ** 2) / (Math.PI * 125 ** 2) < 0.03 && Math.abs(countOn(shrunk) - Math.PI * 115 ** 2) / (Math.PI * 115 ** 2) < 0.03, "boundary grow/shrink by 5 px is exact (round)");
var brushTest = emptyMask(W, H);
paintStroke(brushTest, W, H, 10, 10, 110, 10, 5, 255);
paintStroke(brushTest, W, H, 60, 0, 60, 20, 3, 0);
check(brushTest[10 * W + 30] === 255 && brushTest[10 * W + 60] === 0 && brushTest[30 * W + 30] === 0, "brush paints, eraser removes");
var tex = builtInTextures();
check(tex.length >= 6 && tex.every((t) => t.tile.length === t.size * t.size), `${tex.length} built-in textures generated`);
var lookup = (id) => {
  const t = tex.find((x) => x.id === id);
  return t ? { tile: t.tile, size: t.size } : void 0;
};
var squareClip = selectObject(rgba, W, H, 450, 200, 30);
var t1 = { id: "t1", textureId: "builtin-honeycomb", target: "w1", clip: squareClip, scale: 0.5, intensity: 0.5, offsetX: 0, offsetY: 0 };
var t2 = { id: "t2", textureId: "builtin-carbon-fibre", target: "cmy", clip: squareClip, scale: 1, intensity: 0.6, offsetX: 0, offsetY: 0 };
var layers = { w1, w2, w2ExcludesW1: true, textures: [t1, t2] };
var fm = finalMasks(rgba, W, H, layers, lookup);
var cmy = bakeCmy(rgba, W, H, layers.textures, lookup);
var texInSquare = 0;
var texOutside = 0;
var w2onW1 = 0;
var outsideArt = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x;
  if (fm.w1[p] && inSquare(x, y)) texInSquare++;
  if (fm.w1[p] && !inSquare(x, y) && !inDisc(x, y)) texOutside++;
  if (fm.w1[p] && fm.w2[p]) w2onW1++;
  if ((fm.w1[p] || fm.w2[p]) && rgba[p * 4 + 3] === 0) outsideArt++;
}
var sqArea = 220 * 220;
check(texInSquare > 0.2 * sqArea && texInSquare < 0.8 * sqArea, `W1 texture covers part of the square (${(texInSquare / sqArea * 100).toFixed(0)} %)`);
check(texOutside === 0 && outsideArt === 0, "texture clipped to its region; no ink outside the artwork");
check(w2onW1 === 0, "W2 excludes W1 raised areas by default");
check(original.every((v, i) => v === rgba[i]), "original artwork pixels untouched");
check(cmy === rgba && cmy[(200 * W + 160) * 4] === 220, "CMY is untouched original artwork (disc colour unchanged)");
var layersNoExcl = { ...layers, w2ExcludesW1: false };
var fm2 = finalMasks(rgba, W, H, layersNoExcl, lookup);
check(fm2.w2[200 * W + 160] === 255, "override: W2 may cover W1 when exclusion is off");
var W2d = 300;
var H2d = 900;
var rgbaB = new Uint8ClampedArray(W2d * H2d * 4);
for (let p = 0; p < W2d * H2d; p++) {
  rgbaB[p * 4] = 30;
  rgbaB[p * 4 + 1] = 160;
  rgbaB[p * 4 + 2] = 60;
  rgbaB[p * 4 + 3] = 255;
}
var IN = 25.4;
var mkAsset = (id, wIn, hIn, copies) => ({
  id,
  filename: id,
  fileType: "png",
  fileSize: 1,
  originalWidth: 1,
  originalHeight: 1,
  hasAlpha: true,
  originalUrl: "",
  processedUrl: "",
  trimmedWidth: 1,
  trimmedHeight: 1,
  cropBox: null,
  isTrimmed: false,
  isBgRemoved: false,
  targetWidth: wIn,
  targetHeight: hIn,
  targetWidthMm: wIn * IN,
  targetHeightMm: hIn * IN,
  aspectLocked: true,
  copies,
  allowRotation: true,
  effectiveDpi: 300,
  dpiStatus: "green",
  status: "ready"
});
var preset = findPresetById("uvdtf-a3");
var settings = {
  printType: "uvdtf",
  unit: "inch",
  spacing: 0.2,
  spacingMm: 5,
  margin: 0.2,
  marginMm: 0.2 * IN,
  exportDpi: 300,
  allowItemRotation: true,
  keepDesignsTogether: true,
  nestingAlgorithm: "box",
  mode: "multiple",
  ...getSettingsUpdatesForPreset(preset)
};
var assets = [mkAsset("A", 4.5, 3, 5), mkAsset("B", 2, 6, 3)];
var layout = packGangSheet(assets, settings);
var rotatedCount = layout.placements.filter((p) => p.rotated).length;
check(layout.usedWidthMm === 11 * IN && layout.sheets.every((s) => Math.abs(s.usedLengthMm - 17 * IN) < 0.1), `fixed 11\xD717 sheet (${layout.sheets.length} sheet(s), ${layout.totalCopies} copies, ${rotatedCount} rotated)`);
check(layout.totalCopies === 8 && (layout.validationErrors ?? []).length === 0, "all copies placed without overlap");
var job = {
  sheetWidthIn: 11,
  sheetLengthIn: 17,
  dpi: 100,
  format: "single",
  invertSpots: false,
  designs: [
    { id: "A", width: W, height: H, rgba: cmy, w1: fm.w1, w2: fm.w2, w2ExcludesW1: true },
    { id: "B", width: W2d, height: H2d, rgba: rgbaB, w1: emptyMask(W2d, H2d), w2: emptyMask(W2d, H2d), w2ExcludesW1: true }
  ],
  sheets: layout.sheets.map((s) => s.placements.map((p) => ({ designId: p.assetId, xMm: p.xMm, yMm: p.yMm, widthMm: p.widthMm, heightMm: p.heightMm, rotated: p.rotated })))
};
for (const format of ["single", "separate"]) {
  const t0 = Date.now();
  const { files, stats } = composeSheets({ ...job, format });
  const ms = Date.now() - t0;
  const bufs = files.map((f) => {
    const len = f.parts.reduce((n, p) => n + p.length, 0);
    const b = new Uint8Array(len);
    let o = 0;
    for (const p of f.parts) {
      b.set(p, o);
      o += p.length;
    }
    return b;
  });
  if (outDir) files.forEach((f, i) => fs.writeFileSync(`${outDir}/${f.name}`, bufs[i]));
  const main = readTiff(bufs[0]);
  check(main.width === 1100 && main.height === 1700 && Math.round(main.dpi) === 100, `[${format}] TIFF re-import: 1100\xD71700 px @ 100 DPI = 11\xD717 in (${ms} ms, ${files.length} file(s), ${(bufs.reduce((n, b) => n + b.length, 0) / 1e6).toFixed(2)} MB)`);
  let w1Ch, w2Ch;
  if (format === "single") {
    check(main.samplesPerPixel === 6 && main.photometric === 2 && main.compression === 5, "single TIFF: RGB + 3 extra channels, LZW");
    check(JSON.stringify(main.channelNames) === '["Transparency","W1","W2"]' && JSON.stringify(main.spotKinds) === "[0,2,2]" && JSON.stringify(main.extraSamples) === "[2,0,0]", `channel names ${JSON.stringify(main.channelNames)}, spot kinds ${JSON.stringify(main.spotKinds)}`);
    w1Ch = (p) => main.pixels[p * 6 + 4];
    w2Ch = (p) => main.pixels[p * 6 + 5];
  } else {
    const t1r = readTiff(bufs[1]), t2r = readTiff(bufs[2]);
    check(main.samplesPerPixel === 4 && t1r.samplesPerPixel === 1 && t2r.samplesPerPixel === 1 && t1r.width === main.width && t2r.height === main.height, "separate: artwork RGBA + W1 and W2 grayscale masks, identical size");
    w1Ch = (p) => 255 - t1r.pixels[p];
    w2Ch = (p) => 255 - t2r.pixels[p];
  }
  const spp = main.samplesPerPixel;
  let bad = 0, nonBinary = 0;
  for (let p = 0; p < main.width * main.height; p++) {
    const a = main.pixels[p * spp + 3];
    const v1 = w1Ch(p), v2 = w2Ch(p);
    if (v1 !== 0 && v1 !== 255 || v2 !== 0 && v2 !== 255) nonBinary++;
    if ((v1 || v2) && a === 0) bad++;
    if (v1 && v2) bad++;
  }
  check(nonBinary === 0, "W1/W2 are strictly 0 % or 100 %");
  check(bad === 0, "W1/W2 only on artwork, never both on one pixel (exclusion kept after resampling)");
  let copiesOk = 0, copiesA = 0;
  for (const s of job.sheets[0]) {
    if (s.designId !== "A") continue;
    copiesA++;
    const b = placementBox(s, 100);
    const toSheet = (u, v) => {
      const lx = s.rotated ? Math.floor((1 - v) * b.w) : Math.floor(u * b.w);
      const ly = s.rotated ? Math.floor(u * b.h) : Math.floor(v * b.h);
      return (b.y + Math.min(ly, b.h - 1)) * main.width + b.x + Math.min(lx, b.w - 1);
    };
    const disc = toSheet(160 / W, 200 / H);
    const empty = toSheet(300 / W, 30 / H);
    const discOk = main.pixels[disc * spp] > 200 && main.pixels[disc * spp + 1] < 40 && w1Ch(disc) === 255 && w2Ch(disc) === 0;
    const emptyOk = main.pixels[empty * spp + 3] === 0 && w1Ch(empty) === 0 && w2Ch(empty) === 0;
    if (discOk && emptyOk) copiesOk++;
  }
  check(copiesA === 5 && copiesOk === copiesA, `[${format}] all ${copiesA} copies of design A carry CMY + W1 + W2 in the right place (incl. rotated)`);
  const st = stats[0];
  check(st.w1Pixels > 0 && st.w2Pixels > 0, `stats: W1 ${st.w1Pixels} px, W2 ${st.w2Pixels} px, artwork ${st.artworkPixels} px`);
}
{
  const t0 = Date.now();
  const { files } = composeSheets({ ...job, dpi: 300 });
  const size = files[0].parts.reduce((n, p) => n + p.length, 0);
  check(true, `300 DPI sheet (3300\xD75100 px): ${((Date.now() - t0) / 1e3).toFixed(1)} s, ${(size / 1e6).toFixed(1)} MB`);
}
console.log(failures ? `
${failures} FAILURE(S)` : "\nALL 3D HD PIPELINE TESTS PASS");
process.exit(failures ? 1 : 0);
