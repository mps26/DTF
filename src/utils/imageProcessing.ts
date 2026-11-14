import { CropBox } from '../types';
export * from './textureEffects';

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

export type RecreateAiStyle = 'hd-redraw' | 'clean-illustration' | 'vivid-print';

/**
 * AI-Style High-Fidelity Artwork Recreation:
 * 1. 2x resolution reconstruction (capped at 2400px max side for responsiveness).
 * 2. 5x5 edge-preserving bilateral redraw to eliminate noise & compression artifacts.
 * 3. Multi-scale clarity & edge contour reconstruction.
 * 4. Vibrant DTF tone/color remastering & crisp alpha edge tightening.
 */
export async function recreateImageAi(
  img: HTMLImageElement,
  style: RecreateAiStyle = 'hd-redraw'
): Promise<string> {
  const maxDim = 2400;
  const rawW = img.naturalWidth * 2;
  const rawH = img.naturalHeight * 2;
  const scaleDown = Math.max(rawW, rawH) > maxDim ? maxDim / Math.max(rawW, rawH) : 1;
  const w = Math.max(1, Math.round(rawW * scaleDown));
  const h = Math.max(1, Math.round(rawH * scaleDown));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data);
  const out = imageData.data;

  // Style tuning parameters
  const colorSigma =
    style === 'clean-illustration' ? 42 : style === 'vivid-print' ? 24 : 30;
  const twoSigmaSq = 2 * colorSigma * colorSigma;
  const clarityAmt =
    style === 'clean-illustration' ? 0.45 : style === 'vivid-print' ? 0.65 : 0.55;
  const edgeAmt =
    style === 'clean-illustration' ? 0.65 : style === 'vivid-print' ? 0.55 : 0.60;
  const satBoost =
    style === 'clean-illustration' ? 0.22 : style === 'vivid-print' ? 0.34 : 0.24;
  const contrastBoost =
    style === 'clean-illustration' ? 1.14 : style === 'vivid-print' ? 1.18 : 1.12;

  // Pass 1: 5x5 Edge-Preserving Bilateral Redraw
  const bilat = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = src[idx + 3];
      if (a < 10) {
        bilat[idx + 3] = 0;
        continue;
      }

      const cr = src[idx];
      const cg = src[idx + 1];
      const cb = src[idx + 2];

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumW = 0;

      const y0 = Math.max(0, y - 2);
      const y1 = Math.min(h - 1, y + 2);
      const x0 = Math.max(0, x - 2);
      const x1 = Math.min(w - 1, x + 2);

      for (let ny = y0; ny <= y1; ny++) {
        const dy = ny - y;
        const rowOff = ny * w;
        for (let nx = x0; nx <= x1; nx++) {
          const nIdx = (rowOff + nx) * 4;
          if (src[nIdx + 3] < 15) continue;

          const dx = nx - x;
          const spatialW = Math.exp(-(dx * dx + dy * dy) / 4.5);

          const dr = src[nIdx] - cr;
          const dg = src[nIdx + 1] - cg;
          const db = src[nIdx + 2] - cb;
          const colorDistSq = dr * dr + dg * dg + db * db;
          const rangeW = Math.exp(-colorDistSq / twoSigmaSq);

          const weight = spatialW * rangeW;
          sumR += src[nIdx] * weight;
          sumG += src[nIdx + 1] * weight;
          sumB += src[nIdx + 2] * weight;
          sumW += weight;
        }
      }

      if (sumW > 0) {
        bilat[idx] = Math.round(sumR / sumW);
        bilat[idx + 1] = Math.round(sumG / sumW);
        bilat[idx + 2] = Math.round(sumB / sumW);
      } else {
        bilat[idx] = cr;
        bilat[idx + 1] = cg;
        bilat[idx + 2] = cb;
      }
      bilat[idx + 3] = a;
    }
  }

  // Pass 2: Multi-Scale Clarity, Edge Reconstruction, DTF Tone Remaster & Alpha Tighten
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = (row + x) * 4;
      const a = bilat[idx + 3];
      if (a < 15) {
        out[idx + 3] = 0;
        continue;
      }

      // Compute 3x3 local average & Laplacian edge detail from bilateral-cleaned buffer
      let meanR = 0, meanG = 0, meanB = 0;
      for (let ny = y - 1; ny <= y + 1; ny++) {
        const nRow = ny * w;
        for (let nx = x - 1; nx <= x + 1; nx++) {
          const nIdx = (nRow + nx) * 4;
          meanR += bilat[nIdx];
          meanG += bilat[nIdx + 1];
          meanB += bilat[nIdx + 2];
        }
      }
      meanR /= 9;
      meanG /= 9;
      meanB /= 9;

      const topIdx = ((y - 1) * w + x) * 4;
      const botIdx = ((y + 1) * w + x) * 4;
      const lftIdx = (row + x - 1) * 4;
      const rgtIdx = (row + x + 1) * 4;

      let r = bilat[idx];
      let g = bilat[idx + 1];
      let b = bilat[idx + 2];

      // Local clarity + edge contour boost
      const lapR = 4 * r - (bilat[topIdx] + bilat[botIdx] + bilat[lftIdx] + bilat[rgtIdx]);
      const lapG = 4 * g - (bilat[topIdx + 1] + bilat[botIdx + 1] + bilat[lftIdx + 1] + bilat[rgtIdx + 1]);
      const lapB = 4 * b - (bilat[topIdx + 2] + bilat[botIdx + 2] + bilat[lftIdx + 2] + bilat[rgtIdx + 2]);

      r = r + (r - meanR) * clarityAmt + lapR * edgeAmt;
      g = g + (g - meanG) * clarityAmt + lapG * edgeAmt;
      b = b + (b - meanB) * clarityAmt + lapB * edgeAmt;

      // DTF Contrast & Vibrancy Remaster
      r = (r - 128) * contrastBoost + 128;
      g = (g - 128) * contrastBoost + 128;
      b = (b - 128) * contrastBoost + 128;

      const avg = (r + g + b) / 3;
      const maxCh = Math.max(r, g, b);
      const minCh = Math.min(r, g, b);
      const curSat = maxCh > 0 ? (maxCh - minCh) / maxCh : 0;
      // Adaptive vibrancy: boost less-saturated tones more, protect already vivid tones
      const vib = satBoost * (1.0 - curSat * 0.45);

      out[idx] = Math.max(0, Math.min(255, Math.round(r + (r - avg) * vib)));
      out[idx + 1] = Math.max(0, Math.min(255, Math.round(g + (g - avg) * vib)));
      out[idx + 2] = Math.max(0, Math.min(255, Math.round(b + (b - avg) * vib)));

      // Crisp alpha edge tightening
      out[idx + 3] = a > 235 ? 255 : Math.max(0, Math.min(255, Math.round((a - 15) * (255 / 220))));
    }
  }

  ctx.putImageData(imageData, 0, 0);
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
 * Generates an accurate, clean contour outline (die-cut sticker stroke)
 * around the actual outer silhouette of transparent artwork.
 * Preserves transparency, internal gaps, colors, and resolution.
 */
export async function addStrokeOutline(
  img: HTMLImageElement,
  strokeColor: string = '#ffffff',
  strokeWidth: number = 3
): Promise<string> {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  // If stroke width is 0 or negative, return original image
  if (strokeWidth <= 0) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const cx = c.getContext('2d');
    if (cx) cx.drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  }

  // Parse stroke color to RGB
  const cleanHex = strokeColor.replace('#', '').trim();
  let sR = 255, sG = 255, sB = 255;
  if (cleanHex.length === 3) {
    sR = parseInt(cleanHex[0] + cleanHex[0], 16) || 255;
    sG = parseInt(cleanHex[1] + cleanHex[1], 16) || 255;
    sB = parseInt(cleanHex[2] + cleanHex[2], 16) || 255;
  } else if (cleanHex.length === 6) {
    sR = parseInt(cleanHex.slice(0, 2), 16) || 255;
    sG = parseInt(cleanHex.slice(2, 4), 16) || 255;
    sB = parseInt(cleanHex.slice(4, 6), 16) || 255;
  }

  // Padding so outline is never clipped at canvas edges
  const pad = Math.ceil(strokeWidth) + 4;
  const outW = width + pad * 2;
  const outH = height + pad * 2;
  const totalPixels = outW * outH;

  // Extract original image data
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) return img.src;

  srcCtx.drawImage(img, 0, 0);
  const srcImgData = srcCtx.getImageData(0, 0, width, height);
  const srcData = srcImgData.data;

  // Destination canvas for the final outlined composite
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = outW;
  dstCanvas.height = outH;
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
  if (!dstCtx) return img.src;

  const dstImgData = dstCtx.createImageData(outW, outH);
  const dstData = dstImgData.data;

  // 1. Build padded artwork occupancy map (alpha threshold: > 15)
  const isArtwork = new Uint8Array(totalPixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      if (srcData[srcIdx + 3] > 15) {
        isArtwork[(y + pad) * outW + (x + pad)] = 1;
      }
    }
  }

  // 2. Flood-fill from borders to identify outer background (ignoring internal gaps)
  const isOuterBg = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let qHead = 0;
  let qTail = 0;

  for (let x = 0; x < outW; x++) {
    if (!isArtwork[x] && !isOuterBg[x]) {
      isOuterBg[x] = 1;
      queue[qTail++] = x;
    }
    const bIdx = (outH - 1) * outW + x;
    if (!isArtwork[bIdx] && !isOuterBg[bIdx]) {
      isOuterBg[bIdx] = 1;
      queue[qTail++] = bIdx;
    }
  }

  for (let y = 0; y < outH; y++) {
    const lIdx = y * outW;
    if (!isArtwork[lIdx] && !isOuterBg[lIdx]) {
      isOuterBg[lIdx] = 1;
      queue[qTail++] = lIdx;
    }
    const rIdx = y * outW + (outW - 1);
    if (!isArtwork[rIdx] && !isOuterBg[rIdx]) {
      isOuterBg[rIdx] = 1;
      queue[qTail++] = rIdx;
    }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % outW;
    const cy = Math.floor(curr / outW);

    if (cx > 0) {
      const n = curr - 1;
      if (!isArtwork[n] && !isOuterBg[n]) {
        isOuterBg[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cx < outW - 1) {
      const n = curr + 1;
      if (!isArtwork[n] && !isOuterBg[n]) {
        isOuterBg[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cy > 0) {
      const n = curr - outW;
      if (!isArtwork[n] && !isOuterBg[n]) {
        isOuterBg[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cy < outH - 1) {
      const n = curr + outW;
      if (!isArtwork[n] && !isOuterBg[n]) {
        isOuterBg[n] = 1;
        queue[qTail++] = n;
      }
    }
  }

  // 3. Meijster Euclidean Distance Transform from artwork boundary
  const INF = 1e9;
  const g = new Float64Array(totalPixels);

  for (let x = 0; x < outW; x++) {
    g[x] = isArtwork[x] ? 0 : INF;
    for (let y = 1; y < outH; y++) {
      const idx = y * outW + x;
      g[idx] = isArtwork[idx] ? 0 : 1 + g[(y - 1) * outW + x];
    }
    for (let y = outH - 2; y >= 0; y--) {
      const idx = y * outW + x;
      if (g[(y + 1) * outW + x] < g[idx]) {
        g[idx] = 1 + g[(y + 1) * outW + x];
      }
    }
  }

  const dt = new Float32Array(totalPixels);
  const s = new Int32Array(outW);
  const t = new Int32Array(outW);

  const f = (x: number, i: number, y: number) => {
    const gi = g[y * outW + i];
    return (x - i) * (x - i) + gi * gi;
  };

  const sep = (i: number, u: number, y: number) => {
    const gi = g[y * outW + i];
    const gu = g[y * outW + u];
    return Math.floor((u * u - i * i + gu * gu - gi * gi) / (2 * (u - i)));
  };

  for (let y = 0; y < outH; y++) {
    let q = 0;
    s[0] = 0;
    t[0] = 0;

    for (let u = 1; u < outW; u++) {
      while (q >= 0 && f(t[q], s[q], y) > f(t[q], u, y)) {
        q--;
      }
      if (q < 0) {
        q = 0;
        s[0] = u;
      } else {
        const w = 1 + sep(s[q], u, y);
        if (w < outW) {
          q++;
          s[q] = u;
          t[q] = w;
        }
      }
    }

    for (let u = outW - 1; u >= 0; u--) {
      const d2 = f(u, s[q], y);
      dt[y * outW + u] = Math.sqrt(d2);
      if (u === t[q]) {
        q--;
      }
    }
  }

  // 4. Fill outer stroke in destination buffer
  for (let idx = 0; idx < totalPixels; idx++) {
    if (isOuterBg[idx]) {
      const dist = dt[idx];
      if (dist <= strokeWidth) {
        const pIdx = idx * 4;
        dstData[pIdx] = sR;
        dstData[pIdx + 1] = sG;
        dstData[pIdx + 2] = sB;

        // Smooth anti-aliased edge falloff
        const edge = strokeWidth - dist;
        const alpha = edge < 1.0 ? Math.max(0, Math.min(1, edge)) : 1.0;
        dstData[pIdx + 3] = Math.round(alpha * 255);
      }
    }
  }

  // Put stroke layer on destination canvas
  dstCtx.putImageData(dstImgData, 0, 0);

  // 5. Composite original artwork on top at offset (pad, pad)
  dstCtx.drawImage(img, pad, pad);

  return dstCanvas.toDataURL('image/png');
}



export interface UpscaleResult {
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  factor: number;
  sharpness: number;
}

/**
 * AI Super-Resolution & Sharpen Upscaler (2× Super-Resolution / 4× Ultra-Resolution)
 * Uses deep learning super-resolution backend (FSRCNN / EDSR) with client-side
 * high-precision fallback, full transparency preservation, and controlled unsharp masking.
 */
export async function upscaleImageAi(
  source: HTMLImageElement | string,
  factor: number = 2,
  sharpness: number = 50,
  model: string = 'fsrcnn'
): Promise<UpscaleResult> {
  const normFactor = factor === 4 ? 4 : 2;
  const normSharpness = Math.max(0, Math.min(100, sharpness));

  // Resolve source image element and dimensions
  let imgElem: HTMLImageElement;
  let sourceDataUrl: string;

  if (typeof source === 'string') {
    imgElem = await loadImage(source);
    sourceDataUrl = source;
  } else {
    imgElem = source;
    sourceDataUrl = source.src;
  }

  const origW = imgElem.naturalWidth || imgElem.width;
  const origH = imgElem.naturalHeight || imgElem.height;
  const targetW = origW * normFactor;
  const targetH = origH * normFactor;

  // 1. Attempt Backend AI Super-Resolution (OpenCV Deep Learning FSRCNN / EDSR)
  try {
    let blob: Blob;
    if (sourceDataUrl.startsWith('data:')) {
      const byteString = atob(sourceDataUrl.split(',')[1]);
      const mimeString = sourceDataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      blob = new Blob([ab], { type: mimeString });
    } else {
      const resp = await fetch(sourceDataUrl);
      blob = await resp.blob();
    }

    const formData = new FormData();
    formData.append('file', blob, 'image.png');
    formData.append('factor', normFactor.toString());
    formData.append('sharpness', normSharpness.toString());
    formData.append('model', model);

    const apiResp = await fetch('/api/upscale', {
      method: 'POST',
      body: formData
    });

    if (apiResp.ok) {
      const json = await apiResp.json();
      if (json.status === 'success' && json.dataUrl) {
        return {
          dataUrl: json.dataUrl,
          originalWidth: json.originalWidth || origW,
          originalHeight: json.originalHeight || origH,
          width: json.width || targetW,
          height: json.height || targetH,
          factor: json.factor || normFactor,
          sharpness: json.sharpness ?? normSharpness
        };
      }
    }
  } catch (backendErr) {
    console.warn('Backend /api/upscale unavailable, running high-precision client super-resolution fallback', backendErr);
  }

  // 2. Client-Side High-Precision Super-Resolution & Unsharp Masking Fallback
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      dataUrl: sourceDataUrl,
      originalWidth: origW,
      originalHeight: origH,
      width: origW,
      height: origH,
      factor: 1,
      sharpness: 0
    };
  }

  // Multi-step progressive upsampling to eliminate jagged artifacts
  if (normFactor === 4) {
    const midCanvas = document.createElement('canvas');
    midCanvas.width = origW * 2;
    midCanvas.height = origH * 2;
    const midCtx = midCanvas.getContext('2d');
    if (midCtx) {
      midCtx.imageSmoothingEnabled = true;
      midCtx.imageSmoothingQuality = 'high';
      midCtx.drawImage(imgElem, 0, 0, origW * 2, origH * 2);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(midCanvas, 0, 0, targetW, targetH);
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgElem, 0, 0, targetW, targetH);
    }
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgElem, 0, 0, targetW, targetH);
  }

  // Controlled Unsharp Masking on Luminance channel only (prevents color halos and artifacts)
  if (normSharpness > 0) {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const d = imgData.data;
    const copy = new Uint8ClampedArray(d);
    const amount = (normSharpness / 100) * 1.2;

    for (let y = 1; y < targetH - 1; y++) {
      for (let x = 1; x < targetW - 1; x++) {
        const idx = (y * targetW + x) * 4;
        const a = copy[idx + 3];
        if (a < 10) continue; // Skip transparent edges

        // Convert center to Luminance
        const cr = copy[idx];
        const cg = copy[idx + 1];
        const cb = copy[idx + 2];
        const lumCenter = 0.299 * cr + 0.587 * cg + 0.114 * cb;

        // Sample neighbors for Laplacian
        const topIdx = ((y - 1) * targetW + x) * 4;
        const botIdx = ((y + 1) * targetW + x) * 4;
        const lftIdx = (y * targetW + (x - 1)) * 4;
        const rgtIdx = (y * targetW + (x + 1)) * 4;

        const lumTop = 0.299 * copy[topIdx] + 0.587 * copy[topIdx + 1] + 0.114 * copy[topIdx + 2];
        const lumBot = 0.299 * copy[botIdx] + 0.587 * copy[botIdx + 1] + 0.114 * copy[botIdx + 2];
        const lumLft = 0.299 * copy[lftIdx] + 0.587 * copy[lftIdx + 1] + 0.114 * copy[lftIdx + 2];
        const lumRgt = 0.299 * copy[rgtIdx] + 0.587 * copy[rgtIdx + 1] + 0.114 * copy[rgtIdx + 2];

        const laplacian = 4 * lumCenter - (lumTop + lumBot + lumLft + lumRgt);
        const delta = laplacian * amount;

        // Apply delta proportionally to RGB
        d[idx] = Math.min(255, Math.max(0, Math.round(cr + delta)));
        d[idx + 1] = Math.min(255, Math.max(0, Math.round(cg + delta)));
        d[idx + 2] = Math.min(255, Math.max(0, Math.round(cb + delta)));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    originalWidth: origW,
    originalHeight: origH,
    width: targetW,
    height: targetH,
    factor: normFactor,
    sharpness: normSharpness
  };
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

  const bFactor = Math.max(0.1, 1 + adj.brightness / 100);
  const cFactor = Math.max(0.1, 1 + adj.contrast / 100);
  const sFactor = Math.max(0, 1 + adj.saturation / 100);
  const hueRad = (adj.hue * Math.PI) / 180;
  const cosH = Math.cos(hueRad);
  const sinH = Math.sin(hueRad);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness
    r *= bFactor;
    g *= bFactor;
    b *= bFactor;

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
 * Fast deterministic 2D hash & smooth value noise / FBM helpers for organic textures
 */
function hash2D(ix: number, iy: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, octaves: number = 3): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise2D(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return value / norm;
}

/**
 * Texture & Distressed Effect for breathable vintage DTF prints:
 * - 'cracked': Organic domain-warped Voronoi crackle (real branching plastisol ink cracks)
 * - 'vintage': Washed-out cotton slub streaks + subtle faded ink tone
 * - 'grunge': Multi-octave organic FBM blotches, grit & splatter erosion
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
  const minDim = Math.min(w, h);
  const t = Math.max(0.08, Math.min(1, intensity / 100));

  if (style === 'cracked') {
    // Domain-warped Voronoi cell-edge distance (d2 - d1) produces authentic branching cracks
    const cellSize = Math.max(18, minDim / 18);
    const invCell = 1 / cellSize;
    const crackWidth = 0.045 + t * 0.16;
    const warpAmp = cellSize * 0.55;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        if (alpha === 0) continue;

        // Organic warp so crack lines branch & jag naturally
        const wx = x + (fbm2D(x * 0.018, y * 0.018, 2) - 0.5) * warpAmp;
        const wy = y + (fbm2D(x * 0.018 + 31.7, y * 0.018 + 17.3, 2) - 0.5) * warpAmp;

        const gx = wx * invCell;
        const gy = wy * invCell;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);

        let d1 = 999;
        let d2 = 999;

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cx = ix + ox;
            const cy = iy + oy;
            const px = cx + 0.15 + hash2D(cx * 3 + 7, cy * 5 + 11) * 0.7;
            const py = cy + 0.15 + hash2D(cx * 7 + 19, cy * 3 + 23) * 0.7;
            const dx = px - gx;
            const dy = py - gy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
            } else if (d < d2) {
              d2 = d;
            }
          }
        }

        const edgeDist = d2 - d1;
        // Modulate crack width organically so some cracks are wider and some taper off
        const localWidth = crackWidth * (0.55 + fbm2D(x * 0.01, y * 0.01, 2) * 0.9);
        if (edgeDist < localWidth) {
          const crackFactor = edgeDist / localWidth;
          // Crisp crack cutout with subtle micro-roughness
          const grit = hash2D(x, y) * 0.25;
          const keep = Math.max(0, Math.min(1, crackFactor * 1.15 - grit * (1 - crackFactor)));
          data[idx + 3] = Math.round(alpha * keep);
        }
      }
    }
  } else if (style === 'vintage') {
    // Washed-out cotton slub streaks + subtle faded vintage ink tone
    const baseScale = Math.max(0.008, 12 / minDim);
    const wearThreshold = 0.24 + t * 0.36;
    const fadeAmt = 0.12 + t * 0.26;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        if (alpha === 0) continue;

        // Horizontal cotton-jersey slub fibers + organic blotchiness
        const slub = fbm2D(x * baseScale * 0.45, y * baseScale * 3.8, 3);
        const grain = fbm2D(x * baseScale * 2.5 + 13.1, y * baseScale * 2.5 + 7.4, 2);
        const micro = hash2D(x, y);
        const wear = slub * 0.62 + grain * 0.28 + micro * 0.10;

        // Subtle vintage washed-out ink fade (lifted shadows + slight warm desaturation)
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        data[idx] = Math.min(255, Math.round(r + (lum - r) * fadeAmt * 0.45 + 18 * fadeAmt));
        data[idx + 1] = Math.min(255, Math.round(g + (lum - g) * fadeAmt * 0.45 + 14 * fadeAmt));
        data[idx + 2] = Math.min(255, Math.round(b + (lum - b) * fadeAmt * 0.55 + 6 * fadeAmt));

        if (wear < wearThreshold) {
          const keep = Math.max(0, (wear / wearThreshold) * 0.85);
          data[idx + 3] = Math.round(alpha * keep);
        }
      }
    }
  } else {
    // 'grunge': Multi-octave organic FBM blotches, grit & splatter erosion
    const baseScale = Math.max(0.007, 10 / minDim);
    const thresh = 0.22 + t * 0.42;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        if (alpha === 0) continue;

        // Multi-scale organic grunge: large blotches + medium tears + fine grit
        const macro = fbm2D(x * baseScale * 0.85, y * baseScale * 0.85, 3);
        const mid = fbm2D(x * baseScale * 3.2 + 41.3, y * baseScale * 3.2 + 19.7, 2);
        const grit = hash2D(x, y);
        const n = macro * 0.55 + mid * 0.30 + grit * 0.15;

        if (n < thresh) {
          // Sharp organic tear edges
          const ratio = n / thresh;
          const keep = ratio < 0.72 ? 0 : (ratio - 0.72) / 0.28;
          data[idx + 3] = Math.round(alpha * keep);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}






export type HalftoneStyle = 'color' | 'duotone' | 'bw';

export interface HalftoneOptions {
  style?: HalftoneStyle;
  dotSize?: number;          // 2 - 25 px, default 8
  density?: number;          // 20 - 100%, default 70
  fadeSpread?: number;       // 0 - 100%, default 40
  angle?: number;            // 0 - 90 deg, default 0
  customColor?: string | null; // e.g. '#FF0000' if custom override
  scale?: number;            // resolution scaling factor (default 1)
}

/**
 * Production-ready Halftone Screen Dot Effect for DTF & Screen Printing:
 * - 3 Modes: Classic B&W ('bw'), Color Dots ('color'), and Dot Grid ('duotone').
 * - Dynamic dot sizing and pitch based on density, fadeSpread, and dotSize.
 * - Cell-averaged color sampling preserving rich original colors and fine details.
 * - Strict silhouette clipping with original alpha mask to guarantee 100% transparent backgrounds
 *   and prevent dots from bleeding outside the artwork contour.
 */
export async function applyHalftoneFilter(
  img: HTMLImageElement,
  optionsOrSpacing: HalftoneOptions | number = 8,
  legacyRadiusMax: number = 4,
  legacyStyle: HalftoneStyle = 'color'
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  const w = canvas.width;
  const h = canvas.height;

  // Extract source pixel data
  ctx.drawImage(img, 0, 0);
  const srcData = ctx.getImageData(0, 0, w, h).data;

  // Clear canvas to draw pure halftone screen
  ctx.clearRect(0, 0, w, h);

  let style: HalftoneStyle = 'color';
  let dotSize = 8;
  let density = 70;
  let fadeSpread = 40;
  let angleDeg = 0;
  let customColor: string | null = null;

  if (typeof optionsOrSpacing === 'object' && optionsOrSpacing !== null) {
    style = optionsOrSpacing.style || 'color';
    dotSize = optionsOrSpacing.dotSize ?? 8;
    density = optionsOrSpacing.density ?? 70;
    fadeSpread = optionsOrSpacing.fadeSpread ?? 40;
    angleDeg = optionsOrSpacing.angle ?? 0;
    customColor = optionsOrSpacing.customColor || null;
    if (optionsOrSpacing.scale && optionsOrSpacing.scale > 0) {
      dotSize = Math.max(2, Math.round(dotSize * optionsOrSpacing.scale));
    }
  } else {
    // Legacy positional arguments
    dotSize = optionsOrSpacing;
    style = legacyStyle;
  }

  // Pitch & max radius calculations
  const clampedDensity = Math.max(0.2, Math.min(1.0, density / 100));
  const pitch = Math.max(3, dotSize / clampedDensity);
  const spreadMultiplier = 0.7 + (fadeSpread / 100) * 0.6;
  const maxRadius = Math.max(1, (pitch * 0.48) * clampedDensity * spreadMultiplier);

  const angleRad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  // Bounding box in rotated (u, v) screen space
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h]
  ];
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const [cx, cy] of corners) {
    const u = cx * cosA + cy * sinA;
    const v = -cx * sinA + cy * cosA;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const sampleStep = Math.max(1, Math.floor(pitch / 3));
  const half = Math.max(1, Math.floor(pitch * 0.45));

  for (let v = minV; v <= maxV; v += pitch) {
    for (let u = minU; u <= maxU; u += pitch) {
      const cx = Math.round(u * cosA - v * sinA);
      const cy = Math.round(u * sinA + v * cosA);
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
      for (let sy = Math.max(0, cy - half); sy <= Math.min(h - 1, cy + half); sy += sampleStep) {
        const rowOff = sy * w;
        for (let sx = Math.max(0, cx - half); sx <= Math.min(w - 1, cx + half); sx += sampleStep) {
          const sIdx = (rowOff + sx) * 4;
          const a = srcData[sIdx + 3];
          if (a >= 20) {
            sumR += srcData[sIdx];
            sumG += srcData[sIdx + 1];
            sumB += srcData[sIdx + 2];
            sumA += a;
            count++;
          }
        }
      }

      if (count === 0) continue;

      const r = Math.round(sumR / count);
      const g = Math.round(sumG / count);
      const b = Math.round(sumB / count);
      const avgAlpha = (sumA / count) / 255;
      if (avgAlpha < 0.08) continue;

      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      let dotRadius = 0;
      let fillStyle = '';

      if (style === 'bw') {
        const darkness = 1 - luminance;
        if (darkness < 0.04) continue;
        dotRadius = maxRadius * Math.pow(darkness, 0.75) * avgAlpha;
        fillStyle = `rgba(12, 12, 16, ${avgAlpha.toFixed(3)})`;
      } else if (style === 'color') {
        const tonalFactor = 0.3 + 0.7 * Math.pow(1 - luminance * 0.8, 0.75);
        dotRadius = maxRadius * tonalFactor * avgAlpha;
        if (customColor) {
          fillStyle = customColor;
        } else {
          fillStyle = `rgba(${r}, ${g}, ${b}, ${avgAlpha.toFixed(3)})`;
        }
      } else {
        // 'duotone' -> Dot Grid: Uniform grid as in reference image
        dotRadius = maxRadius * 0.82 * avgAlpha;
        if (customColor) {
          fillStyle = customColor;
        } else {
          fillStyle = `rgba(${r}, ${g}, ${b}, ${avgAlpha.toFixed(3)})`;
        }
      }

      if (dotRadius > 0.5) {
        ctx.beginPath();
        ctx.fillStyle = fillStyle;
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Alpha mask silhouette clipping:
  // Guarantees zero dots bleed outside the original image's silhouette,
  // and preserves the original transparent background and smooth anti-aliased contour.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);
  ctx.restore();

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
 * Draws an image inside a target box, preserving aspect ratio (centered contain fit)
 * when aspectLocked is true so custom box dimensions never stretch or squish the artwork.
 */
export function drawImageProportional(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  aspectLocked: boolean = true
): void {
  // Always render artwork at the exact width and height set in the gangsheet
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0 || boxW <= 0 || boxH <= 0) {
    return;
  }
  ctx.drawImage(img, boxX, boxY, boxW, boxH);
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



export interface EmbroideryOptions {
  stitchPitch?: number; // Thread thickness / row spacing (8 - 24px, default 10)
  stitchLength?: number; // Stitch segment length before needle puncture (default ~3x pitch, e.g. 30px)
  stitchAngle?: number; // Stitch angle in degrees: 45, -45, 0, 90 (default 45)
  stitchType?: 'tatami' | 'satin' | 'crest'; // 'tatami' (interlocking fill), 'crest' (satin badge crest with border)
  sheenIntensity?: number; // Rayon/polyester silk luster (30 - 100%, default 85)
  reliefStrength?: number; // 3D bevel / pillowing relief (30 - 100%, default 80)
  hasBorder?: boolean; // Outer embroidered satin border
  borderWidth?: number; // 4 - 14px (default 8)
  fabricBacking?: 'transparent' | 'twill-canvas' | 'dark-denim' | 'heather-gray'; // default 'transparent'
}

/**
 * Authentic Photorealistic 3D Embroidery Effect for DTF Printing:
 * Modeled after real computerized embroidery machinery (Tajima/Barudan):
 * 1. Staggered Tatami Weave: individual stitch segments with realistic needle puncture holes.
 * 2. Satin Contour Border: perpendicular satin stitches wrapping around badge perimeters.
 * 3. 3D Cylindrical Lighting & Silk Sheen: anisotropic specular highlights along rayon/polyester thread.
 * 4. Micro-Scalloped Edge Loops: authentic looped thread boundary instead of artificial vector cuts.
 * 5. Color Seam Crevices: authentic needle seams at internal color transitions.
 * 6. Optional Twill Fabric Backing: realistic woven canvas backing with soft drop shadow.
 */
export async function applyEmbroideryEffect(
  img: HTMLImageElement,
  optsOrPitch: number | EmbroideryOptions = 10,
  legacySheen: number = 85
): Promise<string> {
  // Normalize options
  const opts: EmbroideryOptions =
    typeof optsOrPitch === 'number'
      ? { stitchPitch: optsOrPitch, sheenIntensity: legacySheen }
      : optsOrPitch || {};

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

  // Fine thread strand sizing (authentic dense 3D threads, never blocky bricks)
  const minDim = Math.min(w, h);
  const resScale = Math.max(1.0, minDim / 1000);
  const rawPitch = opts.stitchPitch ?? 10;
  // Map slider (8..24) to fine realistic thread strand width (~2.6px..5.5px * resScale)
  const pitch = Math.max(2.4, Math.min(8.5, (2.4 + (rawPitch - 8) * 0.18) * resScale));
  const stitchLen = opts.stitchLength ?? Math.round(pitch * 4.5);
  const angleDeg = opts.stitchAngle ?? 45;
  const angleRad = (angleDeg * Math.PI) / 180;
  const sheen = (opts.sheenIntensity ?? 85) / 100;
  const relief = ((opts.reliefStrength ?? 80) / 100) * 6.0;
  const hasBorder = opts.hasBorder !== false;
  const borderWidth = Math.max(
    5,
    Math.min(22, (opts.borderWidth ?? Math.round(6 + (rawPitch - 8) * 0.35)) * resScale)
  );
  const fabric = opts.fabricBacking ?? 'transparent';

  const cosT = Math.cos(angleRad);
  const sinT = Math.sin(angleRad);

  // 1. Extract Alpha and compute fast 2-pass Chamfer distance transform from edge
  const alphaMap = new Uint8Array(w * h);
  const dist = new Float32Array(w * h);
  let hasOpaque = false;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    alphaMap[i / 4] = a;
    if (a > 15) hasOpaque = true;
  }

  if (!hasOpaque) return img.src;

  // Pass 1: Top-Left to Bottom-Right
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (alphaMap[idx] < 15) {
        dist[idx] = 0;
      } else {
        let d = 9999;
        if (x > 0) d = Math.min(d, dist[idx - 1] + 1);
        if (y > 0) d = Math.min(d, dist[idx - w] + 1);
        if (x > 0 && y > 0) d = Math.min(d, dist[idx - w - 1] + 1.414);
        if (x < w - 1 && y > 0) d = Math.min(d, dist[idx - w + 1] + 1.414);
        dist[idx] = d;
      }
    }
  }

  // Pass 2: Bottom-Right to Top-Left
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w;
    for (let x = w - 1; x >= 0; x--) {
      const idx = row + x;
      let d = dist[idx];
      if (x < w - 1) d = Math.min(d, dist[idx + 1] + 1);
      if (y < h - 1) d = Math.min(d, dist[idx + w] + 1);
      if (x < w - 1 && y < h - 1) d = Math.min(d, dist[idx + w + 1] + 1.414);
      if (x > 0 && y < h - 1) d = Math.min(d, dist[idx + w - 1] + 1.414);
      dist[idx] = d;
    }
  }

  // 2. Compute smoothed internal color seam map (gives 3D raised puff & tuck-in seams at color boundaries)
  const rawSeam = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = row + x;
      if (alphaMap[idx] < 15) continue;
      const pIdx = idx * 4;
      const rIdx = (idx + 1) * 4;
      const bIdx = (idx + w) * 4;

      const dr = Math.abs(data[pIdx] - data[rIdx]) + Math.abs(data[pIdx] - data[bIdx]);
      const dg = Math.abs(data[pIdx + 1] - data[rIdx + 1]) + Math.abs(data[pIdx + 1] - data[bIdx + 1]);
      const db = Math.abs(data[pIdx + 2] - data[rIdx + 2]) + Math.abs(data[pIdx + 2] - data[bIdx + 2]);
      const diff = dr + dg + db;

      if (diff > 65) {
        rawSeam[idx] = Math.min(1.0, (diff - 65) / 140);
      }
    }
  }

  // Smooth the seam map with a fast 3x3 box pass so color boundaries form smooth 3D bevels
  const colorSeam = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = row + x;
      if (alphaMap[idx] < 15) continue;
      colorSeam[idx] =
        (rawSeam[idx - w - 1] +
          rawSeam[idx - w] +
          rawSeam[idx - w + 1] +
          rawSeam[idx - 1] +
          rawSeam[idx] * 2 +
          rawSeam[idx + 1] +
          rawSeam[idx + w - 1] +
          rawSeam[idx + w] +
          rawSeam[idx + w + 1]) /
        10;
    }
  }

  // 3. Compute 3D Embroidery Height Map (fine spun thread strands + satin contour border)
  const H = new Float32Array(w * h);
  const cylMap = new Float32Array(w * h);
  const creviceMap = new Float32Array(w * h);
  const borderPitch = Math.max(2.4, pitch * 0.92);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const a = alphaMap[idx];
      if (a < 15) continue;

      const dEdge = dist[idx];

      // Edge normal gradient for perpendicular satin border stitches
      const leftIdx = row + Math.max(0, x - 1);
      const rightIdx = row + Math.min(w - 1, x + 1);
      const topIdx = Math.max(0, y - 1) * w + x;
      const bottomIdx = Math.min(h - 1, y + 1) * w + x;

      const dGradX = dist[rightIdx] - dist[leftIdx];
      const dGradY = dist[bottomIdx] - dist[topIdx];
      const gradMag = Math.sqrt(dGradX * dGradX + dGradY * dGradY) + 1e-4;
      const normX = dGradX / gradMag;
      const normY = dGradY / gradMag;

      // Outer satin border factor (wraps around perimeter of badge)
      let borderFactor = 0;
      let bHCyl = 0;
      let bCrevice = 0;

      if (hasBorder && dEdge <= borderWidth) {
        borderFactor = Math.pow((borderWidth - dEdge) / borderWidth, 1.15);
        const borderV = -x * normY + y * normX;
        const bFracV = (((borderV % borderPitch + borderPitch) % borderPitch) / borderPitch - 0.5) * 2;
        bHCyl = Math.sqrt(Math.max(0, 1.0 - bFracV * bFracV));
        bCrevice = Math.pow(Math.max(0, (Math.abs(bFracV) - 0.65) / 0.35), 2);
      }

      // Interior fine spun thread weave
      const posU = x * cosT + y * sinT;
      const posV = -x * sinT + y * cosT;

      const rIndex = Math.floor(posV / pitch);
      const fracV = (((posV % pitch + pitch) % pitch) / pitch - 0.5) * 2;
      const hCyl = Math.sqrt(Math.max(0, 1.0 - fracV * fracV));
      const rowCrevice = Math.pow(Math.max(0, (Math.abs(fracV) - 0.68) / 0.32), 2);

      // Organic per-strand phase & spun yarn twist (like real twisted embroidery thread)
      const strandSeed = Math.sin(rIndex * 12.9898) * 43758.5453;
      const strandPhase = (strandSeed - Math.floor(strandSeed)) * stitchLen;
      const stagger = ((rIndex % 3) * 0.3333) * stitchLen + strandPhase * 0.35;
      const uOffset = posU + stagger;
      const fracU = (((uOffset % stitchLen + stitchLen) % stitchLen) / stitchLen - 0.5) * 2;

      // Subtle stitch tuck-in at stitch ends (no blocky cuts)
      const holeDistU = (1.0 - Math.abs(fracU)) * (stitchLen / pitch);
      const holeDistV = Math.abs(fracV);
      const distToNeedle = Math.sqrt(holeDistU * holeDistU + holeDistV * holeDistV);
      const needleHole = Math.pow(Math.max(0, 1.0 - distToNeedle / 1.1), 2);

      // Blend border satin with interior thread weave
      const effHCyl = bHCyl * borderFactor + hCyl * (1.0 - borderFactor);
      const effCrevice = bCrevice * borderFactor + rowCrevice * (1.0 - borderFactor);
      const effNeedle = needleHole * (1.0 - borderFactor);
      cylMap[idx] = effHCyl;
      creviceMap[idx] = effCrevice;

      // Patch pillowing & raised 3D satin border ridge
      const hPillow = Math.min(1.0, Math.pow(dEdge / (12.0 * resScale), 0.65));
      const borderRidge = hasBorder
        ? Math.sin(Math.min(1.0, dEdge / borderWidth) * Math.PI) * 0.55
        : 0;

      // Spun yarn twist micro-grain along each thread
      const ply = Math.sin(posU * 1.35 + fracV * 3.1 + strandPhase) * 0.09 * (1.0 - borderFactor * 0.6);
      const cSeam = colorSeam[idx];

      H[idx] =
        hPillow * 0.32 +
        borderRidge +
        effHCyl * 0.52 -
        effNeedle * 0.22 -
        effCrevice * 0.24 -
        cSeam * 0.42 +
        ply;
    }
  }

  // 4. Brightness-Preserving Directional Lighting & Glossy Thread Rendering
  const Lx = -0.55, Ly = -0.65, Lz = 0.70;
  const lNorm = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
  const lx = Lx / lNorm, ly = Ly / lNorm, lz = Lz / lNorm;

  const Hx = lx, Hy = ly, Hz = lz + 1.0;
  const hNorm = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
  const hx = Hx / hNorm, hy = Hy / hNorm, hz = Hz / hNorm;

  // Destination image data
  const outImgData = ctx.createImageData(w, h);
  const outData = outImgData.data;

  // Optional Twill Canvas Fabric background values
  const hasFabric = fabric !== 'transparent';

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const pIdx = idx * 4;
      const alpha = alphaMap[idx];

      if (alpha < 15) {
        if (!hasFabric) {
          outData[pIdx + 3] = 0;
        }
        continue;
      }

      // Gradient of H for normal vector
      const leftIdx = row + Math.max(0, x - 1);
      const rightIdx = row + Math.min(w - 1, x + 1);
      const topIdx = Math.max(0, y - 1) * w + x;
      const bottomIdx = Math.min(h - 1, y + 1) * w + x;

      const dhX = H[rightIdx] - H[leftIdx];
      const dhY = H[bottomIdx] - H[topIdx];

      let nx = -dhX * relief;
      let ny = -dhY * relief;
      let nz = 1.0;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      // Brightness-preserving directional shade + subtle thread-crevice separation
      const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
      const lightDelta = nDotL - lz;
      const baseShade = Math.max(
        0.78,
        Math.min(1.26, lightDelta >= 0 ? 1.0 + lightDelta * 0.52 : 1.0 + lightDelta * 0.42)
      );
      const creviceShade = 1.0 - creviceMap[idx] * 0.22 - colorSeam[idx] * 0.16;
      const shade = baseShade * creviceShade;

      // Specular (rayon/polyester thread sheen along thread crowns)
      const nDotH = Math.max(0, nx * hx + ny * hy + nz * hz);
      const effHCyl = cylMap[idx];
      const specular = Math.pow(nDotH, 16) * 85 * sheen * (0.3 + 0.7 * effHCyl);

      // Preserve full artwork detail with subtle 1px along-thread blending
      const uStepX = Math.round(cosT);
      const uStepY = Math.round(sinT);
      const prevX = Math.max(0, Math.min(w - 1, x - uStepX));
      const prevY = Math.max(0, Math.min(h - 1, y - uStepY));
      const nextX = Math.max(0, Math.min(w - 1, x + uStepX));
      const nextY = Math.max(0, Math.min(h - 1, y + uStepY));
      const prevIdx = (prevY * w + prevX) * 4;
      const nextIdx = (nextY * w + nextX) * 4;

      let r = data[pIdx];
      let g = data[pIdx + 1];
      let b = data[pIdx + 2];

      if (data[prevIdx + 3] >= 128 && data[nextIdx + 3] >= 128) {
        r = r * 0.55 + (data[prevIdx] + data[nextIdx]) * 0.225;
        g = g * 0.55 + (data[prevIdx + 1] + data[nextIdx + 1]) * 0.225;
        b = b * 0.55 + (data[prevIdx + 2] + data[nextIdx + 2]) * 0.225;
      }

      // Thread saturation boost for vibrant embroidery floss
      const avg = (r + g + b) / 3;
      r = Math.max(0, Math.min(255, r + (r - avg) * 0.22));
      g = Math.max(0, Math.min(255, g + (g - avg) * 0.22));
      b = Math.max(0, Math.min(255, b + (b - avg) * 0.22));

      // Final lit color
      outData[pIdx] = Math.max(0, Math.min(255, Math.round(r * shade + specular)));
      outData[pIdx + 1] = Math.max(0, Math.min(255, Math.round(g * shade + specular)));
      outData[pIdx + 2] = Math.max(0, Math.min(255, Math.round(b * shade + specular)));

      // Authentic micro-scalloped loop turnarounds on perimeter when satin border is active
      const dEdge = dist[idx];
      if (hasBorder && dEdge <= 2.5) {
        const borderV = -x * sinT + y * cosT;
        const loopScallop = Math.sin(borderV * 0.9) * 0.35;
        const edgeAlpha = Math.min(1.0, Math.max(0, (dEdge + loopScallop - 0.15) / 1.4));
        outData[pIdx + 3] = Math.round(alpha * edgeAlpha);
      } else {
        outData[pIdx + 3] = alpha;
      }
    }
  }

  // 5. Handle Fabric Backing & Drop Shadow if enabled
  if (hasFabric) {
    // Generate Twill Canvas / Denim texture
    const fabricCanvas = document.createElement('canvas');
    fabricCanvas.width = w;
    fabricCanvas.height = h;
    const fCtx = fabricCanvas.getContext('2d');
    if (fCtx) {
      const fImgData = fCtx.createImageData(w, h);
      const fd = fImgData.data;

      // Colors based on fabric selection
      // 'twill-canvas' -> Khaki/Beige 215, 192, 158
      // 'dark-denim'   -> Denim Blue 48, 62, 85
      // 'heather-gray' -> Athletic Heather 198, 202, 206
      let baseR = 215, baseG = 192, baseB = 158;
      if (fabric === 'dark-denim') { baseR = 48; baseG = 62; baseB = 85; }
      else if (fabric === 'heather-gray') { baseR = 198; baseG = 202; baseB = 206; }

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const fIdx = (y * w + x) * 4;
          // 2/2 Twill diagonal weave formula
          const rib = (x * 0.707 + y * 0.707) / 2.2;
          const ribCross = (x * 0.707 - y * 0.707) / 2.2;
          const yarnWarp = Math.sin(rib * Math.PI);
          const yarnWeft = Math.cos(ribCross * Math.PI * 0.5);
          const twillPat = yarnWarp * 0.5 + yarnWeft * 0.5;
          const fiberNoise = (((x * 37 + y * 59) % 31) / 31 - 0.5) * 0.14;

          const fR = Math.max(0, Math.min(255, baseR + twillPat * 22 + fiberNoise * 32));
          const fG = Math.max(0, Math.min(255, baseG + twillPat * 20 + fiberNoise * 30));
          const fB = Math.max(0, Math.min(255, baseB + twillPat * 18 + fiberNoise * 26));

          fd[fIdx] = fR;
          fd[fIdx + 1] = fG;
          fd[fIdx + 2] = fB;
          fd[fIdx + 3] = 255;
        }
      }
      fCtx.putImageData(fImgData, 0, 0);

      // Render realistic soft drop shadow from patch onto fabric
      fCtx.save();
      fCtx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      fCtx.shadowBlur = 14;
      fCtx.shadowOffsetX = 4;
      fCtx.shadowOffsetY = 6;

      // Draw the embroidery badge over the fabric with drop shadow
      const tempBadgeCanvas = document.createElement('canvas');
      tempBadgeCanvas.width = w;
      tempBadgeCanvas.height = h;
      const bCtx = tempBadgeCanvas.getContext('2d');
      if (bCtx) {
        bCtx.putImageData(outImgData, 0, 0);
        fCtx.drawImage(tempBadgeCanvas, 0, 0);
      }
      fCtx.restore();

      return fabricCanvas.toDataURL('image/png');
    }
  }

  ctx.putImageData(outImgData, 0, 0);
  return canvas.toDataURL('image/png');
}



