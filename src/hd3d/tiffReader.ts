/**
 * Minimal TIFF reader for verifying 3D HD exports (re-import check in the app and
 * in tests): 8-bit chunky strips plus Photoshop
 * channel names / spot flags. Supports uncompressed, LZW and PackBits. Pure (no DOM).
 */
import { lzwDecode, unpackBits } from './tiffWriter';

export interface ParsedTiff {
  width: number;
  height: number;
  samplesPerPixel: number;
  photometric: number;
  compression: number;
  dpi: number;
  extraSamples: number[];
  channelNames: string[];
  spotKinds: number[];
  /** Decoded interleaved pixels. */
  pixels: Uint8Array;
}

export function readTiff(buf: Uint8Array): ParsedTiff {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (v.getUint16(0, false) !== 0x4949 || v.getUint16(2, true) !== 42) throw new Error('Not a little-endian TIFF');
  const ifd = v.getUint32(4, true);
  const n = v.getUint16(ifd, true);
  const tags = new Map<number, number[]>();
  const raw = new Map<number, Uint8Array>();
  const size: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    const tag = v.getUint16(o, true), type = v.getUint16(o + 2, true), count = v.getUint32(o + 4, true);
    const bytes = (size[type] ?? 1) * count;
    const at = bytes <= 4 ? o + 8 : v.getUint32(o + 8, true);
    raw.set(tag, buf.subarray(at, at + bytes));
    const vals: number[] = [];
    for (let k = 0; k < count && type !== 2 && type !== 1; k++) {
      if (type === 3) vals.push(v.getUint16(at + k * 2, true));
      else if (type === 4) vals.push(v.getUint32(at + k * 4, true));
      else if (type === 5) vals.push(v.getUint32(at + k * 8, true) / v.getUint32(at + k * 8 + 4, true));
    }
    tags.set(tag, vals);
  }
  const width = tags.get(256)![0], height = tags.get(257)![0];
  const spp = tags.get(277)?.[0] ?? 1;
  const compression = tags.get(259)?.[0] ?? 1;
  const rowsPerStrip = tags.get(278)?.[0] ?? height;
  const offsets = tags.get(273)!, counts = tags.get(279)!;
  const pixels = new Uint8Array(width * height * spp);
  let pos = 0;
  offsets.forEach((off, i) => {
    const rows = Math.min(rowsPerStrip, height - i * rowsPerStrip);
    const expected = rows * width * spp;
    const data = buf.subarray(off, off + counts[i]);
    pixels.set(compression === 32773 ? unpackBits(data, expected) : compression === 5 ? lzwDecode(data, expected) : data.subarray(0, expected), pos);
    pos += expected;
  });

  // Photoshop resources.
  const channelNames: string[] = [];
  const spotKinds: number[] = [];
  const irb = raw.get(34377);
  if (irb) {
    let p = 0;
    while (p + 12 <= irb.length && irb[p] === 0x38) {
      const id = (irb[p + 4] << 8) | irb[p + 5];
      const nameLen = irb[p + 6];
      let q = p + 6 + 1 + nameLen;
      if ((1 + nameLen) % 2) q++;
      const len = (irb[q] << 24) | (irb[q + 1] << 16) | (irb[q + 2] << 8) | irb[q + 3];
      const data = irb.subarray(q + 4, q + 4 + len);
      if (id === 1006) {
        let k = 0;
        while (k < data.length) { const l = data[k]; channelNames.push(String.fromCharCode(...data.subarray(k + 1, k + 1 + l))); k += 1 + l; }
      } else if (id === 1077) {
        for (let k = 4; k + 13 <= data.length; k += 13) spotKinds.push(data[k + 12]);
      }
      p = q + 4 + len + (len % 2);
    }
  }
  return {
    width, height, samplesPerPixel: spp, photometric: tags.get(262)?.[0] ?? 0, compression,
    dpi: tags.get(282)?.[0] ?? 0, extraSamples: tags.get(338) ?? [], channelNames, spotKinds, pixels
  };
}
