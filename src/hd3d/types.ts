/**
 * 3D HD printing: one master artwork with three aligned print layers.
 *
 *   W1  — white base / raised 3D ink   (binary mask, 100 % where selected)
 *   CMY — the original colour artwork  (never replaced by mask colours)
 *   W2  — gloss / varnish              (binary mask, 100 % where selected)
 *
 * All three are stored at the artwork's own pixel size and share its pixel grid.
 * A design is positioned on the sheet as ONE object, so every move, rotation,
 * scale or copy applies to all three layers with the same transform.
 */

export const HD3D_SHEET_WIDTH_IN = 11;
export const HD3D_SHEET_LENGTH_IN = 17;

/** Binary mask, one byte per artwork pixel: 0 = no ink, 255 = 100 % ink. */
export type Mask = Uint8Array;

export type TextureTarget = 'w1' | 'w2' | 'cmy';

export interface TextureApplication {
  id: string;
  textureId: string;
  /** Which layer the texture creates: raised pattern (W1), gloss pattern (W2) or colour detailing (CMY). */
  target: TextureTarget;
  /** Region the texture is clipped to (artwork pixel grid). */
  clip: Mask;
  /** Tile scale, 1 = one texture pixel per artwork pixel. */
  scale: number;
  /** 0–1: share of the pattern that becomes ink (W1/W2) or detailing strength (CMY). */
  intensity: number;
  offsetX: number;
  offsetY: number;
}

export interface HdLayerState {
  w1: Mask;
  w2: Mask;
  /** W2 leaves out the raised W1 areas (default). Off = gloss may cover raised areas too. */
  w2ExcludesW1: boolean;
  textures: TextureApplication[];
}

export interface HdDesign {
  id: string;
  filename: string;
  fileSize: number;
  /** Original PNG, never modified. */
  file: Blob;
  url: string;
  width: number;
  height: number;
  /** DPI stored in the PNG (pHYs), if any. */
  fileDpi: number | null;
  /** Decoded artwork pixels (RGBA, straight alpha). */
  rgba: Uint8ClampedArray;
  layers: HdLayerState;
  /** Printed size on the sheet. */
  widthIn: number;
  heightIn: number;
  copies: number;
  /** Bumps whenever the layers change, so previews can refresh. */
  revision: number;
}

export interface HdTexture {
  id: string;
  name: string;
  category: string;
  /** Square, seamlessly tiling height map (0 = low, 255 = high). */
  size: number;
  tile: Uint8Array;
  builtIn: boolean;
  createdBy?: string;
}

export type HdPreviewMode = 'original' | 'w1' | 'cmy' | 'w2' | 'combined';
