/**
 * On-screen rendering of a 3D HD design (editor viewport, thumbnails, sheet preview).
 * Display only: nothing here changes the print data (W1 / CMY / W2).
 *
 * CMY: pure original artwork, never altered or overlaid with red/black/white.
 * W1:  white / raised 3D mask in red, preserving unselected artwork colours and texture.
 * W2:  gloss / varnish mask in red, preserving unselected artwork colours (matte forest).
 * Combined: 3D embossed relief + gloss specular highlights.
 */
import type { HdPreviewMode, Mask } from './types';

export interface ViewSource {
  width: number;
  height: number;
  original: Uint8ClampedArray;
  cmy: Uint8ClampedArray;
  w1: Mask;
  w2: Mask;
}

export interface ViewOptions {
  mode: HdPreviewMode;
  /** Screen pixels per artwork pixel. */
  zoom: number;
  /** Screen position of artwork pixel (0, 0). */
  panX: number;
  panY: number;
  show: { w1: boolean; cmy: boolean; w2: boolean };
  /** Editing overlay (e.g. the active layer) tinted on top — NEVER shown in CMY view. */
  overlay?: { mask: Mask; rgb: [number, number, number]; opacity: number } | null;
  /**
   * W1 / W2 views: false (default) = colour artwork with the mask in red;
   * true = mask only (selected = white, unselected = black).
   */
  maskOnly?: boolean;
  /** Second overlay (e.g. texture region). */
  overlay2?: { mask: Mask; rgb: [number, number, number]; opacity: number } | null;
}

/** Preview colours only — never written to any print channel. */
export const W1_PREVIEW: [number, number, number] = [255, 0, 0];
export const W2_PREVIEW: [number, number, number] = [255, 0, 0];

export function checker(x: number, y: number): number {
  return ((x >> 3) + (y >> 3)) & 1 ? 236 : 252;
}

/** Dedicated CMY Renderer: displays original full-colour artwork without any overlay */
export function renderCmyView(src: ViewSource, o: ViewOptions, out: Uint8ClampedArray, outW: number, outH: number): void {
  const { width: w, height: h } = src;
  const inv = 1 / o.zoom;
  const colX = new Int32Array(outW);
  for (let x = 0; x < outW; x++) colX[x] = Math.floor((x + 0.5 - o.panX) * inv);

  for (let y = 0; y < outH; y++) {
    const sy = Math.floor((y + 0.5 - o.panY) * inv);
    const rowIn = sy >= 0 && sy < h;
    for (let x = 0; x < outW; x++) {
      const t = (y * outW + x) * 4;
      const sx = colX[x];
      if (!rowIn || sx < 0 || sx >= w) {
        out[t] = 214; out[t + 1] = 214; out[t + 2] = 208; out[t + 3] = 255;
        continue;
      }
      const p = sy * w + sx;
      const a = src.original[p * 4 + 3] / 255;
      const bg = checker(x, y);
      out[t] = Math.round(src.original[p * 4] * a + bg * (1 - a));
      out[t + 1] = Math.round(src.original[p * 4 + 1] * a + bg * (1 - a));
      out[t + 2] = Math.round(src.original[p * 4 + 2] * a + bg * (1 - a));
      out[t + 3] = 255;
    }
  }
}

/** Dedicated W1 Renderer: W1 raised mask in red; preserves unselected artwork colours */
export function renderW1View(src: ViewSource, o: ViewOptions, out: Uint8ClampedArray, outW: number, outH: number): void {
  const { width: w, height: h } = src;
  const inv = 1 / o.zoom;
  const colX = new Int32Array(outW);
  for (let x = 0; x < outW; x++) colX[x] = Math.floor((x + 0.5 - o.panX) * inv);

  for (let y = 0; y < outH; y++) {
    const sy = Math.floor((y + 0.5 - o.panY) * inv);
    const rowIn = sy >= 0 && sy < h;
    for (let x = 0; x < outW; x++) {
      const t = (y * outW + x) * 4;
      const sx = colX[x];
      if (!rowIn || sx < 0 || sx >= w) {
        const blk = !!o.maskOnly;
        out[t] = blk ? 0 : 214; out[t + 1] = blk ? 0 : 214; out[t + 2] = blk ? 0 : 208; out[t + 3] = 255;
        continue;
      }
      const p = sy * w + sx;
      const on = src.w1[p] !== 0;
      const a = src.original[p * 4 + 3] / 255;
      if (o.maskOnly) {
        const v = (on && a > 0) ? 255 : 0;
        out[t] = v; out[t + 1] = v; out[t + 2] = v; out[t + 3] = 255;
      } else if (on && a > 0) {
        out[t] = W1_PREVIEW[0]; out[t + 1] = W1_PREVIEW[1]; out[t + 2] = W1_PREVIEW[2]; out[t + 3] = 255;
      } else {
        const bg = checker(x, y);
        out[t] = Math.round(src.original[p * 4] * a + bg * (1 - a));
        out[t + 1] = Math.round(src.original[p * 4 + 1] * a + bg * (1 - a));
        out[t + 2] = Math.round(src.original[p * 4 + 2] * a + bg * (1 - a));
        out[t + 3] = 255;
      }
    }
  }
}

/** Dedicated W2 Renderer: W2 gloss mask in red; preserves unselected artwork colours */
export function renderW2View(src: ViewSource, o: ViewOptions, out: Uint8ClampedArray, outW: number, outH: number): void {
  const { width: w, height: h } = src;
  const inv = 1 / o.zoom;
  const colX = new Int32Array(outW);
  for (let x = 0; x < outW; x++) colX[x] = Math.floor((x + 0.5 - o.panX) * inv);

  for (let y = 0; y < outH; y++) {
    const sy = Math.floor((y + 0.5 - o.panY) * inv);
    const rowIn = sy >= 0 && sy < h;
    for (let x = 0; x < outW; x++) {
      const t = (y * outW + x) * 4;
      const sx = colX[x];
      if (!rowIn || sx < 0 || sx >= w) {
        const blk = !!o.maskOnly;
        out[t] = blk ? 0 : 214; out[t + 1] = blk ? 0 : 214; out[t + 2] = blk ? 0 : 208; out[t + 3] = 255;
        continue;
      }
      const p = sy * w + sx;
      const on = src.w2[p] !== 0;
      const a = src.original[p * 4 + 3] / 255;
      if (o.maskOnly) {
        const v = (on && a > 0) ? 255 : 0;
        out[t] = v; out[t + 1] = v; out[t + 2] = v; out[t + 3] = 255;
      } else if (on && a > 0) {
        out[t] = W2_PREVIEW[0]; out[t + 1] = W2_PREVIEW[1]; out[t + 2] = W2_PREVIEW[2]; out[t + 3] = 255;
      } else {
        const bg = checker(x, y);
        out[t] = Math.round(src.original[p * 4] * a + bg * (1 - a));
        out[t + 1] = Math.round(src.original[p * 4 + 1] * a + bg * (1 - a));
        out[t + 2] = Math.round(src.original[p * 4 + 2] * a + bg * (1 - a));
        out[t + 3] = 255;
      }
    }
  }
}

/** Dedicated Combined 3D HD Renderer: simulates 3D relief + gloss specular finish */
export function renderCombinedView(src: ViewSource, o: ViewOptions, out: Uint8ClampedArray, outW: number, outH: number): void {
  const { width: w, height: h } = src;
  const inv = 1 / o.zoom;
  const relief = Math.max(1, Math.round(1.6 * inv));
  const colX = new Int32Array(outW);
  for (let x = 0; x < outW; x++) colX[x] = Math.floor((x + 0.5 - o.panX) * inv);

  for (let y = 0; y < outH; y++) {
    const sy = Math.floor((y + 0.5 - o.panY) * inv);
    const rowIn = sy >= 0 && sy < h;
    for (let x = 0; x < outW; x++) {
      const t = (y * outW + x) * 4;
      const sx = colX[x];
      if (!rowIn || sx < 0 || sx >= w) {
        out[t] = 214; out[t + 1] = 214; out[t + 2] = 208; out[t + 3] = 255;
        continue;
      }
      const p = sy * w + sx;
      const bg = 246;
      const a = !o.show.cmy ? 0 : src.original[p * 4 + 3] / 255;
      let r = src.original[p * 4] * a + bg * (1 - a);
      let g = src.original[p * 4 + 1] * a + bg * (1 - a);
      let b = src.original[p * 4 + 2] * a + bg * (1 - a);

      if (o.show.w1 && src.w1[p]) {
        const at = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src.w1[yy * w + xx]);
        const shade = (at(sx - relief, sy - relief) ? 0 : 1) - (at(sx + relief, sy + relief) ? 0 : 1);
        const d = shade > 0 ? 75 : shade < 0 ? -60 : 8;
        r = Math.max(0, Math.min(255, r + d));
        g = Math.max(0, Math.min(255, g + d));
        b = Math.max(0, Math.min(255, b + d));
      }
      if (o.show.w2 && src.w2[p]) {
        const band = 0.5 + 0.5 * Math.sin(((sx + sy) * o.zoom) / 22);
        const gl = 0.12 + 0.28 * band * band;
        r += (255 - r) * gl; g += (255 - g) * gl; b += (255 - b) * gl;
      }
      out[t] = Math.round(r); out[t + 1] = Math.round(g); out[t + 2] = Math.round(b); out[t + 3] = 255;
    }
  }
}

/** Unified dispatcher for rendering views into `out` (RGBA, outW × outH). */
export function renderView(src: ViewSource, o: ViewOptions, out: Uint8ClampedArray, outW: number, outH: number): void {
  if (o.mode === 'cmy' || o.mode === 'original') {
    renderCmyView(src, o, out, outW, outH);
    return;
  }
  if (o.mode === 'w1') {
    renderW1View(src, o, out, outW, outH);
  } else if (o.mode === 'w2') {
    renderW2View(src, o, out, outW, outH);
  } else {
    renderCombinedView(src, o, out, outW, outH);
  }

  // Active layer editing overlays (only when actively painting/editing in the editor)
  const ov = o.overlay, ov2 = o.overlay2;
  if (!ov && !ov2) return;

  const inv = 1 / o.zoom;
  const colX = new Int32Array(outW);
  for (let x = 0; x < outW; x++) colX[x] = Math.floor((x + 0.5 - o.panX) * inv);

  for (let y = 0; y < outH; y++) {
    const sy = Math.floor((y + 0.5 - o.panY) * inv);
    if (sy < 0 || sy >= src.height) continue;
    for (let x = 0; x < outW; x++) {
      const sx = colX[x];
      if (sx < 0 || sx >= src.width) continue;
      const p = sy * src.width + sx;
      const t = (y * outW + x) * 4;
      let r = out[t], g = out[t + 1], b = out[t + 2];
      if (ov && ov.mask[p]) {
        const k = ov.opacity;
        r = r * (1 - k) + ov.rgb[0] * k;
        g = g * (1 - k) + ov.rgb[1] * k;
        b = b * (1 - k) + ov.rgb[2] * k;
      }
      if (ov2 && ov2.mask[p]) {
        const k = ov2.opacity;
        r = r * (1 - k) + ov2.rgb[0] * k;
        g = g * (1 - k) + ov2.rgb[1] * k;
        b = b * (1 - k) + ov2.rgb[2] * k;
      }
      out[t] = Math.round(r); out[t + 1] = Math.round(g); out[t + 2] = Math.round(b);
    }
  }
}

/** Renders the design thumbnail for thumbnails and sheet preview. Allocates independent ImageData for each view. */
export function renderThumbnail(
  src: ViewSource, mode: HdPreviewMode, maxPx: number,
  show = { w1: true, cmy: true, w2: true }, maskOnly = false
): HTMLCanvasElement {
  const zoom = Math.min(maxPx / src.width, maxPx / src.height, 1);
  const outW = Math.max(1, Math.round(src.width * zoom));
  const outH = Math.max(1, Math.round(src.height * zoom));
  const c = document.createElement('canvas');
  c.width = outW; c.height = outH;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(outW, outH);
  renderView(src, { mode, zoom, panX: 0, panY: 0, show, maskOnly }, img.data, outW, outH);
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const sx = Math.min(src.width - 1, Math.floor((x + 0.5) / zoom)), sy = Math.min(src.height - 1, Math.floor((y + 0.5) / zoom));
    const p = sy * src.width + sx;
    const a = src.original[p * 4 + 3];
    const ink = mode === 'w1' ? src.w1[p] : mode === 'w2' ? src.w2[p] : mode === 'combined' ? src.w1[p] || src.w2[p] : 0;
    const visible = ((mode === 'w1' || mode === 'w2') && maskOnly) ? ink : a || ink;
    if (!visible) img.data[(y * outW + x) * 4 + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
