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
  onExportSingleSheet?: (sheetIndex: number) => void;
  onOptimize?: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  layout,
  settings,
  onClose,
  onExportPng,
  onExportSingleSheet,
  onOptimize
}) => {
  const canvasRefs = useRef<Record<number, HTMLCanvasElement>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [sheetZooms, setSheetZooms] = useState<Record<number, number>>({});
  const [sheetFitModes, setSheetFitModes] = useState<Record<number, boolean>>({});

  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isFitMode, setIsFitMode] = useState<boolean>(true);
  const [bgMode, setBgMode] = useState<'checker' | 'gray' | 'black' | 'white'>('checker');
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  const filmWidthMm = settings.filmWidthMm || 292.1;
  const usedLengthMm = Math.max(30, layout.usedLengthMm || 60);

  const sheetsToDraw = layout.sheets && layout.sheets.length > 0
    ? layout.sheets
    : [{
        sheetIndex: 0,
        placements: layout.placements,
        usedWidthMm: layout.usedWidthMm || settings.filmWidthMm,
        usedLengthMm: layout.usedLengthMm || 60,
        usedLengthInches: layout.usedLengthInches || 2.36,
        usedLengthMeters: layout.usedLengthMeters || 0.06,
        totalCopies: layout.totalCopies,
        filmAreaMm2: layout.filmAreaMm2,
        artworkAreaMm2: layout.artworkAreaMm2,
        wastePercent: layout.wastePercent
      }];

  // Dynamically compute the zoom % required to fit the entire sheet in the viewport
  const calculateFitZoomForSheet = (sheetIndex: number) => {
    if (!containerRef.current) return null;
    const targetSheet = sheetsToDraw[sheetIndex] || sheetsToDraw[0];
    const sWidth = targetSheet.usedWidthMm || filmWidthMm;
    const sLength = Math.max(30, targetSheet.usedLengthMm || 60);

    const availableW = Math.max(80, containerRef.current.clientWidth - 160);
    const availableH = Math.max(100, containerRef.current.clientHeight - 130);

    const fitScaleX = availableW / sWidth;
    const fitScaleY = availableH / sLength;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    const rawZoom = Math.round((fitScale / 1.5) * 100);
    return Math.max(5, Math.min(300, rawZoom));
  };

  const calculateFitZoom = () => calculateFitZoomForSheet(selectedSheetIndex);

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

  // Render vertical sheets on canvases (Side-by-side beside each other)
  useEffect(() => {
    sheetsToDraw.forEach((sheet) => {
      const canvas = canvasRefs.current[sheet.sheetIndex];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const sheetW = sheet.usedWidthMm || settings.filmWidthMm;
      const sheetL = Math.max(30, sheet.usedLengthMm || 60);

      const currentSheetZoom = sheetZooms[sheet.sheetIndex] || zoomPercent;
      const currentScale = Math.max(0.02, (currentSheetZoom / 100) * 1.5);

      const cWidth = Math.max(20, Math.round(sheetW * currentScale));
      const cHeight = Math.max(20, Math.round(sheetL * currentScale));

      canvas.width = cWidth;
      canvas.height = cHeight;

      ctx.clearRect(0, 0, cWidth, cHeight);

      // 1. Background Fill according to chosen bgMode
      if (bgMode === 'checker') {
        const checkSize = Math.max(4, Math.round(8 * (currentSheetZoom / 50)));
        const cols = Math.ceil(cWidth / checkSize);
        const rows = Math.ceil(cHeight / checkSize);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#f1f5f9';
            ctx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
          }
        }
      } else if (bgMode === 'gray') {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(0, 0, cWidth, cHeight);
      } else if (bgMode === 'black') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cWidth, cHeight);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cWidth, cHeight);
      }

      // 2. Outer Film Border
      ctx.strokeStyle = '#a5b4fc';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, cWidth, cHeight);

      // 3. Margin Guide (dashed line)
      const marginPx = settings.marginMm * currentScale;
      if (marginPx > 0) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          marginPx,
          marginPx,
          Math.max(1, cWidth - marginPx * 2),
          Math.max(1, cHeight - marginPx * 2)
        );
        ctx.setLineDash([]);
      }

      // 4. Render Placed Copies on this specific sheet
      sheet.placements.forEach((p) => {
        const pxX = p.xMm * currentScale;
        const pxY = p.yMm * currentScale;
        const pxW = p.widthMm * currentScale;
        const pxH = p.heightMm * currentScale;
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
    });
  }, [
    sheetsToDraw,
    layout.placements,
    images,
    bgMode,
    showBoundingBox,
    settings.marginMm,
    zoomPercent,
    sheetZooms,
    sheetFitModes
  ]);

  const handleZoomIn = () => {
    setIsFitMode(false);
    setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: false }));
    const current = sheetZooms[selectedSheetIndex] || zoomPercent;
    const next = Math.min(300, current + (current >= 100 ? 25 : 10));
    setSheetZooms((prev) => ({ ...prev, [selectedSheetIndex]: next }));
    setZoomPercent(next);
  };

  const handleZoomOut = () => {
    setIsFitMode(false);
    setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: false }));
    const current = sheetZooms[selectedSheetIndex] || zoomPercent;
    const next = Math.max(5, current - (current > 100 ? 25 : 10));
    setSheetZooms((prev) => ({ ...prev, [selectedSheetIndex]: next }));
    setZoomPercent(next);
  };

  const handleFit = () => {
    const fitZoom = calculateFitZoomForSheet(selectedSheetIndex) || calculateFitZoom();
    if (fitZoom !== null) {
      setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: true }));
      setSheetZooms((prev) => ({ ...prev, [selectedSheetIndex]: fitZoom }));
      setIsFitMode(true);
      setZoomPercent(fitZoom);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
      }
    }
  };

  const handle100 = () => {
    setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: false }));
    setSheetZooms((prev) => ({ ...prev, [selectedSheetIndex]: 100 }));
    setIsFitMode(false);
    setZoomPercent(100);
  };

  // Auto-scroll to selected sheet or ensure Sheet 1 is visible on open
  useEffect(() => {
    const el = canvasRefs.current[selectedSheetIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedSheetIndex]);

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

        {/* ================= DOCKED PREVIEW CONTROLS TOOLBAR (OUTSIDE CANVAS) ================= */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
          {/* Left: Sheet Selection Tabs */}
          <div className="flex items-center space-x-2">
            {sheetsToDraw.length > 1 ? (
              <>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Sheet:</span>
                <div className="flex items-center space-x-1.5 font-mono">
                  {sheetsToDraw.map((s) => (
                    <button
                      key={s.sheetIndex}
                      onClick={() => setSelectedSheetIndex(s.sheetIndex)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedSheetIndex === s.sheetIndex
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      Sheet {s.sheetIndex + 1}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="text-xs font-semibold text-slate-500">Preview & Canvas Controls</span>
            )}
          </div>

          {/* Right: Zoom Stepper, Fit, 100%, Swatches, Bounding Box */}
          <div className="flex items-center space-x-2.5 ml-auto">
            {/* Zoom Stepper for Selected Sheet */}
            <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
              <button
                onClick={handleZoomOut}
                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold hover:bg-slate-100 rounded cursor-pointer"
                title="Zoom out"
              >
                –
              </button>
              <span className="font-mono font-bold text-slate-900 min-w-8 text-center text-xs">
                {sheetZooms[selectedSheetIndex] || zoomPercent}%
              </span>
              <button
                onClick={handleZoomIn}
                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-bold hover:bg-slate-100 rounded cursor-pointer"
                title="Zoom in"
              >
                +
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            {/* Presets: Fit & 100% for Selected Sheet */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleFit}
                className={`px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                  sheetFitModes[selectedSheetIndex] !== false
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
                title="Fit selected sheet into view"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={handle100}
                className={`px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                  sheetFitModes[selectedSheetIndex] === false && (sheetZooms[selectedSheetIndex] || zoomPercent) === 100
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 font-medium hover:text-slate-900'
                }`}
                title="View selected sheet at 100% actual print size"
              >
                100%
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            {/* Background Swatches */}
            <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
              {/* Checkerboard Swatch */}
              <button
                onClick={() => setBgMode('checker')}
                className={`w-4.5 h-4.5 rounded-full border overflow-hidden transition-all cursor-pointer ${
                  bgMode === 'checker'
                    ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-110'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
                    linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
                    linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
                  `,
                  backgroundSize: '5px 5px',
                  backgroundColor: '#ffffff'
                }}
                title="Transparent Checkerboard"
              />

              {/* Gray Swatch */}
              <button
                onClick={() => setBgMode('gray')}
                className={`w-4.5 h-4.5 rounded-full bg-slate-400 border border-slate-300 transition-all cursor-pointer ${
                  bgMode === 'gray' ? 'ring-2 ring-indigo-500/40 scale-110' : 'hover:scale-105'
                }`}
                title="Gray Background"
              />

              {/* Black Swatch */}
              <button
                onClick={() => setBgMode('black')}
                className={`w-4.5 h-4.5 rounded-full bg-slate-900 border border-slate-700 transition-all cursor-pointer ${
                  bgMode === 'black' ? 'ring-2 ring-indigo-500/40 scale-110' : 'hover:scale-105'
                }`}
                title="Black Garment Background"
              />
            </div>

            <div className="h-4 w-px bg-slate-200" />

            {/* Bounding Box Toggle */}
            <button
              onClick={() => setShowBoundingBox(!showBoundingBox)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                showBoundingBox
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Bounding Box
            </button>
          </div>
        </div>

        {/* ================= CANVAS VIEWPORT (DOTTED BACKGROUND) ================= */}
        <div
          ref={containerRef}
          className="flex-1 min-h-[460px] max-h-[64vh] overflow-auto p-8 sm:p-12 flex flex-col items-start relative select-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-transparent"
          style={{
            backgroundColor: '#F8FAFC',
            backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* Central Vertical Sheets & Dimension Brackets (Side-by-side beside each other, never clipped on left) */}
          <div className="min-w-full w-max flex items-center justify-center space-x-6 sm:space-x-8 p-4 my-auto">
            {sheetsToDraw.map((sheet) => {
              const isSelected = selectedSheetIndex === sheet.sheetIndex;
              const sheetW = sheet.usedWidthMm || settings.filmWidthMm;
              const sheetL = Math.max(30, sheet.usedLengthMm || 60);
              const currentSheetZoom = sheetZooms[sheet.sheetIndex] || zoomPercent;
              const currentScale = Math.max(0.02, (currentSheetZoom / 100) * 1.5);
              const cWidth = Math.max(20, Math.round(sheetW * currentScale));
              const cHeight = Math.max(20, Math.round(sheetL * currentScale));
              const sheetMeters = (sheet.usedLengthMm / 1000).toFixed(2);

              return (
                <div
                  key={sheet.sheetIndex}
                  onClick={() => setSelectedSheetIndex(sheet.sheetIndex)}
                  className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0 cursor-pointer group"
                >
                  {/* Column with Top Width Pill + Canvas */}
                  <div className="flex flex-col items-center">
                    {/* Top Dimension Pill */}
                    <div className="flex flex-col items-center mb-1">
                      <div className={`rounded-full px-3.5 py-1 text-xs font-bold shadow-xs flex items-center space-x-1.5 z-10 font-mono transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                          : 'bg-white border border-slate-200 text-slate-800 group-hover:border-indigo-300'
                      }`}>
                        {sheetsToDraw.length > 1 ? (
                          <>
                            <span className={isSelected ? 'text-white font-black' : 'text-indigo-600 font-black'}>
                              Sheet {sheet.sheetIndex + 1}
                            </span>
                            <span className={isSelected ? 'text-indigo-200' : 'text-slate-400'}>•</span>
                            <span>{Math.round((sheetW / 25.4) * 10) / 10}" wide</span>
                            {isSelected && (
                              <span className="ml-1 px-1.5 py-0.2 bg-white/20 text-white rounded text-[9px] uppercase tracking-wider font-extrabold">
                                Active
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-indigo-600 font-black">⟷</span>
                            <span>{settings.filmWidth}" wide</span>
                          </>
                        )}
                      </div>
                      {/* Thin bracket line pointing down to sheet top */}
                      <div
                        className="h-2 border-b border-l border-r border-indigo-400/80 rounded-b-xs"
                        style={{ width: Math.max(40, cWidth) }}
                      />
                    </div>

                    {/* The Sheet Canvas */}
                    <div className={`rounded-sm overflow-hidden relative bg-white transition-all ${
                      isSelected
                        ? 'ring-3 ring-indigo-500 shadow-2xl scale-[1.01]'
                        : 'border border-indigo-200/90 shadow-xl opacity-90 group-hover:opacity-100'
                    }`}>
                      <canvas
                        ref={(el) => {
                          if (el) canvasRefs.current[sheet.sheetIndex] = el;
                        }}
                        className="block"
                      />
                    </div>
                  </div>

                  {/* Right Guide Bracket & Dimension Text */}
                  <div className="flex items-center space-x-2.5 flex-shrink-0 self-center">
                    <div
                      className={`w-2.5 border-r-2 border-t-2 border-b-2 rounded-r-md ${
                        isSelected ? 'border-indigo-600' : 'border-indigo-400/90'
                      }`}
                      style={{ height: Math.min(280, Math.max(60, cHeight * 0.75)) }}
                    />
                    <div className="flex flex-col font-mono text-left">
                      <span className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                        {sheetMeters} meters
                      </span>
                      <span className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                        {Math.round((sheetW / 25.4) * 10) / 10}" wide • {sheet.totalCopies} {sheet.totalCopies === 1 ? 'copy' : 'copies'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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

            {/* Download Selected Sheet Button */}
            {onExportSingleSheet && sheetsToDraw.length > 1 && (
              <button
                onClick={() => onExportSingleSheet(selectedSheetIndex)}
                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs sm:text-sm rounded-2xl px-4 py-2.5 shadow-xs flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Download Sheet {selectedSheetIndex + 1}</span>
              </button>
            )}

            {/* Download All Button */}
            <button
              onClick={onExportPng}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl px-5 py-2.5 shadow-xs flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>{sheetsToDraw.length > 1 ? `Download All (${sheetsToDraw.length})` : 'Download PNG'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
