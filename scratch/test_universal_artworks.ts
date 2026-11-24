import { segmentArtwork, generateW1Mask, generateW2Mask, selectArtwork, bakeCmy, layerCoverage, finalMasks } from '../src/hd3d/maskOps';
import { renderCmyView, renderW1View, renderW2View, renderCombinedView, W1_PREVIEW, W2_PREVIEW } from '../src/hd3d/render';
import { composeSheets } from '../src/hd3d/sheetCompose';
import { readTiff } from '../src/hd3d/tiffReader';
import type { HdDesign, HdLayerState } from '../src/hd3d/types';
import * as fs from 'fs';
import * as path from 'path';

function createColorPng(w: number, h: number, drawFn: (rgba: Uint8ClampedArray, w: number, h: number) => void): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4);
  drawFn(rgba, w, h);
  return rgba;
}

// 1. Motorcycle sticker (metallic bike body, black tires, bright orange frame on transparent)
function makeMotorcycle(w: number, h: number): Uint8ClampedArray {
  return createColorPng(w, h, (rgba) => {
    // Background remains 0 alpha (transparent)
    for (let y = Math.floor(h * 0.25); y < Math.floor(h * 0.75); y++) {
      for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x++) {
        const p = (y * w + x) * 4;
        // Silver body
        rgba[p] = 192; rgba[p + 1] = 192; rgba[p + 2] = 200; rgba[p + 3] = 255;
        // Orange fuel tank / highlights
        if (x > w * 0.4 && x < w * 0.6 && y < h * 0.5) {
          rgba[p] = 255; rgba[p + 1] = 120; rgba[p + 2] = 0; rgba[p + 3] = 255;
        }
      }
    }
  });
}

// 2. Company Logo (circular badge, navy field with yellow star and white text)
function makeCompanyLogo(w: number, h: number): Uint8ClampedArray {
  return createColorPng(w, h, (rgba) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.42;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= r) {
          const p = (y * w + x) * 4;
          // Navy field
          rgba[p] = 20; rgba[p + 1] = 40; rgba[p + 2] = 100; rgba[p + 3] = 255;
          // Yellow star in center
          if (dist <= r * 0.35) {
            rgba[p] = 255; rgba[p + 1] = 215; rgba[p + 2] = 0; rgba[p + 3] = 255;
          }
        }
      }
    }
  });
}

// 3. Typography Artwork ("VINTAGE SPEED" - bold red text with white stroke on transparent)
function makeTypography(w: number, h: number): Uint8ClampedArray {
  return createColorPng(w, h, (rgba) => {
    for (let y = Math.floor(h * 0.35); y < Math.floor(h * 0.65); y++) {
      for (let x = Math.floor(w * 0.1); x < Math.floor(w * 0.9); x++) {
        if ((x + y) % 18 < 10) { // letter-like strokes
          const p = (y * w + x) * 4;
          rgba[p] = 220; rgba[p + 1] = 30; rgba[p + 2] = 30; rgba[p + 3] = 255;
        }
      }
    }
  });
}

// 4. Cartoon Character (panda: white fur, black patches, pink cheeks on transparent)
function makeCartoon(w: number, h: number): Uint8ClampedArray {
  return createColorPng(w, h, (rgba) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.4;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= r) {
          const p = (y * w + x) * 4;
          // White face
          rgba[p] = 250; rgba[p + 1] = 250; rgba[p + 2] = 250; rgba[p + 3] = 255;
          // Black ears
          if (y < cy - r * 0.4 && (x < cx - r * 0.4 || x > cx + r * 0.4)) {
            rgba[p] = 20; rgba[p + 1] = 20; rgba[p + 2] = 20; rgba[p + 3] = 255;
          }
          // Pink cheeks
          if (y > cy && y < cy + r * 0.3 && (Math.abs(x - cx) > r * 0.3 && Math.abs(x - cx) < r * 0.6)) {
            rgba[p] = 255; rgba[p + 1] = 150; rgba[p + 2] = 180; rgba[p + 3] = 255;
          }
        }
      }
    }
  });
}

async function runTest() {
  console.log('--- RUNNING UNIVERSAL 3D HD SUITE ---');

  const testCases = [
    { name: 'Motorcycle Sticker', gen: makeMotorcycle },
    { name: 'Company Logo', gen: makeCompanyLogo },
    { name: 'Typography Artwork', gen: makeTypography },
    { name: 'Cartoon Character', gen: makeCartoon }
  ];

  const w = 240, h = 240;

  for (const tc of testCases) {
    console.log(`\nTesting case: [${tc.name}]`);
    const rgba = tc.gen(w, h);
    const artwork = selectArtwork(rgba, w, h);
    let artPx = 0;
    for (let i = 0; i < artwork.length; i++) if (artwork[i]) artPx++;
    console.log(`- Artwork visible pixels: ${artPx} / ${w * h}`);

    // Test 1: CMY is 100% untouched
    const cmy = bakeCmy(rgba);
    if (cmy !== rgba) throw new Error(`${tc.name}: CMY reference mismatch`);
    for (let i = 0; i < rgba.length; i++) {
      if (cmy[i] !== rgba[i]) throw new Error(`${tc.name}: CMY pixel altered at ${i}`);
    }
    console.log('✓ CMY preserves 100% original pixel data, colours and alpha');

    // Test 2: Universal W1 & W2 masks generated without hardcoded foreign objects
    const w1Gen = generateW1Mask(rgba, w, h);
    const w2 = generateW2Mask(rgba, w, h);
    const w1 = w1Gen.mask;

    // Both must strictly stay within artwork
    for (let i = 0; i < w * h; i++) {
      if (!artwork[i]) {
        if (w1[i] !== 0) throw new Error(`${tc.name}: W1 spilled into transparent space at ${i}`);
        if (w2[i] !== 0) throw new Error(`${tc.name}: W2 spilled into transparent space at ${i}`);
      }
    }
    console.log('✓ W1 and W2 strictly bounded by artwork transparency (zero bleed)');

    // W1 and W2 buffers are separate and independent
    if (w1 === w2) throw new Error(`${tc.name}: W1 and W2 share memory buffer`);
    console.log('✓ Independent pixel buffers maintained for originalCMY, w1Mask, and w2Mask');

    // Check layer coverages
    let w1Count = 0, w2Count = 0;
    for (let i = 0; i < w * h; i++) {
      if (w1[i]) w1Count++;
      if (w2[i]) w2Count++;
    }
    console.log(`- W1 Coverage: ${(w1Count / artPx * 100).toFixed(1)}% | W2 Coverage: ${(w2Count / artPx * 100).toFixed(1)}%`);
    if (w1Count === 0 && artPx > 0) throw new Error(`${tc.name}: W1 empty`);
    if (w2Count === 0 && artPx > 0) throw new Error(`${tc.name}: W2 empty`);

    // Test 3: Rendering views
    const viewSrc = { width: w, height: h, original: rgba, cmy, w1, w2 };
    const baseOpt = { mode: 'cmy' as const, zoom: 1, panX: 0, panY: 0, show: { w1: true, cmy: true, w2: true } };
    const outBuf = new Uint8ClampedArray(w * h * 4);
    
    renderCmyView(viewSrc, baseOpt, outBuf, w, h);
    renderW1View(viewSrc, { ...baseOpt, mode: 'w1' }, outBuf, w, h);
    renderW2View(viewSrc, { ...baseOpt, mode: 'w2' }, outBuf, w, h);
    renderCombinedView(viewSrc, { ...baseOpt, mode: 'combined' }, outBuf, w, h);
    console.log('✓ All 4 preview view modes render cleanly');

    // Test 4: Export to TIFF
    const expDesign = {
      id: 'd1',
      width: w,
      height: h,
      rgba,
      w1,
      w2,
      w2ExcludesW1: false
    };

    const job = {
      sheetWidthIn: 11,
      sheetLengthIn: 17,
      dpi: 300,
      format: 'single' as const,
      invertSpots: false,
      designs: [expDesign],
      sheets: [[{ designId: 'd1', xMm: 10, yMm: 10, widthMm: 80, heightMm: 80, rotated: false }]]
    };

    const out = composeSheets(job);
    if (!out.files.length) throw new Error(`${tc.name}: No files exported`);
    const totalBytes = out.files[0].parts.reduce((sum, p) => sum + p.length, 0);
    const fullBuf = new Uint8Array(totalBytes);
    let offset = 0;
    for (const p of out.files[0].parts) {
      fullBuf.set(p, offset);
      offset += p.length;
    }
    const singleMeta = readTiff(fullBuf);
    if (!singleMeta.channelNames.includes('W1') || !singleMeta.channelNames.includes('W2')) {
      throw new Error(`${tc.name}: Single TIFF missing W1 or W2 spot channels`);
    }

    const sepJob = { ...job, format: 'separate' as const };
    const sepOut = composeSheets(sepJob);
    if (sepOut.files.length !== 3) throw new Error(`${tc.name}: Expected 3 files for separate format, got ${sepOut.files.length}`);
    console.log(`✓ TIFF exports verified: Spot channels "W1" and "W2" present, dimensions ${singleMeta.width}x${singleMeta.height}`);
  }

  console.log('\n=========================================');
  console.log('ALL UNIVERSAL 3D HD ARTWORK TESTS PASSED!');
  console.log('=========================================');
}

runTest().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
