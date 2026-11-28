/**
 * AI background removal (subject segmentation) for photos, products, illustrations.
 *
 * Models (run in the browser with transformers.js, inside a Web Worker): BiRefNet-lite
 * (MIT) on capable graphics cards, otherwise ORMBG (Apache-2.0) on the CPU — see
 * src/workers/bgRemovalWorker.ts. Both recognise the foreground object itself, so a
 * subject whose colours match the background (e.g. an off-white T-shirt against a
 * pale sky) is kept intact — something colour-based removal cannot do.
 *
 * Pipeline:
 *  1. The model predicts a soft foreground matte at the original resolution.
 *  2. Matte clean-up (src/utils/cutoutRefine.ts): on a plain backdrop (stickers,
 *     logos, product shots) the cut follows the artwork's outline and everything
 *     inside it is fully opaque, white sticker border included; on photos the
 *     uncertain band at the edge (hair, soft edges) keeps its soft alpha while
 *     the inside of the subject is made fully opaque. No blur of the subject.
 *  3. Edge colour decontamination: in semi-transparent pixels the local background
 *     colour is un-mixed, so there are no light/dark halos on the cut-out.
 *  4. The matte is applied to the ORIGINAL pixels (exact colours, full resolution)
 *     and saved as a real RGBA PNG.
 *  5. Validation: same dimensions as the input, a real alpha channel, and a
 *     plausible subject size — otherwise an error is thrown and nothing is applied.
 *
 * The model is downloaded once (~115 MB for BiRefNet-lite fp16, ~44 MB for ORMBG
 * 8-bit) and then cached by the browser.
 */

import type { WorkerRequest, WorkerResponse } from '../workers/bgRemovalWorker';
import { refineCutout } from './cutoutRefine';

export type AiProgress =
  | { stage: 'loading'; percent: number | null; totalMb?: number }
  | { stage: 'processing' };

export class BackgroundRemovalError extends Error {}

// The model runs in a dedicated Web Worker (src/workers/bgRemovalWorker.ts), so
// downloading and running it never freezes the editor.
let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/bgRemovalWorker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

function runModel(
  pixels: ImageData,
  onProgress?: (p: AiProgress) => void
): Promise<{ matte: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let w: Worker;
    try {
      w = getWorker();
    } catch (err) {
      reject(new BackgroundRemovalError('Your browser cannot run the AI background remover. Your image was not changed.'));
      return;
    }
    const id = nextId++;
    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === 'progress') {
        onProgress?.(m.stage === 'loading' ? { stage: 'loading', percent: m.percent, totalMb: m.totalMb } : { stage: 'processing' });
        return;
      }
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      if (m.type === 'done') {
        resolve({ matte: m.matte, width: m.width, height: m.height });
      } else {
        console.error(`AI background removal ${m.phase} error:`, m.message);
        reject(
          new BackgroundRemovalError(
            m.phase === 'load'
              ? 'The AI background remover could not be loaded (check the internet connection). Your image was not changed.'
              : 'The AI could not process this image. Your image was not changed.'
          )
        );
      }
    };
    const onError = (e: ErrorEvent) => {
      console.error('AI background removal worker crashed', e.message);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      worker?.terminate();
      worker = null;
      reject(new BackgroundRemovalError('The AI background remover stopped unexpectedly. Your image was not changed.'));
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    // RGB only: the model ignores alpha anyway, and sending it would only cost memory.
    const src = pixels.data;
    const rgb = new Uint8ClampedArray(pixels.width * pixels.height * 3);
    for (let i = 0, j = 0; i < src.length; i += 4, j += 3) { rgb[j] = src[i]; rgb[j + 1] = src[i + 1]; rgb[j + 2] = src[i + 2]; }
    w.postMessage({ id, rgb, width: pixels.width, height: pixels.height } satisfies WorkerRequest, [rgb.buffer]);
  });
}

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new BackgroundRemovalError('Could not read the image.'));
    img.src = url;
  });
}

/**
 * Turns the model's soft matte into the final alpha. Pure function (testable).
 * Values are 0–255. Confident regions become fully opaque / transparent; the
 * uncertain band keeps a proportional soft edge. No morphology, no blur.
 */
export function refineMatte(matte: Uint8Array | Uint8ClampedArray): Uint8Array {
  const LOW = 12; // below: background
  const HIGH = 235; // above: solid subject
  const out = new Uint8Array(matte.length);
  for (let i = 0; i < matte.length; i++) {
    const m = matte[i];
    out[i] = m <= LOW ? 0 : m >= HIGH ? 255 : Math.round(((m - LOW) / (HIGH - LOW)) * 255);
  }
  return out;
}

/**
 * Applies `alpha` to the original RGBA pixels in place and removes background
 * colour spill from semi-transparent edge pixels. Pure function (testable).
 */
export function applyMatte(rgba: Uint8ClampedArray, w: number, h: number, alpha: Uint8Array): void {
  const N = w * h;
  const src = new Uint8ClampedArray(rgba); // original colours for neighbour sampling
  const R = 4; // search radius for the local background colour
  for (let i = 0; i < N; i++) {
    const a = alpha[i];
    const o = i * 4;
    const origA = src[o + 3];
    rgba[o + 3] = Math.round((a * origA) / 255); // never adds opacity to an already transparent PNG pixel
    if (a === 0 || a === 255) continue;
    // Semi-transparent edge pixel: estimate the local background from nearby
    // fully transparent pixels and un-mix it: fg = (c - (1-α)·bg) / α.
    const x = i % w;
    const y = (i - x) / w;
    let br = 0, bgc = 0, bb = 0, n = 0;
    for (let dy = -R; dy <= R; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (alpha[j] !== 0) continue;
        br += src[j * 4]; bgc += src[j * 4 + 1]; bb += src[j * 4 + 2]; n++;
      }
    }
    if (n === 0) continue;
    const af = Math.max(a / 255, 0.15); // limit amplification on the faintest pixels
    br /= n; bgc /= n; bb /= n;
    rgba[o] = Math.max(0, Math.min(255, Math.round((src[o] - (1 - af) * br) / af)));
    rgba[o + 1] = Math.max(0, Math.min(255, Math.round((src[o + 1] - (1 - af) * bgc) / af)));
    rgba[o + 2] = Math.max(0, Math.min(255, Math.round((src[o + 2] - (1 - af) * bb) / af)));
  }
}

/** Throws BackgroundRemovalError if the result is obviously unusable. Pure (testable). */
export function validateMatte(alpha: Uint8Array): { subjectPercent: number } {
  let solid = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= 128) solid++;
  const subjectPercent = (solid / alpha.length) * 100;
  if (subjectPercent < 0.3) {
    throw new BackgroundRemovalError('No clear subject was found in this image, so nothing was changed.');
  }
  if (subjectPercent > 99.7) {
    throw new BackgroundRemovalError('No background was found to remove, so nothing was changed.');
  }
  return { subjectPercent };
}

/**
 * Picks a flat backdrop colour for an image that already has transparent pixels:
 * the candidate that the artwork's opaque pixels are least similar to, so the
 * backdrop never merges with the artwork. Pure function (testable).
 */
export function pickBackdrop(rgba: Uint8ClampedArray): { r: number; g: number; b: number } {
  const candidates = [
    { r: 255, g: 255, b: 255 },
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 0, b: 255 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 255, b: 255 }
  ];
  const TOL = 40;
  const hits = new Array(candidates.length).fill(0);
  const step = Math.max(1, Math.floor(rgba.length / 4 / 200000)) * 4; // sample ≤ ~200k px
  for (let o = 0; o < rgba.length; o += step) {
    if (rgba[o + 3] < 128) continue;
    for (let c = 0; c < candidates.length; c++) {
      const k = candidates[c];
      if (Math.abs(rgba[o] - k.r) <= TOL && Math.abs(rgba[o + 1] - k.g) <= TOL && Math.abs(rgba[o + 2] - k.b) <= TOL) hits[c]++;
    }
  }
  // The model is most reliable on a natural white/black backdrop: use the first
  // candidate the artwork (almost) never uses, else the least used one.
  let opaque = 0;
  for (let o = 0; o < rgba.length; o += step) if (rgba[o + 3] >= 128) opaque++;
  const free = hits.findIndex((n) => n <= opaque * 0.005);
  if (free >= 0) return candidates[free];
  let best = 0;
  for (let c = 1; c < candidates.length; c++) if (hits[c] < hits[best]) best = c;
  return candidates[best];
}

/**
 * Removes the background with AI. Resolves to a full-resolution PNG data URL
 * with a real alpha channel; rejects with BackgroundRemovalError on failure
 * (the caller keeps the original image).
 */
export async function removeBackgroundAI(
  imageUrl: string,
  onProgress?: (p: AiProgress) => void
): Promise<{ dataUrl: string; subjectPercent: number; width: number; height: number }> {
  const img = await loadImageEl(imageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new BackgroundRemovalError('Could not read the image.');

  // Original pixels at full resolution.
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new BackgroundRemovalError('Your browser could not create the image, so nothing was changed.');
  ctx.drawImage(img, 0, 0);
  const original = ctx.getImageData(0, 0, w, h);

  // The model ignores alpha: transparent pixels reach it with whatever colour is
  // stored behind them (usually black), and it then cuts into the artwork. So an
  // image that already has transparency is flattened onto a flat backdrop colour
  // the artwork does not use; the model and the clean-up both work on that, and
  // the original transparency is kept in the result.
  let hasTransparency = false;
  for (let o = 3; o < original.data.length; o += 4) {
    if (original.data[o] < 255) { hasTransparency = true; break; }
  }
  let pixels = original;
  if (hasTransparency) {
    const bd = pickBackdrop(original.data);
    ctx.fillStyle = `rgb(${bd.r},${bd.g},${bd.b})`;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    pixels = ctx.getImageData(0, 0, w, h);
  }

  const result = await runModel(pixels, onProgress);
  if (result.width !== w || result.height !== h) {
    throw new BackgroundRemovalError('The AI result did not match the image size, so nothing was changed.');
  }

  // AI matte → final alpha: on a plain backdrop the cut follows the artwork's
  // outline (sticker border kept); the object itself is always fully opaque.
  const { alpha } = refineCutout(pixels.data, w, h, refineMatte(result.matte));
  if (hasTransparency) {
    // Keep the original transparency: alpha = cut × original alpha.
    for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round((alpha[i] * original.data[i * 4 + 3]) / 255);
  }
  const { subjectPercent } = validateMatte(alpha);
  applyMatte(pixels.data, w, h, alpha);
  if (hasTransparency) {
    // Partly transparent original pixels keep their own colour (not the backdrop mix).
    const o = original.data, p = pixels.data;
    for (let i = 0; i < alpha.length; i++) {
      const k = i * 4;
      if (o[k + 3] < 255) { p[k] = o[k]; p[k + 1] = o[k + 1]; p[k + 2] = o[k + 2]; }
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return { dataUrl: canvas.toDataURL('image/png'), subjectPercent, width: w, height: h };
}
