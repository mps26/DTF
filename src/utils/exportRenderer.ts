import { LayoutResult, SheetSettings, PackedPlacement } from '../types';
import { loadImage } from './imageProcessing';
import { MM_PER_INCH } from './units';

/**
 * Generates and downloads a full-resolution 300 DPI (or configured DPI) transparent PNG gang sheet.
 */
export async function exportHighResolutionPng(
  layout: LayoutResult,
  settings: SheetSettings,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const exportDpi = settings.exportDpi || 300;
  // Strictly capped to max 22" (width) x 100" (height)
  const filmWidthInches = Math.min(22, settings.filmWidthMm / MM_PER_INCH);
  const usedLengthInches = Math.min(100, layout.usedLengthMm / MM_PER_INCH);

  const outputWidthPx = Math.round(filmWidthInches * exportDpi);
  const outputHeightPx = Math.round(usedLengthInches * exportDpi);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidthPx;
  canvas.height = outputHeightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Clear to ensure 100% transparent background
  ctx.clearRect(0, 0, outputWidthPx, outputHeightPx);

  // Conversion factor from physical mm to output pixels:
  // mm / 25.4 * exportDpi
  const mmToPx = exportDpi / MM_PER_INCH;

  // Preload images into cache
  const imageCache: Record<string, HTMLImageElement> = {};
  const totalPlacements = layout.placements.length;

  for (let i = 0; i < totalPlacements; i++) {
    const p = layout.placements[i];
    if (!imageCache[p.assetId]) {
      const src = p.asset.processedUrl || p.asset.originalUrl;
      imageCache[p.assetId] = await loadImage(src);
    }
    if (onProgress) {
      onProgress(Math.round(((i + 1) / (totalPlacements * 2)) * 100));
    }
  }

  // Composite placements
  for (let i = 0; i < totalPlacements; i++) {
    const p = layout.placements[i];
    const img = imageCache[p.assetId];
    if (!img) continue;

    const xPx = p.xMm * mmToPx;
    const yPx = p.yMm * mmToPx;
    const wPx = p.widthMm * mmToPx;
    const hPx = p.heightMm * mmToPx;

    ctx.save();
    // High-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (p.rotated) {
      ctx.translate(xPx + wPx, yPx);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, hPx, wPx);
    } else {
      ctx.drawImage(img, xPx, yPx, wPx, hPx);
    }

    ctx.restore();

    if (onProgress) {
      onProgress(50 + Math.round(((i + 1) / (totalPlacements * 2)) * 50));
    }
  }

  // Convert to Blob and trigger download
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create PNG blob'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `DTF_GangSheet_${filmWidthInches.toFixed(1)}x${usedLengthInches.toFixed(1)}in_${exportDpi}DPI.png`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        resolve(url);
      },
      'image/png'
    );
  });
}

/**
 * Exports production job ticket (JSON) with placement coordinates for RIP and contour plotters
 */
export function exportJobTicketJson(layout: LayoutResult, settings: SheetSettings): void {
  const jobTicket = {
    software: 'DTF Gang Sheet Studio Pro',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    film: {
      widthMm: settings.filmWidthMm,
      widthInches: settings.filmWidthMm / MM_PER_INCH,
      usedLengthMm: layout.usedLengthMm,
      usedLengthInches: layout.usedLengthInches,
      spacingMm: settings.spacingMm,
      marginMm: settings.marginMm,
      exportDpi: settings.exportDpi,
      wastePercent: layout.wastePercent
    },
    placementsCount: layout.totalCopies,
    placements: layout.placements.map((p) => ({
      placementId: p.id,
      assetFilename: p.asset.filename,
      copyIndex: p.copyIndex,
      xMm: p.xMm,
      yMm: p.yMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      rotated: p.rotated,
      sourceDpi: p.asset.effectiveDpi
    }))
  };

  const blob = new Blob([JSON.stringify(jobTicket, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DTF_JobTicket_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

