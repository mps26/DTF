/**
 * Built-in 3D textures: seamlessly tiling height maps (0 = low, 255 = high),
 * generated procedurally so they carry real surface detail at any scale.
 * Pure (no DOM).
 */
import type { HdTexture } from './types';

const S = 256;
const TAU = Math.PI * 2;

function make(fn: (u: number, v: number) => number): Uint8Array {
  // u, v in [0, 1): every pattern below is periodic in u and v, so tiles join seamlessly.
  const out = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      out[y * S + x] = Math.max(0, Math.min(255, Math.round(fn((x + 0.5) / S, (y + 0.5) / S) * 255)));
    }
  }
  return out;
}

/** Tileable value noise (periodic lattice). */
function periodicNoise(seed: number, cells: number): (u: number, v: number) => number {
  const rnd = new Float32Array(cells * cells);
  let s = seed >>> 0;
  for (let i = 0; i < rnd.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    rnd[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const at = (i: number, j: number) => rnd[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * cells, y = v * cells;
    const i = Math.floor(x), j = Math.floor(y);
    const fx = sm(x - i), fy = sm(y - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

const carbonFibre = () => make((u, v) => {
  // 2×2 twill weave: tows alternate direction per cell, each tow has a rounded profile and fibre lines.
  const n = 8;
  const cx = Math.floor(u * n), cy = Math.floor(v * n);
  const fu = u * n - cx, fv = v * n - cy;
  const horizontal = ((cx + cy) & 3) < 2;
  const across = horizontal ? fv : fu;
  const along = horizontal ? fu : fv;
  const profile = Math.sin(Math.PI * across); // rounded tow
  const fibres = 0.12 * Math.sin(TAU * 6 * across);
  const end = Math.min(1, Math.sin(Math.PI * along) * 3); // dip where tows cross
  return 0.15 + 0.75 * profile * end + fibres;
});

const honeycomb = () => make((u, v) => {
  // Hexagonal cells with raised walls. Lattice: 6 columns × 6 rows of hex cells (periodic).
  const cols = 6;
  const sx = u * cols, sy = v * cols * (Math.sqrt(3) / 2) * (2 / Math.sqrt(3));
  // Distance to the nearest hex centre on a periodic lattice.
  let best = 1e9, second = 1e9;
  for (let j = -1; j <= cols; j++) {
    for (let i = -1; i <= cols; i++) {
      const cxp = i + ((j & 1) ? 0.5 : 0);
      const cyp = j;
      const d = Math.hypot(sx - cxp, sy - cyp);
      if (d < best) { second = best; best = d; } else if (d < second) second = d;
    }
  }
  const edge = second - best; // 0 on a wall
  return edge < 0.08 ? 1 : edge < 0.16 ? 1 - (edge - 0.08) / 0.08 * 0.75 : 0.25;
});

const diamondPlate = () => make((u, v) => {
  // Mechanical tread plate: raised elongated diamonds in alternating directions.
  const n = 6;
  const cx = Math.floor(u * n), cy = Math.floor(v * n);
  let fu = u * n - cx - 0.5, fv = v * n - cy - 0.5;
  const flip = (cx + cy) & 1;
  const a = flip ? Math.PI / 4 : -Math.PI / 4;
  const ru = fu * Math.cos(a) - fv * Math.sin(a);
  const rv = fu * Math.sin(a) + fv * Math.cos(a);
  const d = Math.abs(ru) / 0.42 + Math.abs(rv) / 0.11;
  return d < 1 ? 0.55 + 0.45 * Math.sqrt(1 - d) : 0.12;
});

const knurled = () => make((u, v) => {
  // Fine knurling: crossed diagonal ridges (fine 3D pattern).
  const n = 16;
  const a = Math.abs(Math.sin(Math.PI * n * (u + v)));
  const b = Math.abs(Math.sin(Math.PI * n * (u - v)));
  return Math.min(a, b) ** 0.6;
});

const engravedGuilloche = () => make((u, v) => {
  // Decorative engraved lines: interfering sine waves like banknote guilloche.
  const w1 = Math.sin(TAU * (u * 12 + 0.35 * Math.sin(TAU * v * 2)));
  const w2 = Math.sin(TAU * (v * 12 + 0.35 * Math.sin(TAU * u * 3)));
  const lines = Math.abs(w1 * 0.6 + w2 * 0.4);
  return lines < 0.25 ? 1 - lines / 0.25 * 0.4 : 0.15;
});

const pebbleEmboss = () => {
  const n1 = periodicNoise(7, 16), n2 = periodicNoise(11, 32), n3 = periodicNoise(23, 64);
  return make((u, v) => {
    // Raised emboss / leather grain: multi-octave tileable noise with sharpened crests.
    const h = 0.55 * n1(u, v) + 0.3 * n2(u, v) + 0.15 * n3(u, v);
    return Math.min(1, Math.max(0, (h - 0.25) * 1.9));
  });
};

const concentricRings = () => make((u, v) => {
  // Engraved concentric rings around each tile centre (periodic grid of rosettes).
  const n = 2;
  const fu = u * n - Math.floor(u * n) - 0.5, fv = v * n - Math.floor(v * n) - 0.5;
  const r = Math.hypot(fu, fv);
  return 0.5 + 0.5 * Math.cos(TAU * r * 14);
});

const brushedMetal = () => {
  const n = periodicNoise(5, 256);
  return make((u, v) => {
    // Mechanical brushed finish: fine horizontal streaks.
    const streak = n(u * 0.0625, v) * 0.7 + n(u * 0.25, v * 0.5) * 0.3;
    return 0.2 + 0.8 * streak;
  });
};

const diamondLattice = () => make((u, v) => {
  // Raised diamond lattice (criss-cross lines), e.g. a quilted / grid pattern on a surface.
  const n = 10;
  const a = Math.abs(((u + v) * n) % 1 - 0.5);
  const b = Math.abs(((u - v + 1) * n) % 1 - 0.5);
  const line = Math.max(a, b); // 0.5 on a line
  return line > 0.42 ? 1 : line > 0.36 ? (line - 0.36) / 0.06 : 0;
});

const halftoneDots = () => make((u, v) => {
  // Raised halftone dots on a staggered grid.
  const n = 16;
  const row = Math.floor(v * n);
  const fu = (u * n + (row & 1) * 0.5) % 1 - 0.5, fv = v * n - row - 0.5;
  const r = Math.hypot(fu, fv);
  return r < 0.3 ? 1 : r < 0.36 ? 1 - (r - 0.3) / 0.06 : 0;
});

/** Distance from point to segment, on a wrapping unit torus (seamless tiles). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function hash(i: number, j: number, k: number): number {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fernFoliage = () => {
  // Leafy fern fronds (stem + alternating leaflets) scattered on a wrapping grid:
  // the fine raised foliage detail seen over pine trees on 3D HD stickers.
  const n = 4;
  const segs: Array<[number, number, number, number, number]> = []; // ax, ay, bx, by, width
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    for (let f = 0; f < 2; f++) {
      const cx = (i + 0.25 + 0.5 * hash(i, j, f * 3 + 1)) / n, cy = (j + 0.25 + 0.5 * hash(i, j, f * 3 + 2)) / n;
      const ang = -Math.PI / 2 + (hash(i, j, f * 3 + 3) - 0.5) * 1.6;
      const L = 0.2 + 0.08 * hash(i, j, f + 9);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const sx = cx - (dx * L) / 2, sy = cy - (dy * L) / 2;
      segs.push([sx, sy, sx + dx * L, sy + dy * L, 0.006]);
      const leaves = 9;
      for (let k = 1; k <= leaves; k++) {
        const t = k / (leaves + 1);
        const px = sx + dx * L * t, py = sy + dy * L * t;
        const len = 0.055 * (1 - t * 0.75);
        for (const side of [-1, 1]) {
          const la = ang + side * 0.95;
          segs.push([px, py, px + Math.cos(la) * len, py + Math.sin(la) * len, 0.0045]);
        }
      }
    }
  }
  // Rasterise each segment only over its own bounding box (wrapping), not the whole tile.
  const f = new Float32Array(S * S);
  for (const [ax, ay, bx, by, wd] of segs) {
    const pad = wd * 1.8;
    const x0 = Math.floor((Math.min(ax, bx) - pad) * S), x1 = Math.ceil((Math.max(ax, bx) + pad) * S);
    const y0 = Math.floor((Math.min(ay, by) - pad) * S), y1 = Math.ceil((Math.max(ay, by) + pad) * S);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = segDist((x + 0.5) / S, (y + 0.5) / S, ax, ay, bx, by);
      if (d >= pad) continue;
      const val = 1 - d / pad; // tapered: 1 on the centre line → 0 at the edge, so Intensity sets the line thickness
      const i = (((y % S) + S) % S) * S + (((x % S) + S) % S);
      if (val > f[i]) f[i] = val;
    }
  }
  const out = new Uint8Array(S * S);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, f[i])) * 255);
  return out;
};

const floralLace = () => make((u, v) => {
  // Lace: six-petal rosettes with an inner ring and connecting dots (decorative raised lines).
  const n = 3;
  const fu = (u * n) % 1 - 0.5, fv = (v * n) % 1 - 0.5;
  const r = Math.hypot(fu, fv), th = Math.atan2(fv, fu);
  const petal = 0.36 * (0.62 + 0.38 * Math.cos(6 * th));
  const line = (d: number, w: number) => Math.max(0, 1 - d / (w * 1.6)); // tapered profile: Intensity sets thickness
  const outline = line(Math.abs(r - petal), 0.018);
  const ring = line(Math.abs(r - 0.1), 0.014);
  const corner = line(Math.hypot(Math.abs(fu) - 0.5, Math.abs(fv) - 0.5) - 0.05, 0.02);
  const vein = r < petal ? line(Math.abs(Math.sin(6 * th / 2)) * r, 0.01) * (r > 0.1 ? 1 : 0) : 0;
  return Math.max(outline, ring, corner, vein);
});

const DEFS: Array<{ id: string; name: string; category: string; gen: () => Uint8Array }> = [
  { id: 'builtin-fern-foliage', name: 'Fern Foliage', category: 'Fine 3D pattern', gen: fernFoliage },
  { id: 'builtin-floral-lace', name: 'Floral Lace', category: 'Decorative engraved', gen: floralLace },
  { id: 'builtin-diamond-lattice', name: 'Diamond Lattice', category: 'Fine 3D pattern', gen: diamondLattice },
  { id: 'builtin-halftone', name: 'Halftone Dots', category: 'Fine 3D pattern', gen: halftoneDots },
  { id: 'builtin-carbon-fibre', name: 'Carbon Fibre Weave', category: 'Carbon fibre', gen: carbonFibre },
  { id: 'builtin-honeycomb', name: 'Honeycomb', category: 'Honeycomb', gen: honeycomb },
  { id: 'builtin-diamond-plate', name: 'Diamond Tread Plate', category: 'Mechanical', gen: diamondPlate },
  { id: 'builtin-brushed-metal', name: 'Brushed Metal', category: 'Mechanical', gen: brushedMetal },
  { id: 'builtin-knurled', name: 'Fine Knurl', category: 'Fine 3D pattern', gen: knurled },
  { id: 'builtin-pebble-emboss', name: 'Pebble Emboss', category: 'Raised emboss', gen: pebbleEmboss },
  { id: 'builtin-guilloche', name: 'Engraved Guilloche', category: 'Decorative engraved', gen: engravedGuilloche },
  { id: 'builtin-rings', name: 'Engraved Rings', category: 'Decorative engraved', gen: concentricRings }
];

let cache: HdTexture[] | null = null;

export function builtInTextures(): HdTexture[] {
  if (!cache) {
    cache = DEFS.map((d) => ({ id: d.id, name: d.name, category: d.category, size: S, tile: d.gen(), builtIn: true }));
  }
  return cache;
}
