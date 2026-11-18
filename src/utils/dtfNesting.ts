import { ArtworkAsset, SheetSettings, PackedPlacement, SheetInfo, LayoutResult } from '../types';
import { MM_PER_INCH } from './units';
import { findPresetById } from './sheetPresets';

/**
 * DTF gang-sheet nesting engine (standard DTF only — UVDTF keeps its own packer).
 *
 * Why this exists: the previous DTF packer laid designs out in upload order on
 * horizontal "shelves". Every shelf was as tall as its tallest design, so the
 * space beside a large design (e.g. a 9" × 8" print next to 2" × 2" stickers)
 * was always wasted, and small designs were only ever appended to the end.
 *
 * This engine is a multi-start MaxRects packer:
 *   1. Every design is expanded into individual copies.
 *   2. Each copy is inflated by the spacing once (footprint = w + s, h + s) and
 *      the bin is inflated by the spacing once, so the gap between any two
 *      designs is ≥ spacing and spacing is never applied twice.
 *   3. Several item orderings × several MaxRects heuristics (BL, BSSF, BAF,
 *      BLSF, Contact-Point) are packed; every free maximal rectangle on the whole
 *      sheet is considered for every copy, so small designs drop into side gaps.
 *   4. A seeded local search re-orders items (i.e. reconsiders earlier
 *      placements) and keeps any arrangement that is shorter.
 *   5. A gravity compaction pass slides every design up, then left, closing any
 *      remaining gaps without ever introducing an overlap.
 *   6. The best layout (fewest sheets → least film → tightest extent, with an
 *      optional "keep copies together" preference) is returned.
 *
 * The result's coordinates are the single source of truth for the canvas
 * preview, the preview modal and the PNG/TIFF/job-ticket exports.
 */

export const DTF_ROLL_WIDTH_IN = 22;
export const DTF_MIN_LENGTH_IN = 39;
export const DTF_MAX_LENGTH_IN = 100;

const EPS = 1e-6;

type Heuristic = 'BL' | 'BSSF' | 'BAF' | 'BLSF' | 'CP';
const HEURISTICS: Heuristic[] = ['BL', 'BSSF', 'BAF', 'BLSF', 'CP'];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Per-side amounts in mm (left, top, right, bottom). */
export interface SideMm {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Transparent margin on each side of an image, as a fraction of its width/height. */
export interface InkBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface NestItem {
  id: string;
  assetId: string;
  assetOrder: number;
  copyIndex: number;
  w: number; // artwork width (mm), unrotated
  h: number; // artwork height (mm), unrotated
  canRotate: boolean;
  asset: ArtworkAsset;
  inset: SideMm; // fully transparent margin inside the image box (upright), mm
  insetRot: SideMm; // same, for the 90 deg clockwise orientation
  ext: SideMm; // clearance the box needs beyond its edges (upright)
  extRot: SideMm;
}

interface Placed {
  item: NestItem;
  x: number; // top-left of the image box in bin space (mm)
  y: number;
  w: number; // placed image width (swapped when rotated)
  h: number;
  rotated: boolean;
  e: SideMm; // clearance beyond each box edge in this orientation
  inset: SideMm; // transparent margin inside each box edge in this orientation
}

/** Sheet geometry in bin space: the usable area starts at (S, S). */
interface Geo {
  S: number; // half the spacing
  usableW: number;
  usableL: number;
}

interface Orient {
  w: number;
  h: number;
  e: SideMm;
  rotated: boolean;
}

interface Candidate {
  order: NestItem[];
  heuristic: Heuristic;
  rotate: boolean; // whether 90° rotation was allowed for this candidate
  sheets: Placed[][];
  sheetCount: number;
  filmLengthMm: number; // film that will actually be consumed (after min-length clamp)
  extentMm: number; // raw used vertical extent across sheets (tie-breaker)
  groupScore: number;
}

export interface DtfNestingOptions {
  /** Max number of local-search iterations (deterministic for a given input). */
  maxSearchIterations?: number;
  /** Wall-clock budget in ms for the rectangle (MaxRects) optimisation. */
  timeBudgetMs?: number;
  /**
   * Transparent margin per side for each asset id (from inkBounds.ts). Lets the
   * spacing be measured between VISIBLE artwork: a side that already has at least
   * half the spacing of transparent padding needs no extra clearance. Image boxes
   * still never overlap. Missing entries = solid box (full clearance).
   */
  inkBounds?: Record<string, InkBounds | null | undefined>;
}

/* ------------------------------------------------------------------------ */
/* MaxRects bin                                                             */
/* ------------------------------------------------------------------------ */

interface FoundPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  s1: number;
  s2: number;
  s3: number;
}

class MaxRectsBin {
  free: Rect[];
  used: Rect[] = [];

  constructor(public binW: number, public binH: number) {
    this.free = [{ x: 0, y: 0, w: binW, h: binH }];
  }

  /**
   * Best position for a design over all free rectangles and orientations.
   * Works on FOOTPRINTS (image box + per-side clearance). The image box itself
   * must stay inside the usable area [S, S + usable].
   */
  find(orients: Orient[], heur: Heuristic, geo: Geo): (FoundPosition & { orient: Orient }) | null {
    let best: (FoundPosition & { orient: Orient }) | null = null;
    for (const r of this.free) {
      for (const o of orients) {
        const w = o.e.l + o.w + o.e.r;
        const h = o.e.t + o.h + o.e.b;
        const x = Math.max(r.x, geo.S - o.e.l);
        const y = Math.max(r.y, geo.S - o.e.t);
        if (x + w > r.x + r.w + EPS || y + h > r.y + r.h + EPS) continue;
        if (x + o.e.l + o.w > geo.S + geo.usableW + EPS || y + o.e.t + o.h > geo.S + geo.usableL + EPS) continue;
        let s1: number;
        let s2: number;
        const leftoverW = r.x + r.w - (x + w);
        const leftoverH = r.y + r.h - (y + h);
        switch (heur) {
          case 'BL':
            s1 = y + h;
            s2 = x;
            break;
          case 'BSSF':
            s1 = Math.min(leftoverW, leftoverH);
            s2 = Math.max(leftoverW, leftoverH);
            break;
          case 'BLSF':
            s1 = Math.max(leftoverW, leftoverH);
            s2 = Math.min(leftoverW, leftoverH);
            break;
          case 'BAF':
            s1 = r.w * r.h - w * h;
            s2 = Math.min(leftoverW, leftoverH);
            break;
          case 'CP':
          default:
            s1 = -this.contact(x, y, w, h);
            s2 = y + h;
            break;
        }
        // Third key always prefers higher (smaller y) then more-left positions,
        // which keeps the used vertical extent small.
        const s3 = y * 10000 + x;
        if (
          !best ||
          s1 < best.s1 - EPS ||
          (Math.abs(s1 - best.s1) <= EPS && (s2 < best.s2 - EPS || (Math.abs(s2 - best.s2) <= EPS && s3 < best.s3)))
        ) {
          best = { x, y, w, h, rotated: o.rotated, s1, s2, s3, orient: o };
        }
      }
    }
    return best;
  }

  /** Shared edge length with sheet sides (left/right/top) and placed rects. */
  private contact(x: number, y: number, w: number, h: number): number {
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

  place(x: number, y: number, w: number, h: number): void {
    const next: Rect[] = [];
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
    // Prune free rectangles fully contained in another one.
    const pruned: Rect[] = [];
    for (let i = 0; i < next.length; i++) {
      const a = next[i];
      if (a.w <= EPS || a.h <= EPS) continue;
      let contained = false;
      for (let j = 0; j < next.length; j++) {
        if (i === j) continue;
        const b = next[j];
        if (
          a.x >= b.x - EPS &&
          a.y >= b.y - EPS &&
          a.x + a.w <= b.x + b.w + EPS &&
          a.y + a.h <= b.y + b.h + EPS
        ) {
          // Identical rects: keep only the first one.
          const identical =
            Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS &&
            Math.abs(a.w - b.w) <= EPS && Math.abs(a.h - b.h) <= EPS;
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
}

/* ------------------------------------------------------------------------ */
/* Packing helpers                                                          */
/* ------------------------------------------------------------------------ */

function orientsFor(it: NestItem, allowRotate: boolean): Orient[] {
  const o: Orient[] = [{ w: it.w, h: it.h, e: it.ext, rotated: false }];
  if (allowRotate && it.canRotate && Math.abs(it.w - it.h) > EPS) {
    o.push({ w: it.h, h: it.w, e: it.extRot, rotated: true });
  }
  return o;
}

function toPlaced(it: NestItem, pos: FoundPosition & { orient: Orient }): Placed {
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

const footprint = (p: Placed): Rect => ({
  x: p.x - p.e.l,
  y: p.y - p.e.t,
  w: p.e.l + p.w + p.e.r,
  h: p.e.t + p.h + p.e.b
});

function packSequence(
  order: NestItem[],
  heur: Heuristic,
  binW: number,
  binH: number,
  geo: Geo,
  allowRotate: boolean
): Placed[][] {
  const sheets: Placed[][] = [];
  let remaining = order;
  while (remaining.length > 0) {
    const bin = new MaxRectsBin(binW, binH);
    const placed: Placed[] = [];
    const left: NestItem[] = [];
    for (const it of remaining) {
      const pos = bin.find(orientsFor(it, allowRotate), heur, geo);
      if (!pos) {
        left.push(it);
        continue;
      }
      bin.place(pos.x, pos.y, pos.w, pos.h);
      placed.push(toPlaced(it, pos));
    }
    if (placed.length === 0) {
      // Cannot happen: oversize items are pre-scaled to fit an empty sheet.
      break;
    }
    sheets.push(placed);
    remaining = left;
  }
  return sheets;
}

/**
 * Gravity compaction: slide each design up, then left, as far as its
 * clearance allows. Works on footprints so it can never create an overlap or
 * reduce the spacing between visible artwork.
 */
function compactSheet(placed: Placed[], geo: Geo): void {
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;

    placed.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const a of placed) {
      const fa = footprint(a);
      let limit = geo.S; // the box top may not leave the usable area
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

/**
 * Repositioning: lift each design (lowest first) out of the sheet, recompute
 * every free space left by the others, and move it to the highest / left-most
 * spot where it fits (typically a side gap beside a larger design). Repeats
 * until nothing improves. Never overlaps, never reduces clearance.
 */
function repositionSheet(
  placed: Placed[],
  binW: number,
  binH: number,
  geo: Geo,
  allowRotate: boolean,
  deadline: number
): void {
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
      const pos = bin.find(orientsFor(a.item, allowRotate), 'BL', geo);
      if (!pos) continue;
      const np = toPlaced(a.item, pos);
      const improves =
        np.y + np.h < a.y + a.h - 0.05 ||
        (Math.abs(np.y + np.h - (a.y + a.h)) <= 0.05 && np.y < a.y - 0.05);
      if (improves) {
        Object.assign(a, np);
        moved = true;
      }
    }
    compactSheet(placed, geo);
    if (!moved) break;
  }
}

function sheetExtent(placed: Placed[], geo: Geo): number {
  let max = 0;
  for (const p of placed) max = Math.max(max, p.y + p.h - geo.S);
  return max;
}

/** Lower = copies of the same design sit closer together. */
function groupingScore(sheets: Placed[][]): number {
  const byAsset = new Map<string, { sheet: number; cx: number; cy: number; size: number }[]>();
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

/** Deterministic PRNG so the same input always yields the same layout. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function better(a: Candidate, b: Candidate): boolean {
  if (a.sheetCount !== b.sheetCount) return a.sheetCount < b.sheetCount;
  if (Math.abs(a.filmLengthMm - b.filmLengthMm) > 1e-3) return a.filmLengthMm < b.filmLengthMm;
  if (Math.abs(a.extentMm - b.extentMm) > 1e-3) return a.extentMm < b.extentMm;
  return a.groupScore < b.groupScore - 1e-6;
}

/* ------------------------------------------------------------------------ */
/* Public entry point                                                       */
/* ------------------------------------------------------------------------ */

export function packDtfGangSheet(
  assets: ArtworkAsset[],
  settings: SheetSettings,
  options: DtfNestingOptions = {}
): LayoutResult {
  const withInk = nestDtf(assets, settings, options);
  if (!options.inkBounds) return withInk;
  // Box-spaced layouts are also valid under the visible-artwork rule, so try one
  // and keep whichever is better: using transparent padding can never lose.
  const plain = nestDtf(assets, settings, { ...options, inkBounds: undefined });
  return layoutIsBetter(plain, withInk) ? plain : withInk;
}

/** Fewer problems, fewer sheets, less film, then a tighter artwork extent. */
function layoutIsBetter(a: LayoutResult, b: LayoutResult): boolean {
  const invalidA = (a.validationErrors?.length ?? 0) > 0;
  const invalidB = (b.validationErrors?.length ?? 0) > 0;
  if (invalidA !== invalidB) return !invalidA;
  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length;
  if (Math.abs(a.usedLengthMm - b.usedLengthMm) > 0.05) return a.usedLengthMm < b.usedLengthMm;
  const extent = (r: LayoutResult) =>
    r.sheets.reduce((sum, sh) => sum + Math.max(0, ...sh.placements.map((p) => p.yMm + p.heightMm)), 0);
  return extent(a) < extent(b) - 0.05;
}

function nestDtf(
  assets: ArtworkAsset[],
  settings: SheetSettings,
  options: DtfNestingOptions
): LayoutResult {
  const startTime = performance.now();

  // --- Sheet geometry ------------------------------------------------------
  const preset = findPresetById(settings.filmWidthPreset);
  const dtfPreset = preset && preset.printType === 'dtf' ? preset : undefined;
  // Width always comes from the DTF roll (22", or the locked 22.5" roll), never from item sizes.
  const filmWidthMm = (dtfPreset?.widthIn ?? DTF_ROLL_WIDTH_IN) * MM_PER_INCH;
  const minLengthMm = (dtfPreset?.minLengthIn ?? DTF_MIN_LENGTH_IN) * MM_PER_INCH;
  const maxLengthMm = (dtfPreset?.maxLengthIn ?? DTF_MAX_LENGTH_IN) * MM_PER_INCH;

  const isFixed = settings.lengthMode === 'fixed';
  const fixedLengthMm = Math.min(maxLengthMm, Math.max(minLengthMm, settings.fixedLengthMm || minLengthMm));
  const sheetMaxLengthMm = isFixed ? fixedLengthMm : maxLengthMm;

  const spacingMm = Math.max(5, settings.spacingMm ?? 5);
  const marginMm = Math.max(0, settings.marginMm ?? 5);
  const keepTogether = settings.keepDesignsTogether ?? true;
  const rotationEnabled = Boolean(settings.allowItemRotation);

  const usableW = Math.max(1, filmWidthMm - marginMm * 2);
  const usableL = Math.max(1, sheetMaxLengthMm - marginMm * 2);
  // Each box side gets up to half the spacing of clearance (less where the image
  // already has transparent padding). The bin is the usable area grown by half a
  // spacing on every side, so clearances fit flush against the margins.
  const S = spacingMm / 2;
  const geo: Geo = { S, usableW, usableL };
  const binW = usableW + spacingMm;
  const binH = usableL + spacingMm;
  const INK_SAFETY_MM = 0.25; // never trust the transparent margin to the last pixel

  // --- Expand copies -------------------------------------------------------
  const activeAssets = settings.mode === 'repeat' && assets.length > 0 ? [assets[0]] : assets;
  const items: NestItem[] = [];
  let scaledToFitCount = 0;
  activeAssets.forEach((asset, assetOrder) => {
    let w = asset.targetWidthMm || 50;
    let h = asset.targetHeightMm || 50;
    const canRotate = rotationEnabled;

    const fitsUpright = w <= usableW + EPS && h <= usableL + EPS;
    const fitsRotated = canRotate && h <= usableW + EPS && w <= usableL + EPS;
    if (!fitsUpright && !fitsRotated) {
      // Physically larger than the printable area: scale proportionally (never distort).
      const scale = Math.min(usableW / w, usableL / h);
      w *= scale;
      h *= scale;
      scaledToFitCount += Math.max(1, asset.copies || 1);
    }

    // Transparent padding (only when measured for this exact image) counts toward the spacing.
    const ib = options.inkBounds?.[asset.id];
    const pad = (frac: number | undefined, dim: number) =>
      Math.max(0, Math.min(dim / 2, (frac && frac > 0 ? frac : 0) * dim - INK_SAFETY_MM));
    const inset: SideMm = ib
      ? { l: pad(ib.left, w), t: pad(ib.top, h), r: pad(ib.right, w), b: pad(ib.bottom, h) }
      : { l: 0, t: 0, r: 0, b: 0 };
    // 90 deg clockwise: left <- bottom, top <- left, right <- top, bottom <- right.
    const insetRot: SideMm = { l: inset.b, t: inset.l, r: inset.t, b: inset.r };
    const clear = (v: SideMm): SideMm => ({
      l: Math.max(0, S - v.l), t: Math.max(0, S - v.t), r: Math.max(0, S - v.r), b: Math.max(0, S - v.b)
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
    const emptySheet: SheetInfo = {
      sheetIndex: 0,
      placements: [],
      usedWidthMm: filmWidthMm,
      usedLengthMm: Math.round(emptyLengthMm * 10) / 10,
      usedLengthInches: Math.round((emptyLengthMm / MM_PER_INCH) * 100) / 100,
      usedLengthMeters: Math.round((emptyLengthMm / 1000) * 100) / 100,
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

  // --- Candidate evaluation -----------------------------------------------
  const sheetFilmLength = (extent: number): number =>
    isFixed ? fixedLengthMm : Math.min(maxLengthMm, Math.max(minLengthMm, extent + marginMm * 2));

  const evaluate = (order: NestItem[], heuristic: Heuristic, rotate: boolean): Candidate => {
    const sheets = packSequence(order, heuristic, binW, binH, geo, rotate);
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
      rotate,
      sheets,
      sheetCount: sheets.length,
      filmLengthMm,
      extentMm,
      groupScore: groupingScore(sheets)
    };
  };

  // Stable tie-breakers keep copies of one design adjacent in every ordering.
  const tie = (a: NestItem, b: NestItem) => a.assetOrder - b.assetOrder || a.copyIndex - b.copyIndex;
  const sortBy = (key: (i: NestItem) => number) =>
    [...items].sort((a, b) => key(b) - key(a) || tie(a, b));

  const orders: NestItem[][] = [
    sortBy((i) => i.w * i.h),
    sortBy((i) => i.h * 1e4 + i.w),
    sortBy((i) => i.w * 1e4 + i.h),
    sortBy((i) => Math.max(i.w, i.h) * 1e4 + Math.min(i.w, i.h)),
    sortBy((i) => i.w + i.h),
    [...items].sort(tie)
  ];
  if (!keepTogether) {
    // Interleaved (round-robin by design) ordering, sorted by area within each round.
    const rr = [...items].sort(
      (a, b) => a.copyIndex - b.copyIndex || b.w * b.h - a.w * a.h || a.assetOrder - b.assetOrder
    );
    orders.push(rr);
  }

  const timeBudgetMs = options.timeBudgetMs ?? 150;
  const deadline = startTime + timeBudgetMs;
  const pool: Candidate[] = [];
  let best: Candidate | null = null;

  for (let oi = 0; oi < orders.length; oi++) {
    const order = orders[oi];
    // Always try the first ordering with every heuristic; very large jobs stop early.
    if (oi > 0 && performance.now() > deadline) break;
    // With rotation enabled, upright layouts are candidates too, so enabling
    // rotation can never produce a longer sheet than leaving it off.
    for (const rotate of rotationEnabled ? [true, false] : [false]) {
      for (const heur of HEURISTICS) {
        const c = evaluate(order, heur, rotate);
        pool.push(c);
        if (!best || better(c, best)) best = c;
      }
    }
  }

  // --- Local search: reorder items to reconsider earlier placements -------
  const n = items.length;
  const defaultIters = n <= 1 ? 0 : Math.max(20, Math.min(400, Math.floor(40000 / n)));
  const maxIters = options.maxSearchIterations ?? defaultIters;
  const rand = mulberry32(n * 2654435761 + Math.round(filmWidthMm * 7 + sheetMaxLengthMm));
  let current = best!;
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
    const c = evaluate(order, heur, current.rotate);
    if (!better(current, c)) {
      // Accept improvements and sideways moves (lets the search escape plateaus).
      current = c;
      pool.push(c);
      if (better(c, best!)) best = c;
    }
  }

  // --- Final choice ---------------------------------------------------------
  const selectWithGrouping = (candidates: Candidate[], top: Candidate): Candidate => {
    let pick = top;
    if (!keepTogether) return pick;
    // Grouping is a preference: only trade at most ~0.5" (or 1.5%) of the real
    // used extent for it — never film length or sheet count. Using the raw
    // extent (not the 39" clamped length) stops grouping from loosening short
    // layouts and re-opening side gaps.
    const tol = Math.max(12.7, top.extentMm * 0.015);
    for (const c of candidates) {
      if (
        c.sheetCount === top.sheetCount &&
        c.filmLengthMm <= top.filmLengthMm + 1e-3 &&
        c.extentMm <= top.extentMm + tol &&
        c.groupScore < pick.groupScore - 1e-6
      ) {
        pick = c;
      }
    }
    return pick;
  };
  let chosen = selectWithGrouping(pool, best!);

  // --- Repositioning: move designs into side gaps left anywhere on the sheet --
  {
    const sheetsR = chosen.sheets.map((sh) => sh.map((p) => ({ ...p })));
    const repoDeadline = performance.now() + 250;
    for (const sh of sheetsR) {
      if (sh.length <= 400) repositionSheet(sh, binW, binH, geo, chosen.rotate, repoDeadline);
    }
    let filmLengthMm = 0;
    let extentMm = 0;
    for (const sh of sheetsR) {
      const e = sheetExtent(sh, geo);
      extentMm += e;
      filmLengthMm += sheetFilmLength(e);
    }
    const repositioned: Candidate = {
      ...chosen, sheets: sheetsR, filmLengthMm, extentMm, groupScore: groupingScore(sheetsR)
    };
    if (!better(chosen, repositioned)) {
      pool.push(repositioned);
      chosen = repositioned;
    }
  }

  // --- Build result ----------------------------------------------------------
  const buildResult = (cand: Candidate): LayoutResult => {
    const round3 = (v: number) => Math.round(v * 1000) / 1000;
    const placements: PackedPlacement[] = [];
    const sheets: SheetInfo[] = [];
    let totalArtworkAreaMm2 = 0;

    cand.sheets.forEach((sheetPlaced, sheetIndex) => {
      const ordered = [...sheetPlaced].sort((a, b) => a.y - b.y || a.x - b.x);
      const sheetPlacements: PackedPlacement[] = ordered.map((p) => ({
        id: p.item.id,
        assetId: p.item.assetId,
        copyIndex: p.item.copyIndex,
        sheetIndex,
        xMm: round3(marginMm + p.x - S),
        yMm: round3(marginMm + p.y - S),
        widthMm: round3(p.w),
        heightMm: round3(p.h),
        rotated: p.rotated,
        inkInsetMm: { l: round3(p.inset.l), t: round3(p.inset.t), r: round3(p.inset.r), b: round3(p.inset.b) },
        asset: p.item.asset
      }));
      placements.push(...sheetPlacements);

      const lengthMm = sheetFilmLength(sheetExtent(sheetPlaced, geo));
      const filmAreaMm2 = filmWidthMm * lengthMm;
      const artworkAreaMm2 = sheetPlaced.reduce((sum, p) => sum + p.w * p.h, 0);
      totalArtworkAreaMm2 += artworkAreaMm2;
      const utilization = filmAreaMm2 > 0 ? (artworkAreaMm2 / filmAreaMm2) * 100 : 0;

      sheets.push({
        sheetIndex,
        placements: sheetPlacements,
        usedWidthMm: filmWidthMm,
        // Round UP to 0.1 mm so the bottom margin is never shortened by rounding
        // (preview and export both use this exact length).
        usedLengthMm: Math.min(maxLengthMm, Math.ceil(lengthMm * 10 - 1e-6) / 10),
        usedLengthInches: Math.round((lengthMm / MM_PER_INCH) * 100) / 100,
        usedLengthMeters: Math.round((lengthMm / 1000) * 100) / 100,
        totalCopies: sheetPlacements.length,
        filmAreaMm2,
        artworkAreaMm2,
        wastePercent: Math.max(0, Math.min(100, Math.round(100 - utilization))),
        utilizationPercent: Math.round(utilization * 10) / 10,
        unusedAreaMm2: Math.max(0, filmAreaMm2 - artworkAreaMm2)
      });
    });

    const totalLengthMm = sheets.reduce((sum, s) => sum + s.usedLengthMm, 0);
    const filmAreaMm2 = sheets.reduce((sum, s) => sum + s.filmAreaMm2, 0);
    const utilization = filmAreaMm2 > 0 ? (totalArtworkAreaMm2 / filmAreaMm2) * 100 : 0;
    const overflowCount = items.length - placements.length;

    return {
      placements,
      sheets,
      totalCopies: placements.length,
      requestedCopies: items.length,
      usedWidthMm: filmWidthMm,
      usedLengthMm: Math.round(totalLengthMm * 10) / 10,
      usedLengthInches: Math.round((totalLengthMm / MM_PER_INCH) * 100) / 100,
      usedLengthMeters: Math.round((totalLengthMm / 1000) * 100) / 100,
      filmAreaMm2,
      artworkAreaMm2: totalArtworkAreaMm2,
      unusedAreaMm2: Math.max(0, filmAreaMm2 - totalArtworkAreaMm2),
      utilizationPercent: Math.round(utilization * 10) / 10,
      wastePercent: Math.max(0, Math.min(100, Math.round(100 - utilization))),
      overflow: overflowCount > 0,
      overflowCount,
      scaledToFitCount,
      validationErrors: [] as string[],
      calculationTimeMs: Math.round(performance.now() - startTime)
    };
  };

  // --- Final safety validation ---------------------------------------------
  // Every layout is checked box-against-box before it is returned. If the chosen
  // one ever fails, fall back to the next-best candidate that passes; a layout
  // that cannot be validated is flagged (validationErrors) and export refuses it.
  const ranked = [chosen, ...pool.filter((c) => c !== chosen).sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0))];
  let firstResult: LayoutResult | null = null;
  for (const cand of ranked) {
    const result = buildResult(cand);
    const errors = validateLayout(result, { spacingMm, marginMm });
    if (errors.length === 0) return result;
    if (!firstResult) firstResult = { ...result, validationErrors: errors };
  }
  return firstResult!;
}

export interface LayoutRules {
  spacingMm: number;
  marginMm: number;
}

/**
 * Strict validation of a finished layout (also used by export):
 *  - every requested copy placed exactly once,
 *  - every image box inside the sheet margins,
 *  - image boxes never overlap (not even their transparent padding), and
 *  - visible artwork is at least the spacing apart: along the separating axis the
 *    box gap plus the transparent insets of the two facing sides (inkInsetMm,
 *    measured by the engine) must reach the spacing.
 * Returns human-readable violations; empty = safe to print.
 */
export function validateLayout(layout: LayoutResult, rules: LayoutRules): string[] {
  const errors: string[] = [];
  const TOL = 0.01; // mm (coordinates are rounded to 0.001 mm)
  const { spacingMm, marginMm } = rules;
  const zero = { l: 0, t: 0, r: 0, b: 0 };
  const seen = new Set<string>();
  for (const p of layout.placements) {
    if (seen.has(p.id)) errors.push(`Duplicate placement ${p.id}`);
    seen.add(p.id);
  }
  if (layout.requestedCopies !== undefined && layout.placements.length !== layout.requestedCopies) {
    errors.push(`Placed ${layout.placements.length} of ${layout.requestedCopies} requested copies`);
  }
  for (const sheet of layout.sheets) {
    const W = sheet.usedWidthMm;
    const L = sheet.usedLengthMm;
    const ps = sheet.placements;
    for (const p of ps) {
      if (!(p.widthMm > 0 && p.heightMm > 0)) errors.push(`${p.id} has invalid size`);
      if (p.xMm < marginMm - TOL || p.yMm < marginMm - TOL ||
          p.xMm + p.widthMm > W - marginMm + TOL || p.yMm + p.heightMm > L - marginMm + TOL) {
        errors.push(`${p.id} is outside the printable area of sheet ${sheet.sheetIndex + 1}`);
      }
    }
    // Sort by x so the pair scan can stop early (no pair needs more than the spacing).
    const byX = [...ps].sort((a, b) => a.xMm - b.xMm);
    for (let i = 0; i < byX.length; i++) {
      const a = byX[i];
      const ia = a.inkInsetMm ?? zero;
      for (let j = i + 1; j < byX.length; j++) {
        const b = byX[j];
        if (b.xMm - (a.xMm + a.widthMm) >= spacingMm - TOL) break;
        const ib = b.inkInsetMm ?? zero;
        const need = (inA: number, inB: number) => Math.max(0, spacingMm - inA - inB) - TOL;
        const ok =
          b.xMm - (a.xMm + a.widthMm) >= need(ia.r, ib.l) ||
          a.xMm - (b.xMm + b.widthMm) >= need(ib.r, ia.l) ||
          b.yMm - (a.yMm + a.heightMm) >= need(ia.b, ib.t) ||
          a.yMm - (b.yMm + b.heightMm) >= need(ib.b, ia.t);
        if (!ok) {
          const gap = Math.max(
            b.xMm - (a.xMm + a.widthMm), a.xMm - (b.xMm + b.widthMm),
            b.yMm - (a.yMm + a.heightMm), a.yMm - (b.yMm + b.heightMm)
          );
          errors.push(
            gap < -TOL
              ? `${a.id} overlaps ${b.id} on sheet ${sheet.sheetIndex + 1}`
              : `${a.id} and ${b.id} artwork closer than ${spacingMm} mm on sheet ${sheet.sheetIndex + 1}`
          );
        }
      }
    }
  }
  return errors;
}
