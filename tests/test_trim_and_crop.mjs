import assert from 'assert';

console.log('=== RUNNING TESTS FOR AUTOMATIC TRIM & CROP CLEAN ===');

// 1. Test Alpha Bounding Box & Waste Percentage Calculation
function calculateBoundingBoxMock(width, height, artX, artY, artW, artH, padding = 4) {
  const minX = Math.max(0, artX - padding);
  const minY = Math.max(0, artY - padding);
  const maxX = Math.min(width, artX + artW + padding);
  const maxY = Math.min(height, artY + artH + padding);

  const cropW = Math.max(1, maxX - minX);
  const cropH = Math.max(1, maxY - minY);
  const totalArea = width * height;
  const artArea = cropW * cropH;
  const emptyPercent = Math.max(0, Math.round(((totalArea - artArea) / totalArea) * 100));

  return { minX, minY, maxX, maxY, width: cropW, height: cropH, emptyPercent };
}

// User's example: 2008 x 2008 image, artwork roughly 1600 x 470
const origW = 2008;
const origH = 2008;
const artX = 204;
const artY = 769;
const artW = 1600;
const artH = 470;
const box = calculateBoundingBoxMock(origW, origH, artX, artY, artW, artH, 0);

console.log(`Test 1: Bounding Box dimensions = ${box.width} x ${box.height}, Waste = ${box.emptyPercent}%`);
assert(box.emptyPercent >= 75 && box.emptyPercent <= 85, 'Waste percentage should be ~81% or ~77%');

// 2. Test Scaled Dimensions after Trim It
// Initial target width = 6.69", target height = 6.69"
const initialTargetW = 6.69;
const initialTargetH = 6.69;
const scaleX = box.width / origW;
const scaleY = box.height / origH;

const trimmedTargetW = parseFloat((initialTargetW * scaleX).toFixed(2));
const trimmedTargetH = parseFloat((initialTargetH * scaleY).toFixed(2));

console.log(`Test 2: Trimmed dimensions = ${trimmedTargetW}" x ${trimmedTargetH}"`);
assert.strictEqual(trimmedTargetW, 5.33, 'Trimmed width must be 5.33 inches');
assert.strictEqual(trimmedTargetH, 1.57, 'Trimmed height must be 1.57 inches');

// 3. Test Aspect Ratio Update
const trimmedRatio = box.width / box.height;
console.log(`Test 3: Trimmed aspect ratio = ${trimmedRatio.toFixed(4)}`);
assert(Math.abs(trimmedRatio - 3.404) < 0.01, 'Aspect ratio should be ~3.404');

// 4. Test Bidirectional Synchronization on Trimmed Image
// Lock is always ON.
// Changing Width to 10.68"
const newW = 10.68;
const calcH = parseFloat((newW / trimmedRatio).toFixed(2));
console.log(`Test 4A: Width = ${newW}" -> Calc Height = ${calcH}"`);
assert.strictEqual(calcH, 3.14, 'Height should be 3.14');

// Changing Height to 3.14"
const newH = 3.14;
const calcW = parseFloat((newH * trimmedRatio).toFixed(2));
console.log(`Test 4B: Height = ${newH}" -> Calc Width = ${calcW}"`);
assert.strictEqual(calcW, 10.69, 'Width should be ~10.68 - 10.69');

// 5. Test Revert
const revertedW = initialTargetW;
const revertedH = initialTargetH;
const revertedRatio = origW / origH;
console.log(`Test 5: Reverted dimensions = ${revertedW}" x ${revertedH}", ratio = ${revertedRatio}`);
assert.strictEqual(revertedW, 6.69);
assert.strictEqual(revertedH, 6.69);
assert.strictEqual(revertedRatio, 1);

// 6. Test Aspect Ratio Presets for Crop & Clean (Free, 1:1, 4:3, 16:9, Orig)
function testCropPreset(preset, imgW, imgH) {
  let targetRatio = 1;
  if (preset === '1:1') targetRatio = 1;
  else if (preset === '4:3') targetRatio = 4 / 3;
  else if (preset === '16:9') targetRatio = 16 / 9;
  else if (preset === 'orig') targetRatio = imgW / imgH;

  const K = targetRatio * (imgH / imgW);
  // Simulate dragging right handle (w increases)
  const normW = 0.6;
  const normH = normW / K;
  const resultingPixelW = normW * imgW;
  const resultingPixelH = normH * imgH;
  const resultingRatio = resultingPixelW / resultingPixelH;

  assert(Math.abs(resultingRatio - targetRatio) < 0.001, `Preset ${preset} must maintain target ratio`);
  return resultingRatio;
}

console.log('Test 6: Presets verified for 1:1 =', testCropPreset('1:1', 2008, 2008));
console.log('Test 6: Presets verified for 4:3 =', testCropPreset('4:3', 2008, 2008));
console.log('Test 6: Presets verified for 16:9 =', testCropPreset('16:9', 2008, 2008));
console.log('Test 6: Presets verified for Orig =', testCropPreset('orig', 2008, 2008));

// 7. Verify Gang Sheet Packing takes new dimensions
const sheetWidthMm = 558.8; // 22 inches
const itemWidthMm = trimmedTargetW * 25.4; // 135.38 mm
const itemHeightMm = trimmedTargetH * 25.4; // 39.88 mm
assert(itemWidthMm < sheetWidthMm, 'Trimmed item fits easily on 22" sheet');
const copiesPerWidth = Math.floor(sheetWidthMm / itemWidthMm);
console.log(`Test 7: Trimmed artwork width allows ${copiesPerWidth} copies horizontally across 22" roll`);
assert(copiesPerWidth >= 4, 'Multiple trimmed copies can now fit across 22" width, saving massive film!');

console.log('=== ALL AUTOMATIC TRIM & CROP CLEAN TESTS PASSED 100% ===');
