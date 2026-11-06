import { ArtworkAsset, SheetSettings, PackedPlacement, LayoutResult } from '../types';
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

  // Calculate candidate maximum height
  const candidateMaxHeightMm = settings.lengthMode === 'fixed'
    ? Math.min(MAX_PRINT_HEIGHT_MM, settings.fixedLengthMm)
    : MAX_PRINT_HEIGHT_MM;

  const placements: PackedPlacement[] = [];
  let overflowCount = 0;
  let totalArtworkAreaMm2 = 0;

  // ================= ROW-BY-ROW SHELF PACKING (Guaranteed Zero Overlap & Aligned One After Another) =================
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
    // Requires: current X + item width <= filmWidth - margin
    const requiredX = currentRowX + itemW;
    const fitsInCurrentRow = itemsInCurrentRow === 0 || requiredX <= filmWidthMm - marginMm + 0.1;

    if (!fitsInCurrentRow) {
      // Advance to next row
      currentRowY += currentRowHeight + spacingMm;
      currentRowX = marginMm;
      currentRowHeight = 0;
      itemsInCurrentRow = 0;
    }

    // Check height overflow beyond 100" roll limit
    if (currentRowY + itemH > candidateMaxHeightMm + 1) {
      overflowCount++;
    }

    // Create guaranteed non-overlapping placement
    const placement: PackedPlacement = {
      id: item.id,
      assetId: item.assetId,
      copyIndex: item.copyIndex,
      xMm: currentRowX,
      yMm: currentRowY,
      widthMm: itemW,
      heightMm: itemH,
      rotated: false, // Strictly upright: no auto-rotation!
      asset: item.asset
    };

    placements.push(placement);

    // Update row state
    currentRowHeight = Math.max(currentRowHeight, itemH);
    currentRowX += itemW + spacingMm;
    itemsInCurrentRow++;
  }

  // ================= COLLISION VERIFICATION PASS =================
  // Extra mathematical safety guard: verifies no two placements can ever overlap
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];

      const overlapX = a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm;
      const overlapY = a.yMm < b.yMm + b.heightMm && a.yMm + a.heightMm > b.yMm;

      if (overlapX && overlapY) {
        // Resolve collision: push item b below item a
        b.yMm = a.yMm + a.heightMm + spacingMm;
      }
    }
  }

  // Calculate final sheet metrics
  const maxBottomMm = placements.reduce(
    (max, p) => Math.max(max, p.yMm + p.heightMm + marginMm),
    0
  );

  const totalLengthMm = settings.lengthMode === 'fixed'
    ? Math.min(MAX_PRINT_HEIGHT_MM, settings.fixedLengthMm)
    : (maxBottomMm > 0 ? Math.min(MAX_PRINT_HEIGHT_MM, maxBottomMm) : 0);

  const usedLengthInches = totalLengthMm / MM_PER_INCH;
  const usedLengthMeters = totalLengthMm / 1000;
  const filmAreaMm2 = filmWidthMm * totalLengthMm;
  const wastePercent = filmAreaMm2 > 0
    ? Math.max(0, Math.min(100, Math.round(((filmAreaMm2 - totalArtworkAreaMm2) / filmAreaMm2) * 100)))
    : 0;

  const overflow = overflowCount > 0 || (maxBottomMm > MAX_PRINT_HEIGHT_MM + 1);
  const calculationTimeMs = Math.round(performance.now() - startTime);

  return {
    placements,
    totalCopies: placements.length,
    usedWidthMm: filmWidthMm,
    usedLengthMm: Math.round(totalLengthMm * 10) / 10,
    usedLengthInches: Math.round(usedLengthInches * 100) / 100,
    usedLengthMeters: Math.round(usedLengthMeters * 100) / 100,
    filmAreaMm2,
    artworkAreaMm2: totalArtworkAreaMm2,
    wastePercent,
    overflow,
    overflowCount,
    calculationTimeMs
  };
}
