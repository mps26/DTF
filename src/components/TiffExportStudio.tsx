import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileStack,
  Layers,
  UploadCloud,
  CheckCircle2,
  Sliders,
  Eye,
  Download,
  Sparkles,
  Zap,
  Printer,
  ShieldCheck,
  RefreshCw,
  FolderPlus,
  Trash2,
  FileImage,
  Info,
  ChevronRight,
  ChevronDown,
  Maximize2,
  ZoomIn,
  ZoomOut,
  PenTool,
  Shirt
} from 'lucide-react';
import { ArtworkAsset, SheetSettings, LayoutResult } from '../types';
import {
  TiffExportOptions,
  createDtfTiffBlob,
  downloadTiffBlob,
  applyAlphaChoke,
  applyAlphaDilation
} from '../utils/tiffGenerator';

interface TiffExportStudioProps {
  currentAssets: ArtworkAsset[];
  currentSettings: SheetSettings;
  currentLayout: LayoutResult;
  onBackToStudio: () => void;
  onNotification: (msg: string) => void;
}

interface TiffQueueItem {
  id: string;
  name: string;
  sourceType: 'gang_sheet' | 'file';
  previewUrl: string;
  widthPx: number;
  heightPx: number;
  widthIn: number;
  heightIn: number;
  file?: File;
  imageData?: ImageData;
}

export const TiffExportStudio: React.FC<TiffExportStudioProps> = ({
  currentAssets,
  currentSettings,
  currentLayout,
  onBackToStudio,
  onNotification
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ================= 5 CARDS ACCORDION STATE =================
  // By default in closed format matching user image, opens on arrow click
  const [openCards, setOpenCards] = useState<{
    sheet: boolean;
    rip: boolean;
    white: boolean;
    uv: boolean;
    files: boolean;
  }>({
    sheet: false,
    rip: false,
    white: false,
    uv: false,
    files: false
  });

  const toggleCard = (card: 'sheet' | 'rip' | 'white' | 'uv' | 'files') => {
    setOpenCards((prev) => ({
      ...prev,
      [card]: !prev[card]
    }));
  };

  // ================= 1. SHEET OPTIONS =================
  // Strictly enforce max printing area: 22" width x 100" height
  const [sheetWidth, setSheetWidth] = useState<number>(Math.min(22, Math.max(1, currentSettings.filmWidth || 11.5)));
  const [sheetHeight, setSheetHeight] = useState<number>(
    Math.min(100, Math.max(1, Math.round((currentLayout.usedLengthInches || 17.9) * 10) / 10))
  );
  const [colorMode, setColorMode] = useState<'cmyk' | 'rgb'>('rgb');
  const [sheetDpi, setSheetDpi] = useState<number>(300);
  const [transparencyChannel, setTransparencyChannel] = useState<boolean>(true);
  const [mirrorSheet, setMirrorSheet] = useState<boolean>(false);
  const [isLayerLifted, setIsLayerLifted] = useState<boolean>(false);

  // ================= 2. RIP AND CHANNEL NAMES =================
  const [ripPreset, setRipPreset] = useState<'maintop' | 'riin' | 'printfactory' | 'flexi' | 'other'>('maintop');
  const [whiteChannelName, setWhiteChannelName] = useState<string>('W1');

  // ================= 3. WHITE INK OPTIONS =================
  const [chokePx, setChokePx] = useState<number>(1);
  const [chokeShape, setChokeShape] = useState<'round' | 'square'>('round');
  const [whiteStrength, setWhiteStrength] = useState<number>(100);
  const [softEdges, setSoftEdges] = useState<'follow_transparency' | 'solid_white'>('follow_transparency');
  const [cleanFaintEdgePixels, setCleanFaintEdgePixels] = useState<'off' | 'light' | 'strong'>('off');

  // ================= 4. UVDTF · VARNISH OPTIONS =================
  const [uvDtfEnabled, setUvDtfEnabled] = useState<boolean>(false);
  const [varnishSize, setVarnishSize] = useState<'wider' | 'same' | 'smaller'>('wider');
  const [varnishOffsetPx, setVarnishOffsetPx] = useState<number>(2);
  const [varnishStrength, setVarnishStrength] = useState<number>(100);
  const [varnishChannelName, setVarnishChannelName] = useState<string>('W2');

  // ================= 5. FILES OPTIONS =================
  const [fileOutputMode, setFileOutputMode] = useState<'one' | 'separate'>('one');
  const [rememberSettings, setRememberSettings] = useState<boolean>(true);

  // Inspector & Preview States
  const [activeChannelView, setActiveChannelView] = useState<'composite' | 'w1_mask' | 'cmyk' | 'v1_varnish'>('composite');
  const [zoom, setZoom] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Queue of items to export as TIFF - START STRICTLY EMPTY (No prior image)
  const [queue, setQueue] = useState<TiffQueueItem[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [whiteLayerUrl, setWhiteLayerUrl] = useState<string | null>(null);
  const [varnishLayerUrl, setVarnishLayerUrl] = useState<string | null>(null);

  const activeItem = useMemo(() => {
    return queue.find((q) => q.id === selectedQueueId) || queue[0] || null;
  }, [queue, selectedQueueId]);

  // Generate live White Underbase (Ruby Red) and Varnish layers for 3D Lifted Layers View
  useEffect(() => {
    if (!activeItem) {
      setWhiteLayerUrl(null);
      setVarnishLayerUrl(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activeItem.previewUrl;
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w === 0 || h === 0) return;

      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const offCtx = off.getContext('2d');
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0);
      const imgData = offCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      let activeThresh = 8;
      if (cleanFaintEdgePixels === 'off') activeThresh = 2;
      else if (cleanFaintEdgePixels === 'light') activeThresh = 10;
      else if (cleanFaintEdgePixels === 'strong') activeThresh = 26;

      const rawAlpha = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        rawAlpha[i] = data[i * 4 + 3];
      }

      // Generate White Underbase (Ruby Red Mask matching media_1793870360720_2c085f75.jpg)
      const chokedAlpha = applyAlphaChoke(rawAlpha, w, h, chokePx, activeThresh, chokeShape);
      const wStrengthRatio = whiteStrength / 100;
      const whiteData = offCtx.createImageData(w, h);
      const wd = whiteData.data;

      for (let i = 0; i < data.length; i += 4) {
        const a = chokedAlpha[i / 4];
        if (a > 0) {
          wd[i] = 239;     // R (Vivid Ruby Red)
          wd[i + 1] = 68;  // G
          wd[i + 2] = 68;  // B
          const finalAlpha = softEdges === 'solid_white' ? 255 : a;
          wd[i + 3] = Math.round(finalAlpha * wStrengthRatio);
        } else {
          wd[i + 3] = 0;
        }
      }

      offCtx.putImageData(whiteData, 0, 0);
      setWhiteLayerUrl(off.toDataURL('image/png'));

      // Generate Varnish Mask if enabled
      if (uvDtfEnabled) {
        let vBuffer: Uint8Array = rawAlpha;
        if (varnishSize === 'wider') {
          vBuffer = applyAlphaDilation(rawAlpha, w, h, varnishOffsetPx, activeThresh);
        } else if (varnishSize === 'smaller') {
          vBuffer = applyAlphaChoke(rawAlpha, w, h, varnishOffsetPx, activeThresh, 'round');
        }
        const vStrengthRatio = varnishStrength / 100;
        const vData = offCtx.createImageData(w, h);
        const vd = vData.data;
        for (let i = 0; i < data.length; i += 4) {
          const va = vBuffer[i / 4];
          if (va > 0) {
            vd[i] = 56;
            vd[i + 1] = 189;
            vd[i + 2] = 248;
            vd[i + 3] = Math.round(va * vStrengthRatio * 0.85);
          } else {
            vd[i + 3] = 0;
          }
        }
        offCtx.putImageData(vData, 0, 0);
        setVarnishLayerUrl(off.toDataURL('image/png'));
      } else {
        setVarnishLayerUrl(null);
      }
    };
  }, [
    activeItem,
    chokePx,
    chokeShape,
    whiteStrength,
    softEdges,
    cleanFaintEdgePixels,
    uvDtfEnabled,
    varnishSize,
    varnishOffsetPx,
    varnishStrength
  ]);

  // Sync default channel names when RIP preset changes
  const handleSelectRipPreset = (preset: 'maintop' | 'riin' | 'printfactory' | 'flexi' | 'other') => {
    setRipPreset(preset);
    if (preset === 'maintop') setWhiteChannelName('W1');
    else if (preset === 'riin') setWhiteChannelName('W1');
    else if (preset === 'printfactory') setWhiteChannelName('White');
    else if (preset === 'flexi') setWhiteChannelName('Spot_White');
  };

  const handleResetToMaintop = () => {
    setRipPreset('maintop');
    setWhiteChannelName('W1');
    setColorMode('cmyk');
    setChokePx(1);
    setChokeShape('round');
    setWhiteStrength(100);
    setTransparencyChannel(true);
    setMirrorSheet(false);
    onNotification('Reset settings to Maintop tested film defaults');
  };

  // Import Active Gang Sheet manually on user demand
  const handleImportCurrentGangSheet = () => {
    if (currentAssets.length === 0) {
      onNotification('No designs currently placed on the gang sheet.');
      return;
    }
    const clampedW = Math.min(22, Math.max(1, sheetWidth));
    const clampedH = Math.min(100, Math.max(1, sheetHeight));
    const first = currentAssets[0];
    const item: TiffQueueItem = {
      id: `gang_sheet_${Date.now()}`,
      name: `Gang_Sheet_${clampedW}in_${currentLayout.totalCopies}copies`,
      sourceType: 'gang_sheet',
      previewUrl: first.processedUrl || first.originalUrl,
      widthPx: Math.min(Math.round(22 * sheetDpi), first.originalWidth || 1200),
      heightPx: Math.min(Math.round(100 * sheetDpi), first.originalHeight || 1200),
      widthIn: clampedW,
      heightIn: clampedH
    };
    setQueue((prev) => [item, ...prev]);
    setSelectedQueueId(item.id);
    onNotification(`Imported active gang sheet (${clampedW}" × ${clampedH}") into TIFF queue`);
  };

  // Handle local file uploads (strictly constrained to max 22" x 100")
  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.includes('png') && !file.type.includes('image')) return;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        let wIn = Math.round((img.naturalWidth / sheetDpi) * 100) / 100;
        let hIn = Math.round((img.naturalHeight / sheetDpi) * 100) / 100;
        // Strictly clamp within printable area: 22" (width) x 100" (height)
        wIn = Math.min(22, Math.max(0.1, wIn));
        hIn = Math.min(100, Math.max(0.1, hIn));

        const item: TiffQueueItem = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          sourceType: 'file',
          previewUrl: url,
          widthPx: img.naturalWidth,
          heightPx: img.naturalHeight,
          widthIn: wIn,
          heightIn: hIn,
          file
        };
        setQueue((prev) => [...prev, item]);
        if (!selectedQueueId) setSelectedQueueId(item.id);
      };
    });
    onNotification(`Added ${files.length} design(s) to TIFF queue (Max 22" × 100")`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemoveFromQueue = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueue((prev) => prev.filter((item) => item.id !== id));
    if (selectedQueueId === id) {
      const remaining = queue.filter((item) => item.id !== id);
      setSelectedQueueId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Live Canvas Rendering & Channel Isolation
  useEffect(() => {
    if (!activeItem || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const render = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Handle mirroring preview
      if (mirrorSheet) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const w = canvas.width;
      const h = canvas.height;

      // Threshold based on cleanFaintEdgePixels
      let activeThresh = 8;
      if (cleanFaintEdgePixels === 'off') activeThresh = 2;
      else if (cleanFaintEdgePixels === 'light') activeThresh = 10;
      else if (cleanFaintEdgePixels === 'strong') activeThresh = 26;

      // 1. COMPOSITE VIEW
      if (activeChannelView === 'composite') {
        ctx.putImageData(imgData, 0, 0);
        return;
      }

      // 2. W1 WHITE UNDERBASE SPOT CHANNEL (Ruby Red Mask Preview)
      if (activeChannelView === 'w1_mask') {
        const rawAlpha = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          rawAlpha[i] = data[i * 4 + 3];
        }
        const chokedAlpha = applyAlphaChoke(rawAlpha, w, h, chokePx, activeThresh, chokeShape);
        const wStrengthRatio = whiteStrength / 100;

        for (let i = 0; i < data.length; i += 4) {
          const a = chokedAlpha[i / 4];
          if (a > 0) {
            data[i] = 239;     // R
            data[i + 1] = 68;  // G
            data[i + 2] = 68;  // B
            const finalAlpha = softEdges === 'solid_white' ? 255 : a;
            data[i + 3] = Math.round(finalAlpha * wStrengthRatio);
          } else {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        return;
      }

      // 3. CMYK COLOR PASS
      if (activeChannelView === 'cmyk') {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < activeThresh) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        return;
      }

      // 4. V1 VARNISH PASS (UV DTF)
      if (activeChannelView === 'v1_varnish') {
        const rawAlpha = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          rawAlpha[i] = data[i * 4 + 3];
        }
        let vBuffer: Uint8Array = rawAlpha;
        if (varnishSize === 'wider') {
          vBuffer = applyAlphaDilation(rawAlpha, w, h, varnishOffsetPx, activeThresh);
        } else if (varnishSize === 'smaller') {
          vBuffer = applyAlphaChoke(rawAlpha, w, h, varnishOffsetPx, activeThresh, 'round');
        }

        const vStrengthRatio = varnishStrength / 100;

        for (let i = 0; i < data.length; i += 4) {
          const va = vBuffer[i / 4];
          if (va > 0) {
            data[i] = 56;      // R
            data[i + 1] = 189;  // G
            data[i + 2] = 248;  // B
            data[i + 3] = Math.round(va * vStrengthRatio * 0.85);
          } else {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    };

    img.onload = render;
    img.src = activeItem.previewUrl;
    if (img.complete && img.naturalWidth > 0) {
      render();
    }
  }, [
    activeItem,
    isLayerLifted,
    activeChannelView,
    chokePx,
    chokeShape,
    whiteStrength,
    softEdges,
    cleanFaintEdgePixels,
    uvDtfEnabled,
    varnishSize,
    varnishOffsetPx,
    varnishStrength,
    mirrorSheet
  ]);

  // Extract pixel buffer
  const getImageDataFromUrl = (url: string): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return reject(new Error('Canvas context unavailable'));
        offCtx.drawImage(img, 0, 0);
        resolve(offCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight));
      };
      img.onerror = reject;
    });
  };

  // Run TIFF Generation & Download
  const handleExportTiff = async (item: TiffQueueItem) => {
    setIsProcessing(true);
    try {
      let imgData = await getImageDataFromUrl(item.previewUrl);

      // Strictly bound TIFF export to maximum printable area: 22" (width) x 100" (height)
      const maxWpx = Math.round(22 * sheetDpi);
      const maxHpx = Math.round(100 * sheetDpi);

      if (imgData.width > maxWpx || imgData.height > maxHpx) {
        const scale = Math.min(maxWpx / imgData.width, maxHpx / imgData.height);
        const targetW = Math.max(1, Math.round(imgData.width * scale));
        const targetH = Math.max(1, Math.round(imgData.height * scale));

        const offCanvas = document.createElement('canvas');
        offCanvas.width = targetW;
        offCanvas.height = targetH;
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          const tempImg = new Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.src = item.previewUrl;
          await new Promise<void>((resolve, reject) => {
            tempImg.onload = () => resolve();
            tempImg.onerror = reject;
          });
          offCtx.drawImage(tempImg, 0, 0, targetW, targetH);
          imgData = offCtx.getImageData(0, 0, targetW, targetH);
        }
      }

      const options: TiffExportOptions = {
        mode: uvDtfEnabled ? 'uv_dtf' : 'dtf',
        dpi: sheetDpi,
        colorMode,
        transparencyChannel,
        mirrorSheet,
        ripPreset,
        whiteChannelName,
        varnishChannelName,
        chokePx,
        chokeShape,
        whiteStrength,
        softEdges,
        cleanFaintEdgePixels,
        varnishSize,
        varnishOffsetPx,
        varnishStrength
      };

      const tiffBlob = createDtfTiffBlob(imgData, options);
      const targetFilename = `${item.name}_${whiteChannelName}${uvDtfEnabled ? `_${varnishChannelName}` : ''}_${colorMode.toUpperCase()}.tif`;

      downloadTiffBlob(tiffBlob, targetFilename);
      onNotification(`Exported RIP TIFF (${Math.round((imgData.width / sheetDpi) * 10) / 10}" × ${Math.round((imgData.height / sheetDpi) * 10) / 10}"): ${targetFilename}`);
    } catch (err: any) {
      console.error(err);
      onNotification(`TIFF generation failed: ${err.message || 'unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportAll = async () => {
    if (queue.length === 0) return;
    for (const item of queue) {
      await handleExportTiff(item);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] text-slate-800 overflow-hidden select-none font-sans">
      
      {/* ================= TOP CONSOLE HEADER ================= */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToStudio}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors border border-slate-200 shadow-2xs"
          >
            <span>← Back to Gang Sheet</span>
          </button>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25">
              <FileStack className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm text-slate-900 tracking-tight uppercase">
                  RIP TIFF Channel Compositor
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Multi-Channel Engine
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Embedded {whiteChannelName} White Underbase & {colorMode.toUpperCase()} Separation • {sheetDpi} DPI Native • Max Print: 22" × 100"
              </div>
            </div>
          </div>
        </div>

        {/* DTF vs UVDTF Quick Switcher in Header */}
        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setUvDtfEnabled(false);
              onNotification('Switched to DTF print process (Textile Garments)');
            }}
            className={`px-3.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              !uvDtfEnabled
                ? 'bg-white text-indigo-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>DTF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUvDtfEnabled(true);
              onNotification('Switched to UVDTF print process (Hard Goods + Varnish)');
            }}
            className={`px-3.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              uvDtfEnabled
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>UVDTF</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase font-black ${
              uvDtfEnabled ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
            }`}>
              W2
            </span>
          </button>
        </div>

        {/* Global Export CTA */}
        <div className="flex items-center space-x-3">
          <div className="text-right font-mono text-xs hidden sm:block">
            <span className="text-slate-500">Queue: </span>
            <span className="font-bold text-slate-900">{queue.length} file(s)</span>
          </div>

          <button
            onClick={handleExportAll}
            disabled={isProcessing || queue.length === 0}
            className="h-9 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 text-white" />
            <span>{isProcessing ? 'Generating TIFF...' : 'Export All RIP TIFFs (.TIF)'}</span>
          </button>
        </div>
      </div>

      {/* ================= 3-COLUMN WORKSPACE ================= */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ---------------- 1. LEFT CONTROLS: THE 5 TIFF OPTIONS IN EXACT USER FORMAT ---------------- */}
        <div className="w-[390px] xl:w-[420px] bg-[#f8fafc] border-r border-slate-200 p-4 space-y-2.5 overflow-y-auto flex-shrink-0 text-slate-800">
          
          {/* PRINT TECHNOLOGY SELECTOR: DTF vs UVDTF */}
          <div className="rounded-[22px] bg-white border border-slate-200/90 p-3 shadow-xs">
            <div className="flex items-center justify-between px-1 mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Print Technology
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                uvDtfEnabled
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {uvDtfEnabled ? 'UV-DTF · Varnish Active' : 'DTF · Textile Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Option 1: DTF */}
              <button
                type="button"
                onClick={() => {
                  setUvDtfEnabled(false);
                  onNotification('Selected DTF: Textile Direct-to-Film (CMYK + W1 White)');
                }}
                className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer group flex flex-col justify-between ${
                  !uvDtfEnabled
                    ? 'bg-gradient-to-b from-indigo-50/90 to-blue-50/40 border-2 border-indigo-600 shadow-xs'
                    : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                        !uvDtfEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        <Shirt className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-black text-sm tracking-tight text-slate-900">DTF</span>
                    </div>
                    {!uvDtfEnabled && (
                      <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-2">
                    Direct To Film
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
                  <span className={`font-bold font-mono ${!uvDtfEnabled ? 'text-indigo-700' : 'text-slate-500'}`}>
                    CMYK, W1
                  </span>
                  <span className="text-slate-400 font-medium">Textile</span>
                </div>
              </button>

              {/* Option 2: UVDTF */}
              <button
                type="button"
                onClick={() => {
                  setUvDtfEnabled(true);
                  onNotification('Selected UVDTF: Hard Surface Transfer (CMYK, W1, W2)');
                }}
                className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer group flex flex-col justify-between ${
                  uvDtfEnabled
                    ? 'bg-gradient-to-b from-purple-50/90 to-fuchsia-50/40 border-2 border-purple-600 shadow-xs'
                    : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                        uvDtfEnabled ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-black text-sm tracking-tight text-slate-900">UVDTF</span>
                    </div>
                    {uvDtfEnabled && (
                      <span className="w-4.5 h-4.5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-purple-700 mt-2">
                    UV + Varnish Gloss
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-purple-200/80 flex items-center justify-between text-[10px]">
                  <span className={`font-bold font-mono ${uvDtfEnabled ? 'text-purple-700' : 'text-slate-500'}`}>
                    CMYK, W1, W2
                  </span>
                  <span className="text-slate-400 font-medium">Hard Goods</span>
                </div>
              </button>
            </div>
          </div>

          {/* CARD 1: Sheet (Soft Pastel Yellow Tint) */}
          <div className="rounded-[22px] bg-[#fefce8] border border-[#fef08a] transition-all overflow-hidden shadow-2xs">
            <div
              onClick={() => toggleCard('sheet')}
              className="h-14 px-5 flex items-center justify-between cursor-pointer select-none"
            >
              <span className="font-bold text-[15px] text-[#0f172a]">Sheet</span>
              <div className="flex items-center space-x-2">
                <span className="bg-white rounded-full px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs border border-black/[0.04]">
                  {sheetWidth} × {sheetHeight}" · {sheetDpi} DPI
                </span>
                <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openCards.sheet ? 'rotate-90 text-indigo-600' : ''}`} />
                </div>
              </div>
            </div>

            {openCards.sheet && (
              <div className="px-5 pb-5 pt-2 space-y-4 border-t border-[#fef08a]/80 bg-[#fffbeb] animate-in fade-in">
                {/* Sheet Dimensions (Strictly Max 22" Width × 100" Height) */}
                <div className="space-y-2 pb-3 border-b border-[#fef08a]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-slate-700">Sheet Dimensions</span>
                    <span className="text-[10px] font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full border border-amber-300">
                      Max: 22" × 100"
                    </span>
                  </div>

                  {/* Width Quick Presets */}
                  <div className="flex items-center gap-1.5">
                    {[11.5, 13, 17, 22].map((presetW) => (
                      <button
                        key={presetW}
                        type="button"
                        onClick={() => setSheetWidth(presetW)}
                        className={`flex-1 py-1 px-2 rounded-xl text-[11px] font-bold transition-all border shadow-2xs ${
                          sheetWidth === presetW
                            ? 'bg-amber-400 text-amber-950 border-amber-500 font-black'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                        }`}
                      >
                        {presetW}"{presetW === 22 ? ' (Max)' : ''}
                      </button>
                    ))}
                  </div>

                  {/* Manual Inputs for Width and Height */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                        Width (Max 22")
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="22"
                          value={sheetWidth}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              setSheetWidth(Math.min(22, Math.max(1, val)));
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 pr-8 font-mono shadow-2xs"
                        />
                        <span className="absolute right-2.5 text-[11px] text-slate-400 font-bold pointer-events-none">
                          in
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                        Height (Max 100")
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="100"
                          value={sheetHeight}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              setSheetHeight(Math.min(100, Math.max(1, val)));
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 pr-8 font-mono shadow-2xs"
                        />
                        <span className="absolute right-2.5 text-[11px] text-slate-400 font-bold pointer-events-none">
                          in
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layers on film */}
                <div>
                  <div className="text-[12px] font-bold text-slate-600 mb-1.5">Layers on the film</div>
                  <button
                    onClick={() => {
                      const next = !isLayerLifted;
                      setIsLayerLifted(next);
                      onNotification(next ? 'Lifted layers into 3D isometric view' : 'Collapsed layers back to normal view');
                    }}
                    className={`py-2 px-4 rounded-full border text-xs font-bold transition-all flex items-center space-x-2 shadow-2xs cursor-pointer ${
                      isLayerLifted
                        ? 'bg-indigo-50/90 text-indigo-950 border-2 border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className={`w-4 h-4 ${isLayerLifted ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span>{isLayerLifted ? 'Put the layers back' : 'Lift the layers'}</span>
                  </button>
                </div>

                {/* Colour */}
                <div>
                  <div className="text-[12px] font-bold text-slate-600 mb-1.5">Colour Separation</div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/90 rounded-2xl border border-slate-200 shadow-2xs">
                    <button
                      onClick={() => setColorMode('rgb')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                        colorMode === 'rgb'
                          ? 'bg-emerald-600 text-white font-black shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      RGB (No BG · Like PNG)
                    </button>
                    <button
                      onClick={() => setColorMode('cmyk')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                        colorMode === 'cmyk'
                          ? 'bg-white text-indigo-950 font-black shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      CMYK · SWOP v2
                    </button>
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1.5 px-1 leading-tight">
                    {colorMode === 'rgb' ? (
                      <span className="text-emerald-700 font-semibold">
                        ✨ <strong>CorelDRAW & Photoshop Native</strong>: 100% transparent background (zero white box, just like PNG) with embedded {whiteChannelName} spot layer.
                      </span>
                    ) : (
                      <span className="text-slate-600 font-medium">
                        Standard 4-color process CMYK separation with {whiteChannelName} underbase.
                      </span>
                    )}
                  </div>
                </div>

                {/* Print resolution */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Print resolution</div>
                    <div className="text-[11px] text-slate-500 font-medium">Taken from the PNG. Change only if it is wrong.</div>
                  </div>
                  <div className="flex items-center bg-white rounded-xl border border-slate-200 px-3 py-1.5 shadow-2xs space-x-1">
                    <input
                      type="number"
                      value={sheetDpi}
                      onChange={(e) => setSheetDpi(Number(e.target.value))}
                      className="w-12 font-bold font-mono text-xs text-slate-900 text-center border-0 p-0 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-400">DPI</span>
                  </div>
                </div>

                {/* Transparency channel */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Transparency channel</div>
                    <div className="text-[11px] text-slate-500 font-medium">Keep on for Maintop.</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={transparencyChannel}
                    onClick={() => setTransparencyChannel(!transparencyChannel)}
                    className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-1 flex items-center shadow-inner flex-shrink-0 ${
                      transparencyChannel ? 'bg-[#4f46e5]' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 pointer-events-none ${
                        transparencyChannel ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Mirror the sheet */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Mirror the sheet</div>
                    <div className="text-[11px] text-slate-500 font-medium">Leave off if your RIP already mirrors.</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mirrorSheet}
                    onClick={() => setMirrorSheet(!mirrorSheet)}
                    className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-1 flex items-center shadow-inner flex-shrink-0 ${
                      mirrorSheet ? 'bg-[#4f46e5]' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 pointer-events-none ${
                        mirrorSheet ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: RIP and channel names (Soft Pastel Sky Blue Tint) */}
          <div className="rounded-[22px] bg-[#f0f9ff] border border-[#e0f2fe] transition-all overflow-hidden shadow-2xs">
            <div
              onClick={() => toggleCard('rip')}
              className="h-14 px-5 flex items-center justify-between cursor-pointer select-none"
            >
              <span className="font-bold text-[15px] text-[#0f172a]">RIP and channel names</span>
              <div className="flex items-center space-x-2">
                <span className="bg-white rounded-full px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs border border-black/[0.04]">
                  {ripPreset === 'maintop' ? 'Maintop · W1' : ripPreset === 'riin' ? 'RIIN · W1' : ripPreset === 'printfactory' ? 'PrintFactory · White' : ripPreset === 'flexi' ? 'Flexi · Spot_White' : `${ripPreset} · ${whiteChannelName}`}
                </span>
                <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openCards.rip ? 'rotate-90 text-indigo-600' : ''}`} />
                </div>
              </div>
            </div>

            {openCards.rip && (
              <div className="px-5 pb-5 pt-2 space-y-4 border-t border-[#e0f2fe]/80 bg-[#f0f9ff] animate-in fade-in">
                {/* 4 Cards Grid matching image */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSelectRipPreset('maintop')}
                    className={`p-3 rounded-2xl border text-left transition-all relative ${
                      ripPreset === 'maintop'
                        ? 'bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600/30'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-[13px] text-slate-900 flex items-center justify-between">
                      <span>Maintop</span>
                      {ripPreset === 'maintop' && (
                        <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">W1 · tested on film</div>
                  </button>

                  <button
                    onClick={() => handleSelectRipPreset('riin')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      ripPreset === 'riin'
                        ? 'bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600/30'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-[13px] text-slate-900">RIIN</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">W1</div>
                  </button>

                  <button
                    onClick={() => handleSelectRipPreset('printfactory')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      ripPreset === 'printfactory'
                        ? 'bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600/30'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-[13px] text-slate-900">PrintFactory</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">White</div>
                  </button>

                  <button
                    onClick={() => handleSelectRipPreset('flexi')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      ripPreset === 'flexi'
                        ? 'bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600/30'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-[13px] text-slate-900">Flexi / PhotoPrint</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Spot_White</div>
                  </button>
                </div>

                {/* Other RIP */}
                <button
                  onClick={() => handleSelectRipPreset('other')}
                  className={`w-full p-3 rounded-2xl border text-left transition-all ${
                    ripPreset === 'other'
                      ? 'bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600/30'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-extrabold text-[13px] text-slate-900">Other RIP</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">type the channel names</div>
                </button>

                {/* Channel names in the TIFF input box */}
                <div>
                  <div className="text-[11px] font-bold text-slate-600 mb-1.5">Channel names in the TIFF</div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-semibold">White channel</div>
                      <input
                        type="text"
                        value={whiteChannelName}
                        onChange={(e) => setWhiteChannelName(e.target.value)}
                        className="font-bold text-sm text-slate-900 border-0 p-0 focus:outline-none w-32 bg-transparent mt-0.5"
                      />
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <PenTool className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                    <span>✓</span>
                    <span>Tested on film</span>
                  </div>
                  <button
                    onClick={handleResetToMaintop}
                    className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    Reset to Maintop default
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CARD 3: White ink (Crisp Clean White / Slate Neutral) */}
          <div className="rounded-[22px] bg-white border border-slate-200 transition-all overflow-hidden shadow-2xs">
            <div
              onClick={() => toggleCard('white')}
              className="h-14 px-5 flex items-center justify-between cursor-pointer select-none"
            >
              <span className="font-bold text-[15px] text-[#0f172a]">White ink</span>
              <div className="flex items-center space-x-2">
                <span className="bg-white rounded-full px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs border border-slate-200">
                  {chokePx} px choke · {whiteStrength}%
                </span>
                <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openCards.white ? 'rotate-90 text-indigo-600' : ''}`} />
                </div>
              </div>
            </div>

            {openCards.white && (
              <div className="px-5 pb-5 pt-2 space-y-4 border-t border-slate-100 bg-white animate-in fade-in">
                {/* Pull white in from edge (choke) */}
                <div>
                  <div className="text-[12px] font-bold text-slate-600 mb-2">Pull white in from the edge (choke)</div>
                  <div className="flex items-center space-x-1.5 mb-2.5">
                    {[0, 1, 2, 3, 4, 5].map((px) => (
                      <button
                        key={px}
                        onClick={() => setChokePx(px)}
                        className={`flex-1 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          chokePx === px
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-extrabold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {px} px
                      </button>
                    ))}
                  </div>

                  {/* Round vs Square pills */}
                  <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-2xs">
                    <button
                      onClick={() => setChokeShape('round')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        chokeShape === 'round'
                          ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Round
                    </button>
                    <button
                      onClick={() => setChokeShape('square')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        chokeShape === 'square'
                          ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Square
                    </button>
                  </div>
                </div>

                {/* White strength */}
                <div>
                  <div className="flex justify-between items-center text-[12px] font-bold text-slate-700 mb-1.5">
                    <span>White strength</span>
                    <span className="font-black text-sm text-slate-900">{whiteStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={whiteStrength}
                    onChange={(e) => setWhiteStrength(Number(e.target.value))}
                    className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Soft edges and shadows */}
                <div>
                  <div className="text-[12px] font-bold text-slate-600 mb-2">Soft edges and shadows</div>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-200">
                    <button
                      onClick={() => setSoftEdges('follow_transparency')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        softEdges === 'follow_transparency'
                          ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Follow transparency
                    </button>
                    <button
                      onClick={() => setSoftEdges('solid_white')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        softEdges === 'solid_white'
                          ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Solid white
                    </button>
                  </div>
                </div>

                {/* Clean faint edge pixels */}
                <div>
                  <div className="text-[12px] font-bold text-slate-600 mb-2">Clean faint edge pixels</div>
                  <div className="inline-flex space-x-1.5">
                    {(['off', 'light', 'strong'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setCleanFaintEdgePixels(m)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize border transition-all ${
                          cleanFaintEdgePixels === m
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-extrabold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CARD 4: UVDTF · Varnish (Soft Pastel Lavender Tint) */}
          <div className="rounded-[22px] bg-[#faf5ff] border border-[#f3e8ff] transition-all overflow-hidden shadow-2xs">
            <div
              onClick={() => toggleCard('uv')}
              className="h-14 px-5 flex items-center justify-between cursor-pointer select-none"
            >
              <span className="font-bold text-[15px] text-[#0f172a]">UVDTF · Varnish</span>
              <div className="flex items-center space-x-2.5">
                <span className="bg-white rounded-full px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs border border-black/[0.04]">
                  {uvDtfEnabled ? `${varnishChannelName} · ${varnishStrength}%` : 'off'}
                </span>
                
                {/* Purple Toggle Switch for Enable / Disable */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={uvDtfEnabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !uvDtfEnabled;
                    setUvDtfEnabled(next);
                    onNotification(next ? 'UVDTF Varnish enabled (W2 channel)' : 'UVDTF Varnish disabled');
                  }}
                  className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-1 flex items-center shadow-inner flex-shrink-0 ${
                    uvDtfEnabled ? 'bg-[#4f46e5]' : 'bg-slate-300'
                  }`}
                  title={uvDtfEnabled ? 'Disable UVDTF Varnish' : 'Enable UVDTF Varnish'}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 pointer-events-none ${
                      uvDtfEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openCards.uv ? 'rotate-90 text-indigo-600' : ''}`} />
                </div>
              </div>
            </div>

            {openCards.uv && (
              <div className="px-5 pb-5 pt-2 space-y-4 border-t border-[#f3e8ff]/80 bg-[#faf5ff] animate-in fade-in">
                {!uvDtfEnabled && (
                  <div className="p-3 bg-purple-100/80 border border-purple-200/90 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-purple-950">Varnish is currently turned off</div>
                      <div className="text-[11px] text-purple-700">Turn on the switch to enable UV DTF Varnish layer</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUvDtfEnabled(true);
                        onNotification('UVDTF Varnish enabled');
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex-shrink-0"
                    >
                      Enable
                    </button>
                  </div>
                )}

                {/* Varnish size */}
                <div>
                  <div className="text-[12px] font-bold text-slate-600 mb-2">Varnish size</div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <button
                      onClick={() => setVarnishSize('wider')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        varnishSize === 'wider'
                          ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Wider than art
                    </button>
                    <button
                      onClick={() => setVarnishSize('same')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        varnishSize === 'same'
                          ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Same
                    </button>
                    <button
                      onClick={() => setVarnishSize('smaller')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        varnishSize === 'smaller'
                          ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Smaller
                    </button>
                  </div>
                </div>

                {/* By offset px */}
                <div>
                  <div className="text-[12px] font-bold text-slate-600 mb-2">By</div>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4, 5].map((px) => (
                      <button
                        key={px}
                        onClick={() => setVarnishOffsetPx(px)}
                        className={`flex-1 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          varnishOffsetPx === px
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-extrabold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {px} px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Varnish strength */}
                <div>
                  <div className="flex justify-between items-center text-[12px] font-bold text-slate-700 mb-1.5">
                    <span>Varnish strength</span>
                    <span className="font-black text-sm text-slate-900">{varnishStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={varnishStrength}
                    onChange={(e) => setVarnishStrength(Number(e.target.value))}
                    className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CARD 5: Files (Soft Pastel Mint Tint) */}
          <div className="rounded-[22px] bg-[#f0fdf4] border border-[#dcfce7] transition-all overflow-hidden shadow-2xs">
            <div
              onClick={() => toggleCard('files')}
              className="h-14 px-5 flex items-center justify-between cursor-pointer select-none"
            >
              <span className="font-bold text-[15px] text-[#0f172a]">Files</span>
              <div className="flex items-center space-x-2">
                <span className="bg-white rounded-full px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs border border-black/[0.04]">
                  {fileOutputMode === 'one' ? 'One TIFF' : 'Separate TIFFs'}
                </span>
                <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openCards.files ? 'rotate-90 text-indigo-600' : ''}`} />
                </div>
              </div>
            </div>

            {openCards.files && (
              <div className="px-5 pb-5 pt-2 space-y-4 border-t border-[#dcfce7]/80 bg-[#f0fdf4] animate-in fade-in">
                {/* Remember these settings switch */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Remember these settings</div>
                    <div className="text-[11px] text-slate-500 font-medium">The page and Download TIFF in the builder start with them.</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rememberSettings}
                    onClick={() => setRememberSettings(!rememberSettings)}
                    className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-1 flex items-center shadow-inner flex-shrink-0 ${
                      rememberSettings ? 'bg-[#4f46e5]' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 pointer-events-none ${
                        rememberSettings ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Clear all */}
                <div className="pt-2">
                  <button
                    onClick={handleResetToMaintop}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ---------------- 2. CENTER INSPECTOR: LIVE MULTI-CHANNEL PROOFING ---------------- */}
        <div className="flex-1 bg-slate-100 flex flex-col justify-between overflow-hidden relative min-w-0">
          
          {/* Top Channel Proofing Selector Strip (No Overlapping, Responsive Spacing) */}
          <div className="min-h-[52px] py-2 px-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 sm:gap-4 flex-shrink-0 z-10">
            {/* View Channel Buttons - Strict Sequence: Composite -> CMYK -> W1 White -> W2 Varnish */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 flex-shrink-0 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveChannelView('composite')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeChannelView === 'composite'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Composite Full Print"
              >
                Composite Print
              </button>

              {/* 1. CMYK Color Pass */}
              <button
                type="button"
                onClick={() => setActiveChannelView('cmyk')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeChannelView === 'cmyk'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`${colorMode.toUpperCase()} Color Pass`}
              >
                {colorMode.toUpperCase()} Color
              </button>

              {/* 2. W1 Spot White Underbase */}
              <button
                type="button"
                onClick={() => setActiveChannelView('w1_mask')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeChannelView === 'w1_mask'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`${whiteChannelName} White Underbase Channel`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
                <span>{whiteChannelName} White</span>
              </button>

              {/* 3. W2 UV Varnish Pass (Available in UVDTF mode) */}
              {uvDtfEnabled && (
                <button
                  type="button"
                  onClick={() => setActiveChannelView('v1_varnish')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all whitespace-nowrap cursor-pointer ${
                    activeChannelView === 'v1_varnish'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={`${varnishChannelName} Varnish Pass`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>{varnishChannelName} Varnish</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Inspection Viewport */}
          <div className="flex-1 p-4 sm:p-6 flex items-center justify-center relative overflow-auto">
            {activeItem ? (
              <>
                {/* 3D ISOMETRIC LIFTED LAYERS VIEW (Clean Layer Representation) */}
                <div
                  className={`w-full h-full items-center justify-center relative overflow-hidden select-none animate-in fade-in duration-300 ${
                    isLayerLifted ? 'flex' : 'hidden'
                  }`}
                >
                  {/* Subtle Blueprint Grid on Floor */}
                  <div
                    className="absolute inset-0 opacity-40 pointer-events-none"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                        linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
                      `,
                      backgroundSize: '40px 40px'
                    }}
                  />

                  {/* Isometric 3D Layer Assembly Stage */}
                  <div
                    className="relative flex items-center justify-center transition-all duration-500 ease-out"
                    style={{
                      transform: `scale(${zoom})`,
                      perspective: '1300px'
                    }}
                  >
                    <div
                      className="relative transition-transform duration-500 ease-out"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: 'rotateX(48deg) rotateZ(-34deg)',
                        width: '440px',
                        height: '380px'
                      }}
                    >
                      {/* BOTTOM SHEET: White Ink Underbase (W1) - Solid White Film Sheet with Red Ink Silhouette */}
                      <div
                        className="absolute inset-0 rounded-2xl bg-white border border-slate-200/90 shadow-2xl transition-all duration-500 flex items-center justify-center p-6"
                        style={{
                          transformStyle: 'preserve-3d',
                          transform: 'translateZ(0px) translateY(40px) translateX(25px)',
                          boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.25), 0 20px 30px -20px rgba(0, 0, 0, 0.3)'
                        }}
                      >
                        <img
                          src={whiteLayerUrl || activeItem.previewUrl}
                          alt="White Ink Underbase"
                          className="max-h-[300px] max-w-[360px] object-contain drop-shadow-sm select-none pointer-events-none"
                        />
                      </div>

                      {/* MIDDLE/TOP SHEET: Colour Pass (Translucent Film with Thin Blue Border) */}
                      <div
                        className="absolute inset-0 rounded-2xl border-2 border-blue-500 shadow-2xl transition-all duration-500 flex items-center justify-center p-6"
                        style={{
                          transformStyle: 'preserve-3d',
                          transform: 'translateZ(95px) translateY(-45px) translateX(-35px)',
                          backgroundColor: 'rgba(255, 255, 255, 0.7)',
                          backgroundImage: `
                            linear-gradient(45deg, rgba(203, 213, 225, 0.45) 25%, transparent 25%),
                            linear-gradient(-45deg, rgba(203, 213, 225, 0.45) 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, rgba(203, 213, 225, 0.45) 75%),
                            linear-gradient(-45deg, transparent 75%, rgba(203, 213, 225, 0.45) 75%)
                          `,
                          backgroundSize: '16px 16px',
                          boxShadow: '0 35px 70px -15px rgba(59, 130, 246, 0.28)'
                        }}
                      >
                        <img
                          src={activeItem.previewUrl}
                          alt="Colour CMYK"
                          className="max-h-[300px] max-w-[360px] object-contain drop-shadow-md select-none pointer-events-none"
                        />
                      </div>

                      {/* OPTIONAL TOPMOST SHEET: UVDTF Varnish Pass (if enabled) */}
                      {uvDtfEnabled && (
                        <div
                          className="absolute inset-0 rounded-2xl border-2 border-cyan-400 shadow-2xl transition-all duration-500 flex items-center justify-center p-6"
                          style={{
                            transformStyle: 'preserve-3d',
                            transform: 'translateZ(180px) translateY(-105px) translateX(-70px)',
                            backgroundColor: 'rgba(236, 254, 255, 0.55)',
                            boxShadow: '0 30px 60px -10px rgba(6, 182, 212, 0.3)'
                          }}
                        >
                          <img
                            src={varnishLayerUrl || activeItem.previewUrl}
                            alt="Varnish W2"
                            className="max-h-[300px] max-w-[360px] object-contain opacity-75 drop-shadow-md select-none pointer-events-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Right side "+ Add sheet" placeholder matching screenshot */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="ml-24 w-36 h-80 rounded-3xl border-2 border-dashed border-indigo-300/80 hover:border-indigo-600 bg-white/40 hover:bg-white/80 transition-all flex flex-col items-center justify-center cursor-pointer group shadow-2xs hidden xl:flex"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-1">
                        +
                      </div>
                      <span className="text-xs font-bold text-indigo-600 group-hover:underline">
                        Add sheet
                      </span>
                    </div>
                  </div>
                </div>

                {/* NORMAL 2D FLAT VIEWPORT (Guarantees 100% complete image visibility without edge clipping) */}
                <div
                  className={`rounded-2xl shadow-xl border border-slate-300/90 relative items-center justify-center p-3 sm:p-5 transition-transform duration-200 select-none ${
                    isLayerLifted ? 'hidden' : 'flex'
                  }`}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    backgroundColor: '#ffffff',
                    backgroundImage: `
                      linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
                      linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
                      linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
                    `,
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    className="block drop-shadow-sm"
                    style={{
                      maxHeight: 'min(450px, 58vh)',
                      maxWidth: 'min(580px, 52vw)',
                      width: 'auto',
                      height: 'auto',
                      aspectRatio: activeItem && activeItem.widthPx && activeItem.heightPx
                        ? `${activeItem.widthPx} / ${activeItem.heightPx}`
                        : 'auto'
                    }}
                  />
                </div>
              </>
            ) : (
              /* CLEAN EMPTY STATE (No prior image) */
              <div className="flex flex-col items-center justify-center text-center p-8 max-w-md bg-white border border-slate-200 rounded-3xl shadow-lg space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <FileStack className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">
                    No Files in TIFF Queue
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Drop your 8-bit transparent PNG images or browse to convert them into RIP-ready multi-channel TIFFs with {whiteChannelName} White Underbase.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 w-full">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Browse PNGs</span>
                  </button>

                  {currentAssets.length > 0 && (
                    <button
                      onClick={handleImportCurrentGangSheet}
                      className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>Import Gang Sheet</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Zoom Controls Overlay */}
            {activeItem && (
              <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700">
                <button
                  onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-indigo-700 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="text-[10px] text-slate-500 hover:text-indigo-600 font-bold pl-1.5 border-l border-slate-200 cursor-pointer"
                  title="Fit 100%"
                >
                  Fit 100%
                </button>
              </div>
            )}
          </div>

          {/* Bottom Technical Spec Bar */}
          <div className="h-10 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-500 font-mono flex-shrink-0">
            {activeItem ? (
              <>
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-900">{activeItem.name}</span>
                  <span>•</span>
                  <span>{activeItem.widthPx} × {activeItem.heightPx} px</span>
                  <span>•</span>
                  <span>{activeItem.widthIn}" × {activeItem.heightIn}"</span>
                  {mirrorSheet && (
                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-bold">
                      Mirrored
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {sheetDpi} DPI Native
                  </span>
                  <span>Channels: {colorMode.toUpperCase()} + {whiteChannelName}{uvDtfEnabled ? ` + ${varnishChannelName}` : ''}</span>
                </div>
              </>
            ) : (
              <div className="text-slate-400 font-medium">Ready to import or drop designs</div>
            )}
          </div>

        </div>

        {/* ---------------- 3. RIGHT WORKSPACE: QUEUE & EXPORT PREFLIGHT ---------------- */}
        <div className="w-80 bg-white border-l border-slate-200 p-4 flex flex-col justify-between flex-shrink-0 overflow-y-auto text-slate-700">
          <div className="space-y-4">
            
            {/* PNG Upload Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-5 text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/*"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 shadow-xs transition-transform">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-xs text-slate-800">
                Drop PNGs to Convert to TIFF
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                Transparent PNG • Up to 20 files at once
              </p>
              <button
                type="button"
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs transition-colors"
              >
                Browse PNGs
              </button>
            </div>

            {/* Queue List Header */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                TIFF Generation Queue ({queue.length})
              </span>
              {currentAssets.length > 0 && queue.length === 0 && (
                <button
                  onClick={handleImportCurrentGangSheet}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  + Add Active Gang Sheet
                </button>
              )}
            </div>

            {/* Queue Items */}
            {queue.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                Queue is empty. Drop files above to begin.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {queue.map((item) => {
                  const isSelected = item.id === (activeItem?.id || '');
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedQueueId(item.id)}
                      className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-8 h-8 rounded-lg object-contain bg-slate-100 p-0.5 border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.widthIn}" × {item.heightIn}" • {sheetDpi} DPI
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportTiff(item);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                          title="Export this TIFF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleRemoveFromQueue(item.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Industrial Preflight Verification */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                RIP Preflight Verification
              </span>
              <div className="space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{whiteChannelName} Spot Channel built from alpha</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{chokePx}px ({chokeShape}) choke applied</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Color Mode: {colorMode === 'cmyk' ? 'Photometric 5 (CMYK)' : 'Photometric 2 (RGB)'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${uvDtfEnabled ? 'text-purple-600' : 'text-indigo-600'}`} />
                  <span className="font-semibold text-slate-800">
                    Process: {uvDtfEnabled ? 'UVDTF (Hard Goods + W2 Varnish)' : 'DTF (Textile + W1 White)'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{ripPreset.toUpperCase()} native film compatibility</span>
                </div>
              </div>
            </div>

          </div>

          {/* Action CTAs: Export Active TIFF */}
          <div className="pt-3 border-t border-slate-200 space-y-2 mt-4 flex-shrink-0">
            <button
              onClick={() => activeItem && handleExportTiff(activeItem)}
              disabled={isProcessing || !activeItem}
              className={`w-full py-3 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                uvDtfEnabled
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-600/20'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-600/20'
              }`}
            >
              <Zap className="w-4 h-4 text-white" />
              <span>
                {isProcessing
                  ? 'Generating TIFF...'
                  : `Download Active TIFF (${uvDtfEnabled ? 'UVDTF: W1 + W2' : `DTF: ${whiteChannelName}`} + ${colorMode.toUpperCase()})`}
              </span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
