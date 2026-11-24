/**
 * PNG intake for 3D HD: decode at full resolution (no resizing, no flattening),
 * read the DPI stored in the file, and keep the original file untouched.
 */
import type { HdDesign } from './types';
import { emptyMask, generateW1Mask, generateW2Mask } from './maskOps';

/** Largest artwork accepted (pixels). Each design keeps RGBA + two masks in memory (≈ 6 bytes / px). */
export const MAX_DESIGN_PIXELS = 120_000_000;

export class HdImageError extends Error {}

/** DPI from the PNG pHYs chunk (pixels per metre), or null. Reads only the file header area. */
export async function readPngDpi(file: Blob): Promise<number | null> {
  const head = new Uint8Array(await file.slice(0, Math.min(file.size, 1 << 20)).arrayBuffer());
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => head[i] === b)) return null;
  const v = new DataView(head.buffer);
  let p = 8;
  while (p + 12 <= head.length) {
    const len = v.getUint32(p);
    const type = String.fromCharCode(head[p + 4], head[p + 5], head[p + 6], head[p + 7]);
    if (type === 'pHYs' && p + 8 + 9 <= head.length) {
      const ppx = v.getUint32(p + 8);
      const unit = head[p + 16];
      return unit === 1 && ppx > 0 ? Math.round((ppx * 0.0254) * 10) / 10 : null;
    }
    if (type === 'IDAT' || type === 'IEND') return null;
    p += 12 + len;
  }
  return null;
}

export function isPng(file: File): boolean {
  return file.type === 'image/png' || /\.png$/i.test(file.name);
}

/** Decodes the PNG to straight-alpha RGBA at its full pixel size. */
export async function decodePng(file: Blob): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch {
    throw new HdImageError('This PNG could not be read. Please check the file.');
  }
  const { width, height } = bmp;
  if (width * height > MAX_DESIGN_PIXELS) {
    bmp.close();
    throw new HdImageError(
      `This PNG is ${width} × ${height} px (${Math.round((width * height) / 1e6)} MP). The 3D HD editor handles up to ${MAX_DESIGN_PIXELS / 1e6} MP per design in the browser.`
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new HdImageError('Your browser could not open an image this large.');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const data = ctx.getImageData(0, 0, width, height).data;
  canvas.width = canvas.height = 1; // release the canvas memory early
  return { rgba: data, width, height };
}

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

/** Default printed size: from the file's DPI (else 300 DPI), shrunk if needed to fit the 11 × 17 sheet. */
export function defaultPrintSize(width: number, height: number, dpi: number | null, maxW: number, maxH: number) {
  const d = dpi && dpi >= 30 ? dpi : 300;
  let wIn = width / d, hIn = height / d;
  // Too big for the sheet: shrink (keeping the aspect) until it fits upright or turned 90°.
  const upright = Math.min(maxW / wIn, maxH / hIn);
  const turned = Math.min(maxW / hIn, maxH / wIn);
  const s = Math.min(1, Math.max(upright, turned));
  wIn *= s; hIn *= s;
  const widthIn = Math.floor(wIn * 100) / 100;
  return { widthIn, heightIn: (widthIn * height) / width }; // aspect locked to the artwork
}

export async function loadDesign(file: File, maxW: number, maxH: number): Promise<HdDesign> {
  if (!isPng(file)) throw new HdImageError(`${file.name}: 3D HD accepts PNG files only.`);
  const [dpi, img] = await Promise.all([readPngDpi(file), decodePng(file)]);
  const size = defaultPrintSize(img.width, img.height, dpi, maxW, maxH);
  const w1Gen = generateW1Mask(img.rgba, img.width, img.height);
  const w2 = generateW2Mask(img.rgba, img.width, img.height);
  return {
    id: newId('hd'),
    filename: file.name,
    fileSize: file.size,
    file,
    url: URL.createObjectURL(file),
    width: img.width,
    height: img.height,
    fileDpi: dpi,
    rgba: img.rgba,
    layers: {
      w1: w1Gen.mask,
      w2,
      w2ExcludesW1: false,
      textures: w1Gen.textureApp ? [w1Gen.textureApp] : []
    }, // W1 and W2 independent; overlap allowed on shared foreground objects unless "Prevent overlap" is ticked
    widthIn: size.widthIn,
    heightIn: size.heightIn,
    copies: 1,
    revision: 0
  };
}

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}
