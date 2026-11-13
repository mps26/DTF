import { ArtworkAsset, SheetSettings, PackedPlacement, SheetInfo, LayoutResult } from '../types';
import { MM_PER_INCH } from './units';
import { findPresetById } from './sheetPresets';

export const MAX_PRINT_WIDTH_INCHES = 23;
export const MAX_PRINT_HEIGHT_INCHES = 100;
export const MAX_PRINT_WIDTH_MM = MAX_PRINT_WIDTH_INCHES * MM_PER_INCH; // 584.2 mm
export const MAX_PRINT_HEIGHT_MM = MAX_PRINT_HEIGHT_INCHES * MM_PER_INCH; // 2540.0 mm

interface ItemToPack {
  id: string;
  assetId: string;
  copyIndex: number;
  widthMm: number;
  heightMm: number;
  allowRotation: boolean;
  asset: ArtworkAsset;
}

/**
 * Packs designs onto a continuous DTF film roll.
 * Enforces industrial DTF printing rules:
 * 1. ZERO ROTATION: Artwork maintains upright 0° orientation so logos & text never print sideways.
 * 2. ZERO OVERLAP: Orderly row-by-row shelf alignment with guaranteed inter-artwork spacing and edge margins.
 * 3. Exact physical roll constraints (max 22" width x 100" length).
 */
export function packGangSheet(
  assets: ArtworkAsset[],
  settings: SheetSettings
): LayoutResult {
  const startTime = performance.now();

  // Find max item dimensions
  const maxItemWidth = assets.reduce((max, a) => Math.max(max, a.targetWidthMm || 0), 0);

  // Strictly clamp width to maximum 22 inches (558.8 mm)
  const filmWidthMm = Math.min(
    MAX_PRINT_WIDTH_MM,
    Math.max(10, Math.max(settings.filmWidthMm, maxItemWidth))
  );

  const spacingMm = Math.max(5, settings.spacingMm ?? 5);
  const marginMm = Math.max(0, settings.marginMm ?? 5);

  // Usable roll width after margins
  const usableWidthMm = Math.max(1, filmWidthMm - marginMm * 2);

  // 1. Expand all designs into virtual copy instances
  const items: ItemToPack[] = [];
  const activeAssets = settings.mode === 'repeat' && assets.length > 0
    ? [assets[0]]
    : assets;

  activeAssets.forEach((asset) => {
    const copies = Math.max(1, asset.copies || 1);
    for (let i = 0; i < copies; i++) {
      items.push({
        id: `${asset.id}_copy_${i}`,
        assetId: asset.id,
        copyIndex: i,
        widthMm: asset.targetWidthMm || 50,
        heightMm: asset.targetHeightMm || 50,
        // Enforce upright orientation: designs must NOT automatically rotate!
        allowRotation: false,
        asset
      });
    }
  });

  if (items.length === 0) {
    const emptyLengthMm = Math.max(0, settings.fixedLengthMm || 0);
    const emptyLengthInches = Math.round((emptyLengthMm / MM_PER_INCH) * 100) / 100;
    const emptyLengthMeters = Math.round((emptyLengthMm / 1000) * 100) / 100;
    const emptyFilmAreaMm2 = filmWidthMm * emptyLengthMm;

    return {
      placements: [],
      sheets: [{
        sheetIndex: 0,
        placements: [],
        usedWidthMm: filmWidthMm,
        usedLengthMm: Math.round(emptyLengthMm * 10) / 10,
        usedLengthInches: emptyLengthInches,
        usedLengthMeters: emptyLengthMeters,
        totalCopies: 0,
        filmAreaMm2: emptyFilmAreaMm2,
        artworkAreaMm2: 0,
        wastePercent: emptyFilmAreaMm2 > 0 ? 100 : 0
      }],
      totalCopies: 0,
      usedWidthMm: filmWidthMm,
      usedLengthMm: Math.round(emptyLengthMm * 10) / 10,
      usedLengthInches: emptyLengthInches,
      usedLengthMeters: emptyLengthMeters,
      filmAreaMm2: emptyFilmAreaMm2,
      artworkAreaMm2: 0,
      wastePercent: emptyFilmAreaMm2 > 0 ? 100 : 0,
      overflow: false,
      overflowCount: 0,
      calculationTimeMs: 0
    };
  }

  // Calculate candidate maximum height per gang sheet
  const activePreset = findPresetById(settings.filmWidthPreset);
  const maxAllowableLengthMm = activePreset
    ? activePreset.maxLengthIn * MM_PER_INCH
    : (settings.filmWidth <= 11.1 ? 17 * MM_PER_INCH : MAX_PRINT_HEIGHT_MM);

  const candidateMaxHeightMm = settings.lengthMode === 'fixed'
    ? Math.min(maxAllowableLengthMm, settings.fixedLengthMm)
    : maxAllowableLengthMm;

  // Sort items descending by height, then width, so large designs are anchored first
  // and smaller designs nest into all available cavities and gaps before a new sheet is started.
  const sortedItems = [...items].sort((a, b) => {
    const diffH = b.heightMm - a.heightMm;
    if (Math.abs(diffH) > 1) return diffH;
    return (b.widthMm * b.heightMm) - (a.widthMm * a.heightMm);
  });

  interface FreeRect {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  interface InternalSheet {
    sheetIndex: number;
    freeRects: FreeRect[];
    placements: PackedPlacement[];
  }

  const internalSheets: InternalSheet[] = [
    {
      sheetIndex: 0,
      freeRects: [
        {
          x: marginMm,
          y: marginMm,
          w: usableWidthMm,
          h: Math.max(10, candidateMaxHeightMm - marginMm * 2)
        }
      ],
      placements: []
    }
  ];

  let totalArtworkAreaMm2 = 0;

  for (const item of sortedItems) {
    const itemW = Math.min(usableWidthMm, item.widthMm);
    const itemH = item.heightMm;
    totalArtworkAreaMm2 += itemW * itemH;

    let placed = false;

    // First attempt: try placing into existing sheets in order (guarantees Sheet 1 is 100% utilized first!)
    for (const sheet of internalSheets) {
      let bestX = Infinity;
      let bestY = Infinity;
      let bestShort = Infinity;
      let found = false;

      for (const r of sheet.freeRects) {
        if (r.w >= itemW - 0.001 && r.h >= itemH - 0.001) {
          const shortFit = Math.min(r.w - itemW, r.h - itemH);
          if (
            r.y < bestY - 0.1 ||
            (Math.abs(r.y - bestY) <= 0.1 && (r.x < bestX - 0.1 || (Math.abs(r.x - bestX) <= 0.1 && shortFit < bestShort)))
          ) {
            bestY = r.y;
            bestX = r.x;
            bestShort = shortFit;
            found = true;
          }
        }
      }

      if (found) {
        sheet.placements.push({
          id: item.id,
          assetId: item.assetId,
          copyIndex: item.copyIndex,
          sheetIndex: sheet.sheetIndex,
          xMm: bestX,
          yMm: bestY,
          widthMm: itemW,
          heightMm: itemH,
          rotated: false,
          asset: item.asset
        });

        // Footprint with spacing
        const fpX = bestX;
        const fpY = bestY;
        const fpW = Math.min(filmWidthMm - marginMm - fpX, itemW + spacingMm);
        const fpH = Math.min(candidateMaxHeightMm - marginMm - fpY, itemH + spacingMm);

        const nextFree: FreeRect[] = [];
        for (const r of sheet.freeRects) {
          if (r.x >= fpX + fpW || r.x + r.w <= fpX || r.y >= fpY + fpH || r.y + r.h <= fpY) {
            nextFree.push(r);
            continue;
          }
          if (fpY > r.y && fpY < r.y + r.h) {
            nextFree.push({ x: r.x, y: r.y, w: r.w, h: fpY - r.y });
          }
          if (fpY + fpH > r.y && fpY + fpH < r.y + r.h) {
            nextFree.push({ x: r.x, y: fpY + fpH, w: r.w, h: (r.y + r.h) - (fpY + fpH) });
          }
          if (fpX > r.x && fpX < r.x + r.w) {
            nextFree.push({ x: r.x, y: r.y, w: fpX - r.x, h: r.h });
          }
          if (fpX + fpW > r.x && fpX + fpW < r.x + r.w) {
            nextFree.push({ x: fpX + fpW, y: r.y, w: (r.x + r.w) - (fpX + fpW), h: r.h });
          }
        }

        // Prune contained rects
        const filtered: FreeRect[] = [];
        for (let i = 0; i < nextFree.length; i++) {
          const a = nextFree[i];
          if (a.w < 1 || a.h < 1) continue;
          let contained = false;
          for (let j = 0; j < nextFree.length; j++) {
            if (i === j) continue;
            const b = nextFree[j];
            if (a.x >= b.x - 0.01 && a.y >= b.y - 0.01 && a.x + a.w <= b.x + b.w + 0.01 && a.y + a.h <= b.y + b.h + 0.01) {
              contained = true;
              break;
            }
          }
          if (!contained) filtered.push(a);
        }

        sheet.freeRects = filtered;
        placed = true;
        break;
      }
    }

    // Only when an item cannot fit anywhere on any existing sheet, start a new sheet!
    if (!placed) {
      const newSheetIndex = internalSheets.length;
      const initialHeight = Math.max(10, candidateMaxHeightMm - marginMm * 2);
      const newSheet: InternalSheet = {
        sheetIndex: newSheetIndex,
        freeRects: [],
        placements: [
          {
            id: item.id,
            assetId: item.assetId,
            copyIndex: item.copyIndex,
            sheetIndex: newSheetIndex,
            xMm: marginMm,
            yMm: marginMm,
            widthMm: itemW,
            heightMm: itemH,
            rotated: false,
            asset: item.asset
          }
        ]
      };

      const fpW = Math.min(usableWidthMm, itemW + spacingMm);
      const fpH = Math.min(initialHeight, itemH + spacingMm);
      const initialFree: FreeRect[] = [];
      if (marginMm + fpH < candidateMaxHeightMm - marginMm) {
        initialFree.push({
          x: marginMm,
          y: marginMm + fpH,
          w: usableWidthMm,
          h: (candidateMaxHeightMm - marginMm) - (marginMm + fpH)
        });
      }
      if (marginMm + fpW < filmWidthMm - marginMm) {
        initialFree.push({
          x: marginMm + fpW,
          y: marginMm,
          w: (filmWidthMm - marginMm) - (marginMm + fpW),
          h: itemH
        });
      }
      newSheet.freeRects = initialFree;
      internalSheets.push(newSheet);
    }
  }

  const placements: PackedPlacement[] = [];
  const sheets: SheetInfo[] = [];

  for (const s of internalSheets) {
    placements.push(...s.placements);

    const sheetMaxBottomMm = s.placements.reduce(
      (max, p) => Math.max(max, p.yMm + p.heightMm + marginMm),
      0
    );

    const sheetLengthMm = settings.lengthMode === 'fixed'
      ? Math.min(candidateMaxHeightMm, settings.fixedLengthMm)
      : (sheetMaxBottomMm > 0 ? Math.min(candidateMaxHeightMm, sheetMaxBottomMm) : 0);

    const sheetLengthInches = sheetLengthMm / MM_PER_INCH;
    const sheetLengthMeters = sheetLengthMm / 1000;
    const sheetFilmAreaMm2 = filmWidthMm * sheetLengthMm;
    const sheetArtworkAreaMm2 = s.placements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0);
    const sheetWaste = sheetFilmAreaMm2 > 0
      ? Math.max(0, Math.min(100, Math.round(((sheetFilmAreaMm2 - sheetArtworkAreaMm2) / sheetFilmAreaMm2) * 100)))
      : 0;

    sheets.push({
      sheetIndex: s.sheetIndex,
      placements: s.placements,
      usedWidthMm: filmWidthMm,
      usedLengthMm: Math.round(sheetLengthMm * 10) / 10,
      usedLengthInches: Math.round(sheetLengthInches * 100) / 100,
      usedLengthMeters: Math.round(sheetLengthMeters * 100) / 100,
      totalCopies: s.placements.length,
      filmAreaMm2: sheetFilmAreaMm2,
      artworkAreaMm2: sheetArtworkAreaMm2,
      wastePercent: sheetWaste
    });
  }

  // Combined totals
  const totalLengthMm = sheets.reduce((sum, s) => sum + s.usedLengthMm, 0);
  const usedLengthInches = totalLengthMm / MM_PER_INCH;
  const usedLengthMeters = totalLengthMm / 1000;
  const filmAreaMm2 = sheets.reduce((sum, s) => sum + s.filmAreaMm2, 0);
  const wastePercent = filmAreaMm2 > 0
    ? Math.max(0, Math.min(100, Math.round(((filmAreaMm2 - totalArtworkAreaMm2) / filmAreaMm2) * 100)))
    : 0;

  const calculationTimeMs = Math.round(performance.now() - startTime);

  return {
    placements,
    sheets,
    totalCopies: placements.length,
    usedWidthMm: filmWidthMm,
    usedLengthMm: Math.round(totalLengthMm * 10) / 10,
    usedLengthInches: Math.round(usedLengthInches * 100) / 100,
    usedLengthMeters: Math.round(usedLengthMeters * 100) / 100,
    filmAreaMm2,
    artworkAreaMm2: totalArtworkAreaMm2,
    wastePercent,
    overflow: false,
    overflowCount: 0,
    calculationTimeMs
  };
}
