/**
 * 3D HD W1 / W2 validation modelled on the reference sheets (camera sticker):
 *   W1 = lens ring (object) + diamond-lattice texture on the camera body (raised pattern)
 *   W2 = lens ring only (gloss), overlapping W1 as in the reference
 * The design is printed at its native pixel size, so the exported TIFF channels are
 * compared pixel-for-pixel with the masks (upright and rotated copies, both formats).
 *   npx esbuild scratch/test_hd3d_reference.ts --bundle --platform=node --outfile=<tmp>/ref.cjs && node <tmp>/ref.cjs [outDir]
 */
import * as fs from 'fs';
import { selectObject, emptyMask, combineInto, finalMasks, bakeCmy, layerCoverage, countOn } from '../src/hd3d/maskOps';
import { builtInTextures } from '../src/hd3d/builtinTextures';
import { composeSheets, placementBox, ExportJob } from '../src/hd3d/sheetCompose';
import { readTiff } from '../src/hd3d/tiffReader';
import type { HdLayerState } from '../src/hd3d/types';

const outDir = process.argv[2];
let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };

// --- Camera-like sticker, 600 × 400 px, transparent background.
const W = 600, H = 400, N = W * H;
const rgba = new Uint8ClampedArray(N * 4);
const set = (p: number, r: number, g: number, b: number) => { rgba[p * 4] = r; rgba[p * 4 + 1] = g; rgba[p * 4 + 2] = b; rgba[p * 4 + 3] = 255; };
const ringR = (x: number, y: number) => Math.hypot(x - 300, y - 210);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x, r = ringR(x, y);
  if (r < 90) set(p, 120, 190, 220);              // lens glass
  else if (r < 120) set(p, 225, 30, 35);          // red lens ring
  else if (x >= 40 && x < 560 && y >= 80 && y < 360) set(p, 250, 220, 40); // yellow body
}
const original = new Uint8ClampedArray(rgba);
const tex = builtInTextures();
const lookup = (id: string) => { const t = tex.find((x) => x.id === id); return t ? { tile: t.tile, size: t.size } : undefined; };
check(!!lookup('builtin-diamond-lattice') && !!lookup('builtin-halftone'), 'Diamond Lattice and Halftone Dots textures available');

// User selections (separate selection data per layer).
const ring = selectObject(rgba, W, H, 300, 210 - 105, 30);
const body = selectObject(rgba, W, H, 60, 100, 30);
const w1 = emptyMask(W, H); combineInto(w1, ring, 'add');
const w2 = emptyMask(W, H); combineInto(w2, ring, 'add');
const layers: HdLayerState = {
  w1, w2, w2ExcludesW1: false,
  textures: [{ id: 't', textureId: 'builtin-diamond-lattice', target: 'w1', clip: body, scale: 1, intensity: 0.4, offsetX: 0, offsetY: 0 }]
};
const fm = finalMasks(rgba, W, H, layers, lookup);
const cmy = bakeCmy(rgba, W, H, layers.textures, lookup);
const cov = layerCoverage(rgba, W, H, fm);

let latticeOnBody = 0, w1OffArt = 0, w2OnBody = 0;
for (let p = 0; p < N; p++) {
  if (fm.w1[p] && body[p]) latticeOnBody++;
  if ((fm.w1[p] || fm.w2[p]) && !rgba[p * 4 + 3]) w1OffArt++;
  if (fm.w2[p] && body[p]) w2OnBody++;
}
check(countOn(ring) > 0 && countOn(body) > 0, `object selection: ring ${countOn(ring)} px, body ${countOn(body)} px`);
check(latticeOnBody > 0.1 * countOn(body) && latticeOnBody < 0.8 * countOn(body), `W1 lattice covers ${(latticeOnBody / countOn(body) * 100).toFixed(0)} % of the body (pattern, not solid)`);
check(w2OnBody === 0, 'W2 has no texture: the body stays unglossed (as in Reference 2)');
check(!cov.identical && cov.w1Px !== cov.w2Px, `W1 and W2 are different masks (W1 ${cov.w1Pct.toFixed(1)} %, W2 ${cov.w2Pct.toFixed(1)} % of artwork, overlap ${cov.overlapPx} px)`);
check(cov.overlapPx === countOn(ring), 'gloss overlaps the raised lens ring (exclusion off, as in the references)');
check(w1OffArt === 0, 'no W1/W2 ink outside the artwork');
check(cmy === rgba && original.every((v, i) => v === rgba[i]), 'CMY is the untouched original (W1/W2 textures never change colour)');
const excl = finalMasks(rgba, W, H, { ...layers, w2ExcludesW1: true }, lookup);
check(layerCoverage(rgba, W, H, excl).overlapPx === 0, 'with "keep gloss off raised areas" on, W1 and W2 do not overlap');

// --- Sheet at native resolution: 2 copies, one rotated. 600 px at 300 DPI = 2 in.
const IN = 25.4, dpi = 300;
const wMm = (W / dpi) * IN, hMm = (H / dpi) * IN;
const placements = [
  { designId: 'cam', xMm: 10, yMm: 10, widthMm: wMm, heightMm: hMm, rotated: false },
  { designId: 'cam', xMm: 10, yMm: 60, widthMm: hMm, heightMm: wMm, rotated: true }
];
const job: ExportJob = {
  sheetWidthIn: 11, sheetLengthIn: 17, dpi, format: 'single', invertSpots: false,
  designs: [{ id: 'cam', width: W, height: H, rgba: cmy, w1: fm.w1, w2: fm.w2, w2ExcludesW1: false }],
  sheets: [placements]
};

for (const format of ['single', 'separate'] as const) {
  const { files } = composeSheets({ ...job, format });
  const bufs = files.map((f) => { const n = f.parts.reduce((a, p) => a + p.length, 0); const b = new Uint8Array(n); let o = 0; for (const p of f.parts) { b.set(p, o); o += p.length; } return b; });
  if (outDir) files.forEach((f, i) => fs.writeFileSync(`${outDir}/${f.name}`, bufs[i]));
  const t = readTiff(bufs[0]);
  const spp = t.samplesPerPixel;
  const sep = format === 'separate' ? [readTiff(bufs[1]), readTiff(bufs[2])] : null;
  // Ink at sheet pixel q (true = 100 %), from the actual file data.
  const ink1 = (q: number) => (sep ? sep[0].pixels[q] === 0 : t.pixels[q * spp + 4] === 255);
  const ink2 = (q: number) => (sep ? sep[1].pixels[q] === 0 : t.pixels[q * spp + 5] === 255);
  let mism1 = 0, mism2 = 0, mismC = 0;
  for (const pl of placements) {
    const b = placementBox(pl, dpi);
    for (let ly = 0; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) {
      const u = pl.rotated ? ly : lx, v = pl.rotated ? b.w - 1 - lx : ly; // design pixel
      const sp = v * W + u, q = (b.y + ly) * t.width + b.x + lx;
      if (ink1(q) !== !!fm.w1[sp]) mism1++;
      if (ink2(q) !== !!fm.w2[sp]) mism2++;
      const a = original[sp * 4 + 3];
      if (t.pixels[q * spp + 3] !== a || (a && (t.pixels[q * spp] !== original[sp * 4] || t.pixels[q * spp + 1] !== original[sp * 4 + 1] || t.pixels[q * spp + 2] !== original[sp * 4 + 2]))) mismC++;
    }
  }
  check(mism1 === 0 && mism2 === 0 && mismC === 0, `[${format}] exported W1, W2 and CMY match the masks / original pixel-for-pixel in both copies (upright + rotated): ${mism1}/${mism2}/${mismC} mismatches`);
  // Whole-sheet hygiene.
  const vals = new Set<number>();
  let transparentNotWhite = 0;
  for (let q = 0; q < t.width * t.height; q++) {
    if (!t.pixels[q * spp + 3] && (t.pixels[q * spp] !== 255 || t.pixels[q * spp + 1] !== 255 || t.pixels[q * spp + 2] !== 255)) transparentNotWhite++;
    if (sep) { vals.add(sep[0].pixels[q]); vals.add(sep[1].pixels[q]); } else { vals.add(t.pixels[q * spp + 4]); vals.add(t.pixels[q * spp + 5]); }
  }
  check(transparentNotWhite === 0, `[${format}] transparent film: alpha 0 and no colour ink (no checkerboard, no preview colours)`);
  check([...vals].every((x) => x === 0 || x === 255), `[${format}] spot / mask data only 0 % or 100 % (values ${[...vals].join(', ')})`);
  if (sep) {
    let white = 0;
    for (let q = 0; q < t.width * t.height; q++) if (sep[0].pixels[q] === 255) white++;
    check(white / (t.width * t.height) > 0.9 && sep[0].photometric === 1, '[separate] W1/W2 mask files are positive: white background (no ink), black = 100 % ink');
  } else {
    check(JSON.stringify(t.channelNames) === '["Transparency","W1","W2"]' && JSON.stringify(t.spotKinds) === '[0,2,2]', `[single] channels: ${t.channelNames.join(', ')} (W1, W2 marked as spot)`);
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL REFERENCE-STYLE W1/W2 TESTS PASS');
process.exit(failures ? 1 : 0);
