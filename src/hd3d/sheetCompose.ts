/**
 * Builds the 3D HD print files for a gang sheet, strip by strip. Pure (no DOM):
 * runs in the export Web Worker and in Node tests.
 *
 * Alignment guarantee: each design is resampled ONCE to its printed pixel size with
 * the same mapping for CMY, W1 and W2 (src/hd3d/resample.ts), and every copy is
 * placed with one integer position and one rotation that all three layers share.
 */
import { resampleMask, resampleRgba } from './resample';
import { TiffChannelInfo, TiffStripWriter } from './tiffWriter';

export const MM_PER_INCH = 25.4;

export interface ExportDesign {
  id: string;
  width: number;
  height: number;
  /** CMY artwork (RGBA, straight alpha), textures for CMY already applied. */
  rgba: Uint8ClampedArray;
  /** Final W1 / W2 masks (0 / 255), same pixel grid as rgba. */
  w1: Uint8Array;
  w2: Uint8Array;
  /** Re-applied after resampling, so W1 and W2 never share a print pixel when excluded. */
  w2ExcludesW1: boolean;
}

export interface ExportPlacement {
  designId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
}

export type ExportFormat = 'single' | 'separate';

export interface ExportJob {
  sheetWidthIn: number;
  sheetLengthIn: number;
  dpi: number;
  format: ExportFormat;
  /**
   * Single TIFF spot channels — false (default): 255 = 100 % ink; true: 0 = 100 % ink.
   * Separate mask TIFFs are always positive (black = 100 % ink, white = no ink).
   */
  invertSpots: boolean;
  designs: ExportDesign[];
  sheets: ExportPlacement[][];
  rowsPerStrip?: number;
}

export interface ExportFile {
  name: string;
  parts: Uint8Array[];
}

export interface ExportStats {
  widthPx: number;
  heightPx: number;
  w1Pixels: number;
  w2Pixels: number;
  artworkPixels: number;
}

const W1_INFO: TiffChannelInfo = { name: 'W1', kind: 'spot', display: [255, 255, 255] };
const W2_INFO: TiffChannelInfo = { name: 'W2', kind: 'spot', display: [0, 174, 239] };
const ALPHA_INFO: TiffChannelInfo = { name: 'Transparency', kind: 'alpha' };

interface PrintRaster { w: number; h: number; rgba: Uint8ClampedArray; w1: Uint8Array; w2: Uint8Array }

/** Integer pixel box of a placement on the sheet. Width/height come from the size only, so every copy is identical. */
export function placementBox(p: ExportPlacement, dpi: number) {
  const k = dpi / MM_PER_INCH;
  return { x: Math.round(p.xMm * k), y: Math.round(p.yMm * k), w: Math.max(1, Math.round(p.widthMm * k)), h: Math.max(1, Math.round(p.heightMm * k)) };
}

export function composeSheets(
  job: ExportJob,
  onProgress?: (fraction: number, label: string) => void,
  isCancelled?: () => boolean
): { files: ExportFile[]; stats: ExportStats[] } {
  const dpi = job.dpi;
  const W = Math.round(job.sheetWidthIn * dpi);
  const H = Math.round(job.sheetLengthIn * dpi);
  const rows = job.rowsPerStrip ?? 64;
  const designs = new Map(job.designs.map((d) => [d.id, d]));
  const rasters = new Map<string, PrintRaster>();
  const files: ExportFile[] = [];
  const stats: ExportStats[] = [];
  const spotOn = job.invertSpots ? 0 : 255;
  const spotOff = job.invertSpots ? 255 : 0;

  const rasterFor = (designId: string, w: number, h: number): PrintRaster => {
    const key = `${designId}:${w}x${h}`;
    let r = rasters.get(key);
    if (!r) {
      const d = designs.get(designId);
      if (!d) throw new Error(`Design ${designId} is missing`);
      r = {
        w, h,
        rgba: resampleRgba(d.rgba, d.width, d.height, w, h),
        w1: resampleMask(d.w1, d.width, d.height, w, h),
        w2: resampleMask(d.w2, d.width, d.height, w, h)
      };
      if (d.w2ExcludesW1) for (let i = 0; i < r.w2.length; i++) if (r.w1[i]) r.w2[i] = 0;
      rasters.set(key, r);
    }
    return r;
  };

  const totalSheets = job.sheets.length;
  job.sheets.forEach((placements, sIdx) => {
    const boxes = placements.map((p) => {
      const b = placementBox(p, dpi);
      // Unrotated print raster: a rotated copy shows the design's width along the sheet's height.
      const raster = p.rotated ? rasterFor(p.designId, b.h, b.w) : rasterFor(p.designId, b.w, b.h);
      return { ...b, rotated: p.rotated, raster };
    });
    onProgress?.((sIdx + 0.05) / totalSheets, `Sheet ${sIdx + 1}: preparing layers`);

    const n = sIdx + 1;
    const single = job.format === 'single';
    const main = new TiffStripWriter({
      width: W, height: H, dpi, photometric: 'rgb', rowsPerStrip: rows,
      extra: single ? [ALPHA_INFO, W1_INFO, W2_INFO] : [ALPHA_INFO]
    });
    const w1w = single ? null : new TiffStripWriter({ width: W, height: H, dpi, photometric: 'gray', rowsPerStrip: rows, extra: [] });
    const w2w = single ? null : new TiffStripWriter({ width: W, height: H, dpi, photometric: 'gray', rowsPerStrip: rows, extra: [] });
    const st: ExportStats = { widthPx: W, heightPx: H, w1Pixels: 0, w2Pixels: 0, artworkPixels: 0 };

    for (let y0 = 0; y0 < H; y0 += rows) {
      if (isCancelled?.()) throw new Error('cancelled');
      const rh = Math.min(rows, H - y0);
      const rgba = new Uint8ClampedArray(W * rh * 4);
      const m1 = new Uint8Array(W * rh);
      const m2 = new Uint8Array(W * rh);
      for (const b of boxes) {
        const yy0 = Math.max(y0, b.y), yy1 = Math.min(y0 + rh, b.y + b.h);
        if (yy0 >= yy1) continue;
        const xx0 = Math.max(0, b.x), xx1 = Math.min(W, b.x + b.w);
        const R = b.raster;
        for (let sy = yy0; sy < yy1; sy++) {
          const ly = sy - b.y;
          for (let sx = xx0; sx < xx1; sx++) {
            const lx = sx - b.x;
            // Source pixel: rotated copies are turned 90° clockwise (same as the on-screen preview).
            const u = b.rotated ? ly : lx;
            const v = b.rotated ? b.w - 1 - lx : ly;
            const sp = v * R.w + u;
            const dp = (sy - y0) * W + sx;
            const a = R.rgba[sp * 4 + 3];
            if (a) {
              rgba[dp * 4] = R.rgba[sp * 4]; rgba[dp * 4 + 1] = R.rgba[sp * 4 + 1]; rgba[dp * 4 + 2] = R.rgba[sp * 4 + 2]; rgba[dp * 4 + 3] = a;
            }
            if (R.w1[sp]) m1[dp] = 1;
            if (R.w2[sp]) m2[dp] = 1;
          }
        }
      }
      // Interleave.
      const spp = single ? 6 : 4;
      const raw = new Uint8Array(W * rh * spp);
      const g1 = single ? null : new Uint8Array(W * rh);
      const g2 = single ? null : new Uint8Array(W * rh);
      for (let p = 0, o = 0; p < W * rh; p++, o += spp) {
        const a = rgba[p * 4 + 3];
        if (a) { raw[o] = rgba[p * 4]; raw[o + 1] = rgba[p * 4 + 1]; raw[o + 2] = rgba[p * 4 + 2]; st.artworkPixels++; }
        else { raw[o] = 255; raw[o + 1] = 255; raw[o + 2] = 255; } // no colour ink where transparent
        raw[o + 3] = a;
        if (m1[p]) st.w1Pixels++;
        if (m2[p]) st.w2Pixels++;
        if (single) {
          raw[o + 4] = m1[p] ? spotOn : spotOff;
          raw[o + 5] = m2[p] ? spotOn : spotOff;
        } else {
          // Separate mask files are print-positive separations: black = 100 % ink, white = none.
          g1![p] = m1[p] ? 0 : 255;
          g2![p] = m2[p] ? 0 : 255;
        }
      }
      main.addStrip(raw);
      w1w?.addStrip(g1!);
      w2w?.addStrip(g2!);
      onProgress?.((sIdx + 0.1 + 0.9 * ((y0 + rh) / H)) / totalSheets, `Sheet ${sIdx + 1}: writing rows ${y0 + rh} / ${H}`);
    }
    const base = `3DHD_11x17_sheet${n}`;
    if (single) {
      files.push({ name: `${base}_CMY+W1+W2.tif`, parts: main.finish() });
    } else {
      files.push({ name: `${base}_CMY.tif`, parts: main.finish() });
      files.push({ name: `${base}_W1.tif`, parts: w1w!.finish() });
      files.push({ name: `${base}_W2.tif`, parts: w2w!.finish() });
    }
    stats.push(st);
  });
  return { files, stats };
}
