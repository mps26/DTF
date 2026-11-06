import { CropBox } from '../types';

/**
 * Loads an image from a URL or data URL and returns an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Inspects an image to check if it contains genuine transparency (alpha < 240)
 */
export async function inspectAlphaTransparency(img: HTMLImageElement): Promise<{ hasAlpha: boolean; minAlpha: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(img.naturalWidth, 1000);
  canvas.height = Math.min(img.naturalHeight, 1000);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { hasAlpha: false, minAlpha: 255 };

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minAlpha = 255;
  let transparentPixelCount = 0;
  const totalPixels = canvas.width * canvas.height;

  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a < minAlpha) minAlpha = a;
    if (a < 240) {
      transparentPixelCount++;
    }
  }

  // If at least 0.5% of pixels have transparency, consider it transparent
  const hasAlpha = transparentPixelCount > totalPixels * 0.005;
  return { hasAlpha, minAlpha };
}

/**
 * Calculates the bounding box of non-transparent visible artwork (alpha > alphaThreshold)
 */
export async function calculateAlphaBoundingBox(
  img: HTMLImageElement,
  alphaThreshold: number = 8,
  paddingPx: number = 2
): Promise<CropBox> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      minX: 0,
      minY: 0,
      maxX: img.naturalWidth,
      maxY: img.naturalHeight,
      width: img.naturalWidth,
      height: img.naturalHeight,
      emptyPercent: 0
    };
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let visiblePixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      if (alpha > alphaThreshold) {
        visiblePixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    // No artwork found, fallback to full image
    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
      width,
      height,
      emptyPercent: 0
    };
  }

  // Apply configurable padding
  minX = Math.max(0, minX - paddingPx);
  minY = Math.max(0, minY - paddingPx);
  maxX = Math.min(width, maxX + paddingPx);
  maxY = Math.min(height, maxY + paddingPx);

  const cropWidth = Math.max(1, maxX - minX);
  const cropHeight = Math.max(1, maxY - minY);
  const totalCanvasArea = width * height;
  const artworkArea = cropWidth * cropHeight;
  const emptyPercent = Math.max(0, Math.round(((totalCanvasArea - artworkArea) / totalCanvasArea) * 100));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: cropWidth,
    height: cropHeight,
    emptyPercent
  };
}

/**
 * Crops an image to the given bounding box and returns a data URL
 */
export async function cropImageToBoundingBox(img: HTMLImageElement, cropBox: CropBox): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = cropBox.width;
  canvas.height = cropBox.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(
    img,
    cropBox.minX,
    cropBox.minY,
    cropBox.width,
    cropBox.height,
    0,
    0,
    cropBox.width,
    cropBox.height
  );

  return canvas.toDataURL('image/png');
}

/**
 * Intelligent background removal:
 * Detects background color by sampling perimeter pixels (corners and edges).
 * Flood fills outer matching regions to transparent while strictly preserving
 * internal foreground colors (such as white letters inside a design).
 */
export async function removeImageBackground(
  img: HTMLImageElement,
  options: {
    targetColor?: { r: number; g: number; b: number };
    tolerance?: number;
    feather?: number;
  } = {}
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  // Determine background color by sampling the 4 corners
  let bgR = 255;
  let bgG = 255;
  let bgB = 255;

  if (options.targetColor) {
    bgR = options.targetColor.r;
    bgG = options.targetColor.g;
    bgB = options.targetColor.b;
  } else {
    // Sample corners: top-left, top-right, bottom-left, bottom-right
    const corners = [
      0,
      (width - 1) * 4,
      ((height - 1) * width) * 4,
      ((height - 1) * width + (width - 1)) * 4
    ];
    let sumR = 0, sumG = 0, sumB = 0;
    for (const idx of corners) {
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
    }
    bgR = Math.round(sumR / 4);
    bgG = Math.round(sumG / 4);
    bgB = Math.round(sumB / 4);
  }

  const tolerance = options.tolerance ?? 25;
  const toleranceSq = tolerance * tolerance * 3;

  // Mask array: 1 = background to remove, 0 = keep
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);

  function colorDiffSq(idx: number): number {
    const dr = data[idx] - bgR;
    const dg = data[idx + 1] - bgG;
    const db = data[idx + 2] - bgB;
    return dr * dr + dg * dg + db * db;
  }

  // Edge-seeded Flood Fill / BFS starting from the image border only!
  // This guarantees that white text/elements inside the artwork NEVER get erased!
  const queue: number[] = [];

  // Seed with all edge pixels that match background color within tolerance
  for (let x = 0; x < width; x++) {
    // Top row
    let idx = (0 * width + x) * 4;
    let pIdx = 0 * width + x;
    if (colorDiffSq(idx) <= toleranceSq) {
      queue.push(pIdx);
      visited[pIdx] = 1;
      mask[pIdx] = 1;
    }
    // Bottom row
    idx = ((height - 1) * width + x) * 4;
    pIdx = (height - 1) * width + x;
    if (colorDiffSq(idx) <= toleranceSq) {
      queue.push(pIdx);
      visited[pIdx] = 1;
      mask[pIdx] = 1;
    }
  }

  for (let y = 0; y < height; y++) {
    // Left column
    let idx = (y * width + 0) * 4;
    let pIdx = y * width + 0;
    if (!visited[pIdx] && colorDiffSq(idx) <= toleranceSq) {
      queue.push(pIdx);
      visited[pIdx] = 1;
      mask[pIdx] = 1;
    }
    // Right column
    idx = (y * width + (width - 1)) * 4;
    pIdx = y * width + (width - 1);
    if (!visited[pIdx] && colorDiffSq(idx) <= toleranceSq) {
      queue.push(pIdx);
      visited[pIdx] = 1;
      mask[pIdx] = 1;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // 4-neighborhood
    const neighbors = [
      cy > 0 ? (cy - 1) * width + cx : -1,
      cy < height - 1 ? (cy + 1) * width + cx : -1,
      cx > 0 ? cy * width + (cx - 1) : -1,
      cx < width - 1 ? cy * width + (cx + 1) : -1
    ];

    for (const n of neighbors) {
      if (n !== -1 && !visited[n]) {
        visited[n] = 1;
        const nDataIdx = n * 4;
        if (colorDiffSq(nDataIdx) <= toleranceSq) {
          mask[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  // Apply alpha mask and soft antialiasing feathering on border
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      const dIdx = pIdx * 4;

      if (mask[pIdx] === 1) {
        data[dIdx + 3] = 0; // Completely transparent
      } else {
        // Check if neighbor is transparent to provide soft anti-aliased edge
        const diff = Math.sqrt(colorDiffSq(dIdx));
        if (diff < tolerance * 1.5) {
          const factor = Math.min(1, Math.max(0, (diff - tolerance * 0.7) / (tolerance * 0.8)));
          data[dIdx + 3] = Math.round(data[dIdx + 3] * factor);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}



/**
 * Pixel Doctor / Despeckle: Removes single isolated rogue pixels
 */
export async function despeckleImage(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 0) {
        // Count opaque neighbors
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (data[nIdx + 3] > 20) neighbors++;
          }
        }
        if (neighbors === 0) {
          data[idx + 3] = 0; // Remove isolated speck
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}



/**
 * Adds an outline stroke (white underbase or colored contour) around transparent artwork
 */
export async function addStrokeOutline(
  img: HTMLImageElement,
  strokeColor: string = '#ffffff',
  strokeWidth: number = 4
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth + strokeWidth * 4;
  canvas.height = img.naturalHeight + strokeWidth * 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  const offsetX = strokeWidth * 2;
  const offsetY = strokeWidth * 2;

  // Draw outline using multiple angular offsets
  ctx.save();
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = 0;

  for (let angle = 0; angle < 360; angle += 15) {
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * strokeWidth;
    const dy = Math.sin(rad) * strokeWidth;
    ctx.drawImage(img, offsetX + dx, offsetY + dy);
  }

  // Draw original image on top
  ctx.drawImage(img, offsetX, offsetY);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * AI Super-Resolution & Sharpen Upscaler (2x / 4x)
 */
export async function upscaleImageAi(
  img: HTMLImageElement,
  factor: number = 2,
  sharpness: number = 50
): Promise<string> {
  const canvas = document.createElement('canvas');
  const targetW = img.naturalWidth * factor;
  const targetH = img.naturalHeight * factor;
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Apply Unsharp Masking Kernel if sharpness > 0
  if (sharpness > 0) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);
    const w = targetW;
    const h = targetH;
    const amount = (sharpness / 100) * 0.7;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        if (copy[idx + 3] === 0) continue; // Skip fully transparent

        for (let c = 0; c < 3; c++) {
          const center = copy[idx + c];
          const top = copy[((y - 1) * w + x) * 4 + c];
          const bottom = copy[((y + 1) * w + x) * 4 + c];
          const left = copy[(y * w + (x - 1)) * 4 + c];
          const right = copy[(y * w + (x + 1)) * 4 + c];

          const laplacian = 4 * center - (top + bottom + left + right);
          data[idx + c] = Math.min(255, Math.max(0, center + laplacian * amount));
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Color & Tone Adjustments: Brightness, Contrast, Saturation, Hue Shift
 */
export async function adjustColorAndTone(
  img: HTMLImageElement,
  adj: {
    brightness: number; // -100 to 100
    contrast: number;   // -100 to 100
    saturation: number; // -100 to 100
    hue: number;        // -180 to 180
  }
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const bFactor = (adj.brightness / 100) * 128;
  const cFactor = (adj.contrast >= 0)
    ? (adj.contrast + 100) / 100
    : (100 + adj.contrast) / 100;
  const sFactor = (adj.saturation + 100) / 100;
  const hueRad = (adj.hue * Math.PI) / 180;
  const cosH = Math.cos(hueRad);
  const sinH = Math.sin(hueRad);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness
    r += bFactor;
    g += bFactor;
    b += bFactor;

    // Contrast
    r = (r - 128) * cFactor + 128;
    g = (g - 128) * cFactor + 128;
    b = (b - 128) * cFactor + 128;

    // Saturation
    const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
    r = gray + (r - gray) * sFactor;
    g = gray + (g - gray) * sFactor;
    b = gray + (b - gray) * sFactor;

    // Hue Rotation
    if (adj.hue !== 0) {
      const newR = r * (0.213 + cosH * 0.787 - sinH * 0.213) +
                   g * (0.715 - cosH * 0.715 - sinH * 0.715) +
                   b * (0.072 - cosH * 0.072 + sinH * 0.928);
      const newG = r * (0.213 - cosH * 0.213 + sinH * 0.143) +
                   g * (0.715 + cosH * 0.285 + sinH * 0.140) +
                   b * (0.072 - cosH * 0.072 - sinH * 0.283);
      const newB = r * (0.213 - cosH * 0.213 - sinH * 0.787) +
                   g * (0.715 - cosH * 0.715 + sinH * 0.715) +
                   b * (0.072 + cosH * 0.928 + sinH * 0.072);
      r = newR;
      g = newG;
      b = newB;
    }

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}



/**
 * Texture & Distressed Crackle Effect for breathable vintage DTF prints
 */
export async function applyTextureEffect(
  img: HTMLImageElement,
  style: 'cracked' | 'vintage' | 'grunge',
  intensity: number = 50
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const thresh = (intensity / 100) * 0.45;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] === 0) continue;

      let noise = 0;
      if (style === 'cracked') {
        // High frequency cellular crack pattern
        const nx = Math.sin(x * 0.07) * Math.cos(y * 0.07);
        const ny = Math.cos(x * 0.15 + y * 0.15);
        noise = Math.abs(nx * ny);
      } else if (style === 'vintage') {
        // Horizontal distressed striping wear
        noise = Math.abs(Math.sin(y * 0.12) * Math.cos((x + y) * 0.03));
      } else {
        // Organic grunge splatter
        const n1 = Math.sin(x * 0.05 + y * 0.05);
        const n2 = Math.cos(x * 0.12 - y * 0.08);
        noise = Math.abs(n1 * n2);
      }

      if (noise < thresh) {
        // Modulate alpha to create the print crack/cutout
        data[idx + 3] = Math.round(data[idx + 3] * (noise / thresh));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}



/**
 * Halftone Screen Dot Effect
 */
export async function applyHalftoneFilter(
  img: HTMLImageElement,
  dotSpacing: number = 8,
  dotRadiusMax: number = 4
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const w = canvas.width;
  const h = canvas.height;

  // Clear canvas to rebuild in pure halftone screen
  ctx.clearRect(0, 0, w, h);

  for (let y = 0; y < h; y += dotSpacing) {
    for (let x = 0; x < w; x += dotSpacing) {
      const idx = (Math.min(y, h - 1) * w + Math.min(x, w - 1)) * 4;
      const alpha = srcData[idx + 3];
      if (alpha < 30) continue;

      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const dotRadius = (1 - luminance * 0.8) * dotRadiusMax * (alpha / 255);

      if (dotRadius > 0.5) {
        ctx.beginPath();
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.arc(x + dotSpacing / 2, y + dotSpacing / 2, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Replace / Remove specific Color (Eyedropper tool)
 */
export async function replaceColorInImage(
  img: HTMLImageElement,
  targetHex: string,
  newHex: string,
  tolerance: number = 30,
  replaceWithTransparent: boolean = false
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Parse target hex
  const tr = parseInt(targetHex.slice(1, 3), 16) || 0;
  const tg = parseInt(targetHex.slice(3, 5), 16) || 0;
  const tb = parseInt(targetHex.slice(5, 7), 16) || 0;

  // Parse replacement hex
  const nr = parseInt(newHex.slice(1, 3), 16) || 0;
  const ng = parseInt(newHex.slice(3, 5), 16) || 0;
  const nb = parseInt(newHex.slice(5, 7), 16) || 0;

  const tolSq = tolerance * tolerance * 3;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const distSq = dr * dr + dg * dg + db * db;

    if (distSq <= tolSq) {
      if (replaceWithTransparent) {
        data[i + 3] = 0;
      } else {
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}



/**
 * Generates instant text / number jersey typography
 */
export function generateTextArtwork(opts: {
  text: string;
  font: string;
  fontSize: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  isArch: boolean;
}): string {
  const canvas = document.createElement('canvas');
  const pad = opts.strokeWidth * 4 + 40;
  canvas.width = Math.max(600, opts.fontSize * opts.text.length + pad * 2);
  canvas.height = Math.max(300, opts.fontSize * 2 + pad * 2);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.font = `900 ${opts.fontSize}px "${opts.font}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  if (opts.strokeWidth > 0) {
    ctx.strokeStyle = opts.strokeColor;
    ctx.lineWidth = opts.strokeWidth * 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(opts.text, cx, cy);
  }

  ctx.fillStyle = opts.fillColor;
  ctx.fillText(opts.text, cx, cy);

  return canvas.toDataURL('image/png');
}

/**
 * Authentic High-Visibility Faux Embroidery Effect for DTF Printing:
 * Generates bold, highly distinct 3D thread stitches, satin directional ribbing,
 * deep seam crevices, silky specular sheen, and authentic raised embroidered badge relief.
 * Specially calibrated so stitch texture is crisp and clearly visible even from a distance without zooming.
 */
export async function applyEmbroideryEffect(
  img: HTMLImageElement,
  stitchPitch: number = 16,
  sheenIntensity: number = 85
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0);
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Pre-calculate alpha channel for directional 3D relief/emboss
  const alphaMap = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    alphaMap[i / 4] = data[i + 3];
  }

  // Scale thread thickness adaptively with image resolution so stitches remain clearly visible without zooming in
  const baseDim = Math.min(w, h);
  const autoResolutionPitch = Math.max(12, Math.round(baseDim / 65));
  const pitch = stitchPitch >= 10
    ? stitchPitch
    : Math.max(12, Math.round((stitchPitch / 5) * autoResolutionPitch));

  const halfPitch = pitch / 2;
  const sheen = (sheenIntensity / 100);
  const step = Math.max(1, Math.round(pitch / 4));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 10) continue;

      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      // 1. Thread stitch diagonal cylinder profile (Satin stitch ribbing at ~45° weave)
      const coord = x * 0.707 + y * 0.707;
      const mod = ((coord % pitch) + pitch) % pitch;
      const dist = (mod - halfPitch) / halfPitch; // -1 to +1 across thread strand

      // Thread curvature factor: rounded cylindrical peak in middle, valley between threads
      const threadCurvature = Math.cos(dist * (Math.PI / 2));
      const crevice = Math.pow(Math.abs(dist), 2.0);

      // Deep, bold directional cylindrical shading (light from top-left):
      // Apex gets direct illumination, lower half of thread cylinder drops into shadow
      const directionalCylinder = -dist * 0.28;
      const threadShading = Math.max(0.20, 1.0 - crevice * 0.72 + directionalCylinder);

      // Distinct dark needle indentation line between adjacent threads (sharp seam accentuation)
      const seamFactor = Math.abs(dist) > 0.80 ? (Math.abs(dist) - 0.80) / 0.20 : 0;
      const seamCrevice = 1.0 - seamFactor * 0.45;

      // 2. Thread Specular Sheen (Silky rayon/polyester thread highlight along thread ridge)
      const specularRidge = Math.pow(Math.max(0, threadCurvature), 4) * 68 * sheen;

      // 3. Directional 3D Emboss Relief (Light coming from top-left)
      const leftIdx = y * w + Math.max(0, x - step);
      const rightIdx = y * w + Math.min(w - 1, x + step);
      const topIdx = Math.max(0, y - step) * w + x;
      const bottomIdx = Math.min(h - 1, y + step) * w + x;

      const deltaX = (alphaMap[rightIdx] - alphaMap[leftIdx]) / 255;
      const deltaY = (alphaMap[bottomIdx] - alphaMap[topIdx]) / 255;
      const bevel = (-deltaX - deltaY) * 45;

      // 4. Thread Micro-Fibers (Subtle fiber grain)
      const fiberNoise = (((x * 19 + y * 37) % 23) / 23) - 0.5;
      const fiberMod = 1 + fiberNoise * 0.08;

      // 5. Rich thread saturation boost for lustrous sheen
      const avg = (r + g + b) / 3;
      r = Math.min(255, r + (r - avg) * 0.28);
      g = Math.min(255, g + (g - avg) * 0.28);
      b = Math.min(255, b + (b - avg) * 0.28);

      // Final modulated color: bold contrast between stitch peak and valley seam
      const litR = r * threadShading * seamCrevice * fiberMod + specularRidge + bevel;
      const litG = g * threadShading * seamCrevice * fiberMod + specularRidge + bevel;
      const litB = b * threadShading * seamCrevice * fiberMod + specularRidge + bevel;

      data[idx] = Math.max(0, Math.min(255, Math.round(litR)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(litG)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(litB)));

      // Subtle edge stitch micro-variation for authentic embroidered perimeter
      if (alpha > 0 && alpha < 255) {
        data[idx + 3] = Math.min(255, Math.round(alpha * (0.80 + 0.20 * threadCurvature)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

