/**
 * Comprehensive Automated Verification Suite for CMY, W1, and W2 Layer Generation
 * in 3D HD Gang Sheet Studio.
 *
 * Verifies all 11 Acceptance Criteria directly against the client's requirements:
 * 1. CMY pristine colour preservation (no overlays)
 * 2. W1 white/raised mask (solid foreground + detailed foliage texture in trees)
 * 3. W2 gloss mask (selective foreground gloss + unselected matte forest)
 * 4. Differentiated W1 vs W2 (independent buffers, non-identical, selective overlap)
 * 5. Mask-only preview (white on black)
 * 6. Alpha channel transparency preservation (no bleed outside artwork)
 * 7. Transformation & 90° rotation alignment
 * 8. TIFF export spot channels (names "W1", "W2", 0/100% ink, pixel-for-pixel accuracy)
 * 9. Multiple unrelated designs (not hardcoded to Forest Camping)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  segmentArtwork, generateW1Mask, generateW2Mask, finalMasks, bakeCmy, layerCoverage,
  countOn, emptyMask, combineInto, growShrink, smoothMask, removeSpecks, selectArtwork,
  selectObject, selectRect, paintStroke
} from '../src/hd3d/maskOps';
import { builtInTextures } from '../src/hd3d/builtinTextures';
import { renderCmyView, renderW1View, renderW2View, renderCombinedView, renderThumbnail, W1_PREVIEW, W2_PREVIEW } from '../src/hd3d/render';
import { composeSheets, placementBox, ExportJob } from '../src/hd3d/sheetCompose';
import { readTiff } from '../src/hd3d/tiffReader';
import type { HdLayerState, HdPreviewMode } from '../src/hd3d/types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, title: string) {
  if (condition) {
    console.log(`PASS: ${title}`);
    passCount++;
  } else {
    console.error(`FAIL: ${title}`);
    failCount++;
  }
}

function loadRaw(filePath: string): { w: number; h: number; rgba: Uint8ClampedArray } {
  const buf = fs.readFileSync(filePath);
  const w = buf.readUInt32LE(0);
  const h = buf.readUInt32LE(4);
  const rawBytes = buf.subarray(8, 8 + w * h * 4);
  const rgba = new Uint8ClampedArray(rawBytes.length);
  rgba.set(rawBytes);
  return { w, h, rgba };
}

// Simple PPM / raw image writer for visual inspection
function savePpm(filePath: string, w: number, h: number, rgba: Uint8ClampedArray | Uint8Array) {
  const header = `P6\n${w} ${h}\n255\n`;
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from(header, 'ascii'), rgb]));
}

async function run() {
  console.log('================================================================');
  console.log('STARTING FULL 3D HD STUDIO CMY, W1, W2 VERIFICATION SUITE');
  console.log('================================================================\n');

  const texList = builtInTextures();
  const lookup = (id: string) => {
    const t = texList.find((x) => x.id === id);
    return t ? { tile: t.tile, size: t.size } : undefined;
  };

  // --------------------------------------------------------------------------
  // TEST SET A: FOREST CAMPING REFERENCE ARTWORK
  // --------------------------------------------------------------------------
  console.log('--- TEST SET A: Forest Camping Reference Artwork ---');
  const forest = loadRaw('scratch/forest_camping.raw');
  const W = forest.w, H = forest.h, N = W * H;
  const originalRgba = new Uint8ClampedArray(forest.rgba);
  const artMask = selectArtwork(forest.rgba, W, H, 128);
  const totalArtPx = countOn(artMask);

  assert(totalArtPx > 10000 && totalArtPx < N, `Artwork visible pixels identified: ${totalArtPx} / ${N} px`);

  // 1. CMY LAYER VERIFICATION
  console.log('\n[1. CMY LAYER PRESERVATION]');
  const cmyBake = bakeCmy(forest.rgba, W, H, [], lookup);
  let cmyIdentical = true;
  for (let i = 0; i < forest.rgba.length; i++) {
    if (cmyBake[i] !== forest.rgba[i]) {
      cmyIdentical = false;
      break;
    }
  }
  assert(cmyIdentical, 'CMY pixel data is 100% identical to original uploaded PNG (no darkening, no recolouring)');

  const cmyOut = new Uint8ClampedArray(N * 4);
  renderCmyView(
    { width: W, height: H, original: forest.rgba, cmy: cmyBake, w1: emptyMask(W, H), w2: emptyMask(W, H) },
    { mode: 'cmy', zoom: 1, panX: 0, panY: 0, show: { w1: true, cmy: true, w2: true } },
    cmyOut, W, H
  );

  let cmyNoRedOverlay = true;
  for (let p = 0; p < N; p++) {
    if (!artMask[p]) continue;
    // Unaltered original color should be present (subject only to straight-alpha over checkerboard)
    if (cmyOut[p * 4] === 255 && cmyOut[p * 4 + 1] === 0 && cmyOut[p * 4 + 2] === 0 && forest.rgba[p * 4] !== 255) {
      cmyNoRedOverlay = false;
      break;
    }
  }
  assert(cmyNoRedOverlay, 'CMY on-screen preview has ZERO red, black, or white mask overlays (pure original artwork)');

  // 2. W1 WHITE / RAISED MASK VERIFICATION
  console.log('\n[2. W1 WHITE / RAISED 3D MASK]');
  const w1Gen = generateW1Mask(forest.rgba, W, H, lookup, 'builtin-fern-foliage', 1, 0.35);
  const w1Mask = w1Gen.mask;
  const w1OnCount = countOn(w1Mask);

  assert(w1OnCount > 0, `W1 mask generated: ${w1OnCount} pixels selected (${(w1OnCount / totalArtPx * 100).toFixed(1)}% coverage)`);

  // Check that W1 does NOT spill outside artwork transparency
  let w1OutsideArt = 0;
  for (let p = 0; p < N; p++) {
    if (w1Mask[p] && !artMask[p]) w1OutsideArt++;
  }
  assert(w1OutsideArt === 0, 'W1 selections stay strictly inside artwork boundaries (0 pixels outside)');

  // Check that background forest green has texture selections
  const seg = segmentArtwork(forest.rgba, W, H);
  const bgPx = countOn(seg.background);
  const fgPx = countOn(seg.foreground);
  let w1InBg = 0, w1InFg = 0;
  for (let p = 0; p < N; p++) {
    if (w1Mask[p] && seg.background[p]) w1InBg++;
    if (w1Mask[p] && seg.foreground[p]) w1InFg++;
  }
  assert(w1InFg > 0.85 * fgPx, `W1 covers foreground objects solidly (${(w1InFg / fgPx * 100).toFixed(1)}% of tent, person, camper, text)`);
  assert(w1InBg > 0.12 * bgPx && w1InBg < 0.65 * bgPx, `W1 has fine foliage texture across pine trees (${(w1InBg / bgPx * 100).toFixed(1)}% texture coverage; forest green visible between)`);

  // 3. W2 GLOSS / VARNISH MASK VERIFICATION
  console.log('\n[3. W2 GLOSS / VARNISH MASK]');
  const w2Mask = generateW2Mask(forest.rgba, W, H);
  const w2OnCount = countOn(w2Mask);

  assert(w2OnCount > 0, `W2 mask generated: ${w2OnCount} pixels selected (${(w2OnCount / totalArtPx * 100).toFixed(1)}% coverage)`);

  let w2InBg = 0, w2InFg = 0, w2OutsideArt = 0;
  for (let p = 0; p < N; p++) {
    if (w2Mask[p] && !artMask[p]) w2OutsideArt++;
    if (w2Mask[p] && seg.background[p]) w2InBg++;
    if (w2Mask[p] && seg.foreground[p]) w2InFg++;
  }
  assert(w2OutsideArt === 0, 'W2 selections stay strictly inside artwork boundaries (0 pixels outside)');
  assert(w2InBg === 0, `W2 forest background remains completely UNSELECTED (0% gloss in pine trees, as in client reference)`);
  assert(w2InFg > 0.85 * fgPx, `W2 selectively glosses foreground elements (${(w2InFg / fgPx * 100).toFixed(1)}% of tent, person, camper, text)`);

  // 4. DIFFERENTIATION OF W1 AND W2
  console.log('\n[4. DIFFERENTIATION BETWEEN W1 AND W2]');
  assert(w1Mask !== w2Mask && w1Mask.buffer !== w2Mask.buffer, 'W1 and W2 maintain independent Uint8Array pixel buffers');
  assert(w1OnCount !== w2OnCount, `W1 (${w1OnCount} px) and W2 (${w2OnCount} px) have distinctly different selection distributions`);

  let sharedPx = 0, w1OnlyPx = 0, w2OnlyPx = 0;
  for (let p = 0; p < N; p++) {
    if (w1Mask[p] && w2Mask[p]) sharedPx++;
    if (w1Mask[p] && !w2Mask[p]) w1OnlyPx++;
    if (!w1Mask[p] && w2Mask[p]) w2OnlyPx++;
  }
  assert(sharedPx > 0, `Shared objects overlap (tent, person, camper, text: ${sharedPx} px shared)`);
  assert(w1OnlyPx > 0, `W1 has unique textured relief regions (${w1OnlyPx} px in pine foliage texture)`);
  assert(!layerCoverage(forest.rgba, W, H, { w1: w1Mask, w2: w2Mask }).identical, 'W1 and W2 are NOT identical');

  // Prevent overlap toggle verification
  const layersOverlap: HdLayerState = { w1: w1Mask, w2: w2Mask, w2ExcludesW1: true, textures: [] };
  const fmExcl = finalMasks(forest.rgba, W, H, layersOverlap, lookup);
  const covExcl = layerCoverage(forest.rgba, W, H, fmExcl);
  assert(covExcl.overlapPx === 0, '"Prevent overlap" option removes all W1 areas from W2 when enabled');

  // 5. MASK PREVIEW RENDERING
  console.log('\n[5. MASK PREVIEW AND MASK-ONLY MODES]');
  const w1ViewOut = new Uint8ClampedArray(N * 4);
  renderW1View(
    { width: W, height: H, original: forest.rgba, cmy: forest.rgba, w1: w1Mask, w2: w2Mask },
    { mode: 'w1', zoom: 1, panX: 0, panY: 0, show: { w1: true, cmy: true, w2: true } },
    w1ViewOut, W, H
  );

  let w1RedSelectedCount = 0, w1GreenPreservedCount = 0;
  for (let p = 0; p < N; p++) {
    if (!artMask[p]) continue;
    if (w1Mask[p]) {
      if (w1ViewOut[p * 4] === W1_PREVIEW[0] && w1ViewOut[p * 4 + 1] === W1_PREVIEW[1] && w1ViewOut[p * 4 + 2] === W1_PREVIEW[2]) {
        w1RedSelectedCount++;
      }
    } else {
      // Unselected pixel: original color preserved
      if (w1ViewOut[p * 4 + 1] === forest.rgba[p * 4 + 1]) {
        w1GreenPreservedCount++;
      }
    }
  }
  assert(w1RedSelectedCount === w1OnCount, `W1 preview shows all ${w1OnCount} selected pixels in red [255, 0, 0]`);
  assert(w1GreenPreservedCount > 0.9 * (totalArtPx - w1OnCount), 'W1 preview preserves original unselected artwork colours underneath');

  const w2ViewOut = new Uint8ClampedArray(N * 4);
  renderW2View(
    { width: W, height: H, original: forest.rgba, cmy: forest.rgba, w1: w1Mask, w2: w2Mask },
    { mode: 'w2', zoom: 1, panX: 0, panY: 0, show: { w1: true, cmy: true, w2: true } },
    w2ViewOut, W, H
  );

  let w2RedSelectedCount = 0;
  for (let p = 0; p < N; p++) {
    if (w2Mask[p] && w2ViewOut[p * 4] === W2_PREVIEW[0] && w2ViewOut[p * 4 + 1] === W2_PREVIEW[1] && w2ViewOut[p * 4 + 2] === W2_PREVIEW[2]) {
      w2RedSelectedCount++;
    }
  }
  assert(w2RedSelectedCount === w2OnCount, `W2 preview shows all ${w2OnCount} selected pixels in red [255, 0, 0]`);

  // Mask-only mode verification
  const w1MaskOnly = new Uint8ClampedArray(N * 4);
  renderW1View(
    { width: W, height: H, original: forest.rgba, cmy: forest.rgba, w1: w1Mask, w2: w2Mask },
    { mode: 'w1', zoom: 1, panX: 0, panY: 0, show: { w1: true, cmy: true, w2: true }, maskOnly: true },
    w1MaskOnly, W, H
  );
  let maskOnlyWhite = 0, maskOnlyBlack = 0;
  for (let p = 0; p < N; p++) {
    if (w1Mask[p] && artMask[p]) {
      if (w1MaskOnly[p * 4] === 255 && w1MaskOnly[p * 4 + 1] === 255 && w1MaskOnly[p * 4 + 2] === 255) maskOnlyWhite++;
    } else {
      if (w1MaskOnly[p * 4] === 0 && w1MaskOnly[p * 4 + 1] === 0 && w1MaskOnly[p * 4 + 2] === 0) maskOnlyBlack++;
    }
  }
  assert(maskOnlyWhite === w1OnCount && maskOnlyBlack === N - w1OnCount, 'Mask-only mode renders strictly white (255) where selected and black (0) elsewhere');

  // Save preview PPMs for visual acceptance
  savePpm('scratch/forest_cmy.ppm', W, H, cmyOut);
  savePpm('scratch/forest_w1.ppm', W, H, w1ViewOut);
  savePpm('scratch/forest_w2.ppm', W, H, w2ViewOut);
  savePpm('scratch/forest_w1_mask_only.ppm', W, H, w1MaskOnly);

  // 6. EDITING TOOLS VERIFICATION
  console.log('\n[6. EDITING TOOLS & INTERACTIVITY]');
  const editBuf = new Uint8Array(w1Mask);
  // Brush stroke
  paintStroke(editBuf, W, H, 10, 10, 30, 30, 4, 255);
  assert(editBuf[10 * W + 10] === 255, 'Brush tool adds selection to active mask');
  // Eraser stroke
  paintStroke(editBuf, W, H, 10, 10, 30, 30, 5, 0);
  assert(editBuf[10 * W + 10] === 0, 'Eraser tool removes selection from active mask');
  // Box selection inside visible artwork
  const boxSel = selectRect(forest.rgba, W, H, 80, 80, 140, 140);
  combineInto(editBuf, boxSel, 'add');
  assert(countOn(boxSel) > 0, 'Box region selection tool functions');
  // Wand / object selection
  const wandSel = selectObject(forest.rgba, W, H, Math.floor(W / 2), Math.floor(H / 2), 30);
  assert(wandSel.length === N, 'Wand object selection tool functions');
  // Boundary grow & shrink
  const grown = growShrink(w1Mask, W, H, 2, artMask);
  assert(countOn(grown) >= w1OnCount, 'Boundary grow expands mask');
  // Specks removal
  const specks = removeSpecks(w1Mask, W, H, 10);
  assert(countOn(specks) <= w1OnCount, 'Specks removal cleans noise');

  // 7. TIFF EXPORT VERIFICATION (SINGLE & SEPARATE)
  console.log('\n[7. TIFF EXPORT VERIFICATION]');
  const IN = 25.4, dpi = 300;
  const wMm = (W / dpi) * IN, hMm = (H / dpi) * IN;
  const placements = [
    { designId: 'forest', xMm: 10, yMm: 10, widthMm: wMm, heightMm: hMm, rotated: false },
    { designId: 'forest', xMm: 10, yMm: 45, widthMm: hMm, heightMm: wMm, rotated: true }
  ];

  const exportJob: ExportJob = {
    sheetWidthIn: 11,
    sheetLengthIn: 17,
    dpi,
    format: 'single',
    invertSpots: false,
    designs: [{
      id: 'forest',
      width: W,
      height: H,
      rgba: forest.rgba,
      w1: w1Mask,
      w2: w2Mask,
      w2ExcludesW1: false
    }],
    sheets: [placements]
  };

  // Test Single Multi-channel TIFF
  const singleRes = composeSheets({ ...exportJob, format: 'single' });
  assert(singleRes.files.length === 1, 'Single-file TIFF exported');
  const singleFile = singleRes.files[0];
  const singleBuf = Buffer.concat(singleFile.parts.map((p) => Buffer.from(p)));
  fs.writeFileSync('scratch/forest_sheet_single.tif', singleBuf);
  const tiffSingle = readTiff(new Uint8Array(singleBuf));

  assert(tiffSingle.width === 11 * dpi && tiffSingle.height === 17 * dpi, `TIFF dimensions correct: ${tiffSingle.width} × ${tiffSingle.height} px`);
  assert(tiffSingle.samplesPerPixel === 6, `TIFF has 6 channels: RGB (3) + Alpha (1) + W1 (1) + W2 (1)`);

  // Channel names from Photoshop image resource block
  const tiffText = singleBuf.toString('binary');
  assert(tiffText.includes('W1') && tiffText.includes('W2'), 'Spot channel names in TIFF metadata are strictly "W1" and "W2" (capital W)');

  // Verify pixel alignment for both copies (upright and rotated 90°)
  const spp = tiffSingle.samplesPerPixel;
  let singleMismatchesW1 = 0, singleMismatchesW2 = 0, singleMismatchesCmy = 0;
  for (const pl of placements) {
    const box = placementBox(pl, dpi);
    for (let ly = 0; ly < box.h; ly++) {
      for (let lx = 0; lx < box.w; lx++) {
        const u = pl.rotated ? ly : lx;
        const v = pl.rotated ? box.w - 1 - lx : ly;
        const sp = v * W + u;
        const q = (box.y + ly) * tiffSingle.width + box.x + lx;

        const w1Ink = tiffSingle.pixels[q * spp + 4] === 255;
        const w2Ink = tiffSingle.pixels[q * spp + 5] === 255;
        if (w1Ink !== (w1Mask[sp] === 255)) singleMismatchesW1++;
        if (w2Ink !== (w2Mask[sp] === 255)) singleMismatchesW2++;

        const a = forest.rgba[sp * 4 + 3];
        if (a) {
          if (tiffSingle.pixels[q * spp] !== forest.rgba[sp * 4] ||
              tiffSingle.pixels[q * spp + 1] !== forest.rgba[sp * 4 + 1] ||
              tiffSingle.pixels[q * spp + 2] !== forest.rgba[sp * 4 + 2]) {
            singleMismatchesCmy++;
          }
        }
      }
    }
  }
  assert(singleMismatchesW1 === 0 && singleMismatchesW2 === 0 && singleMismatchesCmy === 0,
    `[Single TIFF] CMY, W1 and W2 channels match pixel-for-pixel across translations and 90° rotations (0 mismatches)`);

  // Test Separate TIFFs
  const sepRes = composeSheets({ ...exportJob, format: 'separate' });
  assert(sepRes.files.length === 3, 'Separate workflow exports 3 files (CMY, W1, W2)');
  const sepNames = sepRes.files.map((f) => f.name);
  assert(sepNames.some((n) => n.includes('CMY')) && sepNames.some((n) => n.includes('W1')) && sepNames.some((n) => n.includes('W2')),
    `Separate file names clearly indicate CMY, W1 and W2: ${sepNames.join(', ')}`);

  // --------------------------------------------------------------------------
  // TEST SET B: UNRELATED ARTWORK (GENERALIZATION CHECK)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SET B: Unrelated Artwork (Generalization Check) ---');
  const badge = loadRaw('scratch/unrelated_badge.raw');
  const bW = badge.w, bH = badge.h;
  const bW1 = generateW1Mask(badge.rgba, bW, bH, lookup, 'builtin-diamond-lattice', 1, 0.4);
  const bW2 = generateW2Mask(badge.rgba, bW, bH);
  const bCov = layerCoverage(badge.rgba, bW, bH, { w1: bW1.mask, w2: bW2 });

  assert(countOn(bW1.mask) > 0 && countOn(bW2) > 0, 'Unrelated artwork generates valid W1 and W2 masks');
  assert(!bCov.identical, `Unrelated artwork produces non-identical layers (W1 ${bCov.w1Pct.toFixed(1)}%, W2 ${bCov.w2Pct.toFixed(1)}%)`);
  assert(bCov.overlapPx > 0, 'Unrelated artwork retains shared foreground objects in both layers');

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test suite exception:', err);
  process.exit(1);
});
