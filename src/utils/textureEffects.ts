/**
 * Texture Effects - 11 Production-Grade Image Filters
 * For DTF Gang Sheet Builder
 * Preserves 100% alpha transparency, original resolution and aspect ratio.
 */

export type TextureEffectType =
  | 'none'
  | 'vintage'
  | 'nostalgia'
  | 'greyscale'
  | 'tint'
  | 'downlight'
  | 'blue-wash'
  | 'yellow-glow'
  | 'turquoise'
  | 'negative'
  | 'fade'
  | 'sepia';

export interface TextureEffectDef {
  id: TextureEffectType;
  name: string;
  colors: [string, string]; // Preview circle dots matching mockup
  description: string;
}

export const TEXTURE_EFFECTS_LIST: TextureEffectDef[] = [
  {
    id: 'vintage',
    name: 'Vintage',
    colors: ['#f59e0b', '#fbbf24'],
    description: 'Warm, slightly faded colors with subtle film characteristics.'
  },
  {
    id: 'nostalgia',
    name: 'Nostalgia',
    colors: ['#b45309', '#d97706'],
    description: 'Soft warm tones, reduced contrast, and a nostalgic photographic appearance.'
  },
  {
    id: 'greyscale',
    name: 'Greyscale',
    colors: ['#475569', '#94a3b8'],
    description: 'Accurate grayscale luminance conversion preserving fine details.'
  },
  {
    id: 'tint',
    name: 'Tint',
    colors: ['#a855f7', '#c084fc'],
    description: 'Configurable purple/magenta tint while preserving details and transparency.'
  },
  {
    id: 'downlight',
    name: 'Downlight',
    colors: ['#ea580c', '#1e293b'],
    description: 'Darker, dramatic lighting treatment with controlled highlights and shadows.'
  },
  {
    id: 'blue-wash',
    name: 'Blue Wash',
    colors: ['#2563eb', '#60a5fa'],
    description: 'Cool blue color overlay while retaining original image details.'
  },
  {
    id: 'yellow-glow',
    name: 'Yellow Glow',
    colors: ['#eab308', '#fde047'],
    description: 'Warm golden-yellow glow without destroying highlights.'
  },
  {
    id: 'turquoise',
    name: 'Turquoise',
    colors: ['#06b6d4', '#2dd4bf'],
    description: 'Vibrant turquoise/cyan color treatment preserving shadows and details.'
  },
  {
    id: 'negative',
    name: 'Negative',
    colors: ['#1e1b4b', '#38bdf8'],
    description: 'Inverts RGB color channels while preserving the original alpha channel.'
  },
  {
    id: 'fade',
    name: 'Fade',
    colors: ['#fda4af', '#ffe4e6'],
    description: 'Reduced contrast and saturation creating a soft, faded appearance.'
  },
  {
    id: 'sepia',
    name: 'Sepia',
    colors: ['#78350f', '#b45309'],
    description: 'Traditional brown-toned photographic effect.'
  }
];

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * 1. Vintage: Warm, slightly faded colors with subtle film characteristics
 */
export function applyVintage(r: number, g: number, b: number): [number, number, number] {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const vr = r * 1.15 + 18 + (lum > 128 ? 10 : 0);
  const vg = g * 0.98 + 8;
  const vb = b * 0.82;
  return [clamp(vr), clamp(vg), clamp(vb)];
}

/**
 * 2. Nostalgia: Soft warm tones, reduced contrast, and a nostalgic photographic appearance
 */
export function applyNostalgia(r: number, g: number, b: number): [number, number, number] {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const desatR = lum + (r - lum) * 0.78;
  const desatG = lum + (g - lum) * 0.78;
  const desatB = lum + (b - lum) * 0.78;
  const nr = desatR * 1.08 + 22;
  const ng = desatG * 1.02 + 16;
  const nb = desatB * 0.88 + 10;
  return [clamp(nr), clamp(ng), clamp(nb)];
}

/**
 * 3. Greyscale: Accurate Rec.709 grayscale luminance conversion
 */
export function applyGreyscale(r: number, g: number, b: number): [number, number, number] {
  const lum = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b);
  return [lum, lum, lum];
}

/**
 * 4. Tint: Purple/Magenta tint while preserving details and transparency
 */
export function applyTint(r: number, g: number, b: number): [number, number, number] {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const tr = r * 0.95 + lum * 0.25;
  const tg = g * 0.75 + lum * 0.10;
  const tb = b * 1.20 + lum * 0.30;
  return [clamp(tr), clamp(tg), clamp(tb)];
}

/**
 * 5. Downlight: Darker, dramatic lighting treatment with controlled highlights and shadows
 */
export function applyDownlight(r: number, g: number, b: number): [number, number, number] {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const curve = Math.pow(lum, 1.35);
  const factor = curve / (lum || 0.001);
  const dr = r * factor * 0.95;
  const dg = g * factor * 0.90;
  const db = b * factor * 0.85;
  return [clamp(dr), clamp(dg), clamp(db)];
}

/**
 * 6. Blue Wash: Cool blue color overlay while retaining original image details
 */
export function applyBlueWash(r: number, g: number, b: number): [number, number, number] {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const bwr = r * 0.65 + lum * 0.10;
  const bwg = g * 0.82 + lum * 0.15;
  const bwb = b * 1.15 + lum * 0.35 + 20;
  return [clamp(bwr), clamp(bwg), clamp(bwb)];
}

/**
 * 7. Yellow Glow: Warm golden-yellow glow without destroying highlights
 */
export function applyYellowGlow(r: number, g: number, b: number): [number, number, number] {
  const ygr = r * 1.18 + 25;
  const ygg = g * 1.12 + 20;
  const ygb = b * 0.65;
  return [clamp(ygr), clamp(ygg), clamp(ygb)];
}

/**
 * 8. Turquoise: Vibrant turquoise/cyan color treatment preserving shadows and details
 */
export function applyTurquoise(r: number, g: number, b: number): [number, number, number] {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const tqr = r * 0.50 + lum * 0.08;
  const tqg = g * 1.15 + lum * 0.25;
  const tqb = b * 1.20 + lum * 0.28;
  return [clamp(tqr), clamp(tqg), clamp(tqb)];
}

/**
 * 9. Negative: Inverts RGB color channels while preserving original alpha
 */
export function applyNegative(r: number, g: number, b: number): [number, number, number] {
  return [255 - r, 255 - g, 255 - b];
}

/**
 * 10. Fade: Reduced contrast, lifted black floor, and reduced saturation for a soft faded look
 */
export function applyFade(r: number, g: number, b: number): [number, number, number] {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const desatR = lum + (r - lum) * 0.55;
  const desatG = lum + (g - lum) * 0.55;
  const desatB = lum + (b - lum) * 0.55;
  const fdr = 35 + desatR * 0.72;
  const fdg = 35 + desatG * 0.72;
  const fdb = 38 + desatB * 0.72;
  return [clamp(fdr), clamp(fdg), clamp(fdb)];
}

/**
 * 11. Sepia: Traditional warm brown-toned photographic effect
 */
export function applySepia(r: number, g: number, b: number): [number, number, number] {
  const sr = 0.393 * r + 0.769 * g + 0.189 * b;
  const sg = 0.349 * r + 0.686 * g + 0.168 * b;
  const sb = 0.272 * r + 0.534 * g + 0.131 * b;
  return [clamp(sr), clamp(sg), clamp(sb)];
}

/**
 * Applies one of the 11 effects with adjustable intensity (0% to 100%).
 * Strictly preserves transparency (alpha channel is unchanged).
 */
export async function applyTextureFilter(
  img: HTMLImageElement,
  effect: TextureEffectType,
  intensity: number = 50
): Promise<string> {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0, width, height);

  // If intensity is 0 or effect is none, return exact original image
  if (intensity <= 0 || effect === 'none') {
    return canvas.toDataURL('image/png');
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const t = Math.max(0, Math.min(1, intensity / 100));

  // Select shader function
  let shader: (r: number, g: number, b: number) => [number, number, number];
  switch (effect) {
    case 'vintage':
      shader = applyVintage;
      break;
    case 'nostalgia':
      shader = applyNostalgia;
      break;
    case 'greyscale':
      shader = applyGreyscale;
      break;
    case 'tint':
      shader = applyTint;
      break;
    case 'downlight':
      shader = applyDownlight;
      break;
    case 'blue-wash':
      shader = applyBlueWash;
      break;
    case 'yellow-glow':
      shader = applyYellowGlow;
      break;
    case 'turquoise':
      shader = applyTurquoise;
      break;
    case 'negative':
      shader = applyNegative;
      break;
    case 'fade':
      shader = applyFade;
      break;
    case 'sepia':
      shader = applySepia;
      break;
    default:
      return canvas.toDataURL('image/png');
  }

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue; // Skip completely transparent pixels

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [er, eg, eb] = shader(r, g, b);

    // Blend between original and effect based on intensity t
    data[i] = clamp(r * (1 - t) + er * t);
    data[i + 1] = clamp(g * (1 - t) + eg * t);
    data[i + 2] = clamp(b * (1 - t) + eb * t);
    // data[i + 3] remains strictly unchanged!
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

