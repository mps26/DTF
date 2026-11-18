/**
 * Coordinate-level verification of the DTF nesting engine.
 * Run:  npx esbuild scratch/test_dtf_nesting.ts --bundle --platform=node --outfile=scratch/.out/test_dtf_nesting.cjs && node scratch/.out/test_dtf_nesting.cjs
 */
import { packGangSheet } from '../src/utils/packing';
import { ArtworkAsset, LayoutResult, SheetSettings } from '../src/types';

const IN = 25.4;
let failures = 0;
let checks = 0;

function asset(id: string, wIn: number, hIn: number, copies: number): ArtworkAsset {
  return {
    id, filename: `${id}.png`, fileType: 'png', fileSize: 1, originalWidth: wIn * 300, originalHeight: hIn * 300,
    hasAlpha: true, originalUrl: '', processedUrl: '', trimmedWidth: wIn * 300, trimmedHeight: hIn * 300,
    cropBox: null, isTrimmed: false, isBgRemoved: false, targetWidth: wIn, targetHeight: hIn,
    targetWidthMm: wIn * IN, targetHeightMm: hIn * IN, aspectLocked: true, copies, allowRotation: false,
    effectiveDpi: 300, dpiStatus: 'green', status: 'ready'
  };
}

function settings(o: Partial<SheetSettings> & { lengthIn?: number }): SheetSettings {
  const len = o.lengthIn ?? 39;
  return {
    printType: 'dtf', filmWidthPreset: 'dtf-22x100', filmWidth: 22, filmWidthMm: 22 * IN, unit: 'inch',
    spacing: 5 / IN, spacingMm: 5, margin: 0.2, marginMm: 0.2 * IN, lengthMode: 'auto',
    fixedLength: len, fixedLengthMm: len * IN, exportDpi: 300, allowItemRotation: false,
    keepDesignsTogether: true, nestingAlgorithm: 'box', mode: 'multiple', ...o
  };
}

function check(cond: boolean, msg: string) {
  checks++;
  if (!cond) { failures++; console.log('   FAIL: ' + msg); }
}

function verify(name: string, assets: ArtworkAsset[], s: SheetSettings, r: LayoutResult) {
  const W = s.filmWidthMm, m = s.marginMm, sp = Math.max(5, s.spacingMm);
  const requested = assets.reduce((a, x) => a + x.copies, 0);
  check(r.usedWidthMm === 22 * IN, `${name}: width ${r.usedWidthMm} != 558.8`);
  check(r.totalCopies === requested, `${name}: placed ${r.totalCopies} / requested ${requested}`);
  check(new Set(r.placements.map((p) => p.id)).size === r.placements.length, `${name}: duplicate placement ids`);
  check(r.sheets.reduce((a, x) => a + x.placements.length, 0) === r.placements.length, `${name}: sheet split mismatch`);
  for (const sh of r.sheets) {
    const L = sh.usedLengthMm;
    check(L >= 39 * IN - 0.1 && L <= 100 * IN + 0.1, `${name}: sheet ${sh.sheetIndex} length ${(L / IN).toFixed(2)}in out of 39-100`);
    if (s.lengthMode === 'fixed') check(Math.abs(L - s.fixedLengthMm) < 0.1, `${name}: fixed length not respected`);
    for (const p of sh.placements) {
      const a = assets.find((x) => x.id === p.assetId)!;
      const okDims = p.rotated
        ? Math.abs(p.widthMm - a.targetHeightMm) < 0.01 && Math.abs(p.heightMm - a.targetWidthMm) < 0.01
        : Math.abs(p.widthMm - a.targetWidthMm) < 0.01 && Math.abs(p.heightMm - a.targetHeightMm) < 0.01;
      check(okDims, `${name}: ${p.id} dims changed`);
      if (!s.allowItemRotation) check(!p.rotated, `${name}: ${p.id} rotated while rotation disabled`);
      check(p.xMm >= m - 0.01 && p.yMm >= m - 0.01 && p.xMm + p.widthMm <= W - m + 0.01 && p.yMm + p.heightMm <= L - m + 0.01,
        `${name}: ${p.id} out of bounds`);
    }
    const ps = sh.placements;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const gapX = Math.max(b.xMm - (a.xMm + a.widthMm), a.xMm - (b.xMm + b.widthMm));
      const gapY = Math.max(b.yMm - (a.yMm + a.heightMm), a.yMm - (b.yMm + b.heightMm));
      check(Math.max(gapX, gapY) >= sp - 0.01, `${name}: ${a.id} & ${b.id} closer than spacing (${Math.max(gapX, gapY).toFixed(2)}mm)`);
    }
  }
}

function extentIn(r: LayoutResult) {
  return r.sheets.map((s) => Math.max(0, ...s.placements.map((p) => p.yMm + p.heightMm)) / IN);
}

// ---------------------------------------------------------------- datasets
const sample = () => [
  asset('A', 9, 8, 2), asset('B', 8, 6, 4), asset('C', 4, 4, 6),
  asset('D', 3, 5, 5), asset('E', 6, 3, 4), asset('F', 2, 2, 8)
];
// Approximation of the client's 22 x 45 screenshot
const client = () => [
  asset('navardev', 9.5, 2.6, 2), asset('bonbon', 4.2, 0.8, 6), asset('muhs', 2.2, 2.4, 1),
  asset('batch', 3.0, 2.3, 4), asset('hotspot', 7.4, 7.0, 2), asset('photo', 8.0, 9.5, 2),
  asset('parrot', 2.3, 3.5, 5)
];
const equal = () => [asset('Q', 5, 5, 30)];
const portraitLandscape = () => [asset('P', 4, 10, 6), asset('L', 10, 4, 6), asset('S', 3, 3, 10)];
const largeSmall = () => [asset('BIG', 18, 12, 2), asset('tiny', 1.5, 1.5, 40), asset('mid', 6, 9, 3)];
const huge = () => [asset('A', 9, 8, 40), asset('B', 8, 6, 30), asset('C', 4, 4, 50)];

const datasets: [string, () => ArtworkAsset[]][] = [
  ['sample', sample], ['client', client], ['equal', equal],
  ['portrait/landscape', portraitLandscape], ['large+small', largeSmall]
];

// ---------------------------------------------------------------- matrix
const lengths = [39, 45, 50, 60, 75, 100];
let maxMs = 0;
for (const len of lengths) {
  for (const [dname, make] of datasets) {
    for (const spacingMm of [5, 10]) {
      for (const rot of [false, true]) {
        for (const mode of ['auto', 'fixed'] as const) {
          for (const keep of [true, false]) {
            const a = make();
            const s = settings({ lengthIn: len, spacingMm, allowItemRotation: rot, lengthMode: mode, keepDesignsTogether: keep });
            const r = packGangSheet(a, s);
            maxMs = Math.max(maxMs, r.calculationTimeMs);
            verify(`${len}in/${dname}/${spacingMm}mm/rot=${rot}/${mode}/keep=${keep}`, a, s, r);
          }
        }
      }
    }
  }
}
console.log(`Matrix: ${lengths.length * datasets.length * 16} layouts, ${checks} checks, ${failures} failures, slowest ${maxMs}ms`);

// ---------------------------------------------------------------- comparisons vs old shelf packer
console.log('\nOld shelf packer vs new MaxRects (used vertical extent, inches):');
for (const [dname, make] of [...datasets, ['huge (>100in)', huge] as [string, () => ArtworkAsset[]]]) {
  for (const rot of [false, true]) {
    const s = settings({ allowItemRotation: rot });
    const neu = packGangSheet(make(), s);
    const old = packGangSheet(make(), { ...s, printType: 'uvdtf' }); // legacy shelf algorithm, same width
    const fmt = (r: LayoutResult) => `${r.sheets.length} sheet(s) [${extentIn(r).map((e) => e.toFixed(1)).join(', ')}]`;
    console.log(`  ${dname.padEnd(20)} rot=${String(rot).padEnd(5)} old ${fmt(old).padEnd(30)} new ${fmt(neu).padEnd(30)} util ${neu.utilizationPercent}%  ${neu.calculationTimeMs}ms`);
  }
}

// ---------------------------------------------------------------- overflow / multi-sheet
failures += 0;
for (const mode of ['auto', 'fixed'] as const) {
  for (const len of [39, 100]) {
    const a = huge();
    const s = settings({ lengthMode: mode, lengthIn: len });
    const r = packGangSheet(a, s);
    verify(`huge/${mode}/${len}`, a, s, r);
    console.log(`  multi-sheet ${mode} ${len}in -> ${r.sheets.length} sheets, lengths [${r.sheets.map((x) => x.usedLengthInches).join(', ')}], placed ${r.totalCopies}/${r.requestedCopies}`);
  }
}

// ---------------------------------------------------------------- client 22x45 detail
{
  const a = client();
  const s = settings({ lengthMode: 'fixed', lengthIn: 45 });
  const r = packGangSheet(a, s);
  verify('client-22x45-fixed', a, s, r);
  console.log(`\nClient 22x45 fixed: sheets=${r.sheets.length}, extent=${extentIn(r).map((e) => e.toFixed(2))}in, util=${r.utilizationPercent}%`);
  for (const p of r.placements) {
    console.log(`  ${p.id.padEnd(16)} x=${(p.xMm / IN).toFixed(2).padStart(6)} y=${(p.yMm / IN).toFixed(2).padStart(6)} w=${(p.widthMm / IN).toFixed(2)} h=${(p.heightMm / IN).toFixed(2)}`);
  }
  // Render an SVG of the result so the arrangement can be eyeballed.
  const fs = require('fs');
  const sc = 20;
  const colors: Record<string, string> = {};
  const pal = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#8ab17d', '#b56576', '#6d597a'];
  a.forEach((x, i) => (colors[x.id] = pal[i % pal.length]));
  const L = r.sheets[0].usedLengthMm;
  const rects = r.sheets[0].placements.map((p) =>
    `<rect x="${p.xMm / IN * sc}" y="${p.yMm / IN * sc}" width="${p.widthMm / IN * sc}" height="${p.heightMm / IN * sc}" fill="${colors[p.assetId]}" stroke="#000" stroke-width="0.5"/><text x="${p.xMm / IN * sc + 3}" y="${p.yMm / IN * sc + 12}" font-size="10" fill="#fff">${p.assetId}</text>`).join('');
  fs.writeFileSync(process.argv[2] || 'client_22x45.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${22 * sc}" height="${L / IN * sc}"><rect width="100%" height="100%" fill="#222"/>${rects}</svg>`);
}

console.log(`\nTOTAL: ${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
