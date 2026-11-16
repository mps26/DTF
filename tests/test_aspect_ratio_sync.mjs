import assert from 'node:assert';

console.log('====================================================');
console.log('  TEST SUITE: LOCK ASPECT RATIO BIDIRECTIONAL SYNC  ');
console.log('====================================================\n');

const MM_PER_INCH = 25.4;

function unitToMm(value, unit) {
  switch (unit) {
    case 'inch':
      return value * MM_PER_INCH;
    case 'cm':
      return value * 10;
    case 'meter':
      return value * 1000;
    case 'mm':
    default:
      return value;
  }
}

// Exactly mirrors handleUpdateAsset in App.tsx
function updateAsset(asset, updates, unit = 'inch') {
  const updated = { ...asset, ...updates };

  // Lock Aspect Ratio must always be enabled across the application (user cannot disable it)
  updated.aspectLocked = true;

  const origRatio = asset.originalAspectRatio || (asset.originalWidth > 0 && asset.originalHeight > 0 ? (asset.originalWidth / asset.originalHeight) : (asset.lockedRatio || 1));
  updated.originalAspectRatio = origRatio;
  updated.lockedRatio = origRatio;

  const precision = unit === 'meter' ? 4 : 2;

  if (updates.targetWidth !== undefined && updates.targetHeight !== undefined) {
    const rawW = Math.max(0.01, updates.targetWidth);
    const clampedW = parseFloat(rawW.toFixed(precision));
    updated.targetWidth = clampedW;
    updated.targetWidthMm = unitToMm(clampedW, unit);

    const rawH = Math.max(0.01, updates.targetHeight);
    const clampedH = parseFloat(rawH.toFixed(precision));
    updated.targetHeight = clampedH;
    updated.targetHeightMm = unitToMm(clampedH, unit);
  } else if (updates.targetWidth !== undefined) {
    const rawW = Math.max(0.01, updates.targetWidth);
    const clampedW = parseFloat(rawW.toFixed(precision));
    updated.targetWidth = clampedW;
    updated.targetWidthMm = unitToMm(clampedW, unit);

    // newHeight = newWidth / originalAspectRatio (Lock Aspect Ratio always enforced)
    const rawH = clampedW / origRatio;
    const clampedH = Math.max(0.01, parseFloat(rawH.toFixed(precision)));
    updated.targetHeight = clampedH;
    updated.targetHeightMm = unitToMm(clampedH, unit);
  } else if (updates.targetHeight !== undefined) {
    const rawH = Math.max(0.01, updates.targetHeight);
    const clampedH = parseFloat(rawH.toFixed(precision));
    updated.targetHeight = clampedH;
    updated.targetHeightMm = unitToMm(clampedH, unit);

    // newWidth = newHeight * originalAspectRatio (Lock Aspect Ratio always enforced)
    const rawW = clampedH * origRatio;
    const clampedW = Math.max(0.01, parseFloat(rawW.toFixed(precision)));
    updated.targetWidth = clampedW;
    updated.targetWidthMm = unitToMm(clampedW, unit);
  }

  return updated;
}

// SECTION 1: Original Aspect Ratio Calculation
console.log('1. Testing Original Aspect Ratio Extraction:');
const origWidth = 1296;
const origHeight = 1214;
const originalAspectRatio = origWidth / origHeight;
console.log(`   Original Dimensions: ${origWidth} × ${origHeight} px`);
console.log(`   Calculated Aspect Ratio: ${originalAspectRatio.toFixed(4)} (Expected: 1.0675)`);
assert.strictEqual(parseFloat(originalAspectRatio.toFixed(4)), 1.0675);
console.log('   ✓ Original aspect ratio extracted correctly.\n');

// Initialize asset with original dimensions
let asset1 = {
  id: 'asset-test-1',
  filename: 'test-1296x1214.png',
  originalWidth: origWidth,
  originalHeight: origHeight,
  originalAspectRatio: originalAspectRatio,
  aspectLocked: true,
  targetWidth: 4,
  targetHeight: 3.75,
  targetWidthMm: unitToMm(4, 'inch'),
  targetHeightMm: unitToMm(3.75, 'inch')
};

// SECTION 2 & 8: Mandatory Test Table
console.log('2. Running Mandatory Specification Test Cases:');
const testCases = [
  { action: 'Width = 2', set: { targetWidth: 2 }, checkKey: 'targetHeight', expected: 1.87 },
  { action: 'Width = 4', set: { targetWidth: 4 }, checkKey: 'targetHeight', expected: 3.75 },
  { action: 'Width = 6', set: { targetWidth: 6 }, checkKey: 'targetHeight', expected: 5.62 },
  { action: 'Width = 8', set: { targetWidth: 8 }, checkKey: 'targetHeight', expected: 7.49 },
  { action: 'Height = 5', set: { targetHeight: 5 }, checkKey: 'targetWidth', expected: 5.34 },
  { action: 'Height = 8', set: { targetHeight: 8 }, checkKey: 'targetWidth', expected: 8.54 },
  { action: 'Height = 10', set: { targetHeight: 10 }, checkKey: 'targetWidth', expected: 10.68 }
];

for (const tc of testCases) {
  asset1 = updateAsset(asset1, tc.set);
  const actual = asset1[tc.checkKey];
  console.log(`   Lock ON, ${tc.action.padEnd(12)} => ${tc.checkKey === 'targetHeight' ? 'Height' : 'Width'} = ${actual} (Expected: ${tc.expected})`);
  assert.strictEqual(actual, tc.expected, `Mismatch on ${tc.action}: got ${actual}, expected ${tc.expected}`);
}

// Test Lock Always ON (Cannot be disabled)
console.log('\n3. Testing Lock Aspect Ratio Permanent Enforcement (User Cannot Disable):');
asset1 = updateAsset(asset1, { aspectLocked: false });
console.log(`   Attempted to set aspectLocked: false => asset1.aspectLocked remains: ${asset1.aspectLocked} (Expected: true)`);
assert.strictEqual(asset1.aspectLocked, true, 'aspectLocked must remain true permanently');

// Verify that width change continues to proportionally adjust height
asset1 = updateAsset(asset1, { targetWidth: 8 });
console.log(`   Width changed to 8 => Height automatically adjusts to: ${asset1.targetHeight} (Expected: 7.49)`);
assert.strictEqual(asset1.targetHeight, 7.49);

// Verify that height change continues to proportionally adjust width
asset1 = updateAsset(asset1, { targetHeight: 5 });
console.log(`   Height changed to 5 => Width automatically adjusts to: ${asset1.targetWidth} (Expected: 5.34)`);
assert.strictEqual(asset1.targetWidth, 5.34);

// SECTION 4: Original Aspect Ratio Preservation
console.log('\n4. Testing Original Aspect Ratio Immutability across Repeated Resizes:');
// Subsequent change MUST use original aspect ratio (1296 / 1214 = 1.0675), NOT the resized dimensions!
asset1 = updateAsset(asset1, { targetWidth: 4 });
console.log(`   Subsequent Width = 4 => Height = ${asset1.targetHeight} (Expected: 3.75 using original aspect ratio)`);
assert.strictEqual(asset1.targetHeight, 3.75);

// SECTION 4: Individual Image State Management
console.log('\n5. Testing Multiple Uploaded Images Independence:');
let asset2 = {
  id: 'asset-test-2',
  filename: 'portrait-banner.png',
  originalWidth: 600,
  originalHeight: 1800,
  originalAspectRatio: 600 / 1800, // 0.33333...
  aspectLocked: true,
  targetWidth: 3,
  targetHeight: 9,
  targetWidthMm: unitToMm(3, 'inch'),
  targetHeightMm: unitToMm(9, 'inch')
};

// Change dimensions of Asset 2
asset2 = updateAsset(asset2, { targetWidth: 2 });
console.log(`   Asset 2 (aspect ratio 0.3333): Width = 2 => Height = ${asset2.targetHeight} (Expected: 6)`);
assert.strictEqual(asset2.targetHeight, 6);

// Verify Asset 1 is completely unaffected
console.log(`   Verify Asset 1 remains unaffected: Width = ${asset1.targetWidth}, Height = ${asset1.targetHeight}`);
assert.strictEqual(asset1.targetWidth, 4);
assert.strictEqual(asset1.targetHeight, 3.75);

// Change dimensions of Asset 1
asset1 = updateAsset(asset1, { targetHeight: 5 });
console.log(`   Asset 1: Height = 5 => Width = ${asset1.targetWidth} (Expected: 5.34)`);
assert.strictEqual(asset1.targetWidth, 5.34);

// Verify Asset 2 is completely unaffected
console.log(`   Verify Asset 2 remains unaffected: Width = ${asset2.targetWidth}, Height = ${asset2.targetHeight}`);
assert.strictEqual(asset2.targetWidth, 2);
assert.strictEqual(asset2.targetHeight, 6);

// SECTION 5: Edge cases, zero/negative prevention, decimal accuracy
console.log('\n6. Testing Decimals and Boundary Protections:');
asset1 = updateAsset(asset1, { targetWidth: 5.75 });
console.log(`   Decimal Width = 5.75 => Height = ${asset1.targetHeight}`);
const expectedHFor575 = parseFloat((5.75 / originalAspectRatio).toFixed(2));
assert.strictEqual(asset1.targetHeight, expectedHFor575);

// Zero or negative values clamped to safe minimum (0.01)
asset1 = updateAsset(asset1, { targetWidth: -5 });
assert.ok(asset1.targetWidth >= 0.01);
assert.ok(!isNaN(asset1.targetWidth));
assert.ok(!isNaN(asset1.targetHeight));
assert.ok(isFinite(asset1.targetWidth));
assert.ok(isFinite(asset1.targetHeight));
console.log(`   Negative prevention: Clamped Width = ${asset1.targetWidth}, Height = ${asset1.targetHeight}`);

console.log('\n====================================================');
console.log('  ALL SPECIFICATION & MANDATORY TESTS PASSED (100%)  ');
console.log('====================================================');
