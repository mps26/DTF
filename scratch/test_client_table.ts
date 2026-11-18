/**
 * Client regression: exact dimensions from the client's screenshot (untrimmed PNGs).
 * Writes placements for scratch/verify_alpha_layout.py (pixel-level ink + box checks).
 * Build/run:
 *   npx esbuild scratch/test_client_table.ts --bundle --platform=node --outfile=<tmp>/c.cjs
 *   node <tmp>/c.cjs <designsDir> <outJson>
 */
import * as fs from 'fs';
import { packGangSheet } from '../src/utils/packing';
import { validateLayout } from '../src/utils/dtfNesting';
import { ArtworkAsset, LayoutResult, SheetSettings } from '../src/types';

const IN = 25.4;
const [dir, outJson] = process.argv.slice(2);
const designs = JSON.parse(fs.readFileSync(`${dir}/designs.json`, 'utf8'));
// Transparent margins measured like src/utils/inkBounds.ts (any alpha > 0 is artwork).
const inkPath = `${dir}/inkbounds.json`;
const ink: Record<string, any> | undefined = fs.existsSync(inkPath) ? JSON.parse(fs.readFileSync(inkPath, 'utf8')) : undefined;
const mkAssets = (filter?: string, mult = 1): ArtworkAsset[] =>
  designs.filter((d: any) => !filter || d.id === filter).map((d: any) => ({
    id: d.id, filename: d.id, fileType: 'png', fileSize: 1, originalWidth: 1, originalHeight: 1, hasAlpha: true,
    originalUrl: d.png, processedUrl: d.png, trimmedWidth: 1, trimmedHeight: 1, cropBox: null, isTrimmed: false,
    isBgRemoved: false, targetWidth: d.wIn, targetHeight: d.hIn, targetWidthMm: d.wIn * IN, targetHeightMm: d.hIn * IN,
    aspectLocked: true, copies: d.copies * mult, allowRotation: false, effectiveDpi: 300, dpiStatus: 'green', status: 'ready'
  }));
const settings = (o: Partial<SheetSettings>): SheetSettings => ({
  printType: 'dtf', filmWidthPreset: 'dtf-22x100', filmWidth: 22, filmWidthMm: 22 * IN, unit: 'inch',
  spacing: 5 / IN, spacingMm: 5, margin: 0.2, marginMm: 0.2 * IN, lengthMode: 'auto', fixedLength: 45,
  fixedLengthMm: 45 * IN, exportDpi: 300, allowItemRotation: false, keepDesignsTogether: true,
  nestingAlgorithm: 'box', mode: 'multiple', ...o
});

const cases: [string, ArtworkAsset[], Partial<SheetSettings>][] = [];
for (const len of [45, 60, 100]) for (const mode of ['auto', 'fixed'] as const) for (const rot of [false, true]) for (const sp of [5, 10]) {
  cases.push([`table ${len}in ${mode} rot=${rot} ${sp}mm`, mkAssets(), { lengthMode: mode, fixedLength: len, fixedLengthMm: len * IN, allowItemRotation: rot, spacingMm: sp }]);
}
cases.push(['3 identical parrots auto', mkAssets('parrot'), {}]);
cases.push(['parrots x6 (18) auto', mkAssets('parrot', 6), {}]);
cases.push(['table x3 copies 22x45 fixed (multi-sheet)', mkAssets(undefined, 3), { lengthMode: 'fixed' }]);
cases.push(['table x6 copies auto (>100in)', mkAssets(undefined, 6), {}]);
cases.push(['table keep-together off auto', mkAssets(), { keepDesignsTogether: false }]);

let failures = 0;
const out: any[] = [];
const ext = (r: LayoutResult) => r.sheets.map((s) => (Math.max(0, ...s.placements.map((p) => p.yMm + p.heightMm)) / IN).toFixed(2));
for (const [name, a, o] of cases) {
  const s = settings(o);
  const prev = packGangSheet(a, s); // previous behaviour: full spacing around every image box
  const r = packGangSheet(a, s, ink);
  const requested = a.reduce((n, x) => n + x.copies, 0);
  const errs = validateLayout(r, { spacingMm: s.spacingMm, marginMm: s.marginMm });
  if (r.validationErrors?.length) errs.push(...r.validationErrors);
  if (r.totalCopies !== requested) errs.push(`placed ${r.totalCopies}/${requested}`);
  failures += errs.length ? 1 : 0;
  console.log(`${errs.length ? 'FAIL' : 'OK  '} ${name.padEnd(42)} ${r.sheets.length} sheet(s) len [${r.sheets.map((x) => x.usedLengthInches).join(', ')}] in | artwork ends: previous [${ext(prev).join(', ')}] -> new [${ext(r).join(', ')}] in | ${r.totalCopies}/${requested} placed, ${r.calculationTimeMs}ms`);
  errs.slice(0, 5).forEach((e) => console.log('      ' + e));
  for (const [engine, lay] of [['previous', prev], ['new', r]] as const) out.push({
    scenario: name, engine, spacingMm: s.spacingMm, marginMm: s.marginMm, widthMm: r.usedWidthMm, requested,
    sheets: lay.sheets.map((sh) => ({ lengthMm: sh.usedLengthMm, placements: sh.placements.map((p) => ({ id: p.id, assetId: p.assetId, x: p.xMm, y: p.yMm, w: p.widthMm, h: p.heightMm, rotated: p.rotated })) }))
  });
}
fs.writeFileSync(outJson, JSON.stringify(out));
console.log(failures ? `${failures} case(s) FAILED` : `ALL ${cases.length} CASES PASS (engine validator)`);
process.exit(failures ? 1 : 0);
