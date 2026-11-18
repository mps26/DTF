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
 *  2. Matte clean-up: confident subject → fully opaque, confident background →
 *     fully transparent, the uncertain band (hair, soft edges) keeps its soft alpha.
 *     No erosion/dilation, no blur of the subject.
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
  url: string,
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
    w.postMessage({ id, url } satisfies WorkerRequest);
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
  {
    const result = await runModel(imageUrl, onProgress);
    if (result.width !== w || result.height !== h) {
      throw new BackgroundRemovalError('The AI result did not match the image size, so nothing was changed.');
    }
    const alpha = refineMatte(result.matte);
    const { subjectPercent } = validateMatte(alpha);

    // Apply to the original pixels at full resolution.
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new BackgroundRemovalError('Your browser could not create the image, so nothing was changed.');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    applyMatte(imageData.data, w, h, alpha);
    ctx.putImageData(imageData, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), subjectPercent, width: w, height: h };
  }
}
