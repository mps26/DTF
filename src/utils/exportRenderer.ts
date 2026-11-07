import { LayoutResult, SheetSettings, PackedPlacement } from '../types';
import { loadImage } from './imageProcessing';
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
export async function injectPngDpi(pngBlob: Blob, dpi: number): Promise<Blob> {
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

  // 1 inch = 0.0254 meters -> pixels per meter
  const ppm = Math.round(dpi / 0.0254);

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
  physChunk[6] = 0x79;  // 'y'
  physChunk[7] = 0x73;  // 's'

  view.setUint32(8, ppm);  // X resolution (ppm)
  view.setUint32(12, ppm); // Y resolution (ppm)
  physChunk[16] = 1;       // Unit = meter

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
 * Generates and downloads a full-resolution 300 DPI transparent PNG gang sheet.
 * Guarantees exact physical roll dimensions (e.g. 22" x 100" at 300 DPI) by embedding
 * native PNG pHYs metadata so it opens at exact scale in Photoshop / Illustrator / RIP software.
 * If singleSheetIndex is specified, only that particular sheet is exported and downloaded.
 */
export async function exportHighResolutionPng(
  layout: LayoutResult,
  settings: SheetSettings,
  onProgress?: (progressPercent: number) => void,
  singleSheetIndex?: number
): Promise<string> {
  const exportDpi = settings.exportDpi || 300;
  const mmToPx = exportDpi / MM_PER_INCH;
  const filmWidthInches = Math.min(22, settings.filmWidthMm / MM_PER_INCH);
  const outputWidthPx = Math.round(filmWidthInches * exportDpi);

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

  // Preload images into cache once for all sheets
  const imageCache: Record<string, HTMLImageElement> = {};
  const totalPlacements = layout.placements.length;

  for (let i = 0; i < totalPlacements; i++) {
    const p = layout.placements[i];
    if (!imageCache[p.assetId]) {
      const src = p.asset.processedUrl || p.asset.originalUrl;
      imageCache[p.assetId] = await loadImage(src);
    }
    if (onProgress) {
      onProgress(Math.round(((i + 1) / (totalPlacements * 2)) * 50));
    }
  }

  let lastUrl = '';

  for (let sIdx = 0; sIdx < sheetsToExport.length; sIdx++) {
    const sheet = sheetsToExport[sIdx];
    const targetLengthMm = settings.lengthMode === 'fixed'
      ? Math.min(2540, settings.fixedLengthMm)
      : (sheet.usedLengthMm > 0 ? sheet.usedLengthMm : settings.fixedLengthMm);
    const sheetLengthInches = Math.min(100, Math.max(1, targetLengthMm / MM_PER_INCH));
    const outputHeightPx = Math.round(sheetLengthInches * exportDpi);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidthPx;
    canvas.height = outputHeightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.clearRect(0, 0, outputWidthPx, outputHeightPx);

    for (const p of sheet.placements) {
      const img = imageCache[p.assetId];
      if (!img) continue;

      const xPx = p.xMm * mmToPx;
      const yPx = p.yMm * mmToPx;
      const wPx = p.widthMm * mmToPx;
      const hPx = p.heightMm * mmToPx;

      ctx.save();
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
    }

    const url = await new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        async (rawBlob) => {
          if (!rawBlob) {
            reject(new Error('Failed to create PNG blob'));
            return;
          }

          try {
            const dpiBlob = await injectPngDpi(rawBlob, exportDpi);
            const blobUrl = URL.createObjectURL(dpiBlob);
            const a = document.createElement('a');
            const sheetNumber = sheet.sheetIndex !== undefined ? sheet.sheetIndex + 1 : sIdx + 1;
            const suffix = allSheets.length > 1 ? `_Sheet${sheetNumber}` : '';
            const filename = `DTF_GangSheet${suffix}_${filmWidthInches.toFixed(1)}x${sheetLengthInches.toFixed(1)}in_${exportDpi}DPI.png`;
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            resolve(blobUrl);
          } catch (err) {
            reject(err);
          }
        },
        'image/png'
      );
    });

    lastUrl = url;

    // When exporting multiple sheets in sequence, add a small delay so browser triggers separate downloads reliably
    if (sIdx < sheetsToExport.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
  }

  if (onProgress) onProgress(100);
  return lastUrl;
}

/**
 * Downloads a single gang sheet by its 0-based index
 */
export async function exportSingleSheetPng(
  layout: LayoutResult,
  settings: SheetSettings,
  sheetIndex: number,
  onProgress?: (progressPercent: number) => void
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
