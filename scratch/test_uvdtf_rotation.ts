/**
 * UVDTF 90° rotation scenarios (A4, A3, Meter, 23×100) through the shared nesting engine.
 * Build/run:
 *   npx esbuild scratch/test_uvdtf_rotation.ts --bundle --platform=node --outfile=<tmp>/uv.cjs && node <tmp>/uv.cjs
 */
import { packGangSheet } from '../src/utils/packing';
import { validateLayout } from '../src/utils/dtfNesting';
import { findPresetById, getSettingsUpdatesForPreset } from '../src/utils/sheetPresets';
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

function uvSettings(presetId: string, o: Partial<SheetSettings> = {}): SheetSettings {
  const preset = findPresetById(presetId)!;
  return {
    printType: 'uvdtf', filmWidthPreset: presetId, filmWidth: preset.widthIn, filmWidthMm: preset.widthIn * IN, unit: 'inch',
    spacing: 5 / IN, spacingMm: 5, margin: 0.2, marginMm: 0.2 * IN, lengthMode: 'auto', fixedLength: 24, fixedLengthMm: 24 * IN,
    exportDpi: 300, allowItemRotation: false, keepDesignsTogether: true, nestingAlgorithm: 'box', mode: 'multiple',
    ...getSettingsUpdatesForPreset(preset), ...o
  } as SheetSettings;
}

function check(r: LayoutResult, a: ArtworkAsset[], s: SheetSettings, presetId: string, rotOn: boolean): string[] {
  const preset = findPresetById(presetId)!;
  const errs: string[] = [...validateLayout(r, { spacingMm: s.spacingMm, marginMm: s.marginMm })];
  const requested = a.reduce((n, x) => n + x.copies, 0);
  if (r.totalCopies !== requested) errs.push(`placed ${r.totalCopies}/${requested}`);
  if (new Set(r.placements.map((p) => p.id)).size !== r.placements.length) errs.push('duplicate copies');
  if (Math.abs(r.usedWidthMm - preset.widthIn * IN) > 0.01) errs.push(`sheet width ${r.usedWidthMm / IN}" ≠ ${preset.widthIn}"`);
  for (const sh of r.sheets) {
    if (preset.isFixedLength && Math.abs(sh.usedLengthMm - preset.maxLengthIn * IN) > 0.1) errs.push(`sheet length ${sh.usedLengthInches}" ≠ ${preset.maxLengthIn}"`);
    if (sh.usedLengthMm > preset.maxLengthIn * IN + 0.1) errs.push(`sheet longer than ${preset.maxLengthIn}"`);
    for (const p of sh.placements) {
      const src = a.find((x) => x.id === p.assetId)!;
      const ok = p.rotated
        ? Math.abs(p.widthMm - src.targetHeightMm) < 0.01 && Math.abs(p.heightMm - src.targetWidthMm) < 0.01
        : Math.abs(p.widthMm - src.targetWidthMm) < 0.01 && Math.abs(p.heightMm - src.targetHeightMm) < 0.01;
      if (!ok) errs.push(`${p.id} size changed`);
      if (p.rotated && !rotOn) errs.push(`${p.id} rotated while OFF`);
      if (p.xMm < s.marginMm - 0.01 || p.yMm < s.marginMm - 0.01 || p.xMm + p.widthMm > r.usedWidthMm - s.marginMm + 0.01 || p.yMm + p.heightMm > sh.usedLengthMm - s.marginMm + 0.01) errs.push(`${p.id} outside sheet`);
    }
    const ps = sh.placements;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const p = ps[i], q = ps[j];
      const gap = Math.max(q.xMm - (p.xMm + p.widthMm), p.xMm - (q.xMm + q.widthMm), q.yMm - (p.yMm + p.heightMm), p.yMm - (q.yMm + q.heightMm));
      if (gap < s.spacingMm - 0.01) errs.push(`${p.id}/${q.id} gap ${gap.toFixed(2)} mm`);
    }
  }
  return errs;
}

const ext = (r: LayoutResult) => r.sheets.reduce((n, sh) => n + Math.max(0, ...sh.placements.map((p) => p.yMm + p.heightMm)), 0);
const describe = (r: LayoutResult) => {
  const rot = r.placements.filter((p) => p.rotated).length;
  const cols = new Set(r.placements.map((p) => Math.round(p.xMm))).size;
  return `${r.sheets.length} sheet(s) ${r.sheets.map((s) => s.usedLengthInches + '"').join('+')}, artwork ends ${(ext(r) / IN).toFixed(2)}", rotated ${rot}/${r.totalCopies}, ${cols} column position(s), waste ${r.wastePercent}%`;
};

function run(name: string, presetId: string, a: ArtworkAsset[], expect?: (off: LayoutResult, on: LayoutResult) => string | null) {
  const res: Record<string, LayoutResult> = {};
  const lines: string[] = [];
  for (const rot of [false, true]) {
    const s = uvSettings(presetId, { allowItemRotation: rot });
    const r = packGangSheet(a, s);
    res[rot ? 'on' : 'off'] = r;
    const errs = check(r, a, s, presetId, rot);
    if (errs.length) failures++;
    lines.push(`   rotation ${rot ? 'ON ' : 'OFF'}: ${describe(r)}  ${errs.length ? 'FAIL ' + errs.slice(0, 3).join('; ') : 'ok'}`);
  }
  const notWorse = res.on.sheets.length > res.off.sheets.length || ext(res.on) > ext(res.off) + 0.5 ? 'rotation ON is worse than OFF' : null;
  const msg = notWorse || (expect ? expect(res.off, res.on) : null);
  if (msg) failures++;
  console.log(`${msg ? 'FAIL' : 'PASS'} ${name}${msg ? ' — ' + msg : ''}\n${lines.join('\n')}`);
  return res;
}

console.log('— Your UVDTF tests —');
run('Test A  A4 11×8, 7×2.33 × 2', 'uvdtf-a4', [asset('a', 7, 2.33, 2)]);
run('Test B  Meter 22×39, 12×4 × 5', 'uvdtf-meter', [asset('b', 12, 4, 5)], (off, on) =>
  on.placements.filter((p) => p.rotated).length === 0 ? 'nothing rotated' : ext(on) >= ext(off) - 25 ? 'not clearly shorter than stacking' : null);
run('Test C  Meter 22×39, mixed', 'uvdtf-meter', [asset('A', 12, 4, 3), asset('B', 8, 3, 4), asset('C', 4, 10, 2), asset('D', 6, 6, 3), asset('E', 9, 4, 2)]);

console.log('\n— All four UVDTF sheets —');
const mixed = () => [asset('A', 7, 2.33, 2), asset('B', 3, 5, 3), asset('C', 4, 2, 4)];
run('A4 11×8', 'uvdtf-a4', mixed());
run('A3 11×17', 'uvdtf-a3', [asset('A', 10, 3, 3), asset('B', 4, 7, 2), asset('C', 3, 3, 4)]);
run('Meter 22×39', 'uvdtf-meter', [asset('A', 12, 4, 6), asset('B', 4, 10, 4), asset('C', 6, 6, 4)]);
run('23×100 roll (Auto)', 'uvdtf-23x100', [asset('A', 12, 4, 10), asset('B', 4, 10, 6), asset('C', 6, 6, 8), asset('D', 2, 2, 20)]);
console.log('\n— Overflow / multiple sheets —');
run('A4 overflow (more than one sheet)', 'uvdtf-a4', [asset('A', 7, 2.33, 12)]);
run('Meter overflow', 'uvdtf-meter', [asset('A', 12, 4, 30)]);
console.log('\n— Repeat one design mode —');
{
  const a = [asset('R', 12, 4, 5), asset('ignored', 3, 3, 9)];
  const s = uvSettings('uvdtf-meter', { allowItemRotation: true, mode: 'repeat' });
  const r = packGangSheet(a, s);
  const only = r.placements.every((p) => p.assetId === 'R') && r.totalCopies === 5;
  if (!only) failures++;
  console.log(`${only ? 'PASS' : 'FAIL'} Repeat mode uses only the first design: ${describe(r)}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL UVDTF ROTATION TESTS PASS');
process.exit(failures ? 1 : 0);
