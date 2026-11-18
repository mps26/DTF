/**
 * Background-removal regression: JPEG photos/artwork with known subject masks.
 * Compares the previous algorithm (corner-average flood fill + global feather,
 * ported verbatim) with src/utils/backgroundRemoval.ts.
 *
 * Inputs (made by a generator script): <dir>/<name>.rgba (RGBA, 600x800), <name>.gt (1 = subject)
 * Build/run:
 *   npx esbuild scratch/test_background_removal.ts --bundle --platform=node --outfile=<tmp>/bg.cjs
 *   node <tmp>/bg.cjs <dir> [tolerance=25]
 */
import * as fs from 'fs';
import { removeBackgroundPixels } from '../src/utils/backgroundRemoval';

const W = 600, H = 800;
const dir = process.argv[2];
const TOL = Number(process.argv[3] || 25);
const names: string[] = JSON.parse(fs.readFileSync(`${dir}/names.json`, 'utf8'));

/** The previous removeImageBackground pixel logic, unchanged. */
function oldAlgorithm(data: Uint8ClampedArray, width: number, height: number, tolerance = 25) {
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + (width - 1)) * 4];
  let sr = 0, sg = 0, sb = 0;
  for (const i of corners) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; }
  const bgR = Math.round(sr / 4), bgG = Math.round(sg / 4), bgB = Math.round(sb / 4);
  const tolSq = tolerance * tolerance * 3;
  const mask = new Uint8Array(width * height), visited = new Uint8Array(width * height);
  const diff = (i: number) => { const dr = data[i] - bgR, dg = data[i + 1] - bgG, db = data[i + 2] - bgB; return dr * dr + dg * dg + db * db; };
  const q: number[] = [];
  const seed = (p: number) => { if (!visited[p] && diff(p * 4) <= tolSq) { q.push(p); visited[p] = 1; mask[p] = 1; } };
  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }
  let h = 0;
  while (h < q.length) {
    const c = q[h++], cx = c % width, cy = Math.floor(c / width);
    for (const n of [cy > 0 ? c - width : -1, cy < height - 1 ? c + width : -1, cx > 0 ? c - 1 : -1, cx < width - 1 ? c + 1 : -1]) {
      if (n !== -1 && !visited[n]) { visited[n] = 1; if (diff(n * 4) <= tolSq) { mask[n] = 1; q.push(n); } }
    }
  }
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (mask[p]) data[i + 3] = 0;
    else { const d = Math.sqrt(diff(i)); if (d < tolerance * 1.5) data[i + 3] = Math.round(data[i + 3] * Math.min(1, Math.max(0, (d - tolerance * 0.7) / (tolerance * 0.8)))); }
  }
}

function erode(m: Uint8Array, r: number, value: number): Uint8Array {
  // pixels whose whole (2r+1)^2 neighbourhood equals `value`
  const out = new Uint8Array(W * H);
  for (let y = r; y < H - r; y++) for (let x = r; x < W - r; x++) {
    let ok = true;
    for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r; dx++) if (m[(y + dy) * W + x + dx] !== value) { ok = false; break; }
    out[y * W + x] = ok ? 1 : 0;
  }
  return out;
}

function score(alpha: (p: number) => number, gt: Uint8Array) {
  const fgCore = erode(gt, 3, 1), bgCore = erode(gt, 3, 0);
  let fg = 0, fgOpaque = 0, fgPartial = 0, fgGone = 0, bg = 0, bgGone = 0;
  for (let p = 0; p < W * H; p++) {
    const a = alpha(p);
    if (fgCore[p]) { fg++; if (a >= 250) fgOpaque++; else if (a > 0) fgPartial++; else fgGone++; }
    if (bgCore[p]) { bg++; if (a === 0) bgGone++; }
  }
  const pct = (v: number, n: number) => +(100 * v / Math.max(1, n)).toFixed(1);
  return { bgRemoved: pct(bgGone, bg), subjectOpaque: pct(fgOpaque, fg), subjectSemiTransparent: pct(fgPartial, fg), subjectErased: pct(fgGone, fg) };
}

let pass = 0;
const rows: string[] = [];
for (const name of names) {
  const raw = new Uint8ClampedArray(fs.readFileSync(`${dir}/${name}.rgba`));
  const gt = new Uint8Array(fs.readFileSync(`${dir}/${name}.gt`));
  const a = new Uint8ClampedArray(raw); oldAlgorithm(a, W, H, TOL);
  const b = new Uint8ClampedArray(raw);
  const t = performance.now(); removeBackgroundPixels(b, W, H, { tolerance: TOL }); const ms = Math.round(performance.now() - t);
  fs.writeFileSync(`${dir}/${name}.old.rgba`, a); fs.writeFileSync(`${dir}/${name}.new.rgba`, b);
  const so = score((p) => a[p * 4 + 3], gt), sn = score((p) => b[p * 4 + 3], gt);
  const ok = sn.bgRemoved >= 97 && sn.subjectOpaque >= 99 && sn.subjectErased <= 0.5;
  pass += ok ? 1 : 0;
  rows.push(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(15)} OLD bg removed ${String(so.bgRemoved).padStart(5)}% | subject opaque ${String(so.subjectOpaque).padStart(5)}% semi ${String(so.subjectSemiTransparent).padStart(4)}% erased ${String(so.subjectErased).padStart(4)}%`
    + `\n     ${''.padEnd(15)} NEW bg removed ${String(sn.bgRemoved).padStart(5)}% | subject opaque ${String(sn.subjectOpaque).padStart(5)}% semi ${String(sn.subjectSemiTransparent).padStart(4)}% erased ${String(sn.subjectErased).padStart(4)}%  (${ms} ms)`);
}
console.log(rows.join('\n'));
console.log(`${pass}/${names.length} pass (new: >=97% background removed, >=99% subject interior opaque, <=0.5% subject erased)`);
process.exit(pass === names.length ? 0 : 1);
