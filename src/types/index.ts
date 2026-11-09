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
  fileType: 'png' | 'jpg' | 'jpeg' | 'webp';
  fileSize: number;
  originalWidth: number;
  originalHeight: number;
  hasAlpha: boolean;
  originalUrl: string;
  processedUrl: string;
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
}

export interface SheetSettings {
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
