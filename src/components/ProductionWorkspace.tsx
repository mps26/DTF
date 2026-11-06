import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  MousePointer,
  Grid,
  RotateCw,
  Trash2,
  Copy,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles
} from 'lucide-react';
import { LayoutResult, SheetSettings, Unit, PackedPlacement, ArtworkAsset } from '../types';
import { mmToUnit, formatUnit, MM_PER_INCH } from '../utils/units';
import { Ruler } from './Ruler';

interface ProductionWorkspaceProps {
  layout: LayoutResult;
  settings: SheetSettings;
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  selectedPlacementId: string | null;
  onSelectPlacement: (id: string | null) => void;
  onUpdatePlacementPosition: (placementId: string, xMm: number, yMm: number) => void;
  onRotatePlacement: (placementId: string) => void;
  onDuplicatePlacement: (placementId: string) => void;
  onDeletePlacement: (placementId: string) => void;
  onUpdateSettings: (updates: Partial<SheetSettings>) => void;
  onOpenEditModal: (asset: ArtworkAsset) => void;
}

export const ProductionWorkspace: React.FC<ProductionWorkspaceProps> = ({
  layout,
  settings,
  selectedAssetId,
  onSelectAsset,
  selectedPlacementId,
  onSelectPlacement,
  onUpdatePlacementPosition,
  onRotatePlacement,
  onDuplicatePlacement,
  onDeletePlacement,
  onUpdateSettings,
  onOpenEditModal
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transformation states
  const [zoom, setZoom] = useState<number>(0.85);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [showSpacingGuides, setShowSpacingGuides] = useState<boolean>(true);

  // Interaction dragging states
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPanMouse, setStartPanMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingItem, setIsDraggingItem] = useState<boolean>(false);
  const [dragItemStartPos, setDragItemStartPos] = useState<{ xMm: number; yMm: number }>({ xMm: 0, yMm: 0 });
  const [dragMouseStart, setDragMouseStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Preloaded image elements
  const [imageElements, setImageElements] = useState<Record<string, HTMLImageElement>>({});

  // Scale: pixels per physical mm
  // At zoom = 1, let 1mm = 2.8 pixels (approx 71 DPI on typical 96 DPI display)
  const baseScale = 2.4;
  const scale = baseScale * zoom;

  const filmWidthMm = settings.filmWidthMm;
  const filmLengthMm = Math.max(
    50,
    settings.lengthMode === 'fixed' ? settings.fixedLengthMm : layout.usedLengthMm
  );

  const rollWidthPx = filmWidthMm * scale;
  const rollHeightPx = filmLengthMm * scale;

  // Preload placement images
  useEffect(() => {
    const loaded: Record<string, HTMLImageElement> = {};
    let isCancelled = false;

    layout.placements.forEach((placement) => {
      const asset = placement.asset;
      if (!loaded[asset.id]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = asset.processedUrl || asset.originalUrl;
        img.onload = () => {
          if (!isCancelled) {
            loaded[asset.id] = img;
            setImageElements((prev) => ({ ...prev, [asset.id]: img }));
          }
        };
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [layout.placements]);

  // Fit to screen on initial mount
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const targetW = filmWidthMm * baseScale;
      const targetH = Math.max(100, filmLengthMm) * baseScale;
      const fitZoom = Math.min((clientWidth - 120) / targetW, (clientHeight - 120) / targetH, 1.2);
      setZoom(Math.max(0.3, Math.min(fitZoom, 1.2)));
      setPanOffset({
        x: Math.max(40, (clientWidth - targetW * fitZoom) / 2),
        y: 40
      });
    }
  }, [filmWidthMm]);

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = rollWidthPx;
    canvas.height = rollHeightPx;

    // Clear
    ctx.clearRect(0, 0, rollWidthPx, rollHeightPx);

    // 1. Transparent Checkerboard Background
    const checkSize = 14;
    const cols = Math.ceil(rollWidthPx / checkSize);
    const rows = Math.ceil(rollHeightPx / checkSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#1b2234' : '#141a29';
        ctx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
      }
    }

    // 2. Precision Alignment Grid (10mm or 1 inch)
    if (showGrid) {
      const gridStepMm = settings.unit === 'inch' ? MM_PER_INCH : 10;
      const gridStepPx = gridStepMm * scale;

      ctx.strokeStyle = '#27344e';
      ctx.lineWidth = 0.5;
      ctx.beginPath();

      for (let x = 0; x <= rollWidthPx; x += gridStepPx) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, rollHeightPx);
      }
      for (let y = 0; y <= rollHeightPx; y += gridStepPx) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(rollWidthPx, y + 0.5);
      }
      ctx.stroke();
    }

    // 3. Roll Outer Boundary Line
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, rollWidthPx, rollHeightPx);

    // 4. Margins guide lines (dashed cyan)
    const marginPx = settings.marginMm * scale;
    if (marginPx > 0) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        marginPx,
        marginPx,
        rollWidthPx - marginPx * 2,
        rollHeightPx - marginPx * 2
      );
      ctx.setLineDash([]);
    }

    // 5. Draw Placed Designs
    layout.placements.forEach((placement) => {
      const isSelected =
        placement.id === selectedPlacementId || placement.assetId === selectedAssetId;

      const pxX = placement.xMm * scale;
      const pxY = placement.yMm * scale;
      const pxW = placement.widthMm * scale;
      const pxH = placement.heightMm * scale;

      const img = imageElements[placement.assetId];

      ctx.save();

      // Render image with rotation
      if (placement.rotated) {
        ctx.translate(pxX + pxW, pxY);
        ctx.rotate(Math.PI / 2);
        if (img && img.complete) {
          ctx.drawImage(img, 0, 0, pxH, pxW);
        } else {
          ctx.fillStyle = '#312e81';
          ctx.fillRect(0, 0, pxH, pxW);
        }
      } else {
        if (img && img.complete) {
          ctx.drawImage(img, pxX, pxY, pxW, pxH);
        } else {
          ctx.fillStyle = '#312e81';
          ctx.fillRect(pxX, pxY, pxW, pxH);
        }
      }

      ctx.restore();

      // Draw spacing gap boundary guide
      if (showSpacingGuides && settings.spacingMm > 0) {
        const gapPx = (settings.spacingMm / 2) * scale;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pxX - gapPx, pxY - gapPx, pxW + gapPx * 2, pxH + gapPx * 2);
      }

      // Selection Bounding Box & Handles
      if (isSelected) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.strokeRect(pxX - 1, pxY - 1, pxW + 2, pxH + 2);

        // Corner handles
        const handleSize = 6;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4338ca';
        ctx.lineWidth = 1.5;

        const corners = [
          [pxX - handleSize / 2, pxY - handleSize / 2],
          [pxX + pxW - handleSize / 2, pxY - handleSize / 2],
          [pxX - handleSize / 2, pxY + pxH - handleSize / 2],
          [pxX + pxW - handleSize / 2, pxY + pxH - handleSize / 2]
        ];

        corners.forEach(([hx, hy]) => {
          ctx.fillRect(hx, hy, handleSize, handleSize);
          ctx.strokeRect(hx, hy, handleSize, handleSize);
        });

        // Top rotation handle
        const rotY = pxY - 16;
        const rotX = pxX + pxW / 2;
        ctx.beginPath();
        ctx.moveTo(rotX, pxY);
        ctx.lineTo(rotX, rotY);
        ctx.strokeStyle = '#6366f1';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rotX, rotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#a855f7';
        ctx.fill();
        ctx.stroke();
      } else {
        // Subtle outline for unselected
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pxX, pxY, pxW, pxH);
      }

      // Small index tag
      ctx.fillStyle = isSelected ? '#4f46e5' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(pxX, pxY, 20, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${placement.copyIndex + 1}`, pxX + 10, pxY + 7);
    });
  }, [
    rollWidthPx,
    rollHeightPx,
    layout.placements,
    selectedPlacementId,
    selectedAssetId,
    imageElements,
    scale,
    showGrid,
    showSpacingGuides,
    settings.marginMm,
    settings.spacingMm
  ]);

  // Mouse coordinate converter
  const getCanvasCoords = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { xMm: 0, yMm: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;
    return {
      xMm: xPx / scale,
      yMm: yPx / scale
    };
  };

  // Mouse Handlers for Dragging & Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'pan' || e.button === 1 || e.altKey) {
      setIsPanning(true);
      setStartPanMouse({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const { xMm, yMm } = getCanvasCoords(e);

    // Hit test placements (top to bottom)
    const clicked = [...layout.placements].reverse().find(
      (p) =>
        xMm >= p.xMm &&
        xMm <= p.xMm + p.widthMm &&
        yMm >= p.yMm &&
        yMm <= p.yMm + p.heightMm
    );

    if (clicked) {
      onSelectPlacement(clicked.id);
      onSelectAsset(clicked.assetId);

      setIsDraggingItem(true);
      setDragItemStartPos({ xMm: clicked.xMm, yMm: clicked.yMm });
      setDragMouseStart({ x: e.clientX, y: e.clientY });
    } else {
      onSelectPlacement(null);
      onSelectAsset(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - startPanMouse.x,
        y: e.clientY - startPanMouse.y
      });
      return;
    }

    if (isDraggingItem && selectedPlacementId) {
      const dxPx = e.clientX - dragMouseStart.x;
      const dyPx = e.clientY - dragMouseStart.y;
      const dxMm = dxPx / scale;
      const dyMm = dyPx / scale;

      let newX = dragItemStartPos.xMm + dxMm;
      let newY = dragItemStartPos.yMm + dyMm;

      // Snapping to margins
      if (Math.abs(newX - settings.marginMm) < 2) {
        newX = settings.marginMm;
      }
      if (Math.abs(newY - settings.marginMm) < 2) {
        newY = settings.marginMm;
      }

      onUpdatePlacementPosition(selectedPlacementId, Math.max(0, newX), Math.max(0, newY));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingItem(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.2, Math.min(2.5, z * zoomFactor)));
  };

  const selectedPlacement = layout.placements.find((p) => p.id === selectedPlacementId);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] relative overflow-hidden select-none">
      {/* Top Workspace Toolbar */}
      <div className="h-10 bg-[#0d1220] border-b border-[#1e293b] px-3 flex items-center justify-between text-xs text-slate-300 z-20 flex-shrink-0">
        {/* Left: Tool modes */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'select'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Selection & Move Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('pan')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'pan'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Hand Pan Viewport Tool (H / Spacebar)"
          >
            <Move className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1"></div>

          {/* Grid & Rulers toggles */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded transition-colors ${
              showGrid ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Precision Grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowSpacingGuides(!showSpacingGuides)}
            className={`p-1.5 rounded text-[11px] font-mono px-2 transition-colors ${
              showSpacingGuides ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Spacing Guides"
          >
            Spacing {settings.spacing} {settings.unit === 'inch' ? 'in' : settings.unit}
          </button>
        </div>

        {/* Center: Dimensions & Placement Summary */}
        <div className="flex items-center space-x-3 font-mono text-[11px] text-slate-400">
          <span>
            Roll: <strong className="text-white">{formatUnit(settings.filmWidth, settings.unit, 1)}</strong> ×{' '}
            <strong className="text-white">
              {formatUnit(mmToUnit(filmLengthMm, settings.unit), settings.unit, 1)} {settings.unit === 'inch' ? 'in' : settings.unit}
            </strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Copies: <strong className="text-indigo-400">{layout.totalCopies}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Waste: <strong className="text-emerald-400">{layout.wastePercent}%</strong>
          </span>
        </div>

        {/* Right: Zoom controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center font-mono text-[11px] text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-0.5 rounded hover:bg-slate-800 text-[10px] font-mono text-slate-400 hover:text-white"
            title="100% 1:1 Scale"
          >
            1:1
          </button>
        </div>
      </div>

      {/* Main Viewport Container with CAD Rulers */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`flex-1 relative overflow-hidden bg-[#060911] ${
          activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        {/* Horizontal Top Ruler */}
        {showRulers && (
          <div className="absolute top-0 left-5 right-0 z-10 overflow-hidden border-b border-[#1e293b]">
            <Ruler
              orientation="horizontal"
              length={2400}
              scale={scale}
              unit={settings.unit}
              offset={panOffset.x}
            />
          </div>
        )}

        {/* Vertical Left Ruler */}
        {showRulers && (
          <div className="absolute top-5 left-0 bottom-0 z-10 overflow-hidden border-r border-[#1e293b]">
            <Ruler
              orientation="vertical"
              length={2400}
              scale={scale}
              unit={settings.unit}
              offset={panOffset.y}
            />
          </div>
        )}

        {/* Top-Left Corner Box */}
        {showRulers && (
          <div className="absolute top-0 left-0 w-5 h-5 bg-[#1e2230] z-20 border-r border-b border-[#334155] flex items-center justify-center text-[8px] font-mono text-slate-400 font-bold">
            {settings.unit === 'inch' ? 'in' : 'mm'}
          </div>
        )}

        {/* Movable Canvas Roll Container */}
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y + (showRulers ? 20 : 0)}px)`,
            width: rollWidthPx,
            height: rollHeightPx
          }}
          className="absolute shadow-2xl transition-transform duration-75 ease-out select-none"
        >
          <canvas ref={canvasRef} className="block" />

          {/* Floating Context Toolbar for Selected Placement */}
          {selectedPlacement && (
            <div
              style={{
                left: Math.max(0, selectedPlacement.xMm * scale),
                top: Math.max(0, (selectedPlacement.yMm * scale) - 34)
              }}
              className="absolute z-30 bg-[#0d1222] border border-indigo-500 rounded px-2 py-1 flex items-center space-x-1.5 shadow-xl text-white font-mono text-[10px]"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-bold text-indigo-300">
                {selectedPlacement.asset.filename}
              </span>
              <span className="text-slate-500">|</span>
              <span>
                {formatUnit(mmToUnit(selectedPlacement.widthMm, settings.unit), settings.unit)} ×{' '}
                {formatUnit(mmToUnit(selectedPlacement.heightMm, settings.unit), settings.unit)}
              </span>

              <button
                onClick={() => onRotatePlacement(selectedPlacement.id)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                title="Rotate 90°"
              >
                <RotateCw className="w-3 h-3" />
              </button>

              <button
                onClick={() => onDuplicatePlacement(selectedPlacement.id)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                title="Duplicate copy"
              >
                <Copy className="w-3 h-3" />
              </button>

              <button
                onClick={() => onOpenEditModal(selectedPlacement.asset)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-indigo-400"
                title="Open Studio Image Editor"
              >
                <Sparkles className="w-3 h-3" />
              </button>

              <button
                onClick={() => onDeletePlacement(selectedPlacement.id)}
                className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                title="Remove this placement"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Fixed Length Overflow Banner */}
          {layout.overflow && (
            <div className="absolute bottom-4 left-4 right-4 bg-rose-950/90 border border-rose-700 rounded-lg p-2 flex items-center space-x-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>
                <strong>Warning:</strong> Artwork exceeds fixed sheet length constraint. Switch to Auto length or expand film roll.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
