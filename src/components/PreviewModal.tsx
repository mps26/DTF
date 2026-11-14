import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2
} from 'lucide-react';
import { LayoutResult, SheetSettings } from '../types';
import { formatUnit, mmToUnit } from '../utils/units';
import { drawImageProportional } from '../utils/imageProcessing';

interface PreviewModalProps {
  layout: LayoutResult;
  settings: SheetSettings;
  onClose: () => void;
  onExportPng: () => void;
  onExportSingleSheet?: (sheetIndex: number) => void;
  onOptimize?: () => void;
  isExporting?: boolean;
  exportProgress?: number;
  exportStatusText?: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  layout,
  settings,
  onClose,
  onExportPng,
  onExportSingleSheet,
  onOptimize,
  isExporting = false,
  exportProgress = 0,
  exportStatusText = ''
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
  const [optimizeNotice, setOptimizeNotice] = useState<string | null>(null);

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
            drawImageProportional(ctx, img, 0, 0, pxH, pxW, p.asset?.aspectLocked !== false);
          } else {
            ctx.fillStyle = '#ea580c';
            ctx.fillRect(0, 0, pxH, pxW);
          }
        } else {
          if (img && img.complete) {
            drawImageProportional(ctx, img, pxX, pxY, pxW, pxH, p.asset?.aspectLocked !== false);
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
    setOptimizeNotice(null);
    if (onOptimize) {
      onOptimize();
    }
    setTimeout(() => {
      setIsOptimizing(false);
      setOptimizeNotice('Optimized: True-Shape nesting, rotation & tight spacing applied.');
    }, 350);
  };

  const meters = (layout.usedLengthMm / 1000).toFixed(2);
  const copiesCount = layout.totalCopies || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 select-none animate-in fade-in">
      {/* Floating Dialog matching Reference Image */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* ================= MODAL HEADER ================= */}
        <div className="px-6 py-3.5 sm:px-8 sm:py-4 flex items-start justify-between border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              How it will print
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Low-quality preview. Your download will be sharp.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            title="Close preview"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* ================= DOCKED PREVIEW CONTROLS TOOLBAR (OUTSIDE CANVAS) ================= */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs select-none flex-shrink-0">
          {/* Left: Sheet Selection Tabs */}
          <div className="flex items-center space-x-2">
            {sheetsToDraw.length > 1 ? (
              <>
                <span className="text-[11px] font-bold text-[#526A7B] uppercase tracking-wider">Select Sheet:</span>
                <div className="flex items-center space-x-1.5 font-mono">
                  {sheetsToDraw.map((s) => (
                    <button
                      key={s.sheetIndex}
                      onClick={() => setSelectedSheetIndex(s.sheetIndex)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedSheetIndex === s.sheetIndex
                          ? 'bg-[#EF7F1A] text-[#204563] shadow-xs font-black'
                          : 'bg-white border border-[#E5D9C8] text-[#204563] hover:bg-[#FAF7F1]'
                      }`}
                    >
                      Sheet {s.sheetIndex + 1}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="text-xs font-semibold text-[#526A7B]">Preview &amp; Canvas Controls</span>
            )}
          </div>

          {/* Right: Zoom Stepper, Fit, 100%, Swatches, Bounding Box */}
          <div className="flex items-center space-x-2.5 ml-auto">
            {/* Zoom Stepper for Selected Sheet */}
            <div className="flex items-center space-x-1.5 bg-white border border-[#E5D9C8] rounded-lg px-2 py-1 shadow-2xs">
              <button
                onClick={handleZoomOut}
                className="w-5 h-5 flex items-center justify-center text-[#526A7B] hover:text-[#204563] font-bold hover:bg-[#FAF7F1] rounded cursor-pointer"
                title="Zoom out"
              >
                –
              </button>
              <span className="font-mono font-bold text-[#204563] min-w-8 text-center text-xs">
                {sheetZooms[selectedSheetIndex] || zoomPercent}%
              </span>
              <button
                onClick={handleZoomIn}
                className="w-5 h-5 flex items-center justify-center text-[#526A7B] hover:text-[#204563] font-bold hover:bg-[#FAF7F1] rounded cursor-pointer"
                title="Zoom in"
              >
                +
              </button>
            </div>

            <div className="h-4 w-px bg-[#E5D9C8]" />

            {/* Presets: Fit & 100% for Selected Sheet */}
            <div className="flex items-center space-x-1 bg-white border border-[#E5D9C8] rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleFit}
                className={`px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                  sheetFitModes[selectedSheetIndex] !== false
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-[#526A7B] font-medium hover:text-[#204563]'
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
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-[#526A7B] font-medium hover:text-[#204563]'
                }`}
                title="View selected sheet at 100% actual print size"
              >
                100%
              </button>
            </div>

            <div className="h-4 w-px bg-[#E5D9C8]" />

            {/* Background Swatches */}
            <div className="flex items-center space-x-1.5 bg-white border border-[#E5D9C8] rounded-lg px-2 py-1 shadow-2xs">
              {/* Checkerboard Swatch */}
              <button
                onClick={() => setBgMode('checker')}
                className={`w-4.5 h-4.5 rounded-full border overflow-hidden transition-all cursor-pointer ${
                  bgMode === 'checker'
                    ? 'border-[#EF7F1A] ring-2 ring-[#EF7F1A]/30 scale-110'
                    : 'border-[#E5D9C8] hover:scale-105'
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
                  bgMode === 'gray' ? 'ring-2 ring-[#EF7F1A]/40 scale-110' : 'hover:scale-105'
                }`}
                title="Gray Background"
              />

              {/* Black Swatch */}
              <button
                onClick={() => setBgMode('black')}
                className={`w-4.5 h-4.5 rounded-full bg-slate-900 border border-slate-700 transition-all cursor-pointer ${
                  bgMode === 'black' ? 'ring-2 ring-[#EF7F1A]/40 scale-110' : 'hover:scale-105'
                }`}
                title="Black Garment Background"
              />
            </div>

            <div className="h-4 w-px bg-[#E5D9C8]" />

            {/* Bounding Box Toggle */}
            <button
              onClick={() => setShowBoundingBox(!showBoundingBox)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                showBoundingBox
                  ? 'bg-[#EF7F1A] border-[#EF7F1A] text-[#204563] font-black'
                  : 'bg-white border-[#E5D9C8] text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1]'
              }`}
            >
              Bounding Box
            </button>
          </div>
        </div>

        {/* ================= CANVAS VIEWPORT (DOTTED BACKGROUND) ================= */}
        <div
          ref={containerRef}
          className="flex-1 min-h-[140px] overflow-auto p-4 sm:p-8 flex flex-col items-start relative select-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E8DDCA] hover:[&::-webkit-scrollbar-thumb]:bg-[#E5D9C8] [&::-webkit-scrollbar-track]:bg-transparent"
          style={{
            backgroundColor: '#FAF7F1',
            backgroundImage: 'radial-gradient(#526A7B 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* Central Vertical Sheets & Dimension Brackets */}
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
                          ? 'bg-[#EF7F1A] text-[#204563] ring-2 ring-[#EF7F1A]/40 shadow-md font-black'
                          : 'bg-white border border-[#E5D9C8] text-[#204563] group-hover:border-[#EF7F1A]'
                      }`}>
                        {sheetsToDraw.length > 1 ? (
                          <>
                            <span className={isSelected ? 'text-[#204563] font-black' : 'text-[#204563] font-black'}>
                              Sheet {sheet.sheetIndex + 1}
                            </span>
                            <span className={isSelected ? 'text-[#204563]/60' : 'text-[#526A7B]'}>•</span>
                            <span>{Math.round((sheetW / 25.4) * 10) / 10}" wide</span>
                            {isSelected && (
                              <span className="ml-1 px-1.5 py-0.2 bg-[#204563] text-white rounded text-[9px] uppercase tracking-wider font-extrabold">
                                Active
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-[#204563] font-black">⟷</span>
                            <span>{settings.filmWidth}" wide</span>
                          </>
                        )}
                      </div>
                      {/* Direct Single Sheet Download Button on Sheet Card */}
                      {sheetsToDraw.length > 1 && onExportSingleSheet && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSheetIndex(sheet.sheetIndex);
                            onExportSingleSheet(sheet.sheetIndex);
                          }}
                          disabled={isExporting}
                          className="mt-1.5 mb-1 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white text-[#204563] border border-[#E5D9C8] shadow-xs hover:bg-[#EF7F1A] hover:border-[#EF7F1A] transition-all cursor-pointer z-10 disabled:opacity-50"
                          title={`Download Sheet ${sheet.sheetIndex + 1} as separate PNG`}
                        >
                          <Download className="w-3 h-3 text-[#204563]" />
                          <span>Download Sheet {sheet.sheetIndex + 1}</span>
                        </button>
                      )}

                      {/* Thin bracket line pointing down to sheet top */}
                      <div
                        className="h-2 border-b border-l border-r border-[#EF7F1A] rounded-b-xs"
                        style={{ width: Math.max(40, cWidth) }}
                      />
                    </div>

                    {/* The Sheet Canvas */}
                    <div className={`rounded-sm overflow-hidden relative bg-white transition-all ${
                      isSelected
                        ? 'ring-3 ring-[#EF7F1A] shadow-2xl scale-[1.01]'
                        : 'border border-[#E5D9C8] shadow-xl opacity-90 group-hover:opacity-100'
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
                        isSelected ? 'border-[#EF7F1A]' : 'border-[#E5D9C8]'
                      }`}
                      style={{ height: Math.min(280, Math.max(60, cHeight * 0.75)) }}
                    />
                    <div className="flex flex-col font-mono text-left">
                      <span className="font-black text-sm sm:text-base text-[#204563] leading-tight">
                        {sheetMeters} meters
                      </span>
                      <span className="text-xs text-[#526A7B] font-medium leading-tight mt-0.5">
                        {Math.round((sheetW / 25.4) * 10) / 10}" wide • {sheet.totalCopies} {sheet.totalCopies === 1 ? 'copy' : 'copies'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Download Progress Banner */}
        {isExporting && (
          <div className="px-6 py-2 bg-[#FAF7F1] border-t border-[#E5D9C8] flex items-center justify-between flex-shrink-0 animate-in fade-in duration-200">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#204563] truncate pr-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#EF7F1A] flex-shrink-0" />
              <span className="truncate">{exportStatusText || 'Generating and downloading high-resolution sheets...'}</span>
            </div>
            <div className="flex items-center space-x-2.5 flex-shrink-0">
              <div className="w-28 sm:w-40 bg-[#E8DDCA] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#EF7F1A] h-full transition-all duration-150 ease-out rounded-full"
                  style={{ width: `${Math.max(4, Math.min(100, exportProgress))}%` }}
                />
              </div>
              <span className="font-mono font-bold text-xs text-[#204563] w-9 text-right">{Math.round(exportProgress)}%</span>
            </div>
          </div>
        )}

        {/* ================= OPTIMIZE CONFIRMATION BANNER ================= */}
        {optimizeNotice && !isExporting && (
          <div className="px-6 py-2 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-800 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{optimizeNotice}</span>
            </div>
            <button
              onClick={() => setOptimizeNotice(null)}
              className="text-emerald-600 hover:text-emerald-800 text-[11px] font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ================= MODAL FOOTER ================= */}
        <div className="px-6 py-3 sm:px-8 sm:py-3.5 bg-white border-t border-[#E5D9C8] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          {/* Left Dimension & Copies Pills */}
          <div className="flex items-center space-x-2.5">
            <div className="bg-[#FAF7F1] text-[#204563] font-bold font-mono text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-[#E5D9C8] shadow-2xs">
              {settings.filmWidth}" × {meters} meters
            </div>

            <div className="bg-[#FAF7F1] text-[#204563] font-bold font-mono text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-[#E5D9C8] shadow-2xs">
              {copiesCount} {copiesCount === 1 ? 'copy' : 'copies'}
            </div>
          </div>

          {/* Right Action Buttons: Optimize & Download */}
          <div className="flex items-center space-x-3">
            {/* Emerald Gradient Optimize Button */}
            <button
              onClick={handleRunOptimize}
              disabled={isOptimizing || isExporting}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl px-5 py-2.5 shadow-lg shadow-emerald-500/25 flex items-center space-x-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none cursor-pointer"
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

            {/* Download Individual Separate Sheets Buttons */}
            {onExportSingleSheet && sheetsToDraw.length > 1 && sheetsToDraw.length <= 3 ? (
              sheetsToDraw.map((s) => (
                <button
                  key={s.sheetIndex}
                  onClick={() => {
                    setSelectedSheetIndex(s.sheetIndex);
                    onExportSingleSheet(s.sheetIndex);
                  }}
                  disabled={isExporting}
                  className={`border disabled:opacity-50 font-black text-xs sm:text-sm rounded-2xl px-4 py-2.5 shadow-xs flex items-center space-x-2 transition-all cursor-pointer ${
                    selectedSheetIndex === s.sheetIndex
                      ? 'bg-[#EF7F1A] text-[#204563] border-[#EF7F1A] shadow-md ring-2 ring-[#EF7F1A]/30'
                      : 'bg-[#FAF7F1] hover:bg-[#FCE8D5] text-[#204563] border-[#E5D9C8]'
                  }`}
                  title={`Download Sheet ${s.sheetIndex + 1} as separate PNG file`}
                >
                  <Download className={`w-4 h-4 text-[#204563]`} />
                  <span>Download Sheet {s.sheetIndex + 1}</span>
                </button>
              ))
            ) : onExportSingleSheet && sheetsToDraw.length > 3 ? (
              <button
                onClick={() => onExportSingleSheet(selectedSheetIndex)}
                disabled={isExporting}
                className="bg-[#EF7F1A] text-[#204563] border border-[#EF7F1A] disabled:opacity-50 font-black text-xs sm:text-sm rounded-2xl px-4 py-2.5 shadow-md flex items-center space-x-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
                title={`Download Sheet ${selectedSheetIndex + 1} separately`}
              >
                <Download className="w-4 h-4 text-[#204563]" />
                <span>Download Sheet {selectedSheetIndex + 1}</span>
              </button>
            ) : null}

            {/* Download All Button */}
            <button
              onClick={onExportPng}
              disabled={isExporting}
              className={`font-black text-xs sm:text-sm rounded-2xl px-5 py-2.5 shadow-xs flex items-center space-x-2 transition-all ${
                isExporting
                  ? 'bg-[#EF7F1A] text-[#204563] cursor-wait shadow-orange-500/25 ring-2 ring-orange-400'
                  : 'bg-[#204563] hover:bg-[#183750] text-white cursor-pointer'
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 text-[#204563] animate-spin" />
                  <span>{exportStatusText || `Downloading (${exportProgress}%)...`}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-white" />
                  <span>{sheetsToDraw.length > 1 ? `Download All (${sheetsToDraw.length})` : 'Download PNG'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
