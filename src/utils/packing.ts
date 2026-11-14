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
    const emptyLengthMm = settings.lengthMode === 'fixed' ? Math.max(0, settings.fixedLengthMm || 0) : 0;
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

  // Industrial DTF Sequential Shelf Packing:
  // 1. Preserve original asset & copy sequence without random height-based sorting.
  // 2. Lay out designs in orderly horizontal rows from left margin to right edge.
  // 3. Whenever a row is filled or a new row starts, strictly align to the left margin (x = marginMm).
  // 4. Proportional scaling if an artwork's width exceeds printable roll width.
  // 5. Zero rotation: preserve upright 0° orientation.
  interface InternalSheet {
    sheetIndex: number;
    placements: PackedPlacement[];
  }

  const internalSheets: InternalSheet[] = [
    {
      sheetIndex: 0,
      placements: []
    }
  ];

  let currentSheetIndex = 0;
  let curX = marginMm;
  let curY = marginMm;
  let curRowHeight = 0;
  let totalArtworkAreaMm2 = 0;

  for (const item of items) {
    let itemW = item.widthMm;
    let itemH = item.heightMm;

    // Preserve proportional aspect ratio if item is wider than printable roll width
    if (itemW > usableWidthMm) {
      const scale = usableWidthMm / itemW;
      itemW = usableWidthMm;
      itemH = itemH * scale;
    }

    totalArtworkAreaMm2 += itemW * itemH;

    // Check if item fits in current row horizontally
    const fitsInCurrentRow = curX + itemW <= filmWidthMm - marginMm + 0.001;

    if (fitsInCurrentRow) {
      // Check if current row exceeds candidateMaxHeightMm
      if (curY + itemH > candidateMaxHeightMm - marginMm + 0.001 && curY > marginMm) {
        // Current sheet cannot fit this row vertically, start next sheet
        currentSheetIndex++;
        internalSheets.push({
          sheetIndex: currentSheetIndex,
          placements: []
        });
        curX = marginMm;
        curY = marginMm;
        curRowHeight = itemH;
      } else {
        curRowHeight = Math.max(curRowHeight, itemH);
      }
    } else {
      // Row is full. Advance to next row, strictly resetting x to left margin!
      const nextY = curY + curRowHeight + spacingMm;

      // Does the new row fit on the current sheet?
      if (nextY + itemH <= candidateMaxHeightMm - marginMm + 0.001) {
        curY = nextY;
        curX = marginMm;
        curRowHeight = itemH;
      } else {
        // Start a new sheet!
        currentSheetIndex++;
        internalSheets.push({
          sheetIndex: currentSheetIndex,
          placements: []
        });
        curX = marginMm;
        curY = marginMm;
        curRowHeight = itemH;
      }
    }

    // Place the item at (curX, curY)
    internalSheets[currentSheetIndex].placements.push({
      id: item.id,
      assetId: item.assetId,
      copyIndex: item.copyIndex,
      sheetIndex: currentSheetIndex,
      xMm: Math.round(curX * 100) / 100,
      yMm: Math.round(curY * 100) / 100,
      widthMm: Math.round(itemW * 100) / 100,
      heightMm: Math.round(itemH * 100) / 100,
      rotated: false,
      asset: item.asset
    });

    // Advance curX for the next item in this row
    curX += itemW + spacingMm;
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
