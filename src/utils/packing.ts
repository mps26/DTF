import { ArtworkAsset, SheetSettings, LayoutResult } from '../types';
import { MM_PER_INCH } from './units';
import { packDtfGangSheet, InkBounds } from './dtfNesting';

export const MAX_PRINT_WIDTH_INCHES = 23;
export const MAX_PRINT_HEIGHT_INCHES = 100;
export const MAX_PRINT_WIDTH_MM = MAX_PRINT_WIDTH_INCHES * MM_PER_INCH; // 584.2 mm
export const MAX_PRINT_HEIGHT_MM = MAX_PRINT_HEIGHT_INCHES * MM_PER_INCH; // 2540.0 mm

/**
 * Gang-sheet packing entry point used by the preview, the preview modal and all exports.
 * DTF and UVDTF both use the MaxRects nesting engine (./dtfNesting.ts), each with its
 * own sheet sizes. With 90° Rotation on, every design is evaluated in both
 * orientations and rotated only when that gives a better layout.
 */
export function packGangSheet(
  assets: ArtworkAsset[],
  settings: SheetSettings,
  inkBounds?: Record<string, InkBounds | null | undefined>
): LayoutResult {
  return packDtfGangSheet(assets, settings, { inkBounds });
}
