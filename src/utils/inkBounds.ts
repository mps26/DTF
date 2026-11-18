import type { InkBounds } from './dtfNesting';

/**
 * Measures the fully transparent margin on each side of an image (the exact
 * image the preview and exporter draw). A pixel counts as artwork if its alpha
 * is > 0, so faint / anti-aliased edges are never treated as empty space.
 * Results are cached per URL.
 */
const READ_MAX_SIDE = 4096;
const cache = new Map<string, Promise<InkBounds | null>>();

export function loadInkBounds(url: string): Promise<InkBounds | null> {
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<InkBounds | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const nw = img.naturalWidth || img.width;
        const nh = img.naturalHeight || img.height;
        if (!nw || !nh) return resolve(null);
        const sc = Math.min(1, READ_MAX_SIDE / Math.max(nw, nh));
        const w = Math.max(1, Math.round(nw * sc));
        const h = Math.max(1, Math.round(nh * sc));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          for (let x = 0; x < w; x++) {
            if (data[row + x * 4 + 3] > 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) return resolve(null); // fully transparent: treat as solid box
        // One pixel of slack when the image was down-sampled for reading.
        const slack = sc < 1 ? 1 : 0;
        resolve({
          left: Math.max(0, minX - slack) / w,
          top: Math.max(0, minY - slack) / h,
          right: Math.max(0, w - 1 - maxX - slack) / w,
          bottom: Math.max(0, h - 1 - maxY - slack) / h
        });
      } catch {
        resolve(null); // unreadable (e.g. tainted canvas): solid box, full spacing
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cache.set(url, p);
  return p;
}
