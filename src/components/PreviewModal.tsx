import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { LayoutResult, SheetSettings } from '../types';
import { formatUnit, mmToUnit } from '../utils/units';

interface PreviewModalProps {
  layout: LayoutResult;
  settings: SheetSettings;
  onClose: () => void;
  onExportPng: () => void;
  onOptimize?: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  layout,
  settings,
  onClose,
  onExportPng,
  onOptimize
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isFitMode, setIsFitMode] = useState<boolean>(true);
  const [bgMode, setBgMode] = useState<'checker' | 'gray' | 'black' | 'white'>('checker');
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  const filmWidthMm = settings.filmWidthMm || 292.1;
  const usedLengthMm = Math.max(30, layout.usedLengthMm || 60);

  // Dynamically compute the zoom % required to fit the entire sheet in the viewport
  const calculateFitZoom = () => {
    if (!containerRef.current) return null;
    const container = containerRef.current;
    // Leave breathing room for toolbar, top/bottom labels, and right bracket
    const availableW = Math.max(80, container.clientWidth - 160);
    const availableH = Math.max(100, container.clientHeight - 130);

    const fitScaleX = availableW / filmWidthMm;
    const fitScaleY = availableH / usedLengthMm;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    // In this component, scale = (zoomPercent / 100) * 1.5
    // Therefore zoomPercent = (scale / 1.5) * 100
    const rawZoom = Math.round((fitScale / 1.5) * 100);
    return Math.max(5, Math.min(300, rawZoom));
  };

  // Auto-fit on initial mount and when layout dimensions change
  useEffect(() => {
    const applyFit = () => {
      const fitZoom = calculateFitZoom();
      if (fitZoom !== null) {
        setZoomPercent(fitZoom);
        setIsFitMode(true);
      }
    };
    // Run after initial DOM paint so containerRef has real client dimensions
    const timer = setTimeout(applyFit, 60);
    return () => clearTimeout(timer);
  }, [filmWidthMm, usedLengthMm]);

  // Handle window resize while in Fit mode
  useEffect(() => {
    const handleResize = () => {
      if (isFitMode) {
        const fitZoom = calculateFitZoom();
        if (fitZoom !== null) {
          setZoomPercent(fitZoom);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFitMode, filmWidthMm, usedLengthMm]);

  // Preload placement artwork images
  useEffect(() => {
    const loaded: Record<string, HTMLImageElement> = {};
    layout.placements.forEach((p) => {
      if (!loaded[p.assetId]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = p.asset.processedUrl || p.asset.originalUrl;
        img.onload = () => {
          loaded[p.assetId] = img;
          setImages((prev) => ({ ...prev, [p.assetId]: img }));
        };
      }
    });
  }, [layout.placements]);

  // Base scale calculation: 1.5 px/mm at 100% zoom
  const scale = useMemo(() => {
    return Math.max(0.02, (zoomPercent / 100) * 1.5);
  }, [zoomPercent]);

  const canvasWidth = Math.max(20, Math.round(filmWidthMm * scale));
  const canvasHeight = Math.max(20, Math.round(usedLengthMm * scale));

  // Render vertical sheet on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 1. Background Fill according to chosen bgMode
    if (bgMode === 'checker') {
      const checkSize = Math.max(4, Math.round(8 * (zoomPercent / 50)));
      const cols = Math.ceil(canvasWidth / checkSize);
      const rows = Math.ceil(canvasHeight / checkSize);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#f1f5f9';
          ctx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
        }
      }
    } else if (bgMode === 'gray') {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (bgMode === 'black') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // 2. Outer Film Border
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    // 3. Margin Guide (dashed line)
    const marginPx = settings.marginMm * scale;
    if (marginPx > 0) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        marginPx,
        marginPx,
        Math.max(1, canvasWidth - marginPx * 2),
        Math.max(1, canvasHeight - marginPx * 2)
      );
      ctx.setLineDash([]);
    }

    // 4. Render All Placed Copies
    layout.placements.forEach((p) => {
      const pxX = p.xMm * scale;
      const pxY = p.yMm * scale;
      const pxW = p.widthMm * scale;
      const pxH = p.heightMm * scale;
      const img = images[p.assetId];

      ctx.save();
      if (p.rotated) {
        ctx.translate(pxX + pxW, pxY);
        ctx.rotate(Math.PI / 2);
        if (img && img.complete) {
          ctx.drawImage(img, 0, 0, pxH, pxW);
        } else {
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(0, 0, pxH, pxW);
        }
      } else {
        if (img && img.complete) {
          ctx.drawImage(img, pxX, pxY, pxW, pxH);
        } else {
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(pxX, pxY, pxW, pxH);
        }
      }
      ctx.restore();

      // Bounding box overlay if enabled
      if (showBoundingBox) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 0.75;
        ctx.strokeRect(pxX, pxY, pxW, pxH);
      }
    });
  }, [
    canvasWidth,
    canvasHeight,
    layout.placements,
    images,
    scale,
    bgMode,
    showBoundingBox,
    settings.marginMm,
    zoomPercent
  ]);

  const handleZoomIn = () => {
    setIsFitMode(false);
    setZoomPercent((z) => Math.min(300, z + (z >= 100 ? 25 : 10)));
  };

  const handleZoomOut = () => {
    setIsFitMode(false);
    setZoomPercent((z) => Math.max(5, z - (z > 100 ? 25 : 10)));
  };

  const handleFit = () => {
    const fitZoom = calculateFitZoom();
    if (fitZoom !== null) {
      setZoomPercent(fitZoom);
      setIsFitMode(true);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
      }
    }
  };

  const handle100 = () => {
    setZoomPercent(100);
    setIsFitMode(false);
  };

  const handleRunOptimize = () => {
    setIsOptimizing(true);
    if (onOptimize) {
      onOptimize();
    }
    setTimeout(() => {
      setIsOptimizing(false);
    }, 1000);
  };

  const meters = (layout.usedLengthMm / 1000).toFixed(2);
  const copiesCount = layout.totalCopies || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in">
      {/* Floating Dialog matching Reference Image */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* ================= MODAL HEADER ================= */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 flex items-start justify-between border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              How it will print
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Low-quality preview. Your download will be sharp.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= CANVAS VIEWPORT (DOTTED BACKGROUND) ================= */}
        <div
          ref={containerRef}
          className="flex-1 min-h-[460px] max-h-[64vh] overflow-auto p-8 sm:p-12 flex relative"
          style={{
            backgroundColor: '#F8FAFC',
            backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* Central Vertical Sheet & Dimension Brackets */}
          <div className="flex items-center space-x-3 sm:space-x-4 m-auto">
            {/* Column with Top Width Pill + Canvas + Bottom Film Ends Here Badge */}
            <div className="flex flex-col items-center">
              {/* Top Dimension Pill: [ ⟷ 11.5" wide ] */}
              <div className="flex flex-col items-center mb-1">
                <div className="bg-white border border-slate-200 rounded-full px-3.5 py-1 text-xs font-bold text-slate-800 shadow-xs flex items-center space-x-1.5 z-10 font-mono">
                  <span className="text-indigo-600 font-black">⟷</span>
                  <span>{settings.filmWidth}" wide</span>
                </div>
                {/* Thin bracket line pointing down to sheet top */}
                <div
                  className="h-2 border-b border-l border-r border-indigo-400/80 rounded-b-xs"
                  style={{ width: Math.max(40, canvasWidth) }}
                />
              </div>

              {/* The Sheet Canvas */}
              <div className="shadow-xl rounded-sm overflow-hidden border border-indigo-200/90 relative bg-white">
                <canvas ref={canvasRef} className="block" />
              </div>

              {/* Bottom Badge: FILM ENDS HERE */}
              <div className="z-10 -mt-3.5">
                <span className="bg-slate-800 border border-slate-700 text-white text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md font-mono">
                  FILM ENDS HERE
                </span>
              </div>
            </div>

            {/* Right Guide Bracket & Dimension Text: "3.13 meters / 11.5" wide" */}
            <div className="flex items-center space-x-2.5 flex-shrink-0 self-center">
              {/* Blue Bracket Line */}
              <div
                className="w-2.5 border-r-2 border-t-2 border-b-2 border-indigo-400/90 rounded-r-md"
                style={{ height: Math.min(280, Math.max(60, canvasHeight * 0.75)) }}
              />

              {/* Callout Text */}
              <div className="flex flex-col font-mono text-left">
                <span className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                  {meters} meters
                </span>
                <span className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                  {settings.filmWidth}" wide
                </span>
              </div>
            </div>
          </div>

          {/* ================= FLOATING TOOLBAR AT BOTTOM-RIGHT ================= */}
          <div className="absolute bottom-4 right-6 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full px-3.5 py-1.5 shadow-lg flex items-center space-x-3 text-xs font-semibold text-slate-700 select-none z-20">
            {/* Zoom Stepper */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleZoomOut}
                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold hover:bg-slate-100 rounded"
                title="Zoom out"
              >
                –
              </button>
              <span className="font-mono font-bold text-slate-900 min-w-8 text-center">
                {zoomPercent}%
              </span>
              <button
                onClick={handleZoomIn}
                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold hover:bg-slate-100 rounded"
                title="Zoom in"
              >
                +
              </button>
            </div>

            <div className="h-3.5 w-px bg-slate-200" />

            {/* Presets: Fit & 100% */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleFit}
                className={`transition-colors cursor-pointer text-xs ${
                  isFitMode ? 'text-indigo-600 font-extrabold' : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
                title="Fit sheet into view"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={handle100}
                className={`transition-colors cursor-pointer text-xs ${
                  zoomPercent === 100 && !isFitMode
                    ? 'text-indigo-600 font-extrabold'
                    : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
                title="View at 100% actual print size"
              >
                100%
              </button>
            </div>

            <div className="h-3.5 w-px bg-slate-200" />

            {/* Background Swatches */}
            <div className="flex items-center space-x-1.5">
              {/* Checkerboard Swatch */}
              <button
                onClick={() => setBgMode('checker')}
                className={`w-5 h-5 rounded-full border overflow-hidden transition-all ${
                  bgMode === 'checker'
                    ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-105'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
                    linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
                    linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
                  `,
                  backgroundSize: '6px 6px',
                  backgroundColor: '#ffffff'
                }}
                title="Transparent Checkerboard"
              />

              {/* Gray Swatch */}
              <button
                onClick={() => setBgMode('gray')}
                className={`w-5 h-5 rounded-full bg-slate-400 border border-slate-300 transition-all ${
                  bgMode === 'gray' ? 'ring-2 ring-indigo-500/40 scale-105' : 'hover:scale-105'
                }`}
                title="Gray Background"
              />

              {/* Black Swatch */}
              <button
                onClick={() => setBgMode('black')}
                className={`w-5 h-5 rounded-full bg-slate-900 border border-slate-700 transition-all ${
                  bgMode === 'black' ? 'ring-2 ring-indigo-500/40 scale-105' : 'hover:scale-105'
                }`}
                title="Black Garment Background"
              />
            </div>

            <div className="h-3.5 w-px bg-slate-200" />

            {/* Bounding Box Toggle */}
            <button
              onClick={() => setShowBoundingBox(!showBoundingBox)}
              className={`hover:text-indigo-600 transition-colors ${
                showBoundingBox ? 'text-indigo-600 font-bold' : 'text-slate-500'
              }`}
            >
              Bounding Box
            </button>
          </div>
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="px-6 py-4 sm:px-8 sm:py-4.5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Left Dimension & Copies Pills */}
          <div className="flex items-center space-x-2.5">
            <div className="bg-slate-100/90 text-slate-900 font-bold font-mono text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-2xs">
              {settings.filmWidth}" × {meters} meters
            </div>

            <div className="bg-slate-100/90 text-slate-900 font-bold font-mono text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-2xs">
              {copiesCount} {copiesCount === 1 ? 'copy' : 'copies'}
            </div>
          </div>

          {/* Right Action Buttons: Optimize & Download */}
          <div className="flex items-center space-x-3">
            {/* Emerald Gradient Optimize Button matching Reference Image */}
            <button
              onClick={handleRunOptimize}
              disabled={isOptimizing}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl px-5 py-2.5 shadow-lg shadow-emerald-500/25 flex items-center space-x-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="text-xs sm:text-sm font-extrabold leading-tight">
                  {isOptimizing ? 'Optimizing...' : 'Optimize'}
                </div>
                <div className="text-[10px] font-medium text-emerald-100 leading-tight">
                  Fit closer, save film
                </div>
              </div>
            </button>

            {/* Download Button matching Reference Image */}
            <button
              onClick={onExportPng}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl px-5 py-2.5 shadow-xs flex items-center space-x-2 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
