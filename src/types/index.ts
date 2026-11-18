export type Unit = 'inch' | 'mm' | 'cm' | 'meter';

export type DpiStatus = 'green' | 'amber' | 'red';

export type NestingAlgorithm = 'box' | 'skyline' | 'true-shape';

export type LengthMode = 'auto' | 'fixed';

export interface CropBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  emptyPercent: number;
}

export interface ArtworkAsset {
  id: string;
  filename: string;
  fileType: 'png' | 'jpg' | 'jpeg' | 'webp' | 'svg' | 'pdf';
  fileSize: number;
  originalWidth: number;
  originalHeight: number;
  originalAspectRatio?: number;
  hasAlpha: boolean;
  originalUrl: string;
  processedUrl: string;
  svgContent?: string;
  isVector?: boolean;
  trimmedWidth: number;
  trimmedHeight: number;
  cropBox: CropBox | null;
  isTrimmed: boolean;
  isBgRemoved: boolean;
  targetWidth: number; // in current display unit
  targetHeight: number; // in current display unit
  targetWidthMm: number; // canonical mm
  targetHeightMm: number; // canonical mm
  aspectLocked: boolean;
  lockedRatio?: number; // width / height preserved ratio
  copies: number;
  allowRotation: boolean;
  effectiveDpi: number;
  dpiStatus: DpiStatus;
  status: 'uploaded' | 'processing' | 'ready' | 'review_required' | 'warning' | 'failed';
  warningMessage?: string;
  visible?: boolean;
  /** false = kept in the Gallery only; undefined/true = placed on the gang sheet. */
  onSheet?: boolean;
  initialOriginalWidth?: number;
  initialOriginalHeight?: number;
  initialOriginalAspectRatio?: number;
  initialTargetWidth?: number;
  initialTargetHeight?: number;
  initialTargetWidthMm?: number;
  initialTargetHeightMm?: number;
  initialCropBox?: CropBox | null;
}

export type PrintType = 'dtf' | 'uvdtf';

export interface SheetSettings {
  printType?: PrintType;
  filmWidthPreset: string;
  filmWidth: number; // in current unit
  filmWidthMm: number;
  unit: Unit;
  spacing: number; // in current unit
  spacingMm: number;
  margin: number; // in current unit
  marginMm: number;
  lengthMode: LengthMode;
  fixedLength: number; // in current unit
  fixedLengthMm: number;
  exportDpi: number;
  allowItemRotation: boolean;
  /** DTF nesting: prefer keeping copies of the same design near each other (default true). */
  keepDesignsTogether?: boolean;
  nestingAlgorithm: NestingAlgorithm;
  mode: 'multiple' | 'repeat';
  showGrid?: boolean;
  showRulers?: boolean;
  snapToGuides?: boolean;
}

export interface PackedPlacement {
  id: string;
  assetId: string;
  copyIndex: number;
  sheetIndex?: number; // 0 for Sheet 1, 1 for Sheet 2, etc.
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
  /** Fully transparent margin inside each edge of the placed box (mm), as measured by the nesting engine. */
  inkInsetMm?: { l: number; t: number; r: number; b: number };
  asset: ArtworkAsset;
  customX?: number; // manual drag override
  customY?: number;
}

export interface SheetInfo {
  sheetIndex: number;
  placements: PackedPlacement[];
  usedWidthMm: number;
  usedLengthMm: number;
  usedLengthInches: number;
  usedLengthMeters: number;
  totalCopies: number;
  filmAreaMm2: number;
  artworkAreaMm2: number;
  wastePercent: number;
  utilizationPercent?: number;
  unusedAreaMm2?: number;
}

export interface LayoutResult {
  placements: PackedPlacement[];
  sheets: SheetInfo[];
  totalCopies: number;
  usedWidthMm: number;
  usedLengthMm: number;
  usedLengthInches: number;
  usedLengthMeters: number;
  filmAreaMm2: number;
  artworkAreaMm2: number;
  wastePercent: number;
  requestedCopies?: number;
  unusedAreaMm2?: number;
  utilizationPercent?: number;
  scaledToFitCount?: number;
  /** Non-empty only if no collision-free layout could be produced; exports refuse such layouts. */
  validationErrors?: string[];
  overflow: boolean;
  overflowCount: number;
  calculationTimeMs: number;
}

export interface ToolDefinition {
  id: string;
  category: 'fix-quality' | 'cut-adjust' | 'style-effects' | 'create-convert';
  name: string;
  description: string;
  badge?: string;
  iconName: string;
}
