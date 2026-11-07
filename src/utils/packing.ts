import { ArtworkAsset, SheetSettings, PackedPlacement, SheetInfo, LayoutResult } from '../types';
import { MM_PER_INCH } from './units';

export const MAX_PRINT_WIDTH_INCHES = 22;
export const MAX_PRINT_HEIGHT_INCHES = 100;
export const MAX_PRINT_WIDTH_MM = MAX_PRINT_WIDTH_INCHES * MM_PER_INCH; // 558.8 mm
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

  const spacingMm = Math.max(0, settings.spacingMm ?? 5);
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
    return {
      placements: [],
      sheets: [{
        sheetIndex: 0,
        placements: [],
        usedWidthMm: filmWidthMm,
        usedLengthMm: 0,
        usedLengthInches: 0,
        usedLengthMeters: 0,
        totalCopies: 0,
        filmAreaMm2: 0,
        artworkAreaMm2: 0,
        wastePercent: 0
      }],
      totalCopies: 0,
      usedWidthMm: filmWidthMm,
      usedLengthMm: 0,
      usedLengthInches: 0,
      usedLengthMeters: 0,
      filmAreaMm2: 0,
      artworkAreaMm2: 0,
      wastePercent: 0,
      overflow: false,
      overflowCount: 0,
      calculationTimeMs: 0
    };
  }

  // Calculate candidate maximum height per gang sheet
  // Hardware bounds: 11" roll max length is 17" (431.8 mm); 22" roll max length is 100" (2540 mm)
  const maxAllowableLengthMm = settings.filmWidth <= 11.1
    ? 17 * MM_PER_INCH
    : MAX_PRINT_HEIGHT_MM;

  const candidateMaxHeightMm = settings.lengthMode === 'fixed'
    ? Math.min(maxAllowableLengthMm, settings.fixedLengthMm)
    : maxAllowableLengthMm;

  const placements: PackedPlacement[] = [];
  let totalArtworkAreaMm2 = 0;

  // Track sheet and shelf state
  let currentSheetIndex = 0;
  let currentRowX = marginMm;
  let currentRowY = marginMm;
  let currentRowHeight = 0;
  let itemsInCurrentRow = 0;

  for (const item of items) {
    // Clamp width to usable film width so large artwork does not bleed off edges
    const itemW = Math.min(usableWidthMm, item.widthMm);
    const itemH = item.heightMm;
    totalArtworkAreaMm2 += itemW * itemH;

    // Check if item fits in the current row:
    const requiredX = currentRowX + itemW;
    const fitsInCurrentRow = itemsInCurrentRow === 0 || requiredX <= filmWidthMm - marginMm + 0.1;

    let targetX = currentRowX;
    let targetY = currentRowY;

    if (!fitsInCurrentRow) {
      targetX = marginMm;
      targetY = currentRowY + currentRowHeight + spacingMm;
    }

    // CHECK IF THIS ITEM FITS VERTICALLY ON THE CURRENT SHEET:
    // If targetY + itemH exceeds candidateMaxHeightMm - marginMm, the item would appear cut in half!
    // In such cases, we start another gang sheet beside it of the exact same size.
    if (targetY + itemH > candidateMaxHeightMm - marginMm + 0.1 && (itemsInCurrentRow > 0 || currentRowY > marginMm)) {
      currentSheetIndex++;
      currentRowX = marginMm;
      currentRowY = marginMm;
      currentRowHeight = 0;
      itemsInCurrentRow = 0;
      targetX = marginMm;
      targetY = marginMm;
    } else if (!fitsInCurrentRow) {
      currentRowY = targetY;
      currentRowX = marginMm;
      currentRowHeight = 0;
      itemsInCurrentRow = 0;
    }

    // Create guaranteed non-overlapping placement on current sheet
    const placement: PackedPlacement = {
      id: item.id,
      assetId: item.assetId,
      copyIndex: item.copyIndex,
      sheetIndex: currentSheetIndex,
      xMm: targetX,
      yMm: targetY,
      widthMm: itemW,
      heightMm: itemH,
      rotated: false, // Strictly upright: no auto-rotation!
      asset: item.asset
    };

    placements.push(placement);

    // Update row state
    currentRowHeight = Math.max(currentRowHeight, itemH);
    currentRowX = targetX + itemW + spacingMm;
    itemsInCurrentRow++;
  }

  // Calculate individual sheet metrics
  const sheets: SheetInfo[] = [];
  for (let s = 0; s <= currentSheetIndex; s++) {
    const sheetPlacements = placements.filter((p) => (p.sheetIndex ?? 0) === s);
    const sheetMaxBottomMm = sheetPlacements.reduce(
      (max, p) => Math.max(max, p.yMm + p.heightMm + marginMm),
      0
    );

    const sheetLengthMm = settings.lengthMode === 'fixed'
      ? Math.min(candidateMaxHeightMm, settings.fixedLengthMm)
      : (sheetMaxBottomMm > 0 ? Math.min(candidateMaxHeightMm, sheetMaxBottomMm) : 0);

    const sheetLengthInches = sheetLengthMm / MM_PER_INCH;
    const sheetLengthMeters = sheetLengthMm / 1000;
    const sheetFilmAreaMm2 = filmWidthMm * sheetLengthMm;
    const sheetArtworkAreaMm2 = sheetPlacements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0);
    const sheetWaste = sheetFilmAreaMm2 > 0
      ? Math.max(0, Math.min(100, Math.round(((sheetFilmAreaMm2 - sheetArtworkAreaMm2) / sheetFilmAreaMm2) * 100)))
      : 0;

    sheets.push({
      sheetIndex: s,
      placements: sheetPlacements,
      usedWidthMm: filmWidthMm,
      usedLengthMm: Math.round(sheetLengthMm * 10) / 10,
      usedLengthInches: Math.round(sheetLengthInches * 100) / 100,
      usedLengthMeters: Math.round(sheetLengthMeters * 100) / 100,
      totalCopies: sheetPlacements.length,
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
