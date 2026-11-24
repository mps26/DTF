/**
 * Runs refineCutout on a raw RGBA image with a constant or supplied AI matte.
 *   node cut.cjs <in.rgba> <w> <h> <aiConst|matte.raw> <out.rgba>
 */
import * as fs from 'fs';
import { refineCutout } from '../src/utils/cutoutRefine';
const [inp, ws, hs, aiArg, out] = process.argv.slice(2);
const w = +ws, h = +hs;
const rgba = new Uint8ClampedArray(fs.readFileSync(inp));
const ai = /^\d+$/.test(aiArg) ? new Uint8Array(w * h).fill(+aiArg) : new Uint8Array(fs.readFileSync(aiArg));
const t = Date.now();
const { alpha, info } = refineCutout(rgba, w, h, ai);
let solid = 0, soft = 0;
for (let p = 0; p < w * h; p++) { rgba[p * 4 + 3] = alpha[p]; if (alpha[p] === 255) solid++; else if (alpha[p] > 0) soft++; }
fs.writeFileSync(out, Buffer.from(rgba.buffer));
console.log(JSON.stringify({ ms: Date.now() - t, info, solidPct: +(solid / (w * h) * 100).toFixed(2), softPct: +(soft / (w * h) * 100).toFixed(3) }));
