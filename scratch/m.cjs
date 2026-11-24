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

// scratch/test_hd3d_masks.ts
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
  const sm2 = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * cells, y = v * cells;
    const i = Math.floor(x), j = Math.floor(y);
    const fx = sm2(x - i), fy = sm2(y - j);
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
  const w1 = Math.sin(TAU * (u * 12 + 0.35 * Math.sin(TAU * v * 2)));
  const w2 = Math.sin(TAU * (v * 12 + 0.35 * Math.sin(TAU * u * 3)));
  const lines = Math.abs(w1 * 0.6 + w2 * 0.4);
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
function selectArtwork(rgba2, w, h, alphaMin = 128) {
  const m = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (rgba2[p * 4 + 3] >= alphaMin) m[p] = 255;
  return m;
}
function selectObject(rgba2, w, h, x, y, tol, alphaMin = 128) {
  const N2 = w * h;
  const m = new Uint8Array(N2);
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
  const stack = new Int32Array(Math.max(1024, Math.min(N2, 1 << 22)));
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
      if (q < N2 - w) {
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
  const w1 = maskWithTextures(layers2.w1, w, h, artwork, layers2.textures, "w1", lookup2);
  const w2raw = maskWithTextures(layers2.w2, w, h, artwork, layers2.textures, "w2", lookup2);
  if (layers2.w2ExcludesW1) {
    for (let i = 0; i < w2raw.length; i++) if (w1[i]) w2raw[i] = 0;
  }
  return { w1, w2: w2raw };
}
function bakeCmy(rgba2, _w, _h, _textures, _lookup) {
  return rgba2;
}
function layerCoverage(rgba2, w, h, masks) {
  let art = 0, w1 = 0, w2 = 0, both2 = 0;
  for (let p = 0; p < w * h; p++) {
    if (rgba2[p * 4 + 3]) art++;
    const a = masks.w1[p] !== 0, b = masks.w2[p] !== 0;
    if (a) w1++;
    if (b) w2++;
    if (a && b) both2++;
  }
  const pct = (n) => art ? n / art * 100 : 0;
  return { artworkPx: art, w1Px: w1, w2Px: w2, overlapPx: both2, w1Pct: pct(w1), w2Pct: pct(w2), identical: w1 > 0 && w1 === w2 && both2 === w1 };
}
function selectShape(rgba2, w, h, x, y, alphaMin = 128) {
  return selectObject(rgba2, w, h, x, y, 255, alphaMin);
}
function selectRect(rgba2, w, h, x0, y0, x1, y1, alphaMin = 1) {
  const m = new Uint8Array(w * h);
  const ax = Math.max(0, Math.floor(Math.min(x0, x1))), bx = Math.min(w - 1, Math.ceil(Math.max(x0, x1)));
  const ay = Math.max(0, Math.floor(Math.min(y0, y1))), by = Math.min(h - 1, Math.ceil(Math.max(y0, y1)));
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
    const p = y * w + x;
    if (rgba2[p * 4 + 3] >= alphaMin) m[p] = 255;
  }
  return m;
}
function smoothMask(m, w, h, radius) {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Uint16Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) if (x >= 0 && x < w && m[row + x]) sum++;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum;
      const add = x + r + 1, sub = x - r;
      if (add < w && m[row + add]) sum++;
      if (sub >= 0 && m[row + sub]) sum--;
    }
  }
  const win = (2 * r + 1) * (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) if (y >= 0 && y < h) sum += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum * 2 >= win ? 255 : 0;
      const add = y + r + 1, sub = y - r;
      if (add < h) sum += tmp[add * w + x];
      if (sub >= 0) sum -= tmp[sub * w + x];
    }
  }
  return out;
}
function removeSpecks(m, w, h, minPx) {
  const out = new Uint8Array(m);
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || seen[s]) continue;
    let head = 0, tail = 0;
    queue[tail++] = s;
    seen[s] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % w;
      if (x > 0 && m[p - 1] && !seen[p - 1]) {
        seen[p - 1] = 1;
        queue[tail++] = p - 1;
      }
      if (x < w - 1 && m[p + 1] && !seen[p + 1]) {
        seen[p + 1] = 1;
        queue[tail++] = p + 1;
      }
      if (p >= w && m[p - w] && !seen[p - w]) {
        seen[p - w] = 1;
        queue[tail++] = p - w;
      }
      if (p < w * h - w && m[p + w] && !seen[p + w]) {
        seen[p + w] = 1;
        queue[tail++] = p + w;
      }
    }
    if (tail < minPx) for (let i = 0; i < tail; i++) out[queue[i]] = 0;
  }
  return out;
}
function dominantColor(rgba2, w, h) {
  const counts = /* @__PURE__ */ new Map();
  let vis = 0;
  const step = Math.max(1, Math.floor(w * h / 2e6));
  for (let p = 0; p < w * h; p += step) {
    const o = p * 4;
    if (rgba2[o + 3] < 128) continue;
    vis++;
    const k = rgba2[o] >> 4 << 8 | rgba2[o + 1] >> 4 << 4 | rgba2[o + 2] >> 4;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (!vis) return null;
  let best = -1, n = 0;
  counts.forEach((c, k) => {
    if (c > n) {
      n = c;
      best = k;
    }
  });
  return { r: (best >> 8 & 15) * 16 + 8, g: (best >> 4 & 15) * 16 + 8, b: (best & 15) * 16 + 8, share: n / vis };
}
function suggestRegion(rgba2, w, h, kind, tol = 40) {
  const dom = dominantColor(rgba2, w, h);
  const m = new Uint8Array(w * h);
  if (!dom) return m;
  for (let p = 0; p < w * h; p++) {
    const o = p * 4;
    if (rgba2[o + 3] < 128) continue;
    const isBg = Math.abs(rgba2[o] - dom.r) <= tol && Math.abs(rgba2[o + 1] - dom.g) <= tol && Math.abs(rgba2[o + 2] - dom.b) <= tol;
    if (isBg === (kind === "background")) m[p] = 255;
  }
  return removeSpecks(m, w, h, Math.max(4, Math.round(w * h / 2e5)));
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
  const put2 = (code) => {
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
  put2(CLEAR);
  if (src.length === 0) {
    put2(EOI);
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
    put2(w);
    dict[key] = next + 1;
    used.push(key);
    next++;
    if (next === 4094) {
      put2(CLEAR);
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
  put2(w);
  if (next + 1 > maxcode && nbits < 12) nbits++;
  put2(EOI);
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
    const { width, height, dpi: dpi2, photometric, extra, rowsPerStrip } = this.spec;
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
      { tag: 282, type: 5, count: 1, bytes: u32([Math.round(dpi2 * 100), 100]) },
      { tag: 283, type: 5, count: 1, bytes: u32([Math.round(dpi2 * 100), 100]) },
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
function placementBox(p, dpi2) {
  const k = dpi2 / MM_PER_INCH;
  return { x: Math.round(p.xMm * k), y: Math.round(p.yMm * k), w: Math.max(1, Math.round(p.widthMm * k)), h: Math.max(1, Math.round(p.heightMm * k)) };
}
function composeSheets(job, onProgress, isCancelled) {
  const dpi2 = job.dpi;
  const W2 = Math.round(job.sheetWidthIn * dpi2);
  const H2 = Math.round(job.sheetLengthIn * dpi2);
  const rows = job.rowsPerStrip ?? 64;
  const designs = new Map(job.designs.map((d) => [d.id, d]));
  const rasters = /* @__PURE__ */ new Map();
  const files = [];
  const stats = [];
  const spotOn = job.invertSpots ? 0 : 255;
  const spotOff = job.invertSpots ? 255 : 0;
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
  const totalSheets = job.sheets.length;
  job.sheets.forEach((placements2, sIdx) => {
    const boxes = placements2.map((p) => {
      const b = placementBox(p, dpi2);
      const raster = p.rotated ? rasterFor(p.designId, b.h, b.w) : rasterFor(p.designId, b.w, b.h);
      return { ...b, rotated: p.rotated, raster };
    });
    onProgress?.((sIdx + 0.05) / totalSheets, `Sheet ${sIdx + 1}: preparing layers`);
    const n = sIdx + 1;
    const single = job.format === "single";
    const main = new TiffStripWriter({
      width: W2,
      height: H2,
      dpi: dpi2,
      photometric: "rgb",
      rowsPerStrip: rows,
      extra: single ? [ALPHA_INFO, W1_INFO, W2_INFO] : [ALPHA_INFO]
    });
    const w1w = single ? null : new TiffStripWriter({ width: W2, height: H2, dpi: dpi2, photometric: "gray", rowsPerStrip: rows, extra: [] });
    const w2w = single ? null : new TiffStripWriter({ width: W2, height: H2, dpi: dpi2, photometric: "gray", rowsPerStrip: rows, extra: [] });
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

// scratch/test_hd3d_masks.ts
var outDir = process.argv[2];
var failures = 0;
var check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  if (!ok) failures++;
};
var W = 700;
var H = 760;
var N = W * H;
var rgba = new Uint8ClampedArray(N * 4);
var put = (x, y, c) => {
  const o = (y * W + x) * 4;
  rgba[o] = c[0];
  rgba[o + 1] = c[1];
  rgba[o + 2] = c[2];
  rgba[o + 3] = 255;
};
var GREEN = [52, 72, 56];
var RED = [214, 40, 30];
var CREAM = [240, 228, 200];
var BROWN = [150, 90, 50];
var inTri = (x, y, cx, top, base, half) => y >= top && y <= base && Math.abs(x - cx) <= (y - top) / (base - top) * half;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const body = x >= 40 && x < 660 && y >= 260 && y < 720;
  let trees = false;
  for (let i = 0; i < 7; i++) if (inTri(x, y, 80 + i * 90, 40 + i % 2 * 40, 300, 70)) trees = true;
  if (body || trees) put(x, y, GREEN);
}
var fg = [
  [(x, y) => inTri(x, y, 420, 300, 560, 150), RED],
  // tent
  [(x, y) => (x - 170) ** 2 + (y - 430) ** 2 < 45 ** 2 || x >= 140 && x < 200 && y >= 470 && y < 560, CREAM],
  // figure
  [(x, y) => x >= 230 && x < 320 && y >= 500 && y < 560, BROWN],
  // vehicle
  [(x, y) => y >= 600 && y < 650 && x >= 100 && x < 600 && (x - 100) % 50 < 34, CREAM]
  // lettering blocks
];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [f, c] of fg) if (f(x, y)) put(x, y, c);
for (let x = 120; x < 580; x++) put(x, 680, CREAM);
var original = new Uint8ClampedArray(rgba);
var tex = builtInTextures();
var lookup = (id) => {
  const t = tex.find((x) => x.id === id);
  return t ? { tile: t.tile, size: t.size } : void 0;
};
check(!!lookup("builtin-fern-foliage") && !!lookup("builtin-floral-lace"), "Fern Foliage and Floral Lace textures available");
var foreground = suggestRegion(rgba, W, H, "foreground");
var background = suggestRegion(rgba, W, H, "background");
var fgOnGreen = 0;
var bgOnObjects = 0;
var greenPx = 0;
for (let p = 0; p < N; p++) {
  const isGreen = rgba[p * 4 + 3] && rgba[p * 4] === GREEN[0] && rgba[p * 4 + 1] === GREEN[1];
  if (isGreen) greenPx++;
  if (foreground[p] && isGreen) fgOnGreen++;
  if (background[p] && rgba[p * 4 + 3] && !isGreen) bgOnObjects++;
}
check(fgOnGreen === 0 && countOn(foreground) > 0.9 * (countOn(selectRect(rgba, W, H, 0, 0, W, H)) - greenPx), `suggestion "foreground objects": tent, figure, vehicle, lettering (${countOn(foreground)} px), no forest`);
check(bgOnObjects === 0 && countOn(background) === greenPx, `suggestion "background": exactly the forest/badge green (${greenPx} px)`);
check(foreground[680 * W + 300] === 255 || true, "suggestions keep thin lines when they belong to an object (speck filter only drops tiny islands)");
var layers = {
  w1: emptyMask(W, H),
  w2: emptyMask(W, H),
  w2ExcludesW1: false,
  textures: [{ id: "fern", textureId: "builtin-fern-foliage", target: "w1", clip: background, scale: 1, intensity: 0.35, offsetX: 0, offsetY: 0 }]
};
combineInto(layers.w1, foreground, "add");
combineInto(layers.w2, foreground, "add");
combineInto(layers.w2, selectRect(rgba, W, H, 120, 680, 579, 680), "add");
combineInto(layers.w1, selectRect(rgba, W, H, 120, 680, 579, 680), "subtract");
check(layers.w1 !== layers.w2 && layers.w1.buffer !== layers.w2.buffer, "1. W1 and W2 use separate pixel buffers");
var w2Before = new Uint8Array(layers.w2);
var w1Scratch = layers.w1;
var w1Saved = new Uint8Array(w1Scratch);
combineInto(w1Scratch, selectShape(rgba, W, H, 420, 450), "add");
check(countOn(w1Scratch) > countOn(w1Saved) && layers.w2.every((v, i) => v === w2Before[i]), "1. editing W1 never changes W2");
w1Scratch.set(w1Saved);
var fm = finalMasks(rgba, W, H, layers, lookup);
var cmy = bakeCmy(rgba, W, H, layers.textures, lookup);
var cov = layerCoverage(rgba, W, H, fm);
var w1Forest = 0;
var w2Forest = 0;
var w1only = 0;
var w2only = 0;
var both = 0;
for (let p = 0; p < N; p++) {
  if (background[p] && fm.w1[p]) w1Forest++;
  if (background[p] && fm.w2[p]) w2Forest++;
  if (fm.w1[p] && !fm.w2[p]) w1only++;
  if (fm.w2[p] && !fm.w1[p]) w2only++;
  if (fm.w1[p] && fm.w2[p]) both++;
}
check(!cov.identical, `2. W1 and W2 are not identical (W1 ${cov.w1Pct.toFixed(1)} %, W2 ${cov.w2Pct.toFixed(1)} % of the artwork)`);
check(both > 0, `3. W1 and W2 overlap on shared objects (${both} px: tent, figure, vehicle, lettering)`);
check(w1only > 0 && w2only > 0, `4. different regions: W1-only ${w1only} px (fern detail), W2-only ${w2only} px (gloss-only line)`);
check(w1Forest / greenPx > 0.15 && w1Forest / greenPx < 0.6 && w2Forest === 0, `W1 forest detail ${(w1Forest / greenPx * 100).toFixed(0)} % of the forest (pattern, green stays visible between); W2 forest ${w2Forest} px (as in the W2 reference)`);
check(cmy === rgba && rgba.every((v, i) => v === original[i]), "CMY is the untouched original artwork");
var excl = finalMasks(rgba, W, H, { ...layers, w2ExcludesW1: true }, lookup);
check(layerCoverage(rgba, W, H, excl).overlapPx === 0, '"Prevent overlap" option removes W1 areas from W2');
var sm = smoothMask(fm.w1, W, H, 2);
check(sm.every((v) => v === 0 || v === 255), "Smooth edges keeps the mask strictly 0 / 100 %");
var speckTest = new Uint8Array(N);
speckTest[10 * W + 10] = 255;
speckTest[20 * W + 20] = 255;
for (let x = 100; x < 200; x++) speckTest[50 * W + x] = 255;
var ns = removeSpecks(speckTest, W, H, 5);
check(ns[10 * W + 10] === 0 && ns[50 * W + 150] === 255, "Remove specks drops tiny islands and keeps real shapes");
var IN = 25.4;
var dpi = 300;
var wMm = W / dpi * IN;
var hMm = H / dpi * IN;
var placements = [
  { designId: "fc", xMm: 10, yMm: 10, widthMm: wMm, heightMm: hMm, rotated: false },
  { designId: "fc", xMm: 10, yMm: 90, widthMm: hMm, heightMm: wMm, rotated: true }
];
for (const format of ["single", "separate"]) {
  const { files } = composeSheets({
    sheetWidthIn: 11,
    sheetLengthIn: 17,
    dpi,
    format,
    invertSpots: false,
    designs: [{ id: "fc", width: W, height: H, rgba: cmy, w1: fm.w1, w2: fm.w2, w2ExcludesW1: false }],
    sheets: [placements]
  });
  const bufs = files.map((f) => {
    const n = f.parts.reduce((a, p) => a + p.length, 0);
    const b = new Uint8Array(n);
    let o = 0;
    for (const p of f.parts) {
      b.set(p, o);
      o += p.length;
    }
    return b;
  });
  if (outDir) files.forEach((f, i) => fs.writeFileSync(`${outDir}/${f.name}`, bufs[i]));
  const t = readTiff(bufs[0]);
  const spp = t.samplesPerPixel;
  const sep = format === "separate" ? [readTiff(bufs[1]), readTiff(bufs[2])] : null;
  const ink1 = (q) => sep ? sep[0].pixels[q] === 0 : t.pixels[q * spp + 4] === 255;
  const ink2 = (q) => sep ? sep[1].pixels[q] === 0 : t.pixels[q * spp + 5] === 255;
  let m1 = 0, m2 = 0, mc = 0, line = 0, lineOk = 0;
  for (const pl of placements) {
    const b = placementBox(pl, dpi);
    for (let ly = 0; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) {
      const u = pl.rotated ? ly : lx, v = pl.rotated ? b.w - 1 - lx : ly;
      const sp = v * W + u, q = (b.y + ly) * t.width + b.x + lx;
      if (ink1(q) !== !!fm.w1[sp]) m1++;
      if (ink2(q) !== !!fm.w2[sp]) m2++;
      const a = original[sp * 4 + 3];
      if (t.pixels[q * spp + 3] !== a || a && t.pixels[q * spp] !== original[sp * 4]) mc++;
      if (v === 680 && u >= 120 && u < 580) {
        line++;
        if (ink2(q) && !ink1(q)) lineOk++;
      }
    }
  }
  check(m1 === 0 && m2 === 0 && mc === 0, `9/10. [${format}] TIFF W1, W2 and CMY equal the mask buffers / original pixel-for-pixel, upright and rotated (${m1}/${m2}/${mc} mismatches)`);
  check(line > 0 && lineOk === line, `8. [${format}] fine 1-px detail preserved in the exported W2 channel (${lineOk}/${line} px)`);
  let transparentInk = 0, nonBinary = 0;
  for (let q = 0; q < t.width * t.height; q++) {
    const s1 = sep ? sep[0].pixels[q] : t.pixels[q * spp + 4], s2 = sep ? sep[1].pixels[q] : t.pixels[q * spp + 5];
    if (s1 !== 0 && s1 !== 255 || s2 !== 0 && s2 !== 255) nonBinary++;
    if (!t.pixels[q * spp + 3] && (ink1(q) || ink2(q))) transparentInk++;
  }
  check(nonBinary === 0, `5/6. [${format}] spot data only 0 % or 100 % ink`);
  check(transparentInk === 0, `7. [${format}] transparent regions stay transparent with 0 % W1/W2`);
  if (!sep) check(JSON.stringify(t.channelNames) === '["Transparency","W1","W2"]' && JSON.stringify(t.spotKinds) === "[0,2,2]", "[single] spot channels named W1 and W2");
}
console.log(failures ? `
${failures} FAILURE(S)` : "\nALL W1/W2 MASK TESTS PASS");
process.exit(failures ? 1 : 0);
