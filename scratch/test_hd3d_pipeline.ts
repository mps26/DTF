/**
 * 3D HD end-to-end pipeline test (no browser): masks → textures → 11×17 packing with
 * rotation → TIFF export (single file + separate files) → TIFF re-import and checks.
 * Build/run:
 *   npx esbuild scratch/test_hd3d_pipeline.ts --bundle --platform=node --outfile=<tmp>/hd.cjs && node <tmp>/hd.cjs [outDir]
 */
import * as fs from 'fs';
import { selectObject, selectArtwork, combineInto, growShrink, finalMasks, bakeCmy, countOn, emptyMask, paintStroke } from '../src/hd3d/maskOps';
import { builtInTextures } from '../src/hd3d/builtinTextures';
import { composeSheets, placementBox, ExportJob } from '../src/hd3d/sheetCompose';
import { readTiff } from '../src/hd3d/tiffReader';
import { packBits, unpackBits, lzwEncode, lzwDecode } from '../src/hd3d/tiffWriter';
import { packGangSheet } from '../src/utils/packing';
import { findPresetById, getSettingsUpdatesForPreset } from '../src/utils/sheetPresets';
import type { ArtworkAsset, SheetSettings } from '../src/types';
import type { HdLayerState, TextureApplication } from '../src/hd3d/types';

const outDir = process.argv[2];
let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };

// --- PackBits round trip
{
  let ok = true;
  for (let t = 0; t < 200; t++) {
    const n = 1 + Math.floor(Math.random() * 3000);
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.random() < 0.6 ? (i > 0 ? a[i - 1] : 7) : Math.floor(Math.random() * 256);
    const b = unpackBits(packBits(a), n);
    if (b.some((x, i) => x !== a[i])) { ok = false; break; }
  }
  check(ok, 'PackBits compress/decompress round trip (200 random buffers)');
}
// --- LZW round trip (random, repetitive, long buffers that force table resets and 12-bit codes)
{
  let ok = true;
  const cases: Uint8Array[] = [new Uint8Array(0), new Uint8Array([7]), new Uint8Array(100000).fill(255)];
  for (let t = 0; t < 60; t++) {
    const n = 1 + Math.floor(Math.random() * 200000);
    const a = new Uint8Array(n);
    const mode = t % 3;
    for (let i = 0; i < n; i++) a[i] = mode === 0 ? Math.floor(Math.random() * 256) : mode === 1 ? [255, 255, 255, 0, 0, 0][i % 6] : (i > 0 && Math.random() < 0.7 ? a[i - 1] : Math.floor(Math.random() * 16));
    cases.push(a);
  }
  for (const a of cases) {
    const b = lzwDecode(lzwEncode(a), a.length);
    if (b.length !== a.length || b.some((x, i) => x !== a[i])) { ok = false; break; }
  }
  check(ok, `LZW compress/decompress round trip (${cases.length} buffers incl. 12-bit codes and table resets)`);
}

// --- Synthetic artwork: 600×400, red disc (left), blue square (right), transparent elsewhere.
const W = 600, H = 400;
const rgba = new Uint8ClampedArray(W * H * 4);
const inDisc = (x: number, y: number) => (x - 160) ** 2 + (y - 200) ** 2 <= 120 ** 2;
const inSquare = (x: number, y: number) => x >= 340 && x < 560 && y >= 90 && y < 310;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 4;
  if (inDisc(x, y)) { rgba[o] = 220; rgba[o + 1] = 20; rgba[o + 2] = 30; rgba[o + 3] = 255; }
  else if (inSquare(x, y)) { rgba[o] = 20; rgba[o + 1] = 60; rgba[o + 2] = 200; rgba[o + 3] = 255; }
}
const original = new Uint8ClampedArray(rgba);

// W1 = the red disc (object selection), W2 = whole artwork (excludes W1 by default).
const w1 = emptyMask(W, H);
combineInto(w1, selectObject(rgba, W, H, 160, 200, 30), 'add');
const w2 = selectArtwork(rgba, W, H);
check(countOn(w1) > 0.95 * Math.PI * 120 ** 2 && countOn(w1) < 1.05 * Math.PI * 120 ** 2, `object selection picks the disc only (${countOn(w1)} px)`);
const grown = growShrink(w1, W, H, 5);
const shrunk = growShrink(w1, W, H, -5);
check(Math.abs(countOn(grown) - Math.PI * 125 ** 2) / (Math.PI * 125 ** 2) < 0.03 && Math.abs(countOn(shrunk) - Math.PI * 115 ** 2) / (Math.PI * 115 ** 2) < 0.03, 'boundary grow/shrink by 5 px is exact (round)');
// A brush stroke and an eraser stroke.
const brushTest = emptyMask(W, H);
paintStroke(brushTest, W, H, 10, 10, 110, 10, 5, 255);
paintStroke(brushTest, W, H, 60, 0, 60, 20, 3, 0);
check(brushTest[10 * W + 30] === 255 && brushTest[10 * W + 60] === 0 && brushTest[30 * W + 30] === 0, 'brush paints, eraser removes');

// Texture: honeycomb raised (W1) clipped to the blue square.
const tex = builtInTextures();
check(tex.length >= 6 && tex.every((t) => t.tile.length === t.size * t.size), `${tex.length} built-in textures generated`);
const lookup = (id: string) => { const t = tex.find((x) => x.id === id); return t ? { tile: t.tile, size: t.size } : undefined; };
const squareClip = selectObject(rgba, W, H, 450, 200, 30);
const t1: TextureApplication = { id: 't1', textureId: 'builtin-honeycomb', target: 'w1', clip: squareClip, scale: 0.5, intensity: 0.5, offsetX: 0, offsetY: 0 };
const t2: TextureApplication = { id: 't2', textureId: 'builtin-carbon-fibre', target: 'cmy', clip: squareClip, scale: 1, intensity: 0.6, offsetX: 0, offsetY: 0 };
const layers: HdLayerState = { w1, w2, w2ExcludesW1: true, textures: [t1, t2] };
const fm = finalMasks(rgba, W, H, layers, lookup);
const cmy = bakeCmy(rgba, W, H, layers.textures, lookup);
let texInSquare = 0, texOutside = 0, w2onW1 = 0, outsideArt = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x;
  if (fm.w1[p] && inSquare(x, y)) texInSquare++;
  if (fm.w1[p] && !inSquare(x, y) && !inDisc(x, y)) texOutside++;
  if (fm.w1[p] && fm.w2[p]) w2onW1++;
  if ((fm.w1[p] || fm.w2[p]) && rgba[p * 4 + 3] === 0) outsideArt++;
}
const sqArea = 220 * 220;
check(texInSquare > 0.2 * sqArea && texInSquare < 0.8 * sqArea, `W1 texture covers part of the square (${(texInSquare / sqArea * 100).toFixed(0)} %)`);
check(texOutside === 0 && outsideArt === 0, 'texture clipped to its region; no ink outside the artwork');
check(w2onW1 === 0, 'W2 excludes W1 raised areas by default');
check(original.every((v, i) => v === rgba[i]), 'original artwork pixels untouched');
check(cmy === rgba && cmy[(200 * W + 160) * 4] === 220, 'CMY is untouched original artwork (disc colour unchanged)');
const layersNoExcl: HdLayerState = { ...layers, w2ExcludesW1: false };
const fm2 = finalMasks(rgba, W, H, layersNoExcl, lookup);
check(fm2.w2[200 * W + 160] === 255, 'override: W2 may cover W1 when exclusion is off');

// --- Second design with no W1 and no W2.
const W2d = 300, H2d = 900;
const rgbaB = new Uint8ClampedArray(W2d * H2d * 4);
for (let p = 0; p < W2d * H2d; p++) { rgbaB[p * 4] = 30; rgbaB[p * 4 + 1] = 160; rgbaB[p * 4 + 2] = 60; rgbaB[p * 4 + 3] = 255; }

// --- Pack on the fixed 11×17 sheet (uses the shared MaxRects engine).
const IN = 25.4;
const mkAsset = (id: string, wIn: number, hIn: number, copies: number): ArtworkAsset => ({
  id, filename: id, fileType: 'png', fileSize: 1, originalWidth: 1, originalHeight: 1, hasAlpha: true, originalUrl: '', processedUrl: '',
  trimmedWidth: 1, trimmedHeight: 1, cropBox: null, isTrimmed: false, isBgRemoved: false, targetWidth: wIn, targetHeight: hIn,
  targetWidthMm: wIn * IN, targetHeightMm: hIn * IN, aspectLocked: true, copies, allowRotation: true, effectiveDpi: 300, dpiStatus: 'green', status: 'ready'
});
const preset = findPresetById('uvdtf-a3')!;
const settings = {
  printType: 'uvdtf', unit: 'inch', spacing: 0.2, spacingMm: 5, margin: 0.2, marginMm: 0.2 * IN, exportDpi: 300,
  allowItemRotation: true, keepDesignsTogether: true, nestingAlgorithm: 'box', mode: 'multiple', ...getSettingsUpdatesForPreset(preset)
} as SheetSettings;
const assets = [mkAsset('A', 4.5, 3, 5), mkAsset('B', 2, 6, 3)];
const layout = packGangSheet(assets, settings);
const rotatedCount = layout.placements.filter((p) => p.rotated).length;
check(layout.usedWidthMm === 11 * IN && layout.sheets.every((s) => Math.abs(s.usedLengthMm - 17 * IN) < 0.1), `fixed 11×17 sheet (${layout.sheets.length} sheet(s), ${layout.totalCopies} copies, ${rotatedCount} rotated)`);
check(layout.totalCopies === 8 && (layout.validationErrors ?? []).length === 0, 'all copies placed without overlap');

const job: ExportJob = {
  sheetWidthIn: 11, sheetLengthIn: 17, dpi: 100, format: 'single', invertSpots: false,
  designs: [
    { id: 'A', width: W, height: H, rgba: cmy, w1: fm.w1, w2: fm.w2, w2ExcludesW1: true },
    { id: 'B', width: W2d, height: H2d, rgba: rgbaB, w1: emptyMask(W2d, H2d), w2: emptyMask(W2d, H2d), w2ExcludesW1: true }
  ],
  sheets: layout.sheets.map((s) => s.placements.map((p) => ({ designId: p.assetId, xMm: p.xMm, yMm: p.yMm, widthMm: p.widthMm, heightMm: p.heightMm, rotated: p.rotated })))
};

for (const format of ['single', 'separate'] as const) {
  const t0 = Date.now();
  const { files, stats } = composeSheets({ ...job, format });
  const ms = Date.now() - t0;
  const bufs = files.map((f) => { const len = f.parts.reduce((n, p) => n + p.length, 0); const b = new Uint8Array(len); let o = 0; for (const p of f.parts) { b.set(p, o); o += p.length; } return b; });
  if (outDir) files.forEach((f, i) => fs.writeFileSync(`${outDir}/${f.name}`, bufs[i]));
  const main = readTiff(bufs[0]);
  check(main.width === 1100 && main.height === 1700 && Math.round(main.dpi) === 100, `[${format}] TIFF re-import: 1100×1700 px @ 100 DPI = 11×17 in (${ms} ms, ${files.length} file(s), ${(bufs.reduce((n, b) => n + b.length, 0) / 1e6).toFixed(2)} MB)`);
  let w1Ch: (p: number) => number, w2Ch: (p: number) => number;
  if (format === 'single') {
    check(main.samplesPerPixel === 6 && main.photometric === 2 && main.compression === 5, 'single TIFF: RGB + 3 extra channels, LZW');
    check(JSON.stringify(main.channelNames) === '["Transparency","W1","W2"]' && JSON.stringify(main.spotKinds) === '[0,2,2]' && JSON.stringify(main.extraSamples) === '[2,0,0]', `channel names ${JSON.stringify(main.channelNames)}, spot kinds ${JSON.stringify(main.spotKinds)}`);
    w1Ch = (p) => main.pixels[p * 6 + 4]; w2Ch = (p) => main.pixels[p * 6 + 5];
  } else {
    const t1r = readTiff(bufs[1]), t2r = readTiff(bufs[2]);
    check(main.samplesPerPixel === 4 && t1r.samplesPerPixel === 1 && t2r.samplesPerPixel === 1 && t1r.width === main.width && t2r.height === main.height, 'separate: artwork RGBA + W1 and W2 grayscale masks, identical size');
    // Separate mask files are positive separations (black = 100 % ink): convert to 255 = ink.
    w1Ch = (p) => 255 - t1r.pixels[p]; w2Ch = (p) => 255 - t2r.pixels[p];
  }
  const spp = main.samplesPerPixel;
  // Every W1/W2 pixel lies on artwork; values strictly 0/255.
  let bad = 0, nonBinary = 0;
  for (let p = 0; p < main.width * main.height; p++) {
    const a = main.pixels[p * spp + 3];
    const v1 = w1Ch(p), v2 = w2Ch(p);
    if ((v1 !== 0 && v1 !== 255) || (v2 !== 0 && v2 !== 255)) nonBinary++;
    if ((v1 || v2) && a === 0) bad++;
    if (v1 && v2) bad++;
  }
  check(nonBinary === 0, 'W1/W2 are strictly 0 % or 100 %');
  check(bad === 0, 'W1/W2 only on artwork, never both on one pixel (exclusion kept after resampling)');
  // Per copy: disc centre → red CMY + W1 + no W2; square interior → W2 where W1 texture is off.
  let copiesOk = 0, copiesA = 0;
  for (const s of job.sheets[0]) {
    if (s.designId !== 'A') continue;
    copiesA++;
    const b = placementBox(s, 100);
    const toSheet = (u: number, v: number) => {
      // design fraction (u, v) → sheet pixel, honouring the 90° clockwise rotation
      const lx = s.rotated ? Math.floor((1 - v) * b.w) : Math.floor(u * b.w);
      const ly = s.rotated ? Math.floor(u * b.h) : Math.floor(v * b.h);
      return (b.y + Math.min(ly, b.h - 1)) * main.width + b.x + Math.min(lx, b.w - 1);
    };
    const disc = toSheet(160 / W, 200 / H);
    const empty = toSheet(300 / W, 30 / H);
    const discOk = main.pixels[disc * spp] > 200 && main.pixels[disc * spp + 1] < 40 && w1Ch(disc) === 255 && w2Ch(disc) === 0;
    const emptyOk = main.pixels[empty * spp + 3] === 0 && w1Ch(empty) === 0 && w2Ch(empty) === 0;
    if (discOk && emptyOk) copiesOk++;
  }
  check(copiesA === 5 && copiesOk === copiesA, `[${format}] all ${copiesA} copies of design A carry CMY + W1 + W2 in the right place (incl. rotated)`);
  const st = stats[0];
  check(st.w1Pixels > 0 && st.w2Pixels > 0, `stats: W1 ${st.w1Pixels} px, W2 ${st.w2Pixels} px, artwork ${st.artworkPixels} px`);
}

// --- 300 DPI timing (production resolution).
{
  const t0 = Date.now();
  const { files } = composeSheets({ ...job, dpi: 300 });
  const size = files[0].parts.reduce((n, p) => n + p.length, 0);
  check(true, `300 DPI sheet (3300×5100 px): ${((Date.now() - t0) / 1000).toFixed(1)} s, ${(size / 1e6).toFixed(1)} MB`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL 3D HD PIPELINE TESTS PASS');
process.exit(failures ? 1 : 0);
