import React, { useRef, useState, useEffect } from 'react';
import { drawImageProportional } from '../utils/imageProcessing';
import {
  Layers,
  UploadCloud,
  FolderPlus,
  Edit2,
  Trash2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Box,
  Sliders,
  Ruler,
  Printer,
  Recycle,
  Info,
  ChevronDown,
  ChevronUp,
  Scissors,
  LayoutGrid,
  List,
  ExternalLink,
  Copy,
  Download,
  X,
  Eye,
  Sparkles
} from 'lucide-react';
import { ArtworkAsset, SheetSettings, Unit, LayoutResult } from '../types';
import { formatUnit, mmToUnit, unitToMm } from '../utils/units';

interface LayoutSectionProps {
  assets: ArtworkAsset[];
  settings: SheetSettings;
  layout: LayoutResult;
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onUpdateAsset: (id: string, updates: Partial<ArtworkAsset>) => void;
  onDeleteAsset: (id: string) => void;
  onEditAsset: (asset: ArtworkAsset) => void;
  onTrimAsset: (id: string) => void;
  onRemoveBgAsset: (id: string) => void;
  onFilesSelected: (files: FileList | File[]) => void;
  onOpenGallery: () => void;
  onUnitChange: (unit: Unit) => void;
  onUpdateSettings: (updates: Partial<SheetSettings>) => void;
  onNestingModeChange: (mode: 'box' | 'true-shape') => void;
  onOpenPreviewModal: () => void;
  onExportSingleSheet?: (sheetIndex: number) => void;
}

export const LayoutSection: React.FC<LayoutSectionProps> = ({
  assets,
  settings,
  layout,
  selectedAssetId,
  onSelectAsset,
  onUpdateAsset,
  onDeleteAsset,
  onEditAsset,
  onTrimAsset,
  onRemoveBgAsset,
  onFilesSelected,
  onOpenGallery,
  onUnitChange,
  onUpdateSettings,
  onNestingModeChange,
  onOpenPreviewModal,
  onExportSingleSheet
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement>>({});
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(620);
  const [containerHeight, setContainerHeight] = useState<number>(450);
  const [renderedCanvasHeights, setRenderedCanvasHeights] = useState<Record<number, number>>({});
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [sheetZooms, setSheetZooms] = useState<Record<number, number>>({});
  const [sheetFitModes, setSheetFitModes] = useState<Record<number, boolean>>({});
  const [keepCloseTogether, setKeepCloseTogether] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

  // Measure container dimensions to dynamically auto-fit sheet preview
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
        if (entry.contentRect.height > 0) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Ensure Sheet 1 or active selected sheet is smoothly scrolled into view and never clipped
  useEffect(() => {
    const el = canvasRefs.current[selectedSheetIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedSheetIndex]);

  // Local text input states for smooth manual editing without cursor jumps
  const [widthInputs, setWidthInputs] = useState<Record<string, string>>({});
  const [heightInputs, setHeightInputs] = useState<Record<string, string>>({});
  const [copiesInputs, setCopiesInputs] = useState<Record<string, string>>({});
  const [sheetWidthInput, setSheetWidthInput] = useState<string | null>(null);
  const [spacingInput, setSpacingInput] = useState<string | null>(null);
  const [fixedLengthInput, setFixedLengthInput] = useState<string | null>(null);
  const [collapsedCardIds, setCollapsedCardIds] = useState<Record<string, boolean>>({});

  const toggleCardCollapse = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Preload images for canvas
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

  // Canvas rendering effect for each gang sheet (Sheet 1, Sheet 2 beside it)
  useEffect(() => {
    const sheetsToDraw = layout.sheets && layout.sheets.length > 0
      ? layout.sheets
      : [{
          sheetIndex: 0,
          placements: layout.placements,
          usedWidthMm: layout.usedWidthMm || settings.filmWidthMm,
          usedLengthMm: layout.usedLengthMm || settings.fixedLengthMm || 60,
          usedLengthInches: layout.usedLengthInches || (settings.fixedLengthMm ? settings.fixedLengthMm / 25.4 : 2.36),
          usedLengthMeters: layout.usedLengthMeters || (settings.fixedLengthMm ? settings.fixedLengthMm / 1000 : 0.06),
          totalCopies: layout.totalCopies,
          filmAreaMm2: layout.filmAreaMm2,
          artworkAreaMm2: layout.artworkAreaMm2,
          wastePercent: layout.wastePercent
        }];

    const newHeights: Record<number, number> = {};

    sheetsToDraw.forEach((sheet) => {
      const canvas = canvasRefs.current[sheet.sheetIndex];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const filmWidthMm = Math.max(settings.filmWidthMm, sheet.usedWidthMm || settings.filmWidthMm);
      const fallbackLengthMm = settings.fixedLengthMm || 60;
      const usedLengthMm = Math.max(30, sheet.usedLengthMm || fallbackLengthMm);

      // Per-sheet fit mode & zoom scale
      const isFit = sheetFitModes[sheet.sheetIndex] !== false; // default true
      const sheetZoom = sheetZooms[sheet.sheetIndex] || 1;

      // Anchor roll display width & height within fixed container
      const isMobile = containerWidth < 640;
      const availableHeightPx = isMobile ? Math.max(220, containerHeight - 60) : Math.max(220, containerHeight - 130);
      
      // On mobile, reserve space for bracket (75px) and padding (24px) so roll NEVER overflows horizontally in Fit mode
      const maxMobileRollWidth = Math.max(120, containerWidth - 100);
      const targetRollWidthPx = isMobile
        ? Math.min(260, maxMobileRollWidth)
        : (sheetsToDraw.length > 1
            ? Math.min(230, Math.max(120, Math.floor((containerWidth - 100) / sheetsToDraw.length)))
            : Math.min(320, Math.max(160, containerWidth - 180)));

      const scaleX = targetRollWidthPx / filmWidthMm;
      const scaleY = availableHeightPx / usedLengthMm;
      
      let scale: number;
      if (isFit) {
        // Fit mode: scales comfortably into view height and width without overflow
        const baseScale = Math.min(scaleX, Math.max(scaleX * 0.45, Math.min(scaleX, scaleY)));
        scale = baseScale * sheetZoom;
      } else {
        // 100% mode: full scale print display
        scale = scaleX * sheetZoom;
      }

      const canvasWidth = Math.max(60, Math.round(filmWidthMm * scale));
      const canvasHeight = Math.max(60, Math.round(usedLengthMm * scale));

      newHeights[sheet.sheetIndex] = canvasHeight;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // 1. Transparent Checkerboard Background
      const checkSize = 12;
      const cols = Math.ceil(canvasWidth / checkSize);
      const rows = Math.ceil(canvasHeight / checkSize);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#e2e8f0';
          ctx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
        }
      }

      // 2. Film Outer Boundary
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

      // 3. Margin Guide (dashed line)
      const marginPx = settings.marginMm * scale;
      if (marginPx > 0) {
        ctx.setLineDash([4, 4]);
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

      // 4. Draw placed copies on this specific sheet
      sheet.placements.forEach((placement) => {
        const isSelected = placement.assetId === selectedAssetId;

        const pxX = placement.xMm * scale;
        const pxY = placement.yMm * scale;
        const pxW = placement.widthMm * scale;
        const pxH = placement.heightMm * scale;

        const img = images[placement.assetId];

        ctx.save();
        if (placement.rotated) {
          ctx.translate(pxX + pxW, pxY);
          ctx.rotate(Math.PI / 2);
          if (img && img.complete) {
            drawImageProportional(ctx, img, 0, 0, pxH, pxW, placement.asset?.aspectLocked !== false);
          } else {
            ctx.fillStyle = '#e0e7ff';
            ctx.fillRect(0, 0, pxH, pxW);
          }
        } else {
          if (img && img.complete) {
            drawImageProportional(ctx, img, pxX, pxY, pxW, pxH, placement.asset?.aspectLocked !== false);
          } else {
            ctx.fillStyle = '#e0e7ff';
            ctx.fillRect(pxX, pxY, pxW, pxH);
          }
        }
        ctx.restore();

        ctx.strokeStyle = isSelected ? '#4f46e5' : '#cbd5e1';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(pxX, pxY, pxW, pxH);
      });
    });

    setRenderedCanvasHeights(newHeights);
  }, [layout.sheets, layout.placements, settings, selectedAssetId, images, containerWidth, containerHeight, sheetZooms, sheetFitModes]);

  const handleWidthChange = (asset: ArtworkAsset, valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;
    const maxW = mmToUnit(22 * 25.4, settings.unit);
    const clampedVal = Math.round(Math.min(maxW, val) * 100) / 100;

    if (clampedVal > settings.filmWidth) {
      onUpdateSettings({
        filmWidth: clampedVal,
        filmWidthMm: unitToMm(clampedVal, settings.unit),
        filmWidthPreset: clampedVal === 22 ? '22' : clampedVal.toString()
      });
    }

    onUpdateAsset(asset.id, { targetWidth: clampedVal });
  };

  const handleHeightChange = (asset: ArtworkAsset, valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;
    const maxH = mmToUnit(100 * 25.4, settings.unit);
    const clampedVal = Math.round(Math.min(maxH, val) * 100) / 100;

    if (settings.lengthMode === 'fixed' && clampedVal > settings.fixedLength) {
      onUpdateSettings({
        fixedLength: clampedVal,
        fixedLengthMm: unitToMm(clampedVal, settings.unit)
      });
    }

    onUpdateAsset(asset.id, { targetHeight: clampedVal });
  };

  const displayLength = mmToUnit(layout.usedLengthMm, settings.unit);
  const totalCopies = layout.totalCopies;

  return (
    <div className="w-full h-auto lg:h-full min-h-0">
      {/* 2-Column Responsive Layout: Fixed Viewport Height on desktop, natural scroll on mobile */}
      <div className="flex flex-col lg:flex-row gap-5 items-start h-auto lg:h-full min-h-0">
        {/* ================= LEFT COLUMN: INDEPENDENT VERTICAL SCROLLING ================= */}
        <div className="w-full lg:w-[460px] lg:h-full lg:min-h-0 flex-shrink-0 lg:overflow-y-auto overflow-visible lg:pr-2 space-y-4 pb-4 lg:pb-10 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* Card 1: Uploaded Designs */}
          <div className="bg-white rounded-3xl border border-[#E5D9C8] shadow-sm p-4 sm:p-5 flex flex-col space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E5D9C8]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex items-center justify-center text-[#204563]">
                  <Layers className="w-4 h-4 text-[#EF7F1A]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#204563]">
                    Uploaded Designs ({assets.length})
                  </h3>
                  <p className="text-[11px] text-[#526A7B] font-medium">
                    {totalCopies} {totalCopies === 1 ? 'image' : 'images'} ready for layout
                  </p>
                </div>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center bg-[#FAF7F1] border border-[#E5D9C8] p-0.5 rounded-lg text-[#526A7B]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded ${viewMode === 'grid' ? 'bg-[#EF7F1A] text-[#204563] font-bold shadow-xs' : 'hover:text-[#204563]'}`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded ${viewMode === 'list' ? 'bg-[#EF7F1A] text-[#204563] font-bold shadow-xs' : 'hover:text-[#204563]'}`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Toggle: Keep each design close together */}
            <div className="flex items-center justify-between py-1 px-1">
              <span className="text-xs font-semibold text-[#204563] flex items-center space-x-1">
                <span>Keep each design close together</span>
                <Info className="w-3.5 h-3.5 text-[#526A7B]" />
              </span>

              <button
                onClick={() => setKeepCloseTogether(!keepCloseTogether)}
                className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                  keepCloseTogether ? 'bg-[#EF7F1A]' : 'bg-[#E5D9C8]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                    keepCloseTogether ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Uploaded Design Cards List & Integrated Dropzone (NO OVERLAPPING!) */}
            <div className="space-y-4">
              {assets.map((asset, index) => {
                const isSelected = selectedAssetId === asset.id;
                const isCollapsed = collapsedCardIds[asset.id] ?? false;
                const actualPrintW = asset.cropBox
                  ? (asset.targetWidth * (asset.cropBox.width / asset.originalWidth)).toFixed(2)
                  : asset.targetWidth.toFixed(2);
                const actualPrintH = asset.cropBox
                  ? (asset.targetHeight * (asset.cropBox.height / asset.originalHeight)).toFixed(2)
                  : asset.targetHeight.toFixed(2);

                const currentWidthVal = widthInputs[asset.id] !== undefined
                  ? widthInputs[asset.id]
                  : parseFloat(Number(asset.targetWidth || 0).toFixed(2)).toString();

                const currentHeightVal = heightInputs[asset.id] !== undefined
                  ? heightInputs[asset.id]
                  : parseFloat(Number(asset.targetHeight || 0).toFixed(2)).toString();

                const currentCopiesVal = copiesInputs[asset.id] !== undefined
                  ? copiesInputs[asset.id]
                  : (asset.copies || 1).toString();

                return (
                  <div
                    key={asset.id}
                    onClick={() => onSelectAsset(asset.id)}
                    className={`rounded-3xl border transition-all shadow-sm overflow-hidden relative ${
                      isSelected
                        ? 'border-[#EF7F1A] ring-2 ring-[#EF7F1A]/25'
                        : 'border-[#E5D9C8] hover:border-[#EF7F1A]'
                    }`}
                  >
                    {/* Soft Warm-Beige Header with Thumbnail, Filename, DPI Badge & Orange Circle Badge */}
                    <div
                      className="bg-[#FAF7F1] p-3 sm:p-4 pb-2.5 sm:pb-3 flex items-start space-x-3 sm:space-x-3.5 relative cursor-pointer select-none border-b border-[#E5D9C8]"
                      onClick={(e) => toggleCardCollapse(asset.id, e)}
                    >
                      {/* Orange Index Badge & Collapse Chevron at top-right */}
                      <div className="absolute top-2.5 sm:top-3.5 right-2.5 sm:right-3.5 flex items-center space-x-1.5 sm:space-x-2 z-10">
                        <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#EF7F1A] text-[#204563] font-black text-[11px] sm:text-xs flex items-center justify-center shadow-xs">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => toggleCardCollapse(asset.id, e)}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/80 hover:bg-white text-slate-500 flex items-center justify-center shadow-2xs transition-colors"
                          title={isCollapsed ? 'Expand card' : 'Collapse card'}
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-3 h-3 text-[#204563]" />
                          ) : (
                            <ChevronUp className="w-3 h-3 text-[#204563]" />
                          )}
                        </button>
                      </div>

                      {/* Square Thumbnail with Checkerboard */}
                      <div
                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 overflow-hidden relative flex-shrink-0 shadow-inner flex items-center justify-center"
                        style={{
                          backgroundImage: `
                            linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                            linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                            linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)
                          `,
                          backgroundSize: '8px 8px'
                        }}
                      >
                        <img
                          src={asset.processedUrl || asset.originalUrl}
                          alt={asset.filename}
                          className="w-full h-full object-contain p-0.5 sm:p-1"
                        />
                      </div>

                      {/* Filename & DPI Badge with Yellow Info Icon */}
                      <div className="min-w-0 flex-1 pt-0.5 pr-14">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-800 truncate leading-snug">
                          {asset.filename}
                        </h4>
                        <div className="flex items-center space-x-1.5 mt-1 sm:mt-1.5">
                          <span className="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-2xs">
                            {asset.effectiveDpi} DPI
                          </span>
                          <span
                            className="text-[#EAB308] font-bold text-xs cursor-pointer hover:text-amber-600"
                            title={`Original: ${asset.originalWidth} × ${asset.originalHeight} px`}
                          >
                            ⓘ
                          </span>
                        </div>
                        {isCollapsed && (
                          <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-1 font-mono">
                            {asset.targetWidth}" × {asset.targetHeight}" • {asset.copies || 1} {asset.copies === 1 ? 'copy' : 'copies'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* White Body Section: Only displayed when not collapsed */}
                    {!isCollapsed && (
                      <div className="bg-white p-3 sm:p-4 pt-2.5 sm:pt-3.5 flex flex-col">
                        {/* Dimensions Section: WIDTH and HEIGHT (Clean 2-column manual number inputs) */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-1.5">
                          {/* WIDTH */}
                          <div>
                            <label className="block text-[9px] sm:text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-0.5 sm:mb-1">
                              WIDTH
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={currentWidthVal}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => {
                                  e.stopPropagation();
                                  setWidthInputs((prev) => ({ ...prev, [asset.id]: parseFloat(Number(asset.targetWidth || 0).toFixed(2)).toString() }));
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const text = e.target.value;
                                  setWidthInputs((prev) => ({ ...prev, [asset.id]: text }));
                                  const val = parseFloat(text);
                                  if (!isNaN(val) && val > 0) {
                                    const maxW = mmToUnit(22 * 25.4, settings.unit);
                                    const clampedVal = parseFloat(Math.min(maxW, val).toFixed(2));
                                    onUpdateAsset(asset.id, { targetWidth: clampedVal });
                                  }
                                }}
                                onBlur={() => {
                                  setWidthInputs((prev) => {
                                    const copy = { ...prev };
                                    delete copy[asset.id];
                                    return copy;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-full h-8.5 bg-white border border-[#E5D9C8] rounded-xl px-2.5 py-1 text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A] pr-10 sm:pr-14 font-mono shadow-2xs"
                              />
                              <span className="absolute right-2 sm:right-3 text-[10px] sm:text-xs text-[#526A7B] font-bold pointer-events-none">
                                {settings.unit === 'inch' ? 'in' : settings.unit === 'meter' ? 'm' : settings.unit}
                              </span>
                            </div>
                          </div>

                          {/* HEIGHT */}
                          <div>
                            <label className="block text-[9px] sm:text-[10px] font-bold tracking-wider text-[#526A7B] uppercase mb-0.5 sm:mb-1">
                              HEIGHT
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={currentHeightVal}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => {
                                  e.stopPropagation();
                                  setHeightInputs((prev) => ({ ...prev, [asset.id]: parseFloat(Number(asset.targetHeight || 0).toFixed(2)).toString() }));
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const text = e.target.value;
                                  setHeightInputs((prev) => ({ ...prev, [asset.id]: text }));
                                  const val = parseFloat(text);
                                  if (!isNaN(val) && val > 0) {
                                    const maxH = mmToUnit(100 * 25.4, settings.unit);
                                    const clampedVal = parseFloat(Math.min(maxH, val).toFixed(2));
                                    onUpdateAsset(asset.id, { targetHeight: clampedVal });
                                  }
                                }}
                                onBlur={() => {
                                  setHeightInputs((prev) => {
                                    const copy = { ...prev };
                                    delete copy[asset.id];
                                    return copy;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-full h-8.5 bg-white border border-[#E5D9C8] rounded-xl px-2.5 py-1 text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A] pr-10 sm:pr-14 font-mono shadow-2xs"
                              />
                              <span className="absolute right-2 sm:right-3 text-[10px] sm:text-xs text-[#526A7B] font-bold pointer-events-none">
                                {settings.unit === 'inch' ? 'in' : settings.unit === 'meter' ? 'm' : settings.unit}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Original Resolution */}
                        <div className="text-[11px] sm:text-xs text-[#526A7B] font-medium mb-2">
                          Original: {asset.originalWidth} × {asset.originalHeight} px
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[#E5D9C8] my-1.5" />

                        {/* Lock Aspect Ratio Toggle */}
                        <div
                          className="flex items-center space-x-2 py-0.5 mb-2 select-none"
                          title="Lock Aspect Ratio is permanently enabled"
                        >
                          <button
                            type="button"
                            aria-pressed={true}
                            disabled
                            className="w-8 h-4.5 rounded-full transition-colors relative p-0.5 bg-[#204563] cursor-default opacity-100"
                          >
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform translate-x-3.5" />
                          </button>
                          <span className="text-[11px] sm:text-xs font-semibold text-[#204563]">
                            Lock Aspect Ratio
                          </span>
                        </div>

                        {/* Copies on sheet row */}
                        <div className="flex items-center justify-between bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-2 mb-2.5">
                          <span className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copies on sheet</span>
                          </span>

                          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextVal = Math.max(1, (asset.copies || 1) - 1);
                                setCopiesInputs((prev) => ({ ...prev, [asset.id]: nextVal.toString() }));
                                onUpdateAsset(asset.id, { copies: nextVal });
                              }}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors font-bold text-xs"
                            >
                              –
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={currentCopiesVal}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => {
                                e.stopPropagation();
                                setCopiesInputs((prev) => ({ ...prev, [asset.id]: (asset.copies || 1).toString() }));
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                const text = e.target.value;
                                setCopiesInputs((prev) => ({ ...prev, [asset.id]: text }));
                                const val = parseInt(text);
                                if (!isNaN(val) && val > 0) {
                                  onUpdateAsset(asset.id, { copies: val });
                                }
                              }}
                              onBlur={() => {
                                setCopiesInputs((prev) => {
                                  const copy = { ...prev };
                                  delete copy[asset.id];
                                  return copy;
                                });
                              }}
                              className="w-9 text-center font-bold text-xs text-slate-900 bg-transparent focus:outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextVal = (asset.copies || 1) + 1;
                                setCopiesInputs((prev) => ({ ...prev, [asset.id]: nextVal.toString() }));
                                onUpdateAsset(asset.id, { copies: nextVal });
                              }}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Bottom Action buttons: [✎ Edit] and [🗑] */}
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onEditAsset(asset)}
                            className="flex-1 h-8.5 rounded-xl border border-[#E5D9C8] text-[#204563] bg-white hover:bg-[#FAF7F1] font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-2xs"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#526A7B]" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAsset(asset.id)}
                            className="w-11 h-8.5 rounded-xl border border-[#E5D9C8] text-[#526A7B] bg-white hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs flex items-center justify-center"
                            title="Delete design"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Upload Dropzone Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E5D9C8] hover:border-[#EF7F1A] bg-[#FAF7F1] hover:bg-[#F3EBDD]/60 rounded-2xl p-3.5 sm:p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-1.5"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={settings.mode === 'multiple'}
                  accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) onFilesSelected(e.target.files);
                  }}
                />

                <div className="w-8 h-8 rounded-full bg-[#E8DDCA] text-[#204563] flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-4 h-4 text-[#EF7F1A]" />
                </div>

                <div>
                  <div className="font-bold text-xs text-[#204563]">
                    Drop more designs here or click to browse
                  </div>
                  <div className="text-[10px] text-[#526A7B] font-medium mt-0.5">
                    PNG, JPG, JPEG, PDF • Max 100 MB each
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3.5 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-extrabold rounded-xl text-xs shadow-sm shadow-orange-500/25 transition-all"
                  >
                    Browse Files
                  </button>
                  <button
                    type="button"
                    onClick={onOpenGallery}
                    className="h-8 px-3 bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] font-bold rounded-xl text-xs transition-colors shadow-2xs"
                  >
                    Add from Gallery
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Nesting Engine */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5D9C8] shadow-sm p-3.5 sm:p-5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-extrabold text-xs text-[#204563] flex items-center space-x-1.5">
                <Box className="w-3.5 h-3.5 text-[#EF7F1A]" />
                <span>Nesting Engine</span>
              </span>
              <Info className="w-3 h-3 text-[#526A7B]" />
            </div>

            <div className="space-y-2 text-xs">
              {/* Option 1: Box Packing */}
              <div
                onClick={() => onNestingModeChange('box')}
                className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  settings.nestingAlgorithm === 'box'
                    ? 'border-[#EF7F1A] bg-[#FAF7F1] shadow-xs ring-1 ring-[#EF7F1A]/20'
                    : 'border-[#E5D9C8] hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      settings.nestingAlgorithm === 'box'
                        ? 'border-[#EF7F1A] bg-white'
                        : 'border-[#E5D9C8]'
                    }`}
                  >
                    {settings.nestingAlgorithm === 'box' && (
                      <div className="w-2 h-2 rounded-full bg-[#EF7F1A]" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#204563]">Box packing</div>
                    <div className="text-[10px] text-[#526A7B]">Now on the film • fast</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-[#526A7B] uppercase font-semibold block">FILM</span>
                  <span className="font-mono font-bold text-[#204563] text-xs">
                    {formatUnit(displayLength, settings.unit, 2)} {settings.unit === 'meter' ? 'm' : settings.unit === 'inch' ? 'inch' : settings.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Sheet Settings (Professional, responsive, consistent heights) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5D9C8] shadow-sm p-3.5 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#E5D9C8]">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#204563]" />
                <h3 className="font-extrabold text-xs text-[#204563] uppercase tracking-wider">
                  Sheet Settings
                </h3>
              </div>
              <span className="text-[10px] font-bold text-[#204563] bg-[#FAF7F1] border border-[#E5D9C8] px-2 py-0.5 rounded-full">
                Max: 22" × 100"
              </span>
            </div>

            {/* Row 1: Sheet Width */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#204563]">Sheet Width</span>
                <span className="block text-[10px] text-[#526A7B]">Max 22 inches</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={sheetWidthInput !== null ? sheetWidthInput : settings.filmWidth.toString()}
                  onFocus={() => setSheetWidthInput(settings.filmWidth.toString())}
                  onChange={(e) => {
                    const text = e.target.value;
                    setSheetWidthInput(text);
                    const val = parseFloat(text);
                    if (!isNaN(val) && val > 0) {
                      const clamped = Math.min(24, Math.max(1, val));
                      onUpdateSettings({
                        filmWidth: clamped,
                        filmWidthMm: unitToMm(clamped, 'inch'),
                        filmWidthPreset: clamped.toString()
                      });
                    }
                  }}
                  onBlur={() => {
                    setSheetWidthInput(null);
                  }}
                  className="w-28 sm:w-32 h-8.5 bg-white border border-[#E5D9C8] rounded-xl px-2.5 py-1 text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A] pr-12 font-mono shadow-2xs"
                />
                <span className="absolute right-2.5 text-[11px] sm:text-xs text-[#526A7B] font-medium pointer-events-none">
                  inches
                </span>
              </div>
            </div>

            {/* Row 2: Spacing in mm */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#204563]">Spacing</span>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={spacingInput !== null ? spacingInput : (Math.round((settings.spacingMm ?? 5) * 100) / 100).toString()}
                  onFocus={() => setSpacingInput((Math.round((settings.spacingMm ?? 5) * 100) / 100).toString())}
                  onChange={(e) => {
                    const text = e.target.value;
                    setSpacingInput(text);
                    const val = parseFloat(text);
                    if (!isNaN(val) && val >= 5) {
                      onUpdateSettings({
                        spacingMm: val,
                        spacing: Math.round(mmToUnit(val, settings.unit) * 1000) / 1000
                      });
                    }
                  }}
                  onBlur={() => {
                    const val = spacingInput !== null ? parseFloat(spacingInput) : settings.spacingMm;
                    const clamped = isNaN(val) ? Math.max(5, settings.spacingMm ?? 5) : Math.max(5, val);
                    const rounded = Math.round(clamped * 100) / 100;
                    onUpdateSettings({
                      spacingMm: rounded,
                      spacing: Math.round(mmToUnit(rounded, settings.unit) * 1000) / 1000
                    });
                    setSpacingInput(null);
                  }}
                  className="w-28 sm:w-32 h-8.5 bg-white border border-[#E5D9C8] rounded-xl px-2.5 py-1 text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A] pr-10 font-mono shadow-2xs"
                />
                <span className="absolute right-2.5 text-[11px] sm:text-xs text-[#526A7B] font-medium pointer-events-none">
                  mm
                </span>
              </div>
            </div>

            {/* Row 3: Sheet Length Toggle */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="font-bold text-[#204563]">Sheet Length</span>
              <div className="h-8.5 flex items-center bg-[#FAF7F1] p-0.5 rounded-xl border border-[#E5D9C8] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ lengthMode: 'auto' })}
                  className={`h-7 px-3 rounded-lg transition-all ${
                    settings.lengthMode === 'auto'
                      ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-xs'
                      : 'text-[#526A7B] hover:text-[#204563]'
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ lengthMode: 'fixed' })}
                  className={`h-7 px-3 rounded-lg transition-all ${
                    settings.lengthMode === 'fixed'
                      ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-xs'
                      : 'text-[#526A7B] hover:text-[#204563]'
                  }`}
                >
                  Fixed
                </button>
              </div>
            </div>

            {/* Row 3b: Dedicated Fixed Sheet Length Numeric Input or Auto Calculated Info */}
            {settings.lengthMode === 'fixed' ? (
              <div className="bg-[#FAF7F1] border border-[#E5D9C8] rounded-2xl p-3 space-y-2 transition-all">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-[#204563] block text-xs">Fixed Sheet Length</span>
                    <span className="text-[10px] text-[#526A7B] font-medium">Desired sheet length</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        fixedLengthInput !== null
                          ? fixedLengthInput
                          : parseFloat(Number(settings.fixedLength || 24).toFixed(2)).toString()
                      }
                      onFocus={() => {
                        setFixedLengthInput(parseFloat(Number(settings.fixedLength || 24).toFixed(2)).toString());
                      }}
                      onChange={(e) => {
                        const text = e.target.value;
                        setFixedLengthInput(text);
                        const val = parseFloat(text);
                        if (!isNaN(val) && val > 0) {
                          onUpdateSettings({ fixedLength: val });
                        }
                      }}
                      onBlur={() => {
                        if (fixedLengthInput !== null) {
                          const val = parseFloat(fixedLengthInput);
                          if (!isNaN(val) && val > 0) {
                            const cleanVal = parseFloat(val.toFixed(2));
                            onUpdateSettings({ fixedLength: cleanVal });
                          }
                          setFixedLengthInput(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      placeholder="24"
                      className="w-24 sm:w-28 h-8 bg-white border border-[#E5D9C8] rounded-xl px-2.5 py-1 text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A] pr-10 font-mono shadow-2xs text-center"
                    />
                    <span className="absolute right-2 text-[10px] sm:text-[11px] text-[#526A7B] font-bold pointer-events-none uppercase">
                      {settings.unit === 'inch' ? 'in' : settings.unit === 'meter' ? 'm' : settings.unit}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-[#526A7B] font-medium leading-relaxed">
                  Enter your required sheet length (e.g. 24, 36, 48, 60).
                </p>

                {/* Multi-Sheet Warning if artwork exceeds fixed length */}
                {layout.sheets.length > 1 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-[11px] font-medium space-y-1">
                    <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>Exceeds {parseFloat(Number(settings.fixedLength || 24).toFixed(2))} {settings.unit === 'inch' ? 'in' : settings.unit}</span>
                    </div>
                    <p className="text-[10px] text-amber-700 leading-snug">
                      Your artwork layout requires {parseFloat(mmToUnit(layout.usedLengthMm, settings.unit).toFixed(2))} {settings.unit === 'inch' ? 'in' : settings.unit} and is split across {layout.sheets.length} gang sheets.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const neededInUnit = parseFloat(mmToUnit(layout.usedLengthMm, settings.unit).toFixed(2));
                        onUpdateSettings({ fixedLength: neededInUnit });
                      }}
                      className="inline-flex items-center text-[10px] font-bold text-[#EF7F1A] hover:text-[#d96e12] underline cursor-pointer"
                    >
                      Expand length to {parseFloat(mmToUnit(layout.usedLengthMm, settings.unit).toFixed(2))} {settings.unit === 'inch' ? 'in' : settings.unit} to fit on 1 sheet →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#FAF7F1] border border-[#E5D9C8] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-[#204563] block text-xs">Calculated Sheet Length</span>
                  <span className="text-[10px] text-[#526A7B] font-medium">Automatic height based on designs</span>
                </div>
                <div className="flex items-baseline space-x-1 font-mono font-black text-[#204563] text-xs sm:text-sm bg-white px-2.5 py-1 rounded-xl border border-[#E5D9C8] shadow-2xs">
                  <span>{layout.usedLengthInches.toFixed(2)}</span>
                  <span className="text-[10px] text-[#526A7B] font-bold uppercase">in</span>
                </div>
              </div>
            )}

            {/* Row 4: Copies for all */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copies for all</span>
              </span>

              <div className="h-8.5 flex items-center space-x-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    assets.forEach((a) => {
                      const next = Math.max(1, (a.copies || 1) - 1);
                      onUpdateAsset(a.id, { copies: next });
                    });
                  }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors font-bold text-xs"
                >
                  –
                </button>
                <input
                  type="number"
                  min="1"
                  placeholder="Set"
                  value={assets.length > 0 ? (assets[0].copies || 1) : 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      assets.forEach((a) => onUpdateAsset(a.id, { copies: val }));
                    }
                  }}
                  className="w-10 text-center font-bold text-xs text-slate-900 bg-transparent focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    assets.forEach((a) => {
                      const next = (a.copies || 1) + 1;
                      onUpdateAsset(a.id, { copies: next });
                    });
                  }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors font-bold text-xs"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Four Metrics Cards (Clean 2-Column Responsive Grid) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Card 1: TOTAL COPIES */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5D9C8] shadow-sm p-3 sm:p-4 flex flex-col justify-between h-22 sm:h-26">
              <div className="flex items-center space-x-1.5 text-[#204563]">
                <Layers className="w-4 h-4 text-[#EF7F1A]" />
                <span className="font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-[#526A7B]">
                  Total Copies
                </span>
              </div>
              <div className="font-black text-[#204563] text-xl sm:text-2xl font-mono mt-1">
                {totalCopies}
              </div>
            </div>

            {/* Card 2: SHEET LENGTH */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5D9C8] shadow-sm p-3 sm:p-4 flex flex-col justify-between h-22 sm:h-26">
              <div className="flex items-center space-x-1.5 text-[#204563]">
                <Ruler className="w-4 h-4 text-[#EF7F1A]" />
                <span className="font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-[#526A7B]">
                  Sheet Length
                </span>
              </div>
              <div className="font-black text-[#204563] text-xl sm:text-2xl font-mono mt-1">
                {layout.usedLengthMeters.toFixed(2)} m
              </div>
            </div>

            {/* Card 3: PRINT OUTPUT */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5D9C8] shadow-sm p-3 sm:p-4 flex flex-col justify-between h-22 sm:h-26">
              <div className="flex items-center space-x-1.5 text-emerald-600">
                <Printer className="w-4 h-4 text-emerald-500" />
                <span className="font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-[#526A7B]">
                  Print Output
                </span>
              </div>
              <div className="font-black text-emerald-600 text-xs sm:text-sm font-mono mt-1">
                300 DPI RGBA
              </div>
            </div>

            {/* Card 4: FILM WASTE */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5D9C8] shadow-sm p-3 sm:p-4 flex flex-col justify-between h-22 sm:h-26">
              <div className="flex items-center space-x-1.5 text-teal-600">
                <Recycle className="w-4 h-4 text-teal-500" />
                <span className="font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-[#526A7B]">
                  Film Waste
                </span>
              </div>
              <div className="font-black text-[#204563] text-xl sm:text-2xl font-mono mt-1">
                {layout.wastePercent}%
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: FIXED SHEET PREVIEW ================= */}
        <div id="sheet-preview-section" className="w-full lg:flex-1 lg:h-full min-h-[380px] lg:min-h-0 bg-white rounded-3xl border border-[#E5D9C8] shadow-sm p-4 sm:p-5 flex flex-col space-y-3 overflow-hidden mt-4 lg:mt-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2.5 border-b border-[#E5D9C8] gap-3 flex-shrink-0">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-lg text-[#204563]">Sheet Preview</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF7F1] border border-[#E5D9C8] text-[#526A7B]">
                  Sheet Length: {settings.lengthMode === 'fixed' ? 'Fixed' : 'Auto'}
                </span>
              </div>

              {/* Length Callout */}
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-[#204563] font-mono tracking-tight">
                  {formatUnit(displayLength, settings.unit, 2)} {settings.unit === 'meter' ? 'meters' : settings.unit === 'inch' ? 'in' : settings.unit}
                </span>
              </div>
            </div>

            {/* Unit Selector Pills */}
            <div className="flex items-center space-x-1 p-1 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-semibold">
              {(['mm', 'cm', 'meter', 'inch'] as Unit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => onUnitChange(u)}
                  className={`px-3.5 py-1.5 rounded-lg transition-all ${
                    settings.unit === u
                      ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-xs'
                      : 'text-[#526A7B] hover:text-[#204563]'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Row: HOW IT WILL PRINT (left) | Tap a file to see it big (center) | Maximize (right) */}
          <div className="flex items-center justify-between pt-0.5 flex-shrink-0 relative">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526A7B]">
              How it will print
            </span>

            {/* Centered 'Tap a file to see it big' option matching Image 2 & 3 */}
            <button
              onClick={onOpenPreviewModal}
              className="flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-semibold text-[#204563] bg-white border border-[#E5D9C8] shadow-2xs hover:bg-[#FAF7F1] hover:text-[#EF7F1A] transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#EF7F1A]" />
              <span>Tap a file to see it big</span>
            </button>

            <button
              onClick={onOpenPreviewModal}
              className="p-1 rounded-lg text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1] transition-colors"
              title="Full-screen preview"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Vertical Canvas Container with Dynamic Framing & Blueprint Grid */}
          <div
            ref={canvasContainerRef}
            className="flex-1 min-h-[220px] sm:min-h-[280px] w-full bg-slate-50/80 border border-slate-200 rounded-2xl sm:rounded-3xl p-2.5 sm:p-6 flex flex-col items-center justify-start overflow-y-auto overflow-x-auto shadow-inner relative select-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-transparent"
            style={{
              backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          >
            {/* Centered Roll Previews (Beside each other on desktop, active sheet on mobile) */}
            <div className="w-full flex items-start justify-center space-x-4 sm:space-x-8 p-1 sm:p-2 pb-3 transition-all">
              {((containerWidth < 640 && layout.sheets && layout.sheets.length > 1)
                ? layout.sheets.filter((s) => s.sheetIndex === selectedSheetIndex)
                : (layout.sheets && layout.sheets.length > 0
                    ? layout.sheets
                    : [{
                        sheetIndex: 0,
                        placements: layout.placements,
                        usedWidthMm: layout.usedWidthMm,
                        usedLengthMm: layout.usedLengthMm,
                        usedLengthInches: layout.usedLengthInches,
                        usedLengthMeters: layout.usedLengthMeters,
                        totalCopies: layout.totalCopies,
                        filmAreaMm2: layout.filmAreaMm2,
                        artworkAreaMm2: layout.artworkAreaMm2,
                        wastePercent: layout.wastePercent
                      }]
                  )
              ).map((sheet) => {
                const sheetDisplayLength = mmToUnit(sheet.usedLengthMm, settings.unit);
                const sheetHeight = renderedCanvasHeights[sheet.sheetIndex] || 180;

                const isSelectedSheet = selectedSheetIndex === sheet.sheetIndex;

                return (
                  <div
                    key={sheet.sheetIndex}
                    onClick={() => setSelectedSheetIndex(sheet.sheetIndex)}
                    className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
                  >
                    {/* Top width / sheet label pill */}
                    <div
                      className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold shadow-2xs mb-2.5 flex-shrink-0 transition-all ${
                        isSelectedSheet
                          ? 'bg-[#204563] text-white ring-2 ring-[#EF7F1A] shadow-md'
                          : 'bg-white/95 border border-[#E5D9C8] text-[#204563] hover:border-[#EF7F1A]'
                      }`}
                    >
                      {layout.sheets && layout.sheets.length > 1 ? (
                        <>
                          <span className={isSelectedSheet ? 'text-white font-black' : 'text-[#EF7F1A] font-black'}>
                            Sheet {sheet.sheetIndex + 1}
                          </span>
                          <span className={isSelectedSheet ? 'text-[#EF7F1A]' : 'text-slate-400'}>•</span>
                          <span>{sheet.totalCopies} {sheet.totalCopies === 1 ? 'copy' : 'copies'}</span>
                          <span className={isSelectedSheet ? 'text-[#EF7F1A]' : 'text-slate-400'}>•</span>
                          <span>{Math.round((sheet.usedWidthMm ? sheet.usedWidthMm / 25.4 : settings.filmWidth) * 10) / 10}" wide</span>
                          {isSelectedSheet && (
                            <span className="ml-1 px-1.5 py-0.2 bg-[#EF7F1A] text-[#204563] rounded text-[9px] uppercase tracking-wider font-extrabold">
                              Active
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-[#EF7F1A] font-bold">↔</span>
                          <span>{Math.round((layout.usedWidthMm ? layout.usedWidthMm / 25.4 : settings.filmWidth) * 10) / 10}" wide</span>
                        </>
                      )}
                    </div>

                    {/* Canvas and Proportional Bracket */}
                    <div className="flex items-start justify-center space-x-2.5 transition-all">
                      {/* Canvas with checkerboard border */}
                      <div className={`rounded-xl overflow-hidden flex-shrink-0 transition-all bg-white ${
                        isSelectedSheet
                          ? 'ring-3 ring-[#EF7F1A] shadow-xl'
                          : 'border border-[#E5D9C8] shadow-md group-hover:border-[#EF7F1A]'
                      }`}>
                        <canvas
                          ref={(el) => {
                            if (el) canvasRefs.current[sheet.sheetIndex] = el;
                          }}
                          className="block cursor-pointer transition-all"
                        />
                      </div>

                      {/* Right Bracket & Callout with dynamic proportional height */}
                      <div className="flex items-center space-x-1.5 flex-shrink-0 font-mono text-xs ml-1">
                        <div
                          className={`w-2 sm:w-2.5 border-r-2 border-t-2 border-b-2 rounded-r-md transition-all duration-150 ${
                            isSelectedSheet ? 'border-[#EF7F1A]' : 'border-[#204563]'
                          }`}
                          style={{ height: Math.max(40, sheetHeight * 0.95) }}
                        />
                        <div>
                          <div className="font-extrabold text-[11px] sm:text-xs text-[#204563] font-mono leading-tight">
                            {formatUnit(sheetDisplayLength, settings.unit, 2)} {settings.unit === 'meter' ? 'm' : settings.unit === 'inch' ? 'in' : settings.unit}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-[#526A7B] font-medium">
                            {Math.round((sheet.usedWidthMm ? sheet.usedWidthMm / 25.4 : settings.filmWidth) * 10) / 10}" wide
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas Zoom Toolbar & Active Sheet Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-1 text-[#526A7B] text-xs flex-shrink-0 border-t border-[#E5D9C8]">
            {/* Sheet Selector Tabs when multiple sheets exist */}
            {layout.sheets && layout.sheets.length > 1 ? (
              <div className="flex items-center space-x-1 p-1 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl max-w-full overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold uppercase text-[#526A7B] px-1 shrink-0">Sheet:</span>
                {layout.sheets.map((s) => (
                  <button
                    key={s.sheetIndex}
                    onClick={() => setSelectedSheetIndex(s.sheetIndex)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      selectedSheetIndex === s.sheetIndex
                        ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-xs'
                        : 'text-[#526A7B] hover:text-[#204563] hover:bg-[#E8DDCA]/60'
                    }`}
                  >
                    Sheet {s.sheetIndex + 1}
                  </button>
                ))}
              </div>
            ) : <div />}

            {/* Selected Sheet Zoom, Fit, 100%, and Download */}
            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-2">
              <div className="flex items-center space-x-1 bg-[#FAF7F1] border border-[#E5D9C8] p-1 rounded-xl font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: false }));
                    setSheetZooms((prev) => ({
                      ...prev,
                      [selectedSheetIndex]: Math.max(0.3, (prev[selectedSheetIndex] || 1) - 0.15)
                    }));
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white text-[#204563] hover:text-[#EF7F1A] transition-colors font-bold"
                  title="Zoom Out selected sheet"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <span className="font-mono text-xs font-bold text-[#204563] min-w-10 text-center">
                  {Math.round((sheetZooms[selectedSheetIndex] || 1) * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: false }));
                    setSheetZooms((prev) => ({
                      ...prev,
                      [selectedSheetIndex]: Math.min(3.0, (prev[selectedSheetIndex] || 1) + 0.15)
                    }));
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white text-[#204563] hover:text-[#EF7F1A] transition-colors font-bold"
                  title="Zoom In selected sheet"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-[#E5D9C8] mx-1" />

                {/* Fit Button for Selected Sheet */}
                <button
                  type="button"
                  onClick={() => {
                    setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: true }));
                    setSheetZooms((prev) => ({ ...prev, [selectedSheetIndex]: 1 }));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    sheetFitModes[selectedSheetIndex] !== false
                      ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-xs'
                      : 'text-[#526A7B] hover:text-[#204563]'
                  }`}
                  title="Fit selected sheet into preview"
                >
                  Fit
                </button>

                {/* 100% Button for Selected Sheet */}
                <button
                  type="button"
                  onClick={() => {
                    setSheetFitModes((prev) => ({ ...prev, [selectedSheetIndex]: false }));
                    setSheetZooms((prev) => ({ ...prev, [selectedSheetIndex]: 1.0 }));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    sheetFitModes[selectedSheetIndex] === false && (sheetZooms[selectedSheetIndex] || 1) === 1.0
                      ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-xs'
                      : 'text-[#526A7B] hover:text-[#204563]'
                  }`}
                  title="View selected sheet at 100% actual print size"
                >
                  100%
                </button>
              </div>

              {/* Direct Download for Selected Sheet */}
              {onExportSingleSheet && (
                <button
                  type="button"
                  onClick={() => onExportSingleSheet(selectedSheetIndex)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-[#204563] bg-[#EF7F1A] hover:bg-[#d96e12] shadow-xs transition-colors shrink-0"
                  title={`Download Sheet ${selectedSheetIndex + 1} PNG`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
