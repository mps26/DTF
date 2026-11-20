/**
 * 90° auto-rotation scenarios for the DTF nesting engine.
 * Build/run:
 *   npx esbuild scratch/test_rotation.ts --bundle --platform=node --outfile=<tmp>/rot.cjs && node <tmp>/rot.cjs
 */
import { packGangSheet } from '../src/utils/packing';
import { validateLayout } from '../src/utils/dtfNesting';
import { ArtworkAsset, LayoutResult, SheetSettings } from '../src/types';

const IN = 25.4;
let failures = 0;

function asset(id: string, wIn: number, hIn: number, copies: number): ArtworkAsset {
  return {
    id, filename: id, fileType: 'png', fileSize: 1, originalWidth: wIn * 300, originalHeight: hIn * 300, hasAlpha: false,
    originalUrl: '', processedUrl: '', trimmedWidth: wIn * 300, trimmedHeight: hIn * 300, cropBox: null, isTrimmed: false,
    isBgRemoved: false, targetWidth: wIn, targetHeight: hIn, targetWidthMm: wIn * IN, targetHeightMm: hIn * IN,
    aspectLocked: true, copies, allowRotation: false, effectiveDpi: 300, dpiStatus: 'green', status: 'ready'
  };
}
const settings = (o: Partial<SheetSettings>): SheetSettings => ({
  printType: 'dtf', filmWidthPreset: 'dtf-22x100', filmWidth: 22, filmWidthMm: 22 * IN, unit: 'inch',
  spacing: 5 / IN, spacingMm: 5, margin: 0.2, marginMm: 0.2 * IN, lengthMode: 'auto', fixedLength: 39,
  fixedLengthMm: 39 * IN, exportDpi: 300, allowItemRotation: false, keepDesignsTogether: true,
  nestingAlgorithm: 'box', mode: 'multiple', ...o
});

function independentCheck(r: LayoutResult, a: ArtworkAsset[], s: SheetSettings, rotationOn: boolean): string[] {
  const errs: string[] = [];
  const W = 22 * IN, m = s.marginMm;
  for (const sh of r.sheets) {
    for (const p of sh.placements) {
      const src = a.find((x) => x.id === p.assetId)!;
      const dimsOk = p.rotated
        ? Math.abs(p.widthMm - src.targetHeightMm) < 0.01 && Math.abs(p.heightMm - src.targetWidthMm) < 0.01
        : Math.abs(p.widthMm - src.targetWidthMm) < 0.01 && Math.abs(p.heightMm - src.targetHeightMm) < 0.01;
      if (!dimsOk) errs.push(`${p.id} size changed`);
      if (p.rotated && !rotationOn) errs.push(`${p.id} rotated while 90° Rotation is OFF`);
      if (p.xMm < m - 0.01 || p.yMm < m - 0.01 || p.xMm + p.widthMm > W - m + 0.01 || p.yMm + p.heightMm > sh.usedLengthMm - m + 0.01) errs.push(`${p.id} outside sheet`);
    }
    const ps = sh.placements;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const p = ps[i], q = ps[j];
      const gap = Math.max(q.xMm - (p.xMm + p.widthMm), p.xMm - (q.xMm + q.widthMm), q.yMm - (p.yMm + p.heightMm), p.yMm - (q.yMm + q.heightMm));
      if (gap < s.spacingMm - 0.01) errs.push(`${p.id} / ${q.id} gap ${gap.toFixed(2)} mm < ${s.spacingMm} mm`);
    }
    if (sh.usedLengthMm < 39 * IN - 0.1 || sh.usedLengthMm > 100 * IN + 0.1) errs.push(`sheet length ${sh.usedLengthInches}" outside 39–100"`);
  }
  if (s.lengthMode === 'fixed' && r.sheets.some((sh) => Math.abs(sh.usedLengthMm - s.fixedLengthMm) > 0.1)) errs.push('fixed length not respected');
  return errs;
}

const extent = (r: LayoutResult) => r.sheets.map((sh) => (Math.max(0, ...sh.placements.map((p) => p.yMm + p.heightMm)) / IN).toFixed(2)).join(' + ');
const rotated = (r: LayoutResult) => r.placements.filter((p) => p.rotated).length;

function run(name: string, a: ArtworkAsset[], o: Partial<SheetSettings>, expect?: (off: LayoutResult, on: LayoutResult) => string | null) {
  const results: Record<string, LayoutResult> = {};
  const lines: string[] = [];
  for (const rot of [false, true]) {
    const s = settings({ ...o, allowItemRotation: rot });
    const r = packGangSheet(a, s);
    results[rot ? 'on' : 'off'] = r;
    const requested = a.reduce((n, x) => n + x.copies, 0);
    const errs = [...validateLayout(r, { spacingMm: s.spacingMm, marginMm: s.marginMm }), ...independentCheck(r, a, s, rot)];
    if (r.totalCopies !== requested) errs.push(`placed ${r.totalCopies}/${requested}`);
    if (errs.length) failures++;
    lines.push(`   rotation ${rot ? 'ON ' : 'OFF'}: ${r.sheets.length} sheet(s), artwork ends ${extent(r)}", rotated ${rotated(r)}/${r.totalCopies}, ${r.calculationTimeMs} ms ${errs.length ? 'FAIL ' + errs.slice(0, 3).join('; ') : 'ok'}`);
  }
  const msg = expect ? expect(results.off, results.on) : null;
  if (msg) failures++;
  console.log(`${msg ? 'FAIL' : 'PASS'} ${name}${msg ? ' — ' + msg : ''}\n${lines.join('\n')}`);
}

const ext = (r: LayoutResult) => r.sheets.reduce((n, sh) => n + Math.max(0, ...sh.placements.map((p) => p.yMm + p.heightMm)), 0);
const neverWorse = (off: LayoutResult, on: LayoutResult) =>
  on.sheets.length > off.sheets.length || ext(on) > ext(off) + 0.5 ? `rotation ON is worse (${extent(on)} vs ${extent(off)})` : null;

console.log('— Your test scenarios —');
run('Test 1  wide design 10×4 (1 copy)', [asset('wide', 10, 4, 1)], {}, (off, on) => neverWorse(off, on) || (rotated(on) ? 'rotated a single design for no benefit' : null));
// Spec: the engine may retain OR rotate a tall design depending on space; it must never be worse.
run('Test 2  tall design 4×10 (1 copy)', [asset('tall', 4, 10, 1)], {}, neverWorse);
run('Test 3  mixed designs', [asset('banner', 8, 5.3, 2), asset('portrait', 4.5, 6, 3), asset('square', 5, 5, 3), asset('wide', 10, 4, 2), asset('small', 2, 3, 6)], {}, neverWorse);
run('Test 4  one design × 10 copies (7×5)', [asset('d', 7, 5, 10)], {}, neverWorse);
run('Test 5  rotation OFF keeps orientation', [asset('wide', 10, 4, 4), asset('tall', 4, 10, 4)], {}, (off) => (rotated(off) ? 'designs rotated while OFF' : null));
run('Extra   rotation clearly helps: 14×6 × 3', [asset('long', 14, 6, 3)], {}, (off, on) => neverWorse(off, on) || (ext(on) < ext(off) - 25 ? null : `expected a much shorter sheet with rotation (${extent(on)} vs ${extent(off)})`));

console.log('\n— Test 6/7: sheet sizes, Auto/Fixed, 5 mm and 10 mm spacing —');
const mixed = () => [asset('banner', 8, 5.3, 4), asset('portrait', 4.5, 6, 6), asset('wide', 10, 4, 4), asset('long', 14, 6, 2), asset('small', 2, 3, 12)];
for (const len of [39, 45, 60, 100]) for (const mode of ['auto', 'fixed'] as const) for (const sp of [5, 10]) {
  run(`${len}" ${mode} ${sp} mm`, mixed(), { fixedLength: len, fixedLengthMm: len * IN, lengthMode: mode, spacingMm: sp }, neverWorse);
}
console.log('\n— Many copies (multi-sheet) —');
run('portrait 4.5×6 × 120', [asset('portrait', 4.5, 6, 120)], {}, neverWorse);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL ROTATION SCENARIOS PASS');
process.exit(failures ? 1 : 0);
