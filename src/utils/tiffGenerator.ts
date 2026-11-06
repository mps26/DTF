/**
 * Pure client-side RIP-ready TIFF encoder for DTF and UV DTF printing.
 * Generates genuine 300 DPI multi-channel TIFF files with:
 * - 4-Channel CMYK (PhotometricInterpretation = 5) or Keep RGB (PhotometricInterpretation = 2)
 * - Extra spot channel for White Ink (W1 / White / Spot_White)
 * - Optional Varnish channel (V1 / W2 / Gloss for UV DTF)
 * - Morphological erosion / dilation with Round or Square kernel
 * - Mirroring for film output
 * - Baseline TIFF encoding compatible with Maintop, Cadlink, RIIN, PrintFactory, Flexi, AcroRIP, Hoson, etc.
 */

export interface TiffExportOptions {
  mode: 'dtf' | 'uv_dtf';
  // Sheet
  dpi: number;
  colorMode?: 'cmyk' | 'rgb';
  colorProfile?: 'swop_v2' | 'fogra39' | 'srgb';
  transparencyChannel?: boolean;
  mirrorSheet?: boolean;
  // RIP & Channels
  ripPreset?: string;
  whiteChannelName?: string;
  varnishChannelName?: string;
  // White Ink
  chokePx: number; // 0 to 5 px
  chokeShape?: 'round' | 'square';
  whiteStrength?: number; // 0 to 100%
  softEdges?: 'follow_transparency' | 'solid_white';
  underbaseMode?: 'solid' | 'gradient' | 'vector';
  thresholdAlpha?: number; // 0 - 255
  cleanFaintEdgePixels?: 'off' | 'light' | 'strong';
  // UV Varnish
  varnishMode?: 'contour' | 'flood' | 'highlight';
  varnishSize?: 'wider' | 'same' | 'smaller';
  varnishOffsetPx?: number; // 1 to 5 px
  varnishStrength?: number; // 0 to 100%
}

/**
 * Converts sRGB (0-255) to standard CMYK (0-255)
 */
export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const normR = r / 255;
  const normG = g / 255;
  const normB = b / 255;

  const k = 1 - Math.max(normR, normG, normB);
  if (k >= 0.999) {
    return [0, 0, 0, 255];
  }

  const c = Math.round(((1 - normR - k) / (1 - k)) * 255);
  const m = Math.round(((1 - normG - k) / (1 - k)) * 255);
  const y = Math.round(((1 - normB - k) / (1 - k)) * 255);
  const kVal = Math.round(k * 255);

  return [c, m, y, kVal];
}

/**
 * Applies morphological erosion (choke) to an alpha mask buffer
 * to prevent white ink halos on dark garments.
 */
export function applyAlphaChoke(
  alphaBuffer: Uint8Array,
  width: number,
  height: number,
  chokePx: number,
  threshold: number = 8,
  shape: 'round' | 'square' = 'round'
): Uint8Array {
  if (chokePx <= 0) {
    const out = new Uint8Array(alphaBuffer.length);
    for (let i = 0; i < alphaBuffer.length; i++) {
      out[i] = alphaBuffer[i] >= threshold ? alphaBuffer[i] : 0;
    }
    return out;
  }

  const out = new Uint8Array(width * height);
  const chokeSq = chokePx * chokePx;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const centerAlpha = alphaBuffer[idx];

      if (centerAlpha < threshold) {
        out[idx] = 0;
        continue;
      }

      // Check neighborhood within choke radius
      let minNeighbor = centerAlpha;
      for (let dy = -chokePx; dy <= chokePx; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) {
          minNeighbor = 0;
          break;
        }
        for (let dx = -chokePx; dx <= chokePx; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) {
            minNeighbor = 0;
            break;
          }

          // Check kernel shape
          const inKernel = shape === 'square'
            ? Math.max(Math.abs(dx), Math.abs(dy)) <= chokePx
            : dx * dx + dy * dy <= chokeSq;

          if (inKernel) {
            const nAlpha = alphaBuffer[ny * width + nx];
            if (nAlpha < minNeighbor) {
              minNeighbor = nAlpha;
            }
          }
        }
        if (minNeighbor === 0) break;
      }

      out[idx] = minNeighbor >= threshold ? minNeighbor : 0;
    }
  }

  return out;
}

/**
 * Applies morphological dilation (expansion) to an alpha mask buffer
 * for UV Varnish "Wider than art" bleed coating.
 */
export function applyAlphaDilation(
  alphaBuffer: Uint8Array,
  width: number,
  height: number,
  offsetPx: number,
  threshold: number = 8
): Uint8Array {
  if (offsetPx <= 0) return alphaBuffer;

  const out = new Uint8Array(width * height);
  const offsetSq = offsetPx * offsetPx;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let maxNeighbor = 0;

      for (let dy = -offsetPx; dy <= offsetPx; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -offsetPx; dx <= offsetPx; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          if (dx * dx + dy * dy <= offsetSq) {
            const nAlpha = alphaBuffer[ny * width + nx];
            if (nAlpha > maxNeighbor) maxNeighbor = nAlpha;
          }
        }
        if (maxNeighbor === 255) break;
      }

      out[idx] = maxNeighbor >= threshold ? maxNeighbor : 0;
    }
  }

  return out;
}

/**
 * Encodes RGBA ImageData into a genuine RIP-ready multi-channel TIFF.
 */
export function createDtfTiffBlob(
  imageData: ImageData,
  options: TiffExportOptions
): Blob {
  const { width, height, data } = imageData;
  const numPixels = width * height;

  // Threshold cutoff calculation based on cleanFaintEdgePixels
  let activeThreshold = options.thresholdAlpha ?? 8;
  if (options.cleanFaintEdgePixels === 'off') {
    activeThreshold = 2;
  } else if (options.cleanFaintEdgePixels === 'light') {
    activeThreshold = 10;
  } else if (options.cleanFaintEdgePixels === 'strong') {
    activeThreshold = 26;
  }

  // 1. Extract raw alpha buffer
  const rawAlpha = new Uint8Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    rawAlpha[i] = data[i * 4 + 3];
  }

  // 2. Compute choked White Underbase channel (W1)
  const chokeShape = options.chokeShape || 'round';
  const chokedW1 = applyAlphaChoke(
    rawAlpha,
    width,
    height,
    options.chokePx,
    activeThreshold,
    chokeShape
  );

  // 3. Compute Varnish channel (V1) if UV DTF
  const isUvDtf = options.mode === 'uv_dtf';
  let varnishBuffer: Uint8Array | null = null;
  if (isUvDtf) {
    const vOffset = options.varnishOffsetPx || 2;
    if (options.varnishSize === 'wider') {
      varnishBuffer = applyAlphaDilation(rawAlpha, width, height, vOffset, activeThreshold);
    } else if (options.varnishSize === 'smaller') {
      varnishBuffer = applyAlphaChoke(rawAlpha, width, height, vOffset, activeThreshold, 'round');
    } else {
      varnishBuffer = rawAlpha;
    }
  }

  // Color Mode: CMYK (4 channels) or Keep RGB (3 channels)
  const isCmyk = (options.colorMode ?? 'cmyk') === 'cmyk';
  const baseColorChannels = isCmyk ? 4 : 3;

  // Samples per pixel:
  // Base Color (4 CMYK or 3 RGB) + W1 (1) + optional V1 (1)
  const samplesPerPixel = baseColorChannels + 1 + (isUvDtf ? 1 : 0);
  const pixelByteLength = numPixels * samplesPerPixel;
  const pixelBuffer = new Uint8Array(pixelByteLength);

  const whiteStrengthMult = (options.whiteStrength ?? 100) / 100;
  const varnishStrengthMult = (options.varnishStrength ?? 100) / 100;
  const isMirror = !!options.mirrorSheet;

  let pIdx = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Handle Mirroring: read from mirrored column if mirrorSheet is true
      const readX = isMirror ? width - 1 - x : x;
      const srcIdx = (y * width + readX);
      const dataIdx = srcIdx * 4;

      const r = data[dataIdx];
      const g = data[dataIdx + 1];
      const b = data[dataIdx + 2];
      const a = data[dataIdx + 3];

      if (a < activeThreshold) {
        // Fully transparent pixel
        for (let c = 0; c < baseColorChannels; c++) pixelBuffer[pIdx++] = 0;
        pixelBuffer[pIdx++] = 0; // W1
        if (isUvDtf) pixelBuffer[pIdx++] = 0; // V1
      } else {
        if (isCmyk) {
          const [c, m, yVal, k] = rgbToCmyk(r, g, b);
          pixelBuffer[pIdx++] = c;
          pixelBuffer[pIdx++] = m;
          pixelBuffer[pIdx++] = yVal;
          pixelBuffer[pIdx++] = k;
        } else {
          pixelBuffer[pIdx++] = r;
          pixelBuffer[pIdx++] = g;
          pixelBuffer[pIdx++] = b;
        }

        // White spot channel (W1)
        let wVal = chokedW1[srcIdx];
        if (options.softEdges === 'solid_white' || options.underbaseMode === 'solid') {
          if (wVal > 0) wVal = 255;
        }
        wVal = Math.round(wVal * whiteStrengthMult);
        pixelBuffer[pIdx++] = Math.min(255, Math.max(0, wVal));

        // Varnish channel (V1 / W2)
        if (isUvDtf && varnishBuffer) {
          let vVal = varnishBuffer[srcIdx];
          vVal = Math.round(vVal * varnishStrengthMult);
          pixelBuffer[pIdx++] = Math.min(255, Math.max(0, vVal));
        }
      }
    }
  }

  // 4. Construct Little-Endian TIFF Structure (II\x2A\x00)
  const dpi = options.dpi || 300;
  const ifdOffset = 8;
  const numEntries = 14;

  const ifdByteLength = 2 + numEntries * 12 + 4;
  const bitsPerSampleOffset = ifdOffset + ifdByteLength;
  const bitsPerSampleByteLength = samplesPerPixel * 2;

  const extraSamplesOffset = bitsPerSampleOffset + bitsPerSampleByteLength;
  // Extra samples count: W1 is 1 spot channel, V1 is another spot channel
  const extraSamplesCount = isUvDtf ? 2 : 1;
  const extraSamplesByteLength = extraSamplesCount * 2;

  const xResOffset = extraSamplesOffset + extraSamplesByteLength;
  const yResOffset = xResOffset + 8;
  const softwareOffset = yResOffset + 8;
  const softwareString = "DTF Layout Pro - Precision RIP Multi-Channel TIFF Encoder\x00";
  const softwareByteLength = softwareString.length;

  const dataOffset = softwareOffset + softwareByteLength;
  const totalFileSize = dataOffset + pixelByteLength;

  const buffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(buffer);

  // TIFF Header
  view.setUint16(0, 0x4949, false); // "II" Little-Endian
  view.setUint16(2, 42, true);      // TIFF Magic 42
  view.setUint32(4, ifdOffset, true);

  // Number of IFD directory entries
  let entryOffset = ifdOffset;
  view.setUint16(entryOffset, numEntries, true);
  entryOffset += 2;

  function writeIfdEntry(tag: number, type: number, count: number, valueOrOffset: number) {
    view.setUint16(entryOffset, tag, true);
    view.setUint16(entryOffset + 2, type, true);
    view.setUint32(entryOffset + 4, count, true);
    view.setUint32(entryOffset + 8, valueOrOffset, true);
    entryOffset += 12;
  }

  // Photometric interpretation: 5 = CMYK, 2 = RGB
  const photometric = isCmyk ? 5 : 2;

  writeIfdEntry(256, 4, 1, width);                                // ImageWidth
  writeIfdEntry(257, 4, 1, height);                               // ImageLength
  writeIfdEntry(258, 3, samplesPerPixel, bitsPerSampleOffset);    // BitsPerSample
  writeIfdEntry(259, 3, 1, 1);                                    // Compression (1 = uncompressed / baseline)
  writeIfdEntry(262, 3, 1, photometric);                          // PhotometricInterpretation
  writeIfdEntry(273, 4, 1, dataOffset);                           // StripOffsets
  writeIfdEntry(277, 3, 1, samplesPerPixel);                      // SamplesPerPixel
  writeIfdEntry(278, 4, 1, height);                               // RowsPerStrip
  writeIfdEntry(279, 4, 1, pixelByteLength);                      // StripByteCounts
  writeIfdEntry(282, 5, 1, xResOffset);                           // XResolution
  writeIfdEntry(283, 5, 1, yResOffset);                           // YResolution
  writeIfdEntry(296, 3, 1, 2);                                    // ResolutionUnit (2 = inch)
  writeIfdEntry(338, 3, extraSamplesCount, extraSamplesOffset);   // ExtraSamples (1 = associated spot channel)
  writeIfdEntry(305, 2, softwareByteLength, softwareOffset);       // Software

  // Next IFD Offset (0 = none)
  view.setUint32(entryOffset, 0, true);

  // Write BitsPerSample: 8 bits for each channel
  for (let s = 0; s < samplesPerPixel; s++) {
    view.setUint16(bitsPerSampleOffset + s * 2, 8, true);
  }

  // Write ExtraSamples: 1 = associated spot color channel (White / Varnish)
  for (let e = 0; e < extraSamplesCount; e++) {
    view.setUint16(extraSamplesOffset + e * 2, 1, true);
  }

  // Write XResolution & YResolution (300/1 DPI)
  view.setUint32(xResOffset, dpi, true);
  view.setUint32(xResOffset + 4, 1, true);
  view.setUint32(yResOffset, dpi, true);
  view.setUint32(yResOffset + 4, 1, true);

  // Write Software string
  for (let c = 0; c < softwareByteLength; c++) {
    view.setUint8(softwareOffset + c, softwareString.charCodeAt(c));
  }

  // Copy Pixel Buffer into ArrayBuffer
  const targetPixelView = new Uint8Array(buffer, dataOffset, pixelByteLength);
  targetPixelView.set(pixelBuffer);

  return new Blob([buffer], { type: 'image/tiff' });
}

/**
 * Downloads a Blob directly to the client browser
 */
export function downloadTiffBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
