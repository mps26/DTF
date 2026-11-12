import React, { useRef, useEffect, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Box,
  Cpu,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { LayoutResult, SheetSettings, Unit, PackedPlacement } from '../types';
import { mmToUnit, formatUnit } from '../utils/units';
import { drawImageProportional } from '../utils/imageProcessing';

interface SheetPreviewProps {
  layout: LayoutResult;
  settings: SheetSettings;
  onUnitChange: (unit: Unit) => void;
  onNestingModeChange: (mode: 'box' | 'true-shape') => void;
  onSelectItem: (placement: PackedPlacement) => void;
}

export const SheetPreview: React.FC<SheetPreviewProps> = ({
  layout,
  settings,
  onUnitChange,
  onNestingModeChange,
  onSelectItem
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [imageElements, setImageElements] = useState<Record<string, HTMLImageElement>>({});
  const [isSimulatingTrueShape, setIsSimulatingTrueShape] = useState<boolean>(false);

  // Preload placement image assets into memory
  useEffect(() => {
    const loaded: Record<string, HTMLImageElement> = {};
    let isCancelled = false;

    const uniqueAssetIds = Array.from(new Set(layout.placements.map((p) => p.assetId)));

    uniqueAssetIds.forEach((id) => {
      const placement = layout.placements.find((p) => p.assetId === id);
      if (placement) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = placement.asset.processedUrl || placement.asset.originalUrl;
        img.onload = () => {
          if (!isCancelled) {
            loaded[id] = img;
            setImageElements((prev) => ({ ...prev, [id]: img }));
          }
        };
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [layout.placements]);

  // Render gang sheet onto the interactive Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Physical dimensions in mm
    const filmWidthMm = settings.filmWidthMm;
    const usedLengthMm = Math.max(30, layout.usedLengthMm || 100);

    // Dynamic scale: fit sheet to container with reasonable padding
    const containerWidth = containerRef.current?.clientWidth || 600;
    const baseScale = Math.min((containerWidth - 60) / filmWidthMm, 2.5);
    const scale = baseScale * zoom;

    const canvasWidth = Math.round(filmWidthMm * scale);
    const canvasHeight = Math.round(usedLengthMm * scale);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 1. Draw Transparent Checkerboard Background
    const checkSize = 14;
    const cols = Math.ceil(canvasWidth / checkSize);
    const rows = Math.ceil(canvasHeight / checkSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#e2e8f0';
        ctx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
      }
    }

    // 2. Draw Sheet Outer Boundary & Margins
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    // Margin boundary guide (dashed line)
    const marginPx = settings.marginMm * scale;
    if (marginPx > 0) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        marginPx,
        marginPx,
        canvasWidth - marginPx * 2,
        canvasHeight - marginPx * 2
      );
      ctx.setLineDash([]);
    }

    // 3. Render Each Placement
    layout.placements.forEach((placement) => {
      const isSelected = placement.id === selectedPlacementId;
      const xPx = placement.xMm * scale;
      const yPx = placement.yMm * scale;
      const wPx = placement.widthMm * scale;
      const hPx = placement.heightMm * scale;

      const img = imageElements[placement.assetId];

      ctx.save();

      // If item is rotated 90 degrees
      if (placement.rotated) {
        ctx.translate(xPx + wPx, yPx);
        ctx.rotate(Math.PI / 2);
        if (img && img.complete) {
          drawImageProportional(ctx, img, 0, 0, hPx, wPx, placement.asset?.aspectLocked !== false);
        } else {
          ctx.fillStyle = '#e0e7ff';
          ctx.fillRect(0, 0, hPx, wPx);
        }
      } else {
        if (img && img.complete) {
          drawImageProportional(ctx, img, xPx, yPx, wPx, hPx, placement.asset?.aspectLocked !== false);
        } else {
          ctx.fillStyle = '#e0e7ff';
          ctx.fillRect(xPx, yPx, wPx, hPx);
        }
      }

      ctx.restore();

      // Item border & selection highlight
      ctx.strokeStyle = isSelected ? '#4f46e5' : '#94a3b8';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.setLineDash(isSelected ? [] : [2, 2]);
      ctx.strokeRect(xPx, yPx, wPx, hPx);
      ctx.setLineDash([]);

      // Subtle index label badge
      ctx.fillStyle = isSelected ? '#4f46e5' : 'rgba(30, 41, 59, 0.75)';
      ctx.fillRect(xPx, yPx, 22, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${placement.copyIndex + 1}`, xPx + 11, yPx + 8);
    });
  }, [layout, settings, zoom, selectedPlacementId, imageElements]);

  // Handle canvas clicks to inspect items
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const filmWidthMm = settings.filmWidthMm;
    const containerWidth = containerRef.current?.clientWidth || 600;
    const baseScale = Math.min((containerWidth - 60) / filmWidthMm, 2.5);
    const scale = baseScale * zoom;

    const clickXMm = clickX / scale;
    const clickYMm = clickY / scale;

    const clicked = layout.placements.find(
      (p) =>
        clickXMm >= p.xMm &&
        clickXMm <= p.xMm + p.widthMm &&
        clickYMm >= p.yMm &&
        clickYMm <= p.yMm + p.heightMm
    );

    if (clicked) {
      setSelectedPlacementId(clicked.id);
      onSelectItem(clicked);
    } else {
      setSelectedPlacementId(null);
    }
  };

  const handleRunTrueShape = () => {
    setIsSimulatingTrueShape(true);
    setTimeout(() => {
      setIsSimulatingTrueShape(false);
      onNestingModeChange('true-shape');
    }, 1200);
  };

  // Display length in active unit
  const displayLength = mmToUnit(layout.usedLengthMm, settings.unit);
  const displayFilmWidth = mmToUnit(settings.filmWidthMm, settings.unit);

  return (
    <div className="bg-white rounded-3xl border border-indigo-100 shadow-md shadow-indigo-900/5 p-5 sm:p-6 flex flex-col h-full">
      {/* Top Header: Sheet Length & Unit Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        {/* Left: Title & Big Length Callout */}
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">
              Sheet Preview
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Sheet Length: {settings.lengthMode === 'auto' ? 'Auto' : 'Fixed'}
            </span>
          </div>

          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 font-mono">
              {formatUnit(displayLength, settings.unit, 1)} {settings.unit === 'inch' ? 'in' : settings.unit}
            </span>
            <span className="text-xs font-medium text-slate-400">
              ({formatUnit(settings.filmWidth, settings.unit, 1)} {settings.unit === 'inch' ? 'in' : settings.unit} roll width)
            </span>
          </div>
        </div>

        {/* Right: Unit Selector Pills [mm, cm, meter, inch] */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 text-xs font-semibold">
          {(['mm', 'cm', 'meter', 'inch'] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => onUnitChange(u)}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                settings.unit === u
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Nesting Mode Switcher (Box packing vs True shape) - Exact match for Screenshot 2 */}
      <div className="py-4 border-b border-slate-100">
        <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2.5 flex items-center justify-between">
          <span>Nesting Engine</span>
          <span className="text-[10px] text-indigo-600 lowercase font-medium">
            deterministic geometry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option 1: Box packing (Fast) */}
          <div
            onClick={() => onNestingModeChange('box')}
            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
              settings.nestingAlgorithm === 'box'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500/30'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  settings.nestingAlgorithm === 'box'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                1
              </div>
              <div>
                <div className="font-bold text-xs text-slate-800">Box packing</div>
                <div className="text-[10px] text-slate-500">Now on the film • fast</div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                FILM {formatUnit(displayLength, settings.unit, 1)} {settings.unit === 'inch' ? 'in' : settings.unit}
              </span>
            </div>
          </div>

          {/* Option 2: True shape (Fits closer) */}
          <div
            className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
              settings.nestingAlgorithm === 'true-shape'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500/30'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  settings.nestingAlgorithm === 'true-shape'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                2
              </div>
              <div>
                <div className="font-bold text-xs text-slate-800">True shape</div>
                <div className="text-[10px] text-slate-500">Fits closer • about 40 sec</div>
              </div>
            </div>

            <div>
              <button
                onClick={handleRunTrueShape}
                disabled={isSimulatingTrueShape}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1"
              >
                {isSimulatingTrueShape ? (
                  <span className="animate-pulse">Optimizing...</span>
                ) : (
                  <span>Run</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-2">
          True shape usually saves film. Press Run to calculate interlocking contour packing.
        </p>
      </div>

      {/* Overflow Warning */}
      {layout.overflow && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>
            <strong>Fixed length overflow:</strong> Designs exceed the fixed sheet length. Switch to Auto length or increase sheet length.
          </span>
        </div>
      )}

      {/* Main Canvas Viewport Area */}
      <div className="mt-4 flex-1 flex flex-col min-h-[460px]">
        {/* Canvas Toolbar Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            How it will print
          </span>

          <div className="flex items-center space-x-1.5 bg-slate-100/90 p-1 rounded-xl text-slate-600">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-1 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable / Interactive Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-3xl p-6 overflow-auto flex flex-col items-center justify-start relative shadow-inner select-none"
        >
          {/* Dimension measurement indicators */}
          <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2 px-2">
            <span>Roll Width: {formatUnit(displayFilmWidth, settings.unit, 1)} {settings.unit === 'inch' ? 'in' : settings.unit}</span>
            <span>Total Placed: {layout.totalCopies} copies</span>
            <span>Length: {formatUnit(displayLength, settings.unit, 1)} {settings.unit === 'inch' ? 'in' : settings.unit}</span>
          </div>

          <div className="relative shadow-xl rounded-lg overflow-hidden border border-slate-300">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="block cursor-pointer transition-transform"
            />
          </div>

          {/* Canvas Bottom Callout: "Tap a file to see it big" */}
          <div className="mt-4 flex items-center space-x-1.5 text-xs text-slate-500 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs">
            <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
            <span>Tap a file on the film to inspect details</span>
          </div>
        </div>

        {/* Preflight Stats Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Copies</div>
            <div className="font-extrabold text-slate-800 text-sm mt-0.5">{layout.totalCopies}</div>
          </div>

          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Sheet Length</div>
            <div className="font-extrabold text-slate-800 text-sm mt-0.5">
              {formatUnit(displayLength, settings.unit, 1)} {settings.unit === 'inch' ? 'in' : settings.unit}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Film Waste</div>
            <div className="font-extrabold text-slate-800 text-sm mt-0.5">
              {layout.wastePercent}%
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Print Output</div>
            <div className="font-extrabold text-emerald-600 text-sm mt-0.5">
              {settings.exportDpi} DPI RGBA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

