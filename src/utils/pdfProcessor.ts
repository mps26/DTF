/**
 * PDF Processing Utility for DTF Gang Sheet Builder
 * Handles loading, rendering, and rasterizing PDF files using PDF.js.
 */

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export const PDFJS_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
export const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfjsLoadingPromise: Promise<any> | null = null;

/**
 * Checks whether a File is a PDF document based on MIME type and file extension
 */
export function isPdfFile(file: File): boolean {
  if (!file) return false;
  const isPdfMime = file.type === 'application/pdf' || file.type.toLowerCase().includes('pdf');
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
  return isPdfMime || isPdfExt;
}

/**
 * Dynamically loads and initializes PDF.js if not already present on window
 */
export async function getPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is only supported in browser environments.');
  }

  if (window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    }
    return window.pdfjsLib;
  }

  if (pdfjsLoadingPromise) {
    return pdfjsLoadingPromise;
  }

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in DOM
    const existingScript = document.querySelector(`script[src="${PDFJS_CDN_URL}"]`) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      } else {
        existingScript.addEventListener('load', () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
            resolve(window.pdfjsLib);
          } else {
            reject(new Error('PDF.js script loaded but window.pdfjsLib was not found.'));
          }
        });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load PDF.js from CDN.'));
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = PDFJS_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js script loaded but window.pdfjsLib was not found.'));
      }
    };
    script.onerror = () => {
      pdfjsLoadingPromise = null;
      reject(new Error('Failed to load PDF processing engine. Please check your internet connection.'));
    };
    document.head.appendChild(script);
  });

  return pdfjsLoadingPromise;
}

export interface RenderedPdfPage {
  pageNumber: number;
  totalPages: number;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  intrinsicWidthInches: number;
  intrinsicHeightInches: number;
  aspectRatio: number;
}

/**
 * Extracts and renders each page of a PDF file into high-resolution PNG images.
 * Preserves true vector resolution, alpha transparency, and physical print dimensions.
 */
export async function renderPdfPages(file: File): Promise<RenderedPdfPage[]> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const results: RenderedPdfPage[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);

    // 1. Unscaled viewport (scale: 1.0) gives dimensions in standard PDF points (72 points = 1 inch)
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const intrinsicWidthInches = Math.max(0.1, unscaledViewport.width / 72);
    const intrinsicHeightInches = Math.max(0.1, unscaledViewport.height / 72);

    // 2. High-resolution rendering scale: 300 DPI (300 / 72 ≈ 4.1667)
    let targetScale = 300 / 72;
    let targetWidth = unscaledViewport.width * targetScale;
    let targetHeight = unscaledViewport.height * targetScale;

    // Safety clamp: ensure canvas dimensions do not exceed 4096 px to prevent browser memory exhaustion on large posters
    const maxDimension = 4096;
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      const fitRatio = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
      targetScale *= fitRatio;
    }

    const viewport = page.getViewport({ scale: targetScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!ctx) {
      throw new Error(`Failed to initialize 2D canvas context for PDF page ${pageNum}`);
    }

    // Render PDF page with transparent background
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
      background: 'rgba(0,0,0,0)'
    };

    await page.render(renderContext).promise;

    const dataUrl = canvas.toDataURL('image/png');
    const widthPx = canvas.width;
    const heightPx = canvas.height;
    const aspectRatio = (widthPx > 0 && heightPx > 0) ? (widthPx / heightPx) : 1;

    results.push({
      pageNumber: pageNum,
      totalPages,
      dataUrl,
      widthPx,
      heightPx,
      intrinsicWidthInches,
      intrinsicHeightInches,
      aspectRatio
    });
  }

  return results;
}
