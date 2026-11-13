/**
 * DTF Gang Sheet Builder - Precision Raster to Vector Engine
 * Bridges client-side canvas contour tracing with high-performance Rust VTracer backend.
 */

export interface VectorizeOptions {
  colormode: 'color' | 'binary';
  detailLevel: 'low' | 'medium' | 'high';
  smoothness: number; // 0 to 100
  removeBackground: boolean;
  optimizePaths: boolean;
}

export interface VectorizeResult {
  svgContent: string;
  svgDataUrl: string;
  width: number;
  height: number;
}

/**
 * Downloads the given SVG string as an .svg file on the client's device
 */
export function downloadSvgFile(svgContent: string, filename = 'vectorized-design.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Helper to load an image source into an HTMLImageElement
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for vectorization'));
    img.src = src;
  });
}

/**
 * Converts imageSrc to Blob
 */
async function srcToBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:')) {
    const arr = src.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  const res = await fetch(src);
  return await res.blob();
}

/**
 * Main vectorization entrypoint:
 * 1. Tries the high-fidelity Rust-based VTracer backend via /api/vectorize
 * 2. Falls back seamlessly to in-browser connected contour vectorizer if offline or backend is unreachable.
 */
export async function vectorizeImage(
  imageSrc: string,
  options: VectorizeOptions
): Promise<VectorizeResult> {
  try {
    const blob = await srcToBlob(imageSrc);
    const formData = new FormData();
    formData.append('file', blob, 'design.png');
    formData.append('colormode', options.colormode);
    formData.append('detail_level', options.detailLevel);
    formData.append('smoothness', options.smoothness.toString());
    formData.append('remove_background', options.removeBackground ? 'true' : 'false');
    formData.append('optimize_paths', options.optimizePaths ? 'true' : 'false');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('/api/vectorize', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      let svgText = await response.text();
      if (svgText && svgText.includes('<svg') && svgText.includes('<path')) {
        // Extract dimensions if present
        const wMatch = svgText.match(/width="([0-9.]+)"/);
        const hMatch = svgText.match(/height="([0-9.]+)"/);
        const width = wMatch ? parseFloat(wMatch[1]) : 800;
        const height = hMatch ? parseFloat(hMatch[1]) : 800;

        // Ensure viewBox attribute is present for proper scaling in browser and gang sheet
        if (!svgText.includes('viewBox') && width > 0 && height > 0) {
          svgText = svgText.replace(
            /<svg([^>]*)>/i,
            `<svg$1 viewBox="0 0 ${width} ${height}">`
          );
        }

        const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
        return {
          svgContent: svgText,
          svgDataUrl,
          width,
          height
        };
      }
    }
  } catch (backendError) {
    console.warn('Backend VTracer unavailable, falling back to client-side vectorizer:', backendError);
  }

  // Seamless client-side vectorizer fallback
  return await vectorizeClientSide(imageSrc, options);
}

// Perpendicular distance from point to line segment
function perpendicularDistance(
  pt: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  return Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

// Ramer-Douglas-Peucker (RDP) path simplification
function rdpSimplify(
  points: Array<{ x: number; y: number }>,
  epsilon: number
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[last]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[last]];
  }
}

// 8-direction Moore-Neighbor boundary contour tracing
function traceContourLoops(
  mask: Uint8Array,
  width: number,
  height: number
): Array<Array<{ x: number; y: number }>> {
  const visited = new Uint8Array(width * height);
  const contours: Array<Array<{ x: number; y: number }>> = [];
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] && !visited[idx]) {
        // Check if boundary pixel
        const isBoundary =
          !mask[idx - 1] ||
          !mask[idx + 1] ||
          !mask[idx - width] ||
          !mask[idx + width];
        if (!isBoundary) continue;

        const points: Array<{ x: number; y: number }> = [];
        let cx = x, cy = y;
        let dir = 0;
        const startX = x, startY = y;
        let stepCount = 0;
        const maxSteps = width * height;

        do {
          points.push({ x: cx, y: cy });
          visited[cy * width + cx] = 1;

          let found = false;
          const checkDir = (dir + 5) % 8;
          for (let i = 0; i < 8; i++) {
            const nd = (checkDir + i) % 8;
            const nx = cx + dx[nd];
            const ny = cy + dy[nd];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
              cx = nx;
              cy = ny;
              dir = nd;
              found = true;
              break;
            }
          }

          if (!found) break;
          stepCount++;
        } while ((cx !== startX || cy !== startY) && stepCount < maxSteps);

        if (points.length >= 4) {
          contours.push(points);
        }
      }
    }
  }
  return contours;
}

// Converts polygon contour vertices into smooth SVG path with cubic Bézier curves
function contourToSvgPath(
  points: Array<{ x: number; y: number }>,
  scale: number,
  precision: number,
  smoothness: number
): string {
  if (points.length < 3) return '';
  const formatCoord = (n: number) => (n / scale).toFixed(precision);
  const smoothFactor = Math.max(0.0, Math.min(1.0, smoothness / 100));

  if (smoothFactor < 0.05 || points.length < 4) {
    const parts = [`M ${formatCoord(points[0].x)} ${formatCoord(points[0].y)}`];
    for (let i = 1; i < points.length; i++) {
      parts.push(`L ${formatCoord(points[i].x)} ${formatCoord(points[i].y)}`);
    }
    parts.push('Z');
    return parts.join(' ');
  }

  // Smooth Catmull-Rom to Cubic Bézier spline
  const parts = [`M ${formatCoord(points[0].x)} ${formatCoord(points[0].y)}`];
  const len = points.length;
  for (let i = 0; i < len; i++) {
    const p0 = points[(i - 1 + len) % len];
    const p1 = points[i];
    const p2 = points[(i + 1) % len];
    const p3 = points[(i + 2) % len];

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * smoothFactor * 1.5;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * smoothFactor * 1.5;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * smoothFactor * 1.5;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * smoothFactor * 1.5;

    parts.push(
      `C ${formatCoord(cp1x)} ${formatCoord(cp1y)}, ${formatCoord(cp2x)} ${formatCoord(cp2y)}, ${formatCoord(p2.x)} ${formatCoord(p2.y)}`
    );
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Pure client-side raster-to-SVG vectorization using Canvas pixel quantization,
 * Moore-Neighbor contour tracing, and smooth cubic Bézier curve fitting.
 */
export async function vectorizeClientSide(
  imageSrc: string,
  options: VectorizeOptions
): Promise<VectorizeResult> {
  const img = await loadImageElement(imageSrc);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  // Max canvas resolution for client vectorization performance
  const maxDim = options.detailLevel === 'high' ? 800 : options.detailLevel === 'medium' ? 600 : 400;
  let scale = 1;
  if (width > maxDim || height > maxDim) {
    scale = maxDim / Math.max(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not initialize 2D canvas context');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const cw = canvas.width;
  const ch = canvas.height;
  const totalPixels = cw * ch;

  // 1. Remove background if requested and image lacks alpha
  if (options.removeBackground) {
    let hasTransparent = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 240) {
        hasTransparent = true;
        break;
      }
    }

    if (!hasTransparent && cw > 4 && ch > 4) {
      // Sample 4 corners
      const cornerIndices = [0, (cw - 1) * 4, ((ch - 1) * cw) * 4, ((ch - 1) * cw + cw - 1) * 4];
      let cr = 0, cg = 0, cb = 0;
      cornerIndices.forEach((idx) => {
        cr += data[idx];
        cg += data[idx + 1];
        cb += data[idx + 2];
      });
      cr /= 4;
      cg /= 4;
      cb /= 4;

      const tol = 35;
      for (let i = 0; i < data.length; i += 4) {
        const dr = Math.abs(data[i] - cr);
        const dg = Math.abs(data[i + 1] - cg);
        const db = Math.abs(data[i + 2] - cb);
        if (dr < tol && dg < tol && db < tol) {
          data[i + 3] = 0;
        }
      }
    }
  }

  const precision = options.optimizePaths ? 1 : 2;
  const epsilon = options.detailLevel === 'high' ? 0.6 : options.detailLevel === 'medium' ? 1.0 : 2.0;

  const paths: string[] = [];

  if (options.colormode === 'binary') {
    // Binary Black & White tracing
    const mask = new Uint8Array(totalPixels);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const idx = (y * cw + x) * 4;
        const a = data[idx + 3];
        if (a < 64) continue;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < 160) {
          mask[y * cw + x] = 1;
        }
      }
    }

    const loops = traceContourLoops(mask, cw, ch);
    for (const loop of loops) {
      const simplified = rdpSimplify(loop, epsilon);
      const d = contourToSvgPath(simplified, scale, precision, options.smoothness);
      if (d) {
        paths.push(`<path d="${d}" fill="#000000"/>`);
      }
    }
  } else {
    // Multicolor quantization and layer contour tracing
    const step = options.detailLevel === 'high' ? 24 : options.detailLevel === 'medium' ? 36 : 52;
    const colorLayers = new Map<string, Uint8Array>();

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const idx = (y * cw + x) * 4;
        const a = data[idx + 3];
        if (a < 32) continue;

        const r = Math.min(255, Math.round(data[idx] / step) * step);
        const g = Math.min(255, Math.round(data[idx + 1] / step) * step);
        const b = Math.min(255, Math.round(data[idx + 2] / step) * step);
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

        let layerMask = colorLayers.get(hex);
        if (!layerMask) {
          layerMask = new Uint8Array(totalPixels);
          colorLayers.set(hex, layerMask);
        }
        layerMask[y * cw + x] = 1;
      }
    }

    // Sort layers by pixel count descending so larger background areas render first
    const sortedLayers: Array<{ hex: string; count: number; mask: Uint8Array }> = [];
    colorLayers.forEach((mask, hex) => {
      let count = 0;
      for (let i = 0; i < totalPixels; i++) {
        if (mask[i]) count++;
      }
      if (count >= 12) {
        sortedLayers.push({ hex, count, mask });
      }
    });
    sortedLayers.sort((a, b) => b.count - a.count);

    for (const layer of sortedLayers) {
      const loops = traceContourLoops(layer.mask, cw, ch);
      for (const loop of loops) {
        const simplified = rdpSimplify(loop, epsilon);
        const d = contourToSvgPath(simplified, scale, precision, options.smoothness);
        if (d) {
          paths.push(`<path d="${d}" fill="${layer.hex}"/>`);
        }
      }
    }
  }

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${paths.join('\n')}
</svg>`;

  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
  return {
    svgContent,
    svgDataUrl,
    width,
    height
  };
}
