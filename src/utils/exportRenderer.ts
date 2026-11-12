import { LayoutResult, SheetSettings, PackedPlacement } from '../types';
import { loadImage, drawImageProportional } from './imageProcessing';
import { MM_PER_INCH } from './units';

/**
 * CRC32 lookup table for PNG chunk calculation
 */
function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf: Uint8Array, offset: number, length: number): number {
  let crc = 0xffffffff;
  for (let i = 0; i < length; i++) {
    crc = crcTable[(crc ^ buf[offset + i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Injects standard PNG pHYs (physical pixel dimensions) chunk into a PNG blob.
 * This guarantees that when opened in Photoshop, Illustrator, Corel, Windows, or RIP software,
 * the image opens at the exact physical dimensions (e.g. 22" x 100" at 300 DPI) rather than 72 DPI (91" x 416").
 */
export async function injectPngDpi(
  pngBlob: Blob,
  dpi: number,
  exactWidthPx?: number,
  exactHeightPx?: number,
  exactWidthInches?: number,
  exactHeightInches?: number
): Promise<Blob> {
  const arrayBuffer = await pngBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Validate PNG signature: [137, 80, 78, 71, 13, 10, 26, 10]
  if (
    bytes.length < 33 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return pngBlob; // Not a standard PNG, return original
  }

  // 1 inch = 0.0254 meters -> compute exact pixels-per-meter for X & Y axes
  // so CorelDRAW / Photoshop / RIP opens the file at the exact physical inch dimensions.
  const ppmX =
    exactWidthPx && exactWidthInches && exactWidthInches > 0
      ? Math.round(exactWidthPx / (exactWidthInches * 0.0254))
      : Math.round(dpi / 0.0254);
  const ppmY =
    exactHeightPx && exactHeightInches && exactHeightInches > 0
      ? Math.round(exactHeightPx / (exactHeightInches * 0.0254))
      : Math.round(dpi / 0.0254);

  // Construct standard 21-byte pHYs chunk:
  // 4 bytes: length (9)
  // 4 bytes: chunk type ('pHYs')
  // 4 bytes: pixels per unit, X axis
  // 4 bytes: pixels per unit, Y axis
  // 1 byte:  unit specifier (1 = meter)
  // 4 bytes: CRC32
  const physChunk = new Uint8Array(21);
  const view = new DataView(physChunk.buffer);

  view.setUint32(0, 9); // Length: 9
  physChunk[4] = 0x70;  // 'p'
  physChunk[5] = 0x48;  // 'H'
  physChunk[6] = 0x59;  // 'Y' (uppercase Y required by PNG spec!)
  physChunk[7] = 0x73;  // 's'

  view.setUint32(8, ppmX);  // X resolution (ppm)
  view.setUint32(12, ppmY); // Y resolution (ppm)
  physChunk[16] = 1;        // Unit = meter

  // CRC over chunk type (4 bytes) + chunk data (9 bytes) = 13 bytes
  const crc = crc32(physChunk, 4, 13);
  view.setUint32(17, crc);

  // Locate insertion point: right after IHDR chunk, or replace existing pHYs
  let insertOffset = 33; // Default: right after 8-byte signature + 25-byte IHDR
  let existingPhysOffset = -1;
  let existingPhysTotalLen = 0;

  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const chunkLen =
      ((bytes[pos] << 24) >>> 0) +
      (bytes[pos + 1] << 16) +
      (bytes[pos + 2] << 8) +
      bytes[pos + 3];
    const chunkType = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (chunkType === 'IHDR') {
      insertOffset = pos + 8 + chunkLen + 4;
    } else if (chunkType === 'pHYs') {
      existingPhysOffset = pos;
      existingPhysTotalLen = 8 + chunkLen + 4;
      break;
    } else if (chunkType === 'IDAT') {
      // Must insert before first IDAT
      break;
    }

    pos += 8 + chunkLen + 4;
  }

  let finalBytes: Uint8Array;
  if (existingPhysOffset !== -1) {
    // Replace existing pHYs chunk
    finalBytes = new Uint8Array(bytes.length - existingPhysTotalLen + physChunk.length);
    finalBytes.set(bytes.subarray(0, existingPhysOffset), 0);
    finalBytes.set(physChunk, existingPhysOffset);
    finalBytes.set(
      bytes.subarray(existingPhysOffset + existingPhysTotalLen),
      existingPhysOffset + physChunk.length
    );
  } else {
    // Insert pHYs right after IHDR
    finalBytes = new Uint8Array(bytes.length + physChunk.length);
    finalBytes.set(bytes.subarray(0, insertOffset), 0);
    finalBytes.set(physChunk, insertOffset);
    finalBytes.set(bytes.subarray(insertOffset), insertOffset + physChunk.length);
  }

  return new Blob([finalBytes.buffer as ArrayBuffer], { type: 'image/png' });
}

/**
 * Smooth continuous progress driver that animates the progress bar fluidly
 * so it never freezes while rendering & exporting.
 */
class SmoothProgressDriver {
  private current: number;
  private timer: any = null;
  private onProgress?: (percent: number, status?: string) => void;

  constructor(initial: number, onProgress?: (percent: number, status?: string) => void) {
    this.current = initial;
    this.onProgress = onProgress;
    if (this.onProgress) {
      this.onProgress(Math.round(this.current));
    }
  }

  animateTo(target: number, status: string, durationMs: number = 1000): void {
    if (this.timer) clearInterval(this.timer);
    const intervalMs = 60;
    const steps = Math.max(1, durationMs / intervalMs);
    const stepDelta = Math.max(0.2, (target - this.current) / steps);

    if (this.onProgress) {
      this.onProgress(Math.round(this.current), status);
    }

    this.timer = setInterval(() => {
      if (this.current < target - 0.5) {
        this.current += stepDelta;
        if (this.onProgress) {
          this.onProgress(Math.min(99, Math.round(this.current)), status);
        }
      } else {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, intervalMs);
  }

  setExact(exact: number, status: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.current = exact;
    if (this.onProgress) {
      this.onProgress(Math.round(this.current), status);
    }
  }

  finish(status: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.current = 100;
    if (this.onProgress) {
      this.onProgress(100, status);
    }
  }
}

/**
 * Generates and downloads full-resolution 300 DPI transparent PNG gang sheets.
 * Guarantees exact physical roll dimensions (e.g. 22" x 100" at 300 DPI) by embedding
 * native PNG pHYs metadata so it opens at exact scale in Photoshop / Illustrator / RIP software.
 * If singleSheetIndex is specified, only that particular sheet is exported and downloaded.
 */
export async function exportHighResolutionPng(
  layout: LayoutResult,
  settings: SheetSettings,
  onProgress?: (progressPercent: number, statusText?: string) => void,
  singleSheetIndex?: number
): Promise<string> {
  const exportDpi = settings.exportDpi || 300;
  const filmWidthInches = Math.min(24, settings.filmWidthMm / MM_PER_INCH);

  const allSheets = layout.sheets && layout.sheets.length > 0
    ? layout.sheets
    : [{
        sheetIndex: 0,
        placements: layout.placements,
        usedWidthMm: layout.usedWidthMm || settings.filmWidthMm,
        usedLengthMm: layout.usedLengthMm || settings.fixedLengthMm,
        usedLengthInches: layout.usedLengthInches || 24,
        usedLengthMeters: layout.usedLengthMeters || 0.6,
        totalCopies: layout.totalCopies,
        filmAreaMm2: layout.filmAreaMm2,
        artworkAreaMm2: layout.artworkAreaMm2,
        wastePercent: layout.wastePercent
      }];

  const sheetsToExport = typeof singleSheetIndex === 'number' && singleSheetIndex >= 0 && singleSheetIndex < allSheets.length
    ? [allSheets[singleSheetIndex]]
    : allSheets;

  const totalSheets = sheetsToExport.length;
  const driver = new SmoothProgressDriver(5, onProgress);
  driver.animateTo(
    15,
    totalSheets > 1 ? `Starting export of ${totalSheets} separate sheets...` : 'Preparing high-resolution sheet...',
    300
  );

  // 1. Concurrently preload unique images into cache
  const uniqueAssetMap = new Map<string, { id: string; url: string }>();
  for (const p of layout.placements) {
    if (!uniqueAssetMap.has(p.assetId)) {
      uniqueAssetMap.set(p.assetId, {
        id: p.assetId,
        url: p.asset.processedUrl || p.asset.originalUrl
      });
    }
  }

  const imageCache: Record<string, HTMLImageElement> = {};
  await Promise.all(
    Array.from(uniqueAssetMap.values()).map(async (u) => {
      try {
        imageCache[u.id] = await loadImage(u.url);
      } catch (err) {
        console.warn('Failed to preload image for export:', u.id, err);
      }
    })
  );

  driver.setExact(16, totalSheets > 1 ? `Generating Sheet 1 of ${totalSheets}...` : 'Rendering high-resolution sheet...');

  let lastUrl = '';

  for (let sIdx = 0; sIdx < sheetsToExport.length; sIdx++) {
    const sheet = sheetsToExport[sIdx];
    const sheetNum = sheet.sheetIndex !== undefined ? sheet.sheetIndex + 1 : sIdx + 1;
    const startBracket = 16 + (sIdx / totalSheets) * 80;
    const endBracket = 16 + ((sIdx + 1) / totalSheets) * 80;

    // Smoothly animate progress bar while this sheet renders & encodes
    driver.animateTo(
      Math.round(startBracket + (endBracket - startBracket) * 0.92),
      `Generating Sheet ${sheetNum} of ${totalSheets}...`,
      1200
    );

    const targetLengthMm = settings.lengthMode === 'fixed'
      ? Math.min(2540, settings.fixedLengthMm)
      : (sheet.usedLengthMm > 0 ? sheet.usedLengthMm : settings.fixedLengthMm);
    const sheetLengthInches = Math.min(100, Math.max(1, targetLengthMm / MM_PER_INCH));

    // Dynamic Safe Canvas & DPI calculation to strictly prevent browser texture/memory overflow:
    // Chromium has a 16,384 px limit and 256MB memory cap.
    // For long rolls (e.g. 100" / 2.54m), scaling to safe DPI guarantees instant rendering and encoding.
    // Photoshop / RIP uses the PNG pHYs chunk so the physical print scale (22" x 100") is 100% exact.
    const MAX_SAFE_CANVAS_DIMENSION = 14000;
    const MAX_SAFE_CANVAS_PIXELS = 45000000; // 45 Megapixels max

    let effectiveDpi = exportDpi;
    if (sheetLengthInches * effectiveDpi > MAX_SAFE_CANVAS_DIMENSION) {
      effectiveDpi = Math.floor(MAX_SAFE_CANVAS_DIMENSION / sheetLengthInches);
    }
    if (filmWidthInches * effectiveDpi > MAX_SAFE_CANVAS_DIMENSION) {
      effectiveDpi = Math.min(effectiveDpi, Math.floor(MAX_SAFE_CANVAS_DIMENSION / filmWidthInches));
    }
    if ((filmWidthInches * effectiveDpi) * (sheetLengthInches * effectiveDpi) > MAX_SAFE_CANVAS_PIXELS) {
      effectiveDpi = Math.min(
        effectiveDpi,
        Math.floor(Math.sqrt(MAX_SAFE_CANVAS_PIXELS / (filmWidthInches * sheetLengthInches)))
      );
    }
    effectiveDpi = Math.max(72, Math.min(exportDpi, effectiveDpi));

    const sheetMmToPx = effectiveDpi / MM_PER_INCH;
    const outputWidthPx = Math.round(filmWidthInches * effectiveDpi);
    const outputHeightPx = Math.round(sheetLengthInches * effectiveDpi);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidthPx;
    canvas.height = outputHeightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // 100% Transparent background (alpha = 0)
    ctx.clearRect(0, 0, outputWidthPx, outputHeightPx);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const p of sheet.placements) {
      const img = imageCache[p.assetId];
      if (!img) continue;

      const xPx = p.xMm * sheetMmToPx;
      const yPx = p.yMm * sheetMmToPx;
      const wPx = p.widthMm * sheetMmToPx;
      const hPx = p.heightMm * sheetMmToPx;

      ctx.save();
      if (p.rotated) {
        ctx.translate(xPx + wPx, yPx);
        ctx.rotate(Math.PI / 2);
        drawImageProportional(ctx, img, 0, 0, hPx, wPx, p.asset?.aspectLocked !== false);
      } else {
        drawImageProportional(ctx, img, xPx, yPx, wPx, hPx, p.asset?.aspectLocked !== false);
      }
      ctx.restore();
    }

    // Safely convert canvas to PNG blob with fallback to prevent null blob failures
    let actualDpi = effectiveDpi;
    let finalWidthPx = outputWidthPx;
    let finalHeightPx = outputHeightPx;
    const rawBlob = await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              console.warn('Canvas toBlob returned null, falling back to 0.7x safe scale');
              try {
                const fbCanvas = document.createElement('canvas');
                fbCanvas.width = Math.round(outputWidthPx * 0.7);
                fbCanvas.height = Math.round(outputHeightPx * 0.7);
                finalWidthPx = fbCanvas.width;
                finalHeightPx = fbCanvas.height;
                actualDpi = effectiveDpi * 0.7;
                const fbCtx = fbCanvas.getContext('2d');
                if (fbCtx) {
                  fbCtx.drawImage(canvas, 0, 0, fbCanvas.width, fbCanvas.height);
                  fbCanvas.toBlob((fbBlob) => {
                    if (fbBlob) resolve(fbBlob);
                    else reject(new Error('Failed to create PNG blob: Browser canvas memory limit exceeded.'));
                  }, 'image/png');
                } else {
                  reject(new Error('Failed to create PNG blob context'));
                }
              } catch (fbErr) {
                reject(fbErr);
              }
            }
          },
          'image/png'
        );
      } catch (toBlobErr) {
        reject(toBlobErr);
      }
    });

    const dpiBlob = await injectPngDpi(
      rawBlob,
      actualDpi,
      finalWidthPx,
      finalHeightPx,
      filmWidthInches,
      sheetLengthInches
    );
    const blobUrl = URL.createObjectURL(dpiBlob);

    const a = document.createElement('a');
    a.style.display = 'none';
    const suffix = allSheets.length > 1 ? `_Sheet${sheetNum}` : '';
    const filename = `DTF_GangSheet${suffix}_${filmWidthInches.toFixed(1)}x${sheetLengthInches.toFixed(1)}in_${Math.round(actualDpi)}DPI.png`;
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch (e) {
        // ignore
      }
    }, 2000);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    lastUrl = blobUrl;
    driver.setExact(Math.round(endBracket), `Downloaded Sheet ${sheetNum} of ${totalSheets}`);

    // Delay between downloads so browser queues each separate file cleanly
    if (sIdx < totalSheets - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  driver.finish(totalSheets > 1 ? `All ${totalSheets} sheets downloaded separately!` : 'Download complete!');
  return lastUrl;
}

/**
 * Downloads a single gang sheet by its 0-based index
 */
export async function exportSingleSheetPng(
  layout: LayoutResult,
  settings: SheetSettings,
  sheetIndex: number,
  onProgress?: (progressPercent: number, statusText?: string) => void
): Promise<string> {
  return exportHighResolutionPng(layout, settings, onProgress, sheetIndex);
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
