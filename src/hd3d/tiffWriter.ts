/**
 * Streaming baseline TIFF writer (little-endian, 8 bit, chunky, LZW) with
 * Photoshop channel metadata, for 3D HD print files. Pure (no DOM).
 *
 * Strips are compressed as they are produced, so a full-size sheet never has to
 * exist uncompressed in memory. The IFD is written after the pixel data.
 *
 * Spot channels: TIFF stores extra channels as ExtraSamples. Their names and the
 * "spot colour" flag come from the Photoshop image-resource block (tag 34377):
 *   1006 alpha/spot channel names (Pascal), 1045 Unicode names, 1077 DisplayInfo
 *   (kind 2 = spot channel). This is how Photoshop itself saves spot channels in TIFF,
 *   and what RIPs that import spot channels from TIFF read.
 */

export interface TiffChannelInfo {
  name: string;
  /** 'alpha' = transparency, 'spot' = named spot colour channel. */
  kind: 'alpha' | 'spot';
  /** Display colour (RGB 0–255) shown for the channel in Photoshop-style apps. */
  display?: [number, number, number];
}

export interface TiffSpec {
  width: number;
  height: number;
  dpi: number;
  photometric: 'rgb' | 'gray';
  /** Extra channels after the colour channels, in pixel order. */
  extra: TiffChannelInfo[];
  rowsPerStrip: number;
  software?: string;
}

/**
 * TIFF LZW (compression 5): MSB-first codes of 9–12 bits, Clear = 256, EOI = 257,
 * with the code-width switch used by libtiff / Photoshop. Lossless.
 */
export function lzwEncode(src: Uint8Array): Uint8Array {
  const CLEAR = 256, EOI = 257;
  const dict = new Int32Array(4096 * 256); // (prefix code << 8 | byte) -> code + 1
  const used: number[] = [];
  let out = new Uint8Array(Math.max(64, (src.length * 3) >> 1));
  let o = 0, acc = 0, accBits = 0;
  let nbits = 9, next = 258, maxcode = 511;
  const put = (code: number) => {
    acc = (acc << nbits) | code;
    accBits += nbits;
    while (accBits >= 8) {
      if (o >= out.length) { const g = new Uint8Array(out.length * 2); g.set(out); out = g; }
      out[o++] = (acc >>> (accBits - 8)) & 0xff;
      accBits -= 8;
    }
    acc &= (1 << accBits) - 1;
  };
  put(CLEAR);
  if (src.length === 0) { put(EOI); if (accBits) out[o++] = (acc << (8 - accBits)) & 0xff; return out.slice(0, o); }
  let w = src[0];
  for (let i = 1; i < src.length; i++) {
    const b = src[i];
    const key = (w << 8) | b;
    const hit = dict[key];
    if (hit) { w = hit - 1; continue; }
    put(w);
    dict[key] = next + 1; used.push(key);
    next++;
    if (next === 4094) {
      put(CLEAR);
      for (const k of used) dict[k] = 0;
      used.length = 0;
      next = 258; nbits = 9; maxcode = 511;
    } else if (next > maxcode) {
      nbits++; maxcode = (1 << nbits) - 1;
    }
    w = b;
  }
  put(w);
  // The decoder adds one more entry after reading `w`; switch width as it will.
  if (next + 1 > maxcode && nbits < 12) nbits++;
  put(EOI);
  if (accBits) out[o++] = (acc << (8 - accBits)) & 0xff;
  return out.slice(0, o);
}

export function lzwDecode(src: Uint8Array, expected: number): Uint8Array {
  const out = new Uint8Array(expected);
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), first = new Uint8Array(4096), length = new Int32Array(4096);
  for (let i = 0; i < 256; i++) { prefix[i] = -1; suffix[i] = i; first[i] = i; length[i] = 1; }
  let o = 0, pos = 0, bitBuf = 0, bitCnt = 0;
  let nbits = 9, next = 258, prev = -1;
  const read = () => {
    while (bitCnt < nbits) {
      if (pos >= src.length) return 257;
      bitBuf = ((bitBuf << 8) | src[pos++]) >>> 0; bitCnt += 8;
    }
    const code = (bitBuf >>> (bitCnt - nbits)) & ((1 << nbits) - 1);
    bitCnt -= nbits;
    bitBuf &= (1 << bitCnt) - 1;
    return code;
  };
  const emit = (code: number) => {
    const len = length[code];
    let c = code;
    for (let k = len - 1; k >= 0; k--) { if (o + k < expected) out[o + k] = suffix[c]; c = prefix[c]; }
    o += len;
  };
  while (o < expected) {
    const code = read();
    if (code === 257) break;
    if (code === 256) { nbits = 9; next = 258; prev = -1; continue; }
    if (prev < 0) { emit(code); prev = code; continue; }
    if (code < next) {
      emit(code);
      prefix[next] = prev; suffix[next] = first[code]; first[next] = first[prev]; length[next] = length[prev] + 1;
    } else {
      prefix[next] = prev; suffix[next] = first[prev]; first[next] = first[prev]; length[next] = length[prev] + 1;
      emit(next);
    }
    next++;
    if (next + 1 > (1 << nbits) - 1 && nbits < 12) nbits++;
    prev = code;
  }
  return out;
}

/** PackBits (Apple / TIFF compression 32773). */
export function packBits(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src.length * 2 + 2); // worst case: 1-byte literals between short runs
  let o = 0, i = 0;
  const n = src.length;
  while (i < n) {
    // Run of identical bytes?
    let run = 1;
    while (i + run < n && run < 128 && src[i + run] === src[i]) run++;
    if (run >= 2) {
      out[o++] = (257 - run) & 0xff; // -(run-1)
      out[o++] = src[i];
      i += run;
      continue;
    }
    // Literal run until the next repeat of 2+ (or 128 bytes).
    const start = i;
    let len = 0;
    while (i < n && len < 128) {
      if (i + 1 < n && src[i] === src[i + 1]) break;
      i++; len++;
    }
    out[o++] = len - 1;
    out.set(src.subarray(start, start + len), o);
    o += len;
  }
  return out.slice(0, o);
}

export function unpackBits(src: Uint8Array, expected: number): Uint8Array {
  const out = new Uint8Array(expected);
  let i = 0, o = 0;
  while (i < src.length && o < expected) {
    const c = src[i++];
    if (c < 128) { const len = c + 1; out.set(src.subarray(i, i + len), o); i += len; o += len; }
    else if (c > 128) { const len = 257 - c; out.fill(src[i++], o, o + len); o += len; }
  }
  return out;
}

function pascal(name: string): number[] {
  const bytes = Array.from(name).map((c) => c.charCodeAt(0) & 0xff).slice(0, 255);
  return [bytes.length, ...bytes];
}

function resource(id: number, data: number[]): number[] {
  const out = [0x38, 0x42, 0x49, 0x4d, (id >> 8) & 0xff, id & 0xff, 0, 0];
  const len = data.length;
  out.push((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...data);
  if (len % 2) out.push(0);
  return out;
}

/** Photoshop image-resource block naming the extra channels and marking spot channels. */
export function photoshopChannelResources(extra: TiffChannelInfo[]): Uint8Array {
  // 1006: channel names as consecutive Pascal strings.
  const names: number[] = [];
  for (const c of extra) names.push(...pascal(c.name));
  // 1045: Unicode names (4-byte length, UTF-16BE, per channel).
  const uni: number[] = [];
  for (const c of extra) {
    const s = c.name + '\u0000';
    uni.push((s.length >>> 24) & 0xff, (s.length >>> 16) & 0xff, (s.length >>> 8) & 0xff, s.length & 0xff);
    for (let i = 0; i < s.length; i++) uni.push((s.charCodeAt(i) >> 8) & 0xff, s.charCodeAt(i) & 0xff);
  }
  // 1077: DisplayInfo — version 1, then per channel: colour space (0 = RGB), 4 × uint16 colour,
  // opacity (0–100), kind (0 = alpha/selected areas, 2 = spot).
  const di: number[] = [0, 0, 0, 1];
  for (const c of extra) {
    const [r, g, b] = c.display ?? (c.kind === 'spot' ? [255, 0, 0] : [0, 0, 0]);
    di.push(0, 0, r, r, g, g, b, b, 0, 0, 0, 100, c.kind === 'spot' ? 2 : 0);
  }
  return new Uint8Array([...resource(1006, names), ...resource(1045, uni), ...resource(1077, di)]);
}

export class TiffStripWriter {
  private parts: Uint8Array[] = [];
  private offsets: number[] = [];
  private counts: number[] = [];
  private pos = 8; // after the header
  private written = 0;
  readonly spp: number;
  readonly stripCount: number;

  constructor(readonly spec: TiffSpec) {
    this.spp = (spec.photometric === 'rgb' ? 3 : 1) + spec.extra.length;
    this.stripCount = Math.ceil(spec.height / spec.rowsPerStrip);
  }

  /** Raw interleaved bytes (rows × width × spp) for the next strip. */
  addStrip(raw: Uint8Array): void {
    const rows = Math.min(this.spec.rowsPerStrip, this.spec.height - this.written);
    const expected = rows * this.spec.width * this.spp;
    if (raw.length !== expected) throw new Error(`TIFF strip has ${raw.length} bytes, expected ${expected}`);
    const packed = lzwEncode(raw);
    this.parts.push(packed);
    this.offsets.push(this.pos);
    this.counts.push(packed.length);
    this.pos += packed.length;
    this.written += rows;
  }

  /** Header + strips + IFD, ready for `new Blob(parts, { type: 'image/tiff' })`. */
  finish(): Uint8Array[] {
    if (this.written !== this.spec.height) throw new Error('TIFF is missing strips');
    const { width, height, dpi, photometric, extra, rowsPerStrip } = this.spec;
    const spp = this.spp;
    const software = (this.spec.software ?? 'DTF Set Files 3D HD') + '\u0000';
    const irb = extra.length ? photoshopChannelResources(extra) : null;

    let dataEnd = this.pos;
    const pad = dataEnd % 2;
    dataEnd += pad;

    type Entry = { tag: number; type: number; count: number; bytes: Uint8Array };
    const u16 = (vals: number[]) => { const b = new Uint8Array(vals.length * 2); const v = new DataView(b.buffer); vals.forEach((x, i) => v.setUint16(i * 2, x, true)); return b; };
    const u32 = (vals: number[]) => { const b = new Uint8Array(vals.length * 4); const v = new DataView(b.buffer); vals.forEach((x, i) => v.setUint32(i * 4, x, true)); return b; };
    const entries: Entry[] = [
      { tag: 256, type: 4, count: 1, bytes: u32([width]) },
      { tag: 257, type: 4, count: 1, bytes: u32([height]) },
      { tag: 258, type: 3, count: spp, bytes: u16(new Array(spp).fill(8)) },
      { tag: 259, type: 3, count: 1, bytes: u16([5]) }, // LZW
      { tag: 262, type: 3, count: 1, bytes: u16([photometric === 'rgb' ? 2 : 1]) },
      { tag: 273, type: 4, count: this.offsets.length, bytes: u32(this.offsets) },
      { tag: 277, type: 3, count: 1, bytes: u16([spp]) },
      { tag: 278, type: 4, count: 1, bytes: u32([rowsPerStrip]) },
      { tag: 279, type: 4, count: this.counts.length, bytes: u32(this.counts) },
      { tag: 282, type: 5, count: 1, bytes: u32([Math.round(dpi * 100), 100]) },
      { tag: 283, type: 5, count: 1, bytes: u32([Math.round(dpi * 100), 100]) },
      { tag: 284, type: 3, count: 1, bytes: u16([1]) },
      { tag: 296, type: 3, count: 1, bytes: u16([2]) },
      { tag: 305, type: 2, count: software.length, bytes: new Uint8Array(Array.from(software).map((c) => c.charCodeAt(0) & 0x7f)) }
    ];
    if (extra.length) {
      // 2 = unassociated alpha (transparency); 0 = unspecified data (spot channels).
      entries.push({ tag: 338, type: 3, count: extra.length, bytes: u16(extra.map((c) => (c.kind === 'alpha' ? 2 : 0))) });
    }
    if (irb) entries.push({ tag: 34377, type: 1, count: irb.length, bytes: irb });

    const ifdOffset = dataEnd;
    const ifdSize = 2 + entries.length * 12 + 4;
    let extOffset = ifdOffset + ifdSize;
    const ifd = new Uint8Array(ifdSize);
    const iv = new DataView(ifd.buffer);
    iv.setUint16(0, entries.length, true);
    const ext: Uint8Array[] = [];
    entries.forEach((e, i) => {
      const o = 2 + i * 12;
      iv.setUint16(o, e.tag, true);
      iv.setUint16(o + 2, e.type, true);
      iv.setUint32(o + 4, e.count, true);
      if (e.bytes.length <= 4) {
        ifd.set(e.bytes, o + 8);
      } else {
        iv.setUint32(o + 8, extOffset, true);
        const padded = e.bytes.length % 2 ? new Uint8Array([...e.bytes, 0]) : e.bytes;
        ext.push(padded);
        extOffset += padded.length;
      }
    });
    iv.setUint32(2 + entries.length * 12, 0, true);

    const header = new Uint8Array(8);
    const hv = new DataView(header.buffer);
    hv.setUint16(0, 0x4949, false);
    hv.setUint16(2, 42, true);
    hv.setUint32(4, ifdOffset, true);
    const out = [header, ...this.parts];
    if (pad) out.push(new Uint8Array(1));
    out.push(ifd, ...ext);
    this.parts = [];
    return out;
  }
}
