/// <reference lib="webworker" />
/**
 * 3D HD export worker: builds the final W1 / W2 masks and CMY artwork of every
 * design, composes the 11 × 17 sheets and writes the TIFF files, off the UI thread.
 * Cancel = terminate the worker.
 */
import { finalMasks, bakeCmy, layerCoverage } from '../hd3d/maskOps';
import { composeSheets, ExportDesign, ExportFormat, ExportPlacement } from '../hd3d/sheetCompose';
import { readTiff } from '../hd3d/tiffReader';
import type { HdLayerState } from '../hd3d/types';

export interface Hd3dExportRequest {
  dpi: number;
  format: ExportFormat;
  invertSpots: boolean;
  sheetWidthIn: number;
  sheetLengthIn: number;
  designs: Array<{ id: string; width: number; height: number; rgba: Uint8ClampedArray; layers: HdLayerState }>;
  tiles: Record<string, { tile: Uint8Array; size: number }>;
  sheets: ExportPlacement[][];
}

export interface Hd3dVerification {
  name: string;
  width: number;
  height: number;
  dpi: number;
  samplesPerPixel: number;
  channelNames: string[];
  spotKinds: number[];
  checkedPixels: boolean;
}

export type Hd3dExportMessage =
  | { type: 'progress'; fraction: number; label: string }
  | {
      type: 'done';
      files: Array<{ name: string; parts: Uint8Array[] }>;
      stats: Array<{ widthPx: number; heightPx: number; w1Pixels: number; w2Pixels: number; artworkPixels: number }>;
      verification: Hd3dVerification[];
      /** Per-design coverage of the exported masks (same calculation as the design cards). */
      coverage: Array<{ id: string; w1Pct: number; w2Pct: number; identical: boolean }>;
    }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const VERIFY_FULL_LIMIT = 400e6; // bytes: re-decode whole files up to this size

ctx.onmessage = (e: MessageEvent<Hd3dExportRequest>) => {
  const req = e.data;
  const post = (m: Hd3dExportMessage, transfer: Transferable[] = []) => ctx.postMessage(m, transfer);
  try {
    const lookup = (id: string) => req.tiles[id];
    const coverage: Array<{ id: string; w1Pct: number; w2Pct: number; identical: boolean }> = [];
    const designs: ExportDesign[] = req.designs.map((d, i) => {
      post({ type: 'progress', fraction: 0, label: `Preparing layers of design ${i + 1} / ${req.designs.length}` });
      const fm = finalMasks(d.rgba, d.width, d.height, d.layers, lookup);
      const cov = layerCoverage(d.rgba, d.width, d.height, fm);
      coverage.push({ id: d.id, w1Pct: cov.w1Pct, w2Pct: cov.w2Pct, identical: cov.identical });
      return { id: d.id, width: d.width, height: d.height, rgba: bakeCmy(d.rgba, d.width, d.height, d.layers.textures, lookup), w1: fm.w1, w2: fm.w2, w2ExcludesW1: d.layers.w2ExcludesW1 };
    });
    const { files, stats } = composeSheets(
      { sheetWidthIn: req.sheetWidthIn, sheetLengthIn: req.sheetLengthIn, dpi: req.dpi, format: req.format, invertSpots: req.invertSpots, designs, sheets: req.sheets },
      (fraction, label) => post({ type: 'progress', fraction: Math.min(0.97, fraction), label })
    );

    // Re-import check: parse every written file back.
    post({ type: 'progress', fraction: 0.98, label: 'Verifying the TIFF files' });
    const verification: Hd3dVerification[] = files.map((f) => {
      const total = f.parts.reduce((n, p) => n + p.length, 0);
      const full = total <= VERIFY_FULL_LIMIT;
      const buf = new Uint8Array(total);
      let o = 0;
      for (const p of f.parts) { buf.set(p, o); o += p.length; }
      const t = full ? readTiff(buf) : null;
      if (!t) {
        return { name: f.name, width: 0, height: 0, dpi: req.dpi, samplesPerPixel: 0, channelNames: [], spotKinds: [], checkedPixels: false };
      }
      return { name: f.name, width: t.width, height: t.height, dpi: t.dpi, samplesPerPixel: t.samplesPerPixel, channelNames: t.channelNames, spotKinds: t.spotKinds, checkedPixels: true };
    });
    const transfer: Transferable[] = [];
    files.forEach((f) => f.parts.forEach((p) => transfer.push(p.buffer)));
    post({ type: 'done', files, stats, verification, coverage }, transfer);
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
