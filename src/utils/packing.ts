import { ArtworkAsset, SheetSettings, PackedPlacement, LayoutResult } from '../types';
import { MM_PER_INCH } from './units';

interface FreeRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ItemToPack {
  id: string;
  assetId: string;
  copyIndex: number;
  widthMm: number;
  heightMm: number;
  allowRotation: boolean;
  asset: ArtworkAsset;
}

export const MAX_PRINT_WIDTH_INCHES = 22;
export const MAX_PRINT_HEIGHT_INCHES = 100;
export const MAX_PRINT_WIDTH_MM = MAX_PRINT_WIDTH_INCHES * MM_PER_INCH; // 558.8 mm
export const MAX_PRINT_HEIGHT_MM = MAX_PRINT_HEIGHT_INCHES * MM_PER_INCH; // 2540.0 mm

/**
 * Packs rectangular items onto a continuous film roll using the MaxRects BSSF (Best Short Side Fit) algorithm.
 * Respects outer margins, inter-item spacing, and optional 90° rotation.
 * Strictly constrained to maximum 22" (558.8 mm) width and 100" (2540.0 mm) length.
 */
export function packGangSheet(
  assets: ArtworkAsset[],
  settings: SheetSettings
): LayoutResult {
  const startTime = performance.now();

  // Find max item dimensions across all assets
  const maxItemWidth = assets.reduce((max, a) => Math.max(max, a.targetWidthMm || 0), 0);
  const maxItemHeight = assets.reduce((max, a) => Math.max(max, a.targetHeightMm || 0), 0);

  // Strictly clamp width to maximum 22 inches (558.8 mm).
  // Dynamically expand effective roll width up to 22" (558.8 mm) if artwork requires it.
  const effectiveFilmWidthMm = Math.min(
    MAX_PRINT_WIDTH_MM,
    Math.max(10, Math.max(settings.filmWidthMm, maxItemWidth))
  );
  const filmWidthMm = effectiveFilmWidthMm;
  const spacingMm = settings.spacingMm;
  const marginMm = settings.marginMm;

  // Usable roll width: For full-size designs up to 22", relax margins so artwork is never blocked
  const usableWidthMm = Math.max(
    10,
    Math.min(filmWidthMm, Math.max(filmWidthMm - marginMm * 2, maxItemWidth))
  );

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
        widthMm: asset.targetWidthMm,
        heightMm: asset.targetHeightMm,
        allowRotation: settings.allowItemRotation && asset.allowRotation,
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

  // 2. Sort items: Descending by area or max dimension (heuristic for better nesting density)
  items.sort((a, b) => {
    const areaA = a.widthMm * a.heightMm;
    const areaB = b.widthMm * b.heightMm;
    if (Math.abs(areaB - areaA) > 0.01) {
      return areaB - areaA;
    }
    return Math.max(b.widthMm, b.heightMm) - Math.max(a.widthMm, a.heightMm);
  });

  // Usable maximum roll height strictly capped to 100 inches (2540.0 mm).
  // For 100" designs, relax margins so full 100" height fits within candidateMaxHeightMm
  const usableMaxHeightMm = Math.max(
    10,
    Math.min(MAX_PRINT_HEIGHT_MM, Math.max(MAX_PRINT_HEIGHT_MM - marginMm * 2, maxItemHeight))
  );

  // Candidate maximum roll height (capped at 100 inches / 2540 mm)
  const candidateMaxHeightMm = settings.lengthMode === 'fixed'
    ? Math.min(usableMaxHeightMm, Math.max(10, Math.max(settings.fixedLengthMm - marginMm * 2, maxItemHeight)))
    : usableMaxHeightMm;

  // Initialize free rectangles with the full usable roll width
  let freeRectangles: FreeRectangle[] = [
    {
      x: 0,
      y: 0,
      width: usableWidthMm,
      height: candidateMaxHeightMm
    }
  ];

  const placements: PackedPlacement[] = [];
  let overflowCount = 0;
  let maxBottomMm = 0;
  let totalArtworkAreaMm2 = 0;

  for (const item of items) {
    const itemW = item.widthMm;
    const itemH = item.heightMm;
    totalArtworkAreaMm2 += itemW * itemH;

    // We add spacing to the dimensions for collision checking
    // Item takes width + spacingMm, height + spacingMm
    let bestScore1 = Infinity;
    let bestScore2 = Infinity;
    let bestRectIndex = -1;
    let bestRotated = false;
    let bestX = 0;
    let bestY = 0;
    let bestPlacedW = itemW;
    let bestPlacedH = itemH;

    for (let r = 0; r < freeRectangles.length; r++) {
      const free = freeRectangles[r];

      // Try normal orientation
      if (free.width >= itemW && free.height >= itemH) {
        const leftoverW = free.width - itemW;
        const leftoverH = free.height - itemH;
        const shortSide = Math.min(leftoverW, leftoverH);
        const longSide = Math.max(leftoverW, leftoverH);

        // Best Short Side Fit: minimize shortSide leftover, break tie by y (pack top-to-bottom)
        const score1 = free.y * 1000 + shortSide;
        const score2 = longSide;

        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestRectIndex = r;
          bestRotated = false;
          bestX = free.x;
          bestY = free.y;
          bestPlacedW = itemW;
          bestPlacedH = itemH;
        }
      }

      // Try 90-degree rotated orientation
      if (item.allowRotation && free.width >= itemH && free.height >= itemW) {
        const leftoverW = free.width - itemH;
        const leftoverH = free.height - itemW;
        const shortSide = Math.min(leftoverW, leftoverH);
        const longSide = Math.max(leftoverW, leftoverH);

        const score1 = free.y * 1000 + shortSide;
        const score2 = longSide;

        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestRectIndex = r;
          bestRotated = true;
          bestX = free.x;
          bestY = free.y;
          bestPlacedW = itemH;
          bestPlacedH = itemW;
        }
      }
    }

    if (bestRectIndex === -1) {
      // If nothing has been placed yet, guarantee the artwork is placed so the sheet is NEVER blank!
      if (placements.length === 0) {
        bestX = 0;
        bestY = 0;
        bestPlacedW = Math.min(filmWidthMm, itemW);
        bestPlacedH = Math.min(MAX_PRINT_HEIGHT_MM, itemH);
        bestRotated = false;
      } else {
        overflowCount++;
        continue;
      }
    }

    // Determine actual margin offset (clamped so design does not clip off sheet)
    const actualMarginX = (filmWidthMm - bestPlacedW >= marginMm * 2)
      ? marginMm
      : Math.max(0, (filmWidthMm - bestPlacedW) / 2);

    const actualMarginY = (candidateMaxHeightMm - bestPlacedH >= marginMm * 2)
      ? marginMm
      : 0;

    // Record placement
    const placement: PackedPlacement = {
      id: item.id,
      assetId: item.assetId,
      copyIndex: item.copyIndex,
      xMm: Math.max(0, Math.min(filmWidthMm - bestPlacedW, bestX + actualMarginX)),
      yMm: bestY + actualMarginY,
      widthMm: bestPlacedW,
      heightMm: bestPlacedH,
      rotated: bestRotated,
      asset: item.asset
    };

    placements.push(placement);

    const placedBottom = placement.yMm + bestPlacedH;
    if (placedBottom > maxBottomMm) {
      maxBottomMm = placedBottom;
    }

    // Split intersected free rectangles
    // Bounding box of newly occupied area including gap spacing
    const occupiedRect: FreeRectangle = {
      x: bestX,
      y: bestY,
      width: bestPlacedW + spacingMm,
      height: bestPlacedH + spacingMm
    };

    const newFreeRects: FreeRectangle[] = [];

    for (const free of freeRectangles) {
      // Check for overlap
      if (
        occupiedRect.x >= free.x + free.width ||
        occupiedRect.x + occupiedRect.width <= free.x ||
        occupiedRect.y >= free.y + free.height ||
        occupiedRect.y + occupiedRect.height <= free.y
      ) {
        // No intersection, keep it
        newFreeRects.push(free);
        continue;
      }

      // Intersected: split free rectangle into up to 4 non-overlapping rectangles
      // Top slice
      if (occupiedRect.y > free.y && occupiedRect.y < free.y + free.height) {
        newFreeRects.push({
          x: free.x,
          y: free.y,
          width: free.width,
          height: occupiedRect.y - free.y
        });
      }
      // Bottom slice
      if (occupiedRect.y + occupiedRect.height < free.y + free.height) {
        newFreeRects.push({
          x: free.x,
          y: occupiedRect.y + occupiedRect.height,
          width: free.width,
          height: free.y + free.height - (occupiedRect.y + occupiedRect.height)
        });
      }
      // Left slice
      if (occupiedRect.x > free.x && occupiedRect.x < free.x + free.width) {
        newFreeRects.push({
          x: free.x,
          y: free.y,
          width: occupiedRect.x - free.x,
          height: free.height
        });
      }
      // Right slice
      if (occupiedRect.x + occupiedRect.width < free.x + free.width) {
        newFreeRects.push({
          x: free.x + occupiedRect.width,
          y: free.y,
          width: free.x + free.width - (occupiedRect.x + occupiedRect.width),
          height: free.height
        });
      }
    }

    // Prune redundant contained rectangles
    freeRectangles = pruneContainedRectangles(newFreeRects);
  }

  // Calculate final sheet metrics - strictly capped at 100 inches (2540.0 mm)
  const totalLengthMm = settings.lengthMode === 'fixed'
    ? Math.min(MAX_PRINT_HEIGHT_MM, settings.fixedLengthMm)
    : (maxBottomMm > 0 ? Math.min(MAX_PRINT_HEIGHT_MM, maxBottomMm) : 0);

  const usedLengthInches = totalLengthMm / MM_PER_INCH;
  const usedLengthMeters = totalLengthMm / 1000;
  const filmAreaMm2 = filmWidthMm * totalLengthMm;
  const wastePercent = filmAreaMm2 > 0
    ? Math.max(0, Math.min(100, Math.round(((filmAreaMm2 - totalArtworkAreaMm2) / filmAreaMm2) * 100)))
    : 0;

  const overflow = overflowCount > 0 || (maxBottomMm > MAX_PRINT_HEIGHT_MM + 1) || (settings.lengthMode === 'fixed' && maxBottomMm > settings.fixedLengthMm + 1);

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

/**
 * Removes any rectangle that is completely contained within another rectangle
 */
function pruneContainedRectangles(rectangles: FreeRectangle[]): FreeRectangle[] {
  const result: FreeRectangle[] = [];
  const len = rectangles.length;

  for (let i = 0; i < len; i++) {
    const a = rectangles[i];
    if (a.width <= 0 || a.height <= 0) continue;
    let isContained = false;

    for (let j = 0; j < len; j++) {
      if (i === j) continue;
      const b = rectangles[j];
      if (
        a.x >= b.x &&
        a.y >= b.y &&
        a.x + a.width <= b.x + b.width &&
        a.y + a.height <= b.y + b.height
      ) {
        isContained = true;
        break;
      }
    }

    if (!isContained) {
      result.push(a);
    }
  }

  return result;
}

