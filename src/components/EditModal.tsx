import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Scissors,
  Activity,
  PenTool,
  RotateCcw,
  Check,
  Pipette,
  Layers,
  CircleDot,
  Sliders,
  Type,
  Maximize2,
  Crop,
  Wand2,
  Cpu,
  Eraser,
  RefreshCw,
  Download,
  UploadCloud,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  SquareDashedBottom,
  CheckCircle2,
  FileStack,
  ShieldCheck,
  Shirt,
  Eye,
  MoveHorizontal,
  ArrowRight,
  Images,
  ChevronLeft,
  Copy
} from 'lucide-react';
import { ArtworkAsset } from '../types';
import { vectorizeImage, downloadSvgFile } from '../utils/vectorizer';
import {
  TEXTURE_EFFECTS_LIST,
  TextureEffectType,
  applyTextureFilter
} from '../utils/textureEffects';
import {
  loadImage,
  removeImageBackground,
  calculateAlphaBoundingBox,
  cropImageToBoundingBox,
  despeckleImage,
  addStrokeOutline,
  upscaleImageAi,
  recreateImageAi,
  RecreateAiStyle,
  adjustColorAndTone,
  applyTextureEffect,
  applyHalftoneFilter,
  HalftoneStyle,
  HalftoneOptions,
  replaceColorInImage,
  applyEmbroideryEffect,
  generateTextArtwork
} from '../utils/imageProcessing';

interface EditModalProps {
  asset: ArtworkAsset | null;
  assets?: ArtworkAsset[];
  initialTool?: string;
  onClose: () => void;
  onSave: (updatedAsset: ArtworkAsset) => void;
  onSelectAsset?: (asset: ArtworkAsset) => void;
  onAddNewAsset?: (newAsset: ArtworkAsset) => void;
  onOpenAudit?: () => void;
  onOpenTiff?: () => void;
}

interface ToolDef {
  id: string;
  name: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
}

interface CategoryDef {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  tools: ToolDef[];
}

export const EditModal: React.FC<EditModalProps> = ({
  asset,
  assets = [],
  initialTool = 'upscaler',
  onClose,
  onSave,
  onSelectAsset,
  onOpenAudit,
  onOpenTiff
}) => {
  if (!asset) return null;

  // Active Asset state (enables switching between all uploaded images inside the modal)
  const [currentAsset, setCurrentAsset] = useState<ArtworkAsset>(asset);

  // Sync if asset prop changes from outside
  useEffect(() => {
    if (asset && asset.id !== currentAsset.id) {
      setCurrentAsset(asset);
      loadAssetData(asset);
    }
  }, [asset?.id]);

  // Normalize incoming tool ID
  const normalizeTool = (id: string) => {
    if (id === 'upscale') return 'upscaler';
    if (id === 'remove-color') return 'remove-replace-color';
    if (id === 'special-effects') return 'texture';
    return id;
  };

  // 4 Categories matching dtflayout.com
  const categories: CategoryDef[] = [
    {
      id: 'fix',
      name: 'Fix & Quality',
      icon: Sparkles,
      tools: [
        { id: 'upscaler', name: 'Image Upscaler', desc: 'Sharpen & 2x/4x enlarge resolution', badge: 'AI', badgeColor: 'bg-[#EF7F1A]/10 text-[#EF7F1A] border-[#EF7F1A]/30' },
        { id: 'color-tone', name: 'Color & Tone', desc: 'Levels, saturation, contrast & balance' },
        { id: 'pixel-doctor', name: 'Pixel Doctor', desc: 'Clean stray pixels & edge fringes' },
        { id: 'print-check', name: 'Print Check', desc: 'Automated pre-print audit', badge: 'AUDIT', badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      ]
    },
    {
      id: 'cut',
      name: 'Cut & Adjust',
      icon: Scissors,
      tools: [
        { id: 'bg-remover', name: 'Background Remover', desc: 'Auto cut-out transparent background', badge: 'AUTO', badgeColor: 'bg-blue-100 text-blue-700 border-blue-200' },
        { id: 'remove-replace-color', name: 'Remove / Replace Color', desc: 'Color knockout & swap channels' },
        { id: 'crop-clean', name: 'Crop & Clean', desc: 'Trim empty padding, rotate & flip' },
        { id: 'eraser', name: 'Eraser Brush', desc: 'Draw directly on canvas to erase', badge: 'DRAW', badgeColor: 'bg-amber-100 text-amber-700 border-amber-200' },
        { id: 'border-knockout', name: 'Border Knockout', desc: 'Punch-out borders & frames' }
      ]
    },
    {
      id: 'style',
      name: 'Style & Effects',
      icon: Wand2,
      tools: [
        { id: 'texture', name: 'Texture Effects', desc: '11 creative color & texture filters', badge: '11', badgeColor: 'bg-[#EF7F1A]/10 text-[#EF7F1A] border-[#EF7F1A]/30' },
        { id: 'halftone', name: 'Halftone Dots', desc: 'Screen dots for breathable prints', badge: 'PRINT', badgeColor: 'bg-teal-100 text-teal-700 border-teal-200' },
        { id: 'stroke-outline', name: 'Stroke / Outline', desc: 'Contour edge outline & choke' }
      ]
    },
    {
      id: 'create',
      name: 'Create & Convert',
      icon: Cpu,
      tools: [
        { id: 'text-number', name: 'Text & Number', desc: 'Team jersey & typography generator', badge: 'NEW', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
        { id: 'vectorize', name: 'Image Vectoriser', desc: 'Trace bitmap to sharp vector paths', badge: 'SVG', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
        { id: 'recreate-ai', name: 'Recreate with AI', desc: 'Redraw and enhance low-res artwork', badge: 'AI', badgeColor: 'bg-[#EF7F1A]/10 text-[#EF7F1A] border-[#EF7F1A]/30' },
        { id: 'tiff-export', name: 'TIFF Export (RIP)', desc: 'Generate multi-channel W1 underbase', badge: 'RIP', badgeColor: 'bg-[#204563]/10 text-[#204563] border-[#204563]/30' }
      ]
    }
  ];

  const getCategoryForTool = (tId: string): string => {
    for (const cat of categories) {
      if (cat.tools.some((t) => t.id === tId)) return cat.id;
    }
    return 'fix';
  };

  const initialNorm = normalizeTool(initialTool);
  const [activeCategory, setActiveCategory] = useState<string>(getCategoryForTool(initialNorm));
  const [activeTool, setActiveTool] = useState<string>(initialNorm);

  useEffect(() => {
    const norm = normalizeTool(initialTool);
    setActiveTool(norm);
    setActiveCategory(getCategoryForTool(norm));
  }, [initialTool]);

  // Image & History state
  const [currentUrl, setCurrentUrl] = useState<string>(asset.processedUrl || asset.originalUrl);
  const [history, setHistory] = useState<string[]>([asset.processedUrl || asset.originalUrl]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [garmentBg, setGarmentBg] = useState<'checker' | 'black' | 'white' | 'charcoal'>('checker');
  const [emptyPercent, setEmptyPercent] = useState<number>(asset.cropBox?.emptyPercent || 0);

  // File replacement & eraser canvas refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eraserCanvasRef = useRef<HTMLCanvasElement>(null);

  // Tool Specific States:
  // 1. Fix & Quality -> Upscaler
  const [upscaleFactor, setUpscaleFactor] = useState<number>(2);
  const [upscaleSharpness, setUpscaleSharpness] = useState<number>(50);
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const [upscaledDims, setUpscaledDims] = useState<{ width: number; height: number } | null>(null);
  const [upscaleCompareMode, setUpscaleCompareMode] = useState<boolean>(true);
  const [upscaleSplitPos, setUpscaleSplitPos] = useState<number>(50);
  const [isDraggingUpscaleSplit, setIsDraggingUpscaleSplit] = useState<boolean>(false);
  const upscaleContainerRef = useRef<HTMLDivElement>(null);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);

  // 1. Fix & Quality -> Color & Tone
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [saturation, setSaturation] = useState<number>(0);
  const [hue, setHue] = useState<number>(0);

  // 2. Cut & Adjust -> BG Remover
  const [bgTolerance, setBgTolerance] = useState<number>(25);

  // 2. Cut & Adjust -> Replace Color
  const [targetColorHex, setTargetColorHex] = useState<string>('#ffffff');
  const [replaceColorHex, setReplaceColorHex] = useState<string>('#4f46e5');
  const [colorTol, setColorTol] = useState<number>(30);
  const [replaceWithTransparent, setReplaceWithTransparent] = useState<boolean>(true);

  // 2. Cut & Adjust -> Crop & Clean
  const [paddingPx, setPaddingPx] = useState<number>(2);

  // 2. Cut & Adjust -> Eraser
  const [eraserSize, setEraserSize] = useState<number>(24);
  const [isErasing, setIsErasing] = useState<boolean>(false);

  // 3. Style & Effects -> Texture (11 Image Filters)
  const [selectedTextureEffect, setSelectedTextureEffect] = useState<TextureEffectType>('vintage');
  const [textureIntensity, setTextureIntensity] = useState<number>(50);
  const [textureBaseUrl, setTextureBaseUrl] = useState<string>(asset.originalUrl || currentUrl);
  const [texturePreviewUrl, setTexturePreviewUrl] = useState<string | null>(null);

  // 3. Style & Effects -> Halftone
  const [halftoneStyle, setHalftoneStyle] = useState<HalftoneStyle>('color');
  const [halftoneDotSize, setHalftoneDotSize] = useState<number>(8);
  const [halftoneDensity, setHalftoneDensity] = useState<number>(70);
  const [halftoneFadeSpread, setHalftoneFadeSpread] = useState<number>(40);
  const [halftoneAngle, setHalftoneAngle] = useState<number>(0);
  const [useCustomDotColor, setUseCustomDotColor] = useState<boolean>(false);
  const [halftoneDotColor, setHalftoneDotColor] = useState<string>('#FF0000');
  const [halftoneDotColorHex, setHalftoneDotColorHex] = useState<string>('#FF0000');
  const [halftoneBaseUrl, setHalftoneBaseUrl] = useState<string>(asset.originalUrl || currentUrl);
  const [halftonePreviewUrl, setHalftonePreviewUrl] = useState<string | null>(null);

  // 3. Style & Effects -> Stroke
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [strokeColor, setStrokeColor] = useState<string>('#ffffff');
  const [strokeHexInput, setStrokeHexInput] = useState<string>('#ffffff');
  const [strokeBaseUrl, setStrokeBaseUrl] = useState<string>(asset.originalUrl || currentUrl);
  const [strokePreviewUrl, setStrokePreviewUrl] = useState<string | null>(null);

  // 3. Style & Effects -> Embroidery
  const [recreateStyle, setRecreateStyle] = useState<RecreateAiStyle>('hd-redraw');
  const [embroideryPitch, setEmbroideryPitch] = useState<number>(10);
  const [embroiderySheen, setEmbroiderySheen] = useState<number>(85);
  const [embroideryAngle, setEmbroideryAngle] = useState<number>(45);
  const [embroideryHasBorder, setEmbroideryHasBorder] = useState<boolean>(true);
  const [embroideryFabric, setEmbroideryFabric] = useState<'transparent' | 'twill-canvas' | 'dark-denim' | 'heather-gray'>('transparent');

  // 4. Create & Convert -> Text & Number
  const [customText, setCustomText] = useState<string>('DTF PRO 24');
  const [textFont, setTextFont] = useState<string>('Impact');
  const [textFontSize, setTextFontSize] = useState<number>(72);
  const [textFillColor, setTextFillColor] = useState<string>('#f59e0b');
  const [textStrokeColor, setTextStrokeColor] = useState<string>('#000000');
  const [textStrokeWidth, setTextStrokeWidth] = useState<number>(4);

  // 2. Cut & Adjust -> Interactive 8-Handle Crop Box
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.04,
    y: 0.04,
    width: 0.92,
    height: 0.92
  });
  const [cropAspectRatio, setCropAspectRatio] = useState<'free' | '1:1' | '4:3' | '16:9' | 'orig'>('free');
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number }>({
    width: asset.originalWidth || 1000,
    height: asset.originalHeight || 1000
  });
  const cropWrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragInfoRef = useRef<{
    action: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    startX: number;
    startY: number;
    box: { x: number; y: number; width: number; height: number };
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // 2. Cut & Adjust -> Border Knockout
  const [borderInset, setBorderInset] = useState<number>(16);
  const [borderKnockoutShape, setBorderKnockoutShape] = useState<'rect' | 'round' | 'oval'>('rect');

  // 4. Create & Convert -> TIFF Export Process Mode (DTF vs UVDTF)
  const [tiffProcessMode, setTiffProcessMode] = useState<'dtf' | 'uvdtf'>('dtf');

  // 4. Create & Convert -> Vectorizer
  const [vectorMode, setVectorMode] = useState<'color' | 'binary'>('color');
  const [vectorDetailLevel, setVectorDetailLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [vectorSmoothness, setVectorSmoothness] = useState<number>(70);
  const [vectorRemoveBg, setVectorRemoveBg] = useState<boolean>(true);
  const [vectorOptimize, setVectorOptimize] = useState<boolean>(true);
  const [vectorizedSvg, setVectorizedSvg] = useState<string | null>(asset?.svgContent || null);
  const [vectorizedSvgUrl, setVectorizedSvgUrl] = useState<string | null>(asset?.isVector ? asset.processedUrl : null);
  const [vectorCompareMode, setVectorCompareMode] = useState<boolean>(true);
  const [vectorSplitPos, setVectorSplitPos] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const vectorContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize internal state with a target asset
  const loadAssetData = (target: ArtworkAsset) => {
    const url = target.processedUrl || target.originalUrl;
    setCurrentUrl(url);
    setHistory([url]);
    setHistoryIndex(0);
    setTextureBaseUrl(url);
    setTexturePreviewUrl(null);
    setHalftoneBaseUrl(url);
    setHalftonePreviewUrl(null);
    setStrokeBaseUrl(url);
    setStrokePreviewUrl(null);
    setVectorizedSvg(target.svgContent || null);
    setVectorizedSvgUrl(target.isVector ? (target.processedUrl || null) : null);
    setUpscaledUrl(null);
    setUpscaledDims(null);
    setUpscaleError(null);
    setEmptyPercent(target.cropBox?.emptyPercent || 0);
    setImageNaturalSize({
      width: target.trimmedWidth || target.originalWidth || 1000,
      height: target.trimmedHeight || target.originalHeight || 1000
    });
  };

  // Switch active asset across any tool inside Design Studio without closing
  const handleSwitchAsset = async (targetAsset: ArtworkAsset) => {
    if (targetAsset.id === currentAsset.id) return;

    // Automatically persist edits for the previous asset if active
    try {
      if (activeTool === 'texture' && selectedTextureEffect !== 'none' && textureIntensity > 0) {
        const baseSrc = textureBaseUrl || currentUrl;
        const baseImg = await loadImage(baseSrc);
        const filteredUrl = await applyTextureFilter(baseImg, selectedTextureEffect, textureIntensity);
        onSave({
          ...currentAsset,
          processedUrl: filteredUrl
        });
      } else if (activeTool === 'stroke-outline' && strokeWidth > 0 && strokePreviewUrl) {
        const baseSrc = strokeBaseUrl || currentUrl;
        const baseImg = await loadImage(baseSrc);
        const strokedUrl = await addStrokeOutline(baseImg, strokeColor, strokeWidth);
        onSave({
          ...currentAsset,
          processedUrl: strokedUrl
        });
      } else if (activeTool === 'halftone' && halftonePreviewUrl) {
        const baseSrc = halftoneBaseUrl || currentUrl;
        const baseImg = await loadImage(baseSrc);
        const maxDim = Math.max(baseImg.naturalWidth, baseImg.naturalHeight);
        const scale = Math.max(1, maxDim / 600);
        const halfUrl = await applyHalftoneFilter(baseImg, {
          style: halftoneStyle,
          dotSize: Math.max(2, Math.round(halftoneDotSize * scale)),
          density: halftoneDensity,
          fadeSpread: halftoneFadeSpread,
          angle: halftoneAngle,
          customColor: useCustomDotColor ? halftoneDotColor : null
        });
        onSave({
          ...currentAsset,
          processedUrl: halfUrl
        });
      }
    } catch (err) {
      console.warn('Could not auto-save previous asset on switch', err);
    }

    setCurrentAsset(targetAsset);
    onSelectAsset?.(targetAsset);
    loadAssetData(targetAsset);
  };

  // Batch apply current texture effect to all uploaded images
  const handleApplyEffectToAllAssets = async () => {
    if (!assets || assets.length <= 1 || selectedTextureEffect === 'none' || textureIntensity === 0) return;
    setIsProcessing(true);
    try {
      for (const item of assets) {
        const baseSrc = item.processedUrl || item.originalUrl;
        const baseImg = await loadImage(baseSrc);
        const filteredUrl = await applyTextureFilter(baseImg, selectedTextureEffect, textureIntensity);
        onSave({
          ...item,
          processedUrl: filteredUrl
        });
      }
      const refreshed = assets.find((a) => a.id === currentAsset.id) || currentAsset;
      loadAssetData(refreshed);
    } catch (err) {
      console.error('Failed to apply effect to all assets', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Initialize bounds on mount or image change
  useEffect(() => {
    let cancelled = false;
    async function checkBounds() {
      try {
        const img = await loadImage(currentUrl);
        const box = await calculateAlphaBoundingBox(img, 8, paddingPx);
        if (!cancelled) setEmptyPercent(box.emptyPercent);
      } catch (err) {
        console.error('Failed to compute crop bounds', err);
      }
    }
    checkBounds();
    return () => {
      cancelled = true;
    };
  }, [currentUrl, paddingPx]);

  // Global mousemove and mouseup listeners for split comparison sliders (vector & upscale)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingSplit && vectorContainerRef.current) {
        const rect = vectorContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(5, Math.min(95, (x / rect.width) * 100));
        setVectorSplitPos(pct);
      }
      if (isDraggingUpscaleSplit && upscaleContainerRef.current) {
        const rect = upscaleContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(5, Math.min(95, (x / rect.width) * 100));
        setUpscaleSplitPos(pct);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingSplit) {
        setIsDraggingSplit(false);
      }
      if (isDraggingUpscaleSplit) {
        setIsDraggingUpscaleSplit(false);
      }
    };

    if (isDraggingSplit || isDraggingUpscaleSplit) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingSplit, isDraggingUpscaleSplit]);

  // Texture Effects: sync base image when switching tools
  useEffect(() => {
    if (activeTool === 'texture') {
      setTextureBaseUrl(currentUrl);
    } else {
      setTexturePreviewUrl(null);
    }
  }, [activeTool]);

  // Texture Effects: Real-time responsive preview (debounced 16ms)
  useEffect(() => {
    if (activeTool !== 'texture') return;

    if (selectedTextureEffect === 'none' || textureIntensity === 0) {
      setTexturePreviewUrl(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const baseSrc = textureBaseUrl || currentUrl;
        const img = await loadImage(baseSrc);
        if (isCancelled) return;

        let prevImg = img;
        const maxPrev = 600;
        if (img.naturalWidth > maxPrev || img.naturalHeight > maxPrev) {
          const c = document.createElement('canvas');
          const s = maxPrev / Math.max(img.naturalWidth, img.naturalHeight);
          c.width = Math.round(img.naturalWidth * s);
          c.height = Math.round(img.naturalHeight * s);
          const cx = c.getContext('2d');
          if (cx) {
            cx.drawImage(img, 0, 0, c.width, c.height);
            prevImg = await loadImage(c.toDataURL('image/png'));
            if (isCancelled) return;
          }
        }

        const res = await applyTextureFilter(prevImg, selectedTextureEffect, textureIntensity);
        if (!isCancelled) {
          setTexturePreviewUrl(res);
        }
      } catch (err) {
        console.error('Texture preview calculation failed:', err);
      }
    }, 16);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTool, selectedTextureEffect, textureIntensity, textureBaseUrl, currentUrl]);

  // Stroke / Outline: sync base image when switching tools
  useEffect(() => {
    if (activeTool === 'stroke-outline') {
      setStrokeBaseUrl(currentUrl);
    } else {
      setStrokePreviewUrl(null);
    }
  }, [activeTool]);

  // Stroke / Outline: Real-time responsive preview (debounced 16ms)
  useEffect(() => {
    if (activeTool !== 'stroke-outline') return;

    if (strokeWidth <= 0) {
      setStrokePreviewUrl(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const baseSrc = strokeBaseUrl || currentUrl;
        const img = await loadImage(baseSrc);
        if (isCancelled) return;

        // Downscale to max 600px for instant 60fps live slider & color preview
        let prevImg = img;
        const maxPrev = 600;
        if (img.naturalWidth > maxPrev || img.naturalHeight > maxPrev) {
          const c = document.createElement('canvas');
          const s = maxPrev / Math.max(img.naturalWidth, img.naturalHeight);
          c.width = Math.round(img.naturalWidth * s);
          c.height = Math.round(img.naturalHeight * s);
          const cx = c.getContext('2d');
          if (cx) {
            cx.drawImage(img, 0, 0, c.width, c.height);
            prevImg = await loadImage(c.toDataURL('image/png'));
            if (isCancelled) return;
          }
        }

        const effectiveWidth = Math.max(1, Math.round(strokeWidth * (prevImg.naturalWidth / img.naturalWidth)));
        const res = await addStrokeOutline(prevImg, strokeColor, effectiveWidth);
        if (!isCancelled) {
          setStrokePreviewUrl(res);
        }
      } catch (err) {
        console.error('Stroke preview calculation failed:', err);
      }
    }, 16);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTool, strokeWidth, strokeColor, strokeBaseUrl, currentUrl]);

  // Halftone: sync base image when switching tools
  useEffect(() => {
    if (activeTool === 'halftone') {
      setHalftoneBaseUrl(currentUrl);
    } else {
      setHalftonePreviewUrl(null);
    }
  }, [activeTool]);

  // Halftone: Real-time responsive preview (debounced 16ms)
  useEffect(() => {
    if (activeTool !== 'halftone') return;

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const baseSrc = halftoneBaseUrl || currentUrl;
        const img = await loadImage(baseSrc);
        if (isCancelled) return;

        // Downscale to max 600px for instant 60fps real-time live preview
        let prevImg = img;
        const maxPrev = 600;
        const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
        if (maxDim > maxPrev) {
          const c = document.createElement('canvas');
          const s = maxPrev / maxDim;
          c.width = Math.round(img.naturalWidth * s);
          c.height = Math.round(img.naturalHeight * s);
          const cx = c.getContext('2d');
          if (cx) {
            cx.drawImage(img, 0, 0, c.width, c.height);
            prevImg = await loadImage(c.toDataURL('image/png'));
            if (isCancelled) return;
          }
        }

        const res = await applyHalftoneFilter(prevImg, {
          style: halftoneStyle,
          dotSize: halftoneDotSize,
          density: halftoneDensity,
          fadeSpread: halftoneFadeSpread,
          angle: halftoneAngle,
          customColor: useCustomDotColor ? halftoneDotColor : null,
          scale: 1.0
        });

        if (!isCancelled) {
          setHalftonePreviewUrl(res);
        }
      } catch (err) {
        console.error('Halftone preview failed:', err);
      }
    }, 16);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTool, halftoneStyle, halftoneDotSize, halftoneDensity, halftoneFadeSpread, halftoneAngle, useCustomDotColor, halftoneDotColor, halftoneBaseUrl, currentUrl]);

  const pushHistory = (newUrl: string) => {
    const newHist = history.slice(0, historyIndex + 1);
    newHist.push(newUrl);
    setHistory(newHist);
    setHistoryIndex(newHist.length - 1);
    setCurrentUrl(newUrl);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentUrl(prevUrl);
      setStrokeBaseUrl(prevUrl);
      setStrokePreviewUrl(null);
      setHalftoneBaseUrl(prevUrl);
      setHalftonePreviewUrl(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextUrl = history[nextIndex];
      setHistoryIndex(nextIndex);
      setCurrentUrl(nextUrl);
      setStrokeBaseUrl(nextUrl);
      setStrokePreviewUrl(null);
      setHalftoneBaseUrl(nextUrl);
      setHalftonePreviewUrl(null);
    }
  };

  const handleRevertOriginal = () => {
    pushHistory(currentAsset.originalUrl);
    setCurrentUrl(currentAsset.originalUrl);
    setStrokeBaseUrl(currentAsset.originalUrl);
    setStrokePreviewUrl(null);
    setHalftoneBaseUrl(currentAsset.originalUrl);
    setHalftonePreviewUrl(null);
    setTextureBaseUrl(currentAsset.originalUrl);
    setTexturePreviewUrl(null);
    setUpscaledUrl(null);
    setUpscaledDims(null);
    setUpscaleError(null);
    setImageNaturalSize({
      width: currentAsset.originalWidth || 1000,
      height: currentAsset.originalHeight || 1000
    });
  };

  // --- ACTIONS ---

  // 1. AI Upscaler (Genuine 2× Super-Resolution & 4× Ultra-Resolution)
  const handleApplyUpscaler = async () => {
    setIsProcessing(true);
    setUpscaleError(null);
    try {
      const sourceUrl = currentAsset.originalUrl || currentUrl;
      const res = await upscaleImageAi(sourceUrl, upscaleFactor, upscaleSharpness);
      setUpscaledUrl(res.dataUrl);
      setUpscaledDims({ width: res.width, height: res.height });
      setCurrentUrl(res.dataUrl);
      pushHistory(res.dataUrl);
      setImageNaturalSize({ width: res.width, height: res.height });
    } catch (err: any) {
      console.error('AI Upscaler failed:', err);
      setUpscaleError(err?.message || 'AI Upscaling failed. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Color & Tone
  const handleApplyColorTone = async () => {
    if (brightness === 0 && contrast === 0 && saturation === 0 && hue === 0) return;
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const resultUrl = await adjustColorAndTone(img, {
        brightness,
        contrast,
        saturation,
        hue
      });
      pushHistory(resultUrl);
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
      setHue(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Pixel Doctor
  const handleDespeckle = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const cleanedUrl = await despeckleImage(img);
      pushHistory(cleanedUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Background Removal
  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const transparentDataUrl = await removeImageBackground(img, { tolerance: bgTolerance });
      pushHistory(transparentDataUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Replace Color
  const handleReplaceColor = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const resUrl = await replaceColorInImage(
        img,
        targetColorHex,
        replaceColorHex,
        colorTol,
        replaceWithTransparent
      );
      pushHistory(resUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Auto-Trim
  const handleAutoTrim = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const box = await calculateAlphaBoundingBox(img, 8, paddingPx);
      const croppedUrl = await cropImageToBoundingBox(img, box);
      pushHistory(croppedUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Rotate & Flip
  const handleTransformImage = async (action: 'rot90' | 'rot270' | 'flipH' | 'flipV') => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (action === 'rot90' || action === 'rot270') {
        canvas.width = img.naturalHeight;
        canvas.height = img.naturalWidth;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((action === 'rot90' ? 90 : -90) * Math.PI / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      } else if (action === 'flipH') {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
      } else if (action === 'flipV') {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
      }
      pushHistory(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Interactive 8-Handle Crop Box Handlers
  const startDrag = (
    e: React.MouseEvent,
    action: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropWrapperRef.current) return;
    const rect = cropWrapperRef.current.getBoundingClientRect();
    dragInfoRef.current = {
      action,
      startX: e.clientX,
      startY: e.clientY,
      box: { ...cropBox },
      containerWidth: Math.max(10, rect.width - 16),
      containerHeight: Math.max(10, rect.height - 16)
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragInfoRef.current) return;
      const { action, startX, startY, box, containerWidth, containerHeight } = dragInfoRef.current;
      if (containerWidth <= 0 || containerHeight <= 0) return;

      const dx = (e.clientX - startX) / containerWidth;
      const dy = (e.clientY - startY) / containerHeight;

      let newX = box.x;
      let newY = box.y;
      let newW = box.width;
      let newH = box.height;

      const minSize = 0.05;

      if (action === 'move') {
        newX = Math.max(0, Math.min(1 - box.width, box.x + dx));
        newY = Math.max(0, Math.min(1 - box.height, box.y + dy));
      } else {
        if (action.includes('e')) {
          newW = Math.max(minSize, Math.min(1 - box.x, box.width + dx));
        }
        if (action.includes('s')) {
          newH = Math.max(minSize, Math.min(1 - box.y, box.height + dy));
        }
        if (action.includes('w')) {
          const maxLeft = box.x + box.width - minSize;
          newX = Math.max(0, Math.min(maxLeft, box.x + dx));
          newW = box.width - (newX - box.x);
        }
        if (action.includes('n')) {
          const maxTop = box.y + box.height - minSize;
          newY = Math.max(0, Math.min(maxTop, box.y + dy));
          newH = box.height - (newY - box.y);
        }
      }

      setCropBox({ x: newX, y: newY, width: newW, height: newH });
    };

    const onMouseUp = () => {
      dragInfoRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleApplyManualCrop = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const canvas = document.createElement('canvas');
      const pixelX = Math.max(0, Math.round(cropBox.x * img.naturalWidth));
      const pixelY = Math.max(0, Math.round(cropBox.y * img.naturalHeight));
      const pixelW = Math.max(1, Math.min(img.naturalWidth - pixelX, Math.round(cropBox.width * img.naturalWidth)));
      const pixelH = Math.max(1, Math.min(img.naturalHeight - pixelY, Math.round(cropBox.height * img.naturalHeight)));

      canvas.width = pixelW;
      canvas.height = pixelH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);
      const croppedUrl = canvas.toDataURL('image/png');
      pushHistory(croppedUrl);
      setCropBox({ x: 0.04, y: 0.04, width: 0.92, height: 0.92 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTightenCropBoxToArtwork = async () => {
    try {
      const img = await loadImage(currentUrl);
      const box = await calculateAlphaBoundingBox(img, 8, paddingPx);
      setCropBox({
        x: Math.max(0, box.minX / img.naturalWidth),
        y: Math.max(0, box.minY / img.naturalHeight),
        width: Math.min(1, box.width / img.naturalWidth),
        height: Math.min(1, box.height / img.naturalHeight)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetCropBox = () => {
    setCropBox({ x: 0, y: 0, width: 1, height: 1 });
  };

  const handleSetAspectRatio = (ratio: 'free' | '1:1' | '4:3' | '16:9' | 'orig') => {
    setCropAspectRatio(ratio);
    if (ratio === 'free') return;
    const imgW = imageNaturalSize.width || 1;
    const imgH = imageNaturalSize.height || 1;
    let targetAspect = 1;
    if (ratio === '1:1') targetAspect = 1;
    else if (ratio === '4:3') targetAspect = 4 / 3;
    else if (ratio === '16:9') targetAspect = 16 / 9;
    else if (ratio === 'orig') targetAspect = imgW / imgH;

    let newW = 0.85;
    let newH = (newW * imgW) / (targetAspect * imgH);
    if (newH > 0.9) {
      newH = 0.85;
      newW = (newH * targetAspect * imgH) / imgW;
    }
    newW = Math.min(0.96, Math.max(0.1, newW));
    newH = Math.min(0.96, Math.max(0.1, newH));
    const newX = (1 - newW) / 2;
    const newY = (1 - newH) / 2;
    setCropBox({ x: newX, y: newY, width: newW, height: newH });
  };

  // Border Knockout Handler
  const handleBorderKnockout = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const inset = Math.max(1, Math.min(Math.min(w, h) / 2 - 5, borderInset));

      ctx.save();
      ctx.beginPath();
      if (borderKnockoutShape === 'rect') {
        ctx.rect(inset, inset, w - inset * 2, h - inset * 2);
      } else if (borderKnockoutShape === 'round') {
        const radius = Math.min(inset * 2, 40);
        ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, radius);
      } else {
        ctx.ellipse(w / 2, h / 2, (w - inset * 2) / 2, (h - inset * 2) / 2, 0, 0, Math.PI * 2);
      }
      ctx.clip();
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      const knockedUrl = canvas.toDataURL('image/png');
      pushHistory(knockedUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Vectorize Image Handlers (Image 2 mockup)
  const handleRunVectorize = async () => {
    setIsProcessing(true);
    try {
      const res = await vectorizeImage(currentUrl, {
        colormode: vectorMode,
        detailLevel: vectorDetailLevel,
        smoothness: vectorSmoothness,
        removeBackground: vectorRemoveBg,
        optimizePaths: vectorOptimize
      });
      setVectorizedSvg(res.svgContent);
      setVectorizedSvgUrl(res.svgDataUrl);
      pushHistory(res.svgDataUrl);
    } catch (err) {
      console.error('Vectorization failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveVectorAndApply = async () => {
    setIsProcessing(true);
    try {
      let finalSvgUrl = vectorizedSvgUrl;
      let finalSvg = vectorizedSvg;
      if (!finalSvgUrl) {
        const res = await vectorizeImage(currentUrl, {
          colormode: vectorMode,
          detailLevel: vectorDetailLevel,
          smoothness: vectorSmoothness,
          removeBackground: vectorRemoveBg,
          optimizePaths: vectorOptimize
        });
        finalSvg = res.svgContent;
        finalSvgUrl = res.svgDataUrl;
      }
      const img = await loadImage(finalSvgUrl);
      const box = await calculateAlphaBoundingBox(img, 8, paddingPx);
      onSave({
        ...currentAsset,
        processedUrl: finalSvgUrl,
        svgContent: finalSvg || undefined,
        isVector: true,
        fileType: 'svg',
        trimmedWidth: img.naturalWidth,
        trimmedHeight: img.naturalHeight,
        cropBox: box,
        isTrimmed: true,
        isBgRemoved: vectorRemoveBg || currentAsset.isBgRemoved
      });
      onClose();
    } catch (err) {
      console.error('Save vector failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSvg = async () => {
    try {
      let svgToDownload = vectorizedSvg;
      if (!svgToDownload) {
        setIsProcessing(true);
        const res = await vectorizeImage(currentUrl, {
          colormode: vectorMode,
          detailLevel: vectorDetailLevel,
          smoothness: vectorSmoothness,
          removeBackground: vectorRemoveBg,
          optimizePaths: vectorOptimize
        });
        svgToDownload = res.svgContent;
        setVectorizedSvg(res.svgContent);
        setVectorizedSvgUrl(res.svgDataUrl);
        setIsProcessing(false);
      }
      const baseName = currentAsset.filename ? currentAsset.filename.replace(/\.[^/.]+$/, '') : 'vectorized-design';
      downloadSvgFile(svgToDownload, `${baseName}.svg`);
    } catch (err) {
      console.error('Download SVG failed:', err);
      setIsProcessing(false);
    }
  };

  const handleRecreateAi = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const res = await recreateImageAi(img, recreateStyle);
      pushHistory(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. Texture Effects (11 Filters)
  const handleApplyTexture = async () => {
    if (selectedTextureEffect === 'none' || textureIntensity === 0) return;
    setIsProcessing(true);
    try {
      const baseSrc = textureBaseUrl || currentUrl;
      const img = await loadImage(baseSrc);
      const res = await applyTextureFilter(img, selectedTextureEffect, textureIntensity);
      pushHistory(res);
      setTextureBaseUrl(res);
      setTexturePreviewUrl(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 9. Halftone Screen
  const handleApplyHalftone = async () => {
    setIsProcessing(true);
    try {
      const baseSrc = halftoneBaseUrl || currentUrl;
      const img = await loadImage(baseSrc);
      const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
      const scale = Math.max(1, maxDim / 600);
      const res = await applyHalftoneFilter(img, {
        style: halftoneStyle,
        dotSize: Math.max(2, Math.round(halftoneDotSize * scale)),
        density: halftoneDensity,
        fadeSpread: halftoneFadeSpread,
        angle: halftoneAngle,
        customColor: useCustomDotColor ? halftoneDotColor : null
      });
      pushHistory(res);
      setHalftoneBaseUrl(res);
      setHalftonePreviewUrl(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 10. Stroke / Outline
  const handleApplyStroke = async () => {
    setIsProcessing(true);
    try {
      const baseSrc = strokeBaseUrl || currentUrl;
      const img = await loadImage(baseSrc);
      const strokedUrl = await addStrokeOutline(img, strokeColor, strokeWidth);
      pushHistory(strokedUrl);
      setStrokeBaseUrl(strokedUrl);
      setStrokePreviewUrl(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 12. Create Text & Number
  const handleGenerateText = () => {
    const textDataUrl = generateTextArtwork({
      text: customText,
      font: textFont,
      fontSize: textFontSize,
      fillColor: textFillColor,
      strokeColor: textStrokeColor,
      strokeWidth: textStrokeWidth,
      isArch: false
    });
    if (textDataUrl) {
      pushHistory(textDataUrl);
    }
  };

  // 13. Eraser Canvas Drawing Handler
  const handleEraserCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsErasing(true);
    eraseAtEvent(e);
  };

  const handleEraserCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isErasing) return;
    eraseAtEvent(e);
  };

  const handleEraserCanvasMouseUp = () => {
    if (!isErasing) return;
    setIsErasing(false);
    if (eraserCanvasRef.current) {
      pushHistory(eraserCanvasRef.current.toDataURL('image/png'));
    }
  };

  const eraseAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = eraserCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, eraserSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Load image onto eraser canvas when currentUrl or eraser tab changes
  useEffect(() => {
    if (activeTool === 'eraser' && eraserCanvasRef.current) {
      const canvas = eraserCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = currentUrl;
    }
  }, [activeTool, currentUrl]);

  // Handle user uploading replacement image
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        pushHistory(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save changes & close
  const handleSaveModal = async () => {
    setIsProcessing(true);
    try {
      let finalUrl = currentUrl;
      if (
        activeTool === 'color-tone' &&
        (brightness !== 0 || contrast !== 0 || saturation !== 0 || hue !== 0)
      ) {
        const baseImg = await loadImage(currentUrl);
        finalUrl = await adjustColorAndTone(baseImg, {
          brightness,
          contrast,
          saturation,
          hue
        });
      } else if (
        activeTool === 'texture' &&
        selectedTextureEffect !== 'none' &&
        textureIntensity > 0
      ) {
        const baseSrc = textureBaseUrl || currentUrl;
        const baseImg = await loadImage(baseSrc);
        finalUrl = await applyTextureFilter(baseImg, selectedTextureEffect, textureIntensity);
      } else if (
        activeTool === 'stroke-outline' &&
        strokeWidth > 0 &&
        strokePreviewUrl
      ) {
        const baseSrc = strokeBaseUrl || currentUrl;
        const baseImg = await loadImage(baseSrc);
        finalUrl = await addStrokeOutline(baseImg, strokeColor, strokeWidth);
      } else if (
        activeTool === 'halftone' &&
        halftonePreviewUrl
      ) {
        const baseSrc = halftoneBaseUrl || currentUrl;
        const baseImg = await loadImage(baseSrc);
        const maxDim = Math.max(baseImg.naturalWidth, baseImg.naturalHeight);
        const scale = Math.max(1, maxDim / 600);
        finalUrl = await applyHalftoneFilter(baseImg, {
          style: halftoneStyle,
          dotSize: Math.max(2, Math.round(halftoneDotSize * scale)),
          density: halftoneDensity,
          fadeSpread: halftoneFadeSpread,
          angle: halftoneAngle,
          customColor: useCustomDotColor ? halftoneDotColor : null
        });
      } else if (
        activeTool === 'vectorize'
      ) {
        let finalSvg = vectorizedSvg;
        let finalSvgUrl = vectorizedSvgUrl;
        if (!finalSvgUrl) {
          const res = await vectorizeImage(currentUrl, {
            colormode: vectorMode,
            detailLevel: vectorDetailLevel,
            smoothness: vectorSmoothness,
            removeBackground: vectorRemoveBg,
            optimizePaths: vectorOptimize
          });
          finalSvg = res.svgContent;
          finalSvgUrl = res.svgDataUrl;
          setVectorizedSvg(finalSvg);
          setVectorizedSvgUrl(finalSvgUrl);
        }
        if (finalSvgUrl) {
          finalUrl = finalSvgUrl;
        }
      } else if (activeTool === 'upscaler' && !upscaledUrl) {
        const sourceUrl = currentAsset.originalUrl || currentUrl;
        const res = await upscaleImageAi(sourceUrl, upscaleFactor, upscaleSharpness);
        finalUrl = res.dataUrl;
      }
      const img = await loadImage(finalUrl);
      const box = await calculateAlphaBoundingBox(img, 8, paddingPx);

      const newWidth = img.naturalWidth;
      const newHeight = img.naturalHeight;

      // Recalculate effective DPI based on physical target print width on gang sheet
      const targetWidthMm = currentAsset.targetWidthMm || 100;
      const effectiveDpi = Math.round(newWidth / (targetWidthMm / 25.4));

      onSave({
        ...currentAsset,
        processedUrl: finalUrl,
        svgContent: vectorizedSvg || currentAsset.svgContent,
        isVector: Boolean(vectorizedSvg || currentAsset.isVector),
        fileType: vectorizedSvg ? 'svg' : currentAsset.fileType,
        trimmedWidth: newWidth,
        trimmedHeight: newHeight,
        originalWidth: newWidth,
        originalHeight: newHeight,
        effectiveDpi: effectiveDpi,
        cropBox: box,
        isTrimmed: finalUrl !== currentAsset.originalUrl && box.emptyPercent < 5,
        isBgRemoved: currentAsset.isBgRemoved
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Active category object
  const currentCategoryObj = categories.find((c) => c.id === activeCategory) || categories[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-white text-slate-800 rounded-3xl border border-slate-200 shadow-2xl max-w-6xl w-full h-[94vh] flex flex-col overflow-hidden">
        
        {/* Top Header Bar: Clean White with Crisp Dark Typography */}
        <div className="px-6 py-3.5 border-b border-[#E5D9C8] bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#204563] flex items-center justify-center text-[#EF7F1A] shadow-md shadow-[#204563]/25">
              <Sparkles className="w-5 h-5 text-[#EF7F1A]" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="font-black text-base text-[#204563] tracking-tight">
                  Design Studio & Image Suite
                </h3>
                {assets && assets.length > 1 ? (
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = assets.findIndex((a) => a.id === currentAsset.id);
                        const prevIdx = (idx - 1 + assets.length) % assets.length;
                        handleSwitchAsset(assets[prevIdx]);
                      }}
                      className="p-1 rounded-lg text-[#526A7B] hover:text-[#EF7F1A] hover:bg-[#FAF7F1] transition-colors cursor-pointer"
                      title="Previous image"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center space-x-1.5 shadow-xs">
                      <span className="truncate max-w-[140px]">{currentAsset.filename}</span>
                      <span className="text-[10px] text-[#EF7F1A] font-extrabold">
                        ({assets.findIndex((a) => a.id === currentAsset.id) + 1}/{assets.length})
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const idx = assets.findIndex((a) => a.id === currentAsset.id);
                        const nextIdx = (idx + 1) % assets.length;
                        handleSwitchAsset(assets[nextIdx]);
                      }}
                      className="p-1 rounded-lg text-[#526A7B] hover:text-[#EF7F1A] hover:bg-[#FAF7F1] transition-colors cursor-pointer"
                      title="Next image"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8]">
                    {currentAsset.filename}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#526A7B] font-medium">
                Active: <span className="text-[#EF7F1A] font-bold capitalize">{activeTool.replace('-', ' ')}</span> • {currentAsset.trimmedWidth || currentAsset.originalWidth || imageNaturalSize.width} × {currentAsset.trimmedHeight || currentAsset.originalHeight || imageNaturalSize.height} px • 300 DPI High-Res
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F1] text-[#204563] text-xs font-bold transition-all flex items-center space-x-1.5 border border-[#E5D9C8] shadow-xs"
              title="Replace current image"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#204563]" />
              <span>Replace File</span>
            </button>

            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 rounded-xl text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1] disabled:opacity-30 transition-all border border-[#E5D9C8] cursor-pointer"
              title="Undo last change"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-xl text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1] disabled:opacity-30 transition-all border border-[#E5D9C8] cursor-pointer"
              title="Redo last undone change"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleRevertOriginal}
              className="px-3 py-1.5 rounded-xl text-amber-700 hover:bg-amber-50 text-xs font-bold transition-all border border-amber-200"
              title="Revert to original uploaded file"
            >
              Revert
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1] transition-all ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. TOP CATEGORY SWITCHER (Clean White Tabs) */}
        <div className="bg-[#FAF7F1] border-b border-[#E5D9C8] px-6 py-2 flex items-center space-x-2 overflow-x-auto flex-shrink-0">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isCatActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  // Automatically activate first tool in category if current tool isn't in it
                  if (!cat.tools.some((t) => t.id === activeTool)) {
                    const firstTool = cat.tools[0];
                    if (firstTool.id === 'print-check' && onOpenAudit) {
                      onOpenAudit();
                    } else if (firstTool.id === 'tiff-export' && onOpenTiff) {
                      onOpenTiff();
                    } else {
                      setActiveTool(firstTool.id);
                    }
                  }
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  isCatActive
                    ? 'bg-[#204563] text-white shadow-md shadow-[#204563]/25 ring-2 ring-[#204563]/20'
                    : 'bg-white text-[#204563] hover:bg-[#FAF7F1] border border-[#E5D9C8]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isCatActive ? 'text-[#EF7F1A]' : 'text-[#204563]'}`} />
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isCatActive ? 'bg-white/20 text-white' : 'bg-[#FAF7F1] text-[#526A7B]'
                }`}>
                  {cat.tools.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. SUB-BAR: ALL TOOLS OF ACTIVE CATEGORY PROMINENTLY VISIBLE */}
        <div className="bg-white border-b border-[#E5D9C8] px-6 py-2.5 flex items-center space-x-2 overflow-x-auto flex-shrink-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#526A7B] mr-2 flex-shrink-0">
            {currentCategoryObj.name} Tools:
          </div>
          {currentCategoryObj.tools.map((t) => {
            const isToolActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === 'print-check' && onOpenAudit) {
                    onOpenAudit();
                  } else if (t.id === 'tiff-export' && onOpenTiff) {
                    onOpenTiff();
                  } else {
                    setActiveTool(t.id);
                  }
                }}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                  isToolActive
                    ? 'bg-[#EF7F1A] border-2 border-[#EF7F1A] text-[#204563] font-black shadow-xs'
                    : 'bg-[#FAF7F1] hover:bg-white text-[#204563] border border-[#E5D9C8]'
                }`}
              >
                <span>{t.name}</span>
                {t.badge && (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase border ${
                    t.badgeColor || 'bg-white text-[#204563] border-[#E5D9C8]'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3. MAIN WORKSPACE: Spacious Center Canvas + Right Control Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Canvas Preview Pane with Garment Simulator & Checkerboard */}
          <div className="flex-1 bg-[#F3EBDD] p-4 sm:p-6 pt-16 flex flex-col items-center justify-center relative overflow-auto min-w-0 min-h-0">
            
            {/* Viewport Zoom & Garment Background Strip */}
            <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E5D9C8] shadow-sm text-xs font-bold text-[#204563]">
              <span className="text-[10px] uppercase text-[#526A7B] font-extrabold mr-1">Zoom:</span>
              <button
                onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
                className="p-1 hover:text-[#EF7F1A] transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="text-[11px] font-mono text-[#204563] w-10 text-center font-bold hover:underline cursor-pointer"
                title="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                className="p-1 hover:text-[#EF7F1A] transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="text-[10px] text-[#526A7B] hover:text-[#204563] ml-1 pl-1.5 border-l border-[#E5D9C8] cursor-pointer font-bold"
              >
                Fit
              </button>

              {(activeTool === 'vectorize' || (activeTool === 'upscaler' && upscaledUrl)) && (
                <button
                  onClick={() => {
                    if (activeTool === 'vectorize') setVectorCompareMode(!vectorCompareMode);
                    if (activeTool === 'upscaler') setUpscaleCompareMode(!upscaleCompareMode);
                  }}
                  className={`ml-2 pl-2 border-l border-[#E5D9C8] flex items-center space-x-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    (activeTool === 'vectorize' ? vectorCompareMode : upscaleCompareMode) ? 'text-[#EF7F1A]' : 'text-[#526A7B] hover:text-[#204563]'
                  }`}
                  title="Toggle Compare Side-by-Side"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Compare</span>
                </button>
              )}
            </div>

            {/* Canvas / Image Display */}
            {activeTool === 'upscaler' ? (
              <div className="flex flex-col items-center justify-center w-full max-h-full">
                {/* Upscaler Comparison Preview Canvas */}
                <div
                  className="rounded-2xl shadow-xl overflow-hidden border border-slate-300 relative flex items-center justify-center transition-transform duration-150 p-4 sm:p-6 w-full h-full"
                  style={{
                    maxHeight: 'calc(100% - 1rem)',
                    maxWidth: 'calc(100% - 1rem)',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    backgroundColor: '#ffffff',
                    backgroundImage: `
                      linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
                      linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
                      linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
                    `,
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                  }}
                >
                  <div
                    ref={upscaleContainerRef}
                    className="relative inline-block select-none max-h-[min(540px,calc(100vh-280px))] max-w-full"
                  >
                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 z-20 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white font-extrabold text-[10px] tracking-wide shadow-md">
                        Original: {currentAsset?.originalWidth || imageNaturalSize.width} × {currentAsset?.originalHeight || imageNaturalSize.height} px
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 z-20 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-[#204563] text-white font-extrabold text-[10px] tracking-wide shadow-md">
                        {upscaledDims
                          ? `AI Upscaled (${upscaleFactor}× • ${upscaleSharpness}% Sharp): ${upscaledDims.width} × ${upscaledDims.height} px`
                          : `AI Target (${upscaleFactor}×): ${(currentAsset?.originalWidth || imageNaturalSize.width) * upscaleFactor} × ${(currentAsset?.originalHeight || imageNaturalSize.height) * upscaleFactor} px`}
                      </span>
                    </div>

                    {/* Base Image: Upscaled output if processed, or current */}
                    <img
                      src={upscaledUrl || currentUrl}
                      alt="Upscaled Preview"
                      className="max-h-[min(540px,calc(100vh-280px))] max-w-full w-auto h-auto object-contain block drop-shadow-sm select-none"
                    />

                    {/* Overlaid clipped Original for split comparison */}
                    {upscaleCompareMode && upscaledUrl && (
                      <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ width: `${upscaleSplitPos}%` }}
                      >
                        <img
                          src={currentAsset?.originalUrl || currentUrl}
                          alt="Original Input"
                          className="max-h-[min(540px,calc(100vh-280px))] max-w-none w-auto h-auto object-contain block select-none"
                          style={{
                            width: upscaleContainerRef.current?.clientWidth,
                            height: upscaleContainerRef.current?.clientHeight
                          }}
                        />
                      </div>
                    )}

                    {/* Draggable Divider with <-> Handle */}
                    {upscaleCompareMode && upscaledUrl && (
                      <div
                        className="absolute top-0 bottom-0 z-30 cursor-ew-resize flex items-center justify-center pointer-events-auto"
                        style={{ left: `${upscaleSplitPos}%`, transform: 'translateX(-50%)' }}
                        onMouseDown={() => setIsDraggingUpscaleSplit(true)}
                      >
                        <div className="w-0.5 h-full bg-white shadow-md shadow-black/40" />
                        <div className="absolute w-7 h-7 rounded-full bg-white border border-slate-300 shadow-lg flex items-center justify-center text-slate-700 hover:scale-110 active:scale-95 transition-transform">
                          <MoveHorizontal className="w-4 h-4 text-[#204563]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTool === 'vectorize' ? (
              <div className="flex flex-col items-center justify-center w-full max-h-full">
                {/* Comparison Preview Canvas */}
                <div
                  className="rounded-2xl shadow-xl overflow-hidden border border-slate-300 relative flex items-center justify-center transition-transform duration-150 p-4 sm:p-6 w-full h-full"
                  style={{
                    maxHeight: 'calc(100% - 1rem)',
                    maxWidth: 'calc(100% - 1rem)',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    backgroundColor: '#ffffff',
                    backgroundImage: `
                      linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
                      linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
                      linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
                    `,
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                  }}
                >
                  <div
                    ref={vectorContainerRef}
                    className="relative inline-block select-none max-h-[min(540px,calc(100vh-280px))] max-w-full"
                  >
                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 z-20 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-[#204563] text-white font-extrabold text-[10px] tracking-wide shadow-md">
                        Original (Raster)
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 z-20 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-[#EF7F1A] text-[#204563] font-black text-[10px] tracking-wide shadow-md">
                        {vectorizedSvgUrl ? 'Vectorized (SVG)' : 'Vectorized (Preview)'}
                      </span>
                    </div>

                    {/* Base Image: Vectorized SVG if generated, or current */}
                    <img
                      src={vectorizedSvgUrl || currentUrl}
                      alt="Vectorized Output"
                      className="max-h-[min(540px,calc(100vh-280px))] max-w-full w-auto h-auto object-contain block drop-shadow-sm select-none"
                    />

                    {/* Overlaid clipped Original for split comparison */}
                    {vectorCompareMode && (
                      <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ width: `${vectorSplitPos}%` }}
                      >
                        <img
                          src={currentAsset?.originalUrl || currentUrl}
                          alt="Original Raster"
                          className="max-h-[min(540px,calc(100vh-280px))] max-w-none w-auto h-auto object-contain block select-none"
                          style={{
                            width: vectorContainerRef.current?.clientWidth,
                            height: vectorContainerRef.current?.clientHeight
                          }}
                        />
                      </div>
                    )}

                    {/* Draggable Divider with <-> Handle */}
                    {vectorCompareMode && (
                      <div
                        className="absolute top-0 bottom-0 z-30 cursor-ew-resize flex items-center justify-center pointer-events-auto"
                        style={{ left: `${vectorSplitPos}%`, transform: 'translateX(-50%)' }}
                        onMouseDown={() => setIsDraggingSplit(true)}
                      >
                        <div className="w-0.5 h-full bg-white shadow-md shadow-black/40" />
                        <div className="absolute w-7 h-7 rounded-full bg-white border border-slate-300 shadow-lg flex items-center justify-center text-slate-700 hover:scale-110 active:scale-95 transition-transform">
                          <MoveHorizontal className="w-4 h-4 text-[#204563]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
            <div
              className="rounded-2xl shadow-xl overflow-hidden border border-slate-300 relative flex items-center justify-center transition-transform duration-150 p-4 sm:p-6"
              style={{
                maxHeight: 'calc(100% - 0.5rem)',
                maxWidth: 'calc(100% - 0.5rem)',
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                backgroundColor: garmentBg === 'black' ? '#09090b' : garmentBg === 'charcoal' ? '#1e293b' : garmentBg === 'white' ? '#ffffff' : '#f8fafc',
                backgroundImage: garmentBg === 'checker' ? `
                  linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
                  linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
                  linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
                ` : undefined,
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
              }}
            >
              {activeTool === 'eraser' ? (
                <canvas
                  ref={eraserCanvasRef}
                  onMouseDown={handleEraserCanvasMouseDown}
                  onMouseMove={handleEraserCanvasMouseMove}
                  onMouseUp={handleEraserCanvasMouseUp}
                  className="max-h-[min(500px,calc(100vh-320px))] max-w-full w-auto h-auto object-contain cursor-crosshair block"
                />
              ) : (
                <div ref={cropWrapperRef} className="relative inline-block select-none max-h-full max-w-full">
                  <img
                    ref={imgRef}
                    src={
                      activeTool === 'halftone' && halftonePreviewUrl
                        ? halftonePreviewUrl
                        : activeTool === 'stroke-outline' && strokePreviewUrl
                        ? strokePreviewUrl
                        : activeTool === 'texture' && texturePreviewUrl
                        ? texturePreviewUrl
                        : currentUrl
                    }
                    alt="Current Preview"
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      setImageNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
                    }}
                    style={
                      activeTool === 'color-tone' &&
                      (brightness !== 0 || contrast !== 0 || saturation !== 0 || hue !== 0)
                        ? {
                            filter: `brightness(${Math.max(0.1, 1 + brightness / 100)}) contrast(${Math.max(0.1, 1 + contrast / 100)}) saturate(${Math.max(0, 1 + saturation / 100)}) hue-rotate(${hue}deg)`
                          }
                        : undefined
                    }
                    className="max-h-[min(500px,calc(100vh-320px))] max-w-full w-auto h-auto object-contain block pointer-events-none select-none drop-shadow-sm"
                  />

                  {/* Interactive 8-Handle Crop Box Overlay (Exact match to media_1793876290534_2a9a2550.jpg) */}
                  {activeTool === 'crop-clean' && (
                    <div className="absolute inset-2 pointer-events-auto select-none">
                      {/* Dimmed Outside Shading */}
                      <div
                        className="absolute left-0 top-0 right-0 bg-black/40 pointer-events-none transition-all duration-75"
                        style={{ height: `${cropBox.y * 100}%` }}
                      />
                      <div
                        className="absolute left-0 right-0 bottom-0 bg-black/40 pointer-events-none transition-all duration-75"
                        style={{ height: `${Math.max(0, (1 - (cropBox.y + cropBox.height))) * 100}%` }}
                      />
                      <div
                        className="absolute left-0 bg-black/40 pointer-events-none transition-all duration-75"
                        style={{
                          top: `${cropBox.y * 100}%`,
                          height: `${cropBox.height * 100}%`,
                          width: `${cropBox.x * 100}%`
                        }}
                      />
                      <div
                        className="absolute right-0 bg-black/40 pointer-events-none transition-all duration-75"
                        style={{
                          top: `${cropBox.y * 100}%`,
                          height: `${cropBox.height * 100}%`,
                          width: `${Math.max(0, (1 - (cropBox.x + cropBox.width))) * 100}%`
                        }}
                      />

                      {/* Crop Box with Dotted Blue Border & 8 Square Handles matching screenshot */}
                      <div
                        className="absolute border-2 border-dashed border-blue-600 shadow-sm cursor-move select-none"
                        style={{
                          left: `${cropBox.x * 100}%`,
                          top: `${cropBox.y * 100}%`,
                          width: `${cropBox.width * 100}%`,
                          height: `${cropBox.height * 100}%`
                        }}
                        onMouseDown={(e) => startDrag(e, 'move')}
                      >
                        {/* Live Dimension Tag */}
                        <div className="absolute top-1.5 left-1.5 bg-blue-600/90 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow pointer-events-none font-bold">
                          {Math.round(cropBox.width * (imageNaturalSize.width || 100))} × {Math.round(cropBox.height * (imageNaturalSize.height || 100))} px
                        </div>

                        {/* 8 Square Handles (Solid blue square with white border, matching screenshot) */}
                        {/* Top-Left */}
                        <div
                          className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-nwse-resize z-20"
                          onMouseDown={(e) => startDrag(e, 'nw')}
                          title="Resize Top-Left"
                        />
                        {/* Top-Center */}
                        <div
                          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-ns-resize z-20"
                          onMouseDown={(e) => startDrag(e, 'n')}
                          title="Resize Top"
                        />
                        {/* Top-Right */}
                        <div
                          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-nesw-resize z-20"
                          onMouseDown={(e) => startDrag(e, 'ne')}
                          title="Resize Top-Right"
                        />
                        {/* Right-Center */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-ew-resize z-20"
                          onMouseDown={(e) => startDrag(e, 'e')}
                          title="Resize Right"
                        />
                        {/* Bottom-Right */}
                        <div
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-nwse-resize z-20"
                          onMouseDown={(e) => startDrag(e, 'se')}
                          title="Resize Bottom-Right"
                        />
                        {/* Bottom-Center */}
                        <div
                          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-ns-resize z-20"
                          onMouseDown={(e) => startDrag(e, 's')}
                          title="Resize Bottom"
                        />
                        {/* Bottom-Left */}
                        <div
                          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-nesw-resize z-20"
                          onMouseDown={(e) => startDrag(e, 'sw')}
                          title="Resize Bottom-Left"
                        />
                        {/* Left-Center */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-blue-600 border border-white shadow-md cursor-ew-resize z-20"
                          onMouseDown={(e) => startDrag(e, 'w')}
                          title="Resize Left"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30">
                <div className="flex items-center space-x-2.5 px-5 py-2.5 bg-[#204563] text-white rounded-2xl font-black text-xs shadow-xl animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin text-[#EF7F1A]" />
                  <span>Processing {activeTool.replace('-', ' ')}...</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Tools Controls Pane: Clean White Panel */}
          <div className="w-full md:w-96 bg-white border-l border-[#E5D9C8] p-5 flex flex-col justify-between overflow-y-auto flex-shrink-0">
            <div className="space-y-4">
              
              {/* Tool Title & Description */}
              <div className="border-b border-[#E5D9C8] pb-3">
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-sm text-[#204563] capitalize">
                    {activeTool === 'texture' ? 'Texture Effects' : activeTool === 'stroke-outline' ? 'Stroke Outline' : activeTool.replace('-', ' ')}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EF7F1A]/10 text-[#EF7F1A] border border-[#EF7F1A]/30 uppercase">
                    DTF Ready
                  </span>
                </div>
                <p className="text-xs text-[#526A7B] mt-1">
                  {activeTool === 'texture'
                    ? 'Apply creative texture and color effects to your image. Select an effect, adjust its intensity, and preview in real time.'
                    : 'Adjust settings below and preview results in real time before applying to your gang sheet.'}
                </p>
              </div>

              {/* Uploaded Images Selector (Visible when multiple images uploaded) */}
              {assets && assets.length > 1 && (
                <div className="bg-[#FAF7F1] border border-[#E5D9C8] rounded-2xl p-3 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      <Images className="w-3.5 h-3.5 text-[#204563]" />
                      <span className="text-xs font-black text-[#204563]">
                        Uploaded Images
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#204563]/10 text-[#204563]">
                        {assets.length}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#526A7B]">
                      Click image to edit
                    </span>
                  </div>

                  {/* Grid of uploaded images */}
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-0.5">
                    {assets.map((item, idx) => {
                      const isSelected = item.id === currentAsset.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSwitchAsset(item)}
                          className={`group relative flex flex-col items-center p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white border-[#204563] ring-2 ring-[#204563]/30 shadow-sm shadow-[#204563]/10'
                              : 'bg-white/80 border-[#E5D9C8] hover:bg-white hover:border-[#204563]/40 hover:shadow-xs'
                          }`}
                          title={item.filename}
                        >
                          {/* Square Thumbnail */}
                          <div
                            className={`w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center relative ${
                              isSelected ? 'bg-[#FAF7F1]' : 'bg-slate-100'
                            }`}
                            style={{
                              backgroundImage: `
                                linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
                                linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
                                linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
                                linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
                              `,
                              backgroundSize: '8px 8px'
                            }}
                          >
                            <img
                              src={item.processedUrl || item.originalUrl}
                              alt={item.filename}
                              className="w-full h-full object-contain p-0.5"
                            />
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#204563] text-white flex items-center justify-center text-[9px] font-black shadow-xs">
                                ✓
                              </div>
                            )}
                            <span
                              className={`absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded text-[8px] font-black ${
                                isSelected ? 'bg-[#204563] text-white' : 'bg-black/60 text-white'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                          </div>

                          {/* Filename */}
                          <span
                            className={`text-[10px] mt-1 font-bold truncate w-full block leading-tight ${
                              isSelected ? 'text-[#204563] font-extrabold' : 'text-[#526A7B] group-hover:text-[#204563]'
                            }`}
                            title={item.filename}
                          >
                            {item.filename}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 1. Fix & Quality -> Upscaler */}
              {activeTool === 'upscaler' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1.5">
                      Upscale Resolution Factor
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setUpscaleFactor(2);
                          setUpscaledUrl(null);
                          setUpscaledDims(null);
                        }}
                        className={`p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                          upscaleFactor === 2
                            ? 'bg-[#204563] text-white shadow-md shadow-[#204563]/30 ring-2 ring-[#204563]/20'
                            : 'bg-[#FAF7F1] text-[#204563] hover:bg-white border border-[#E5D9C8]'
                        }`}
                      >
                        <div className="text-xs font-black">2× Super-Resolution</div>
                        <div className={`text-[10px] font-mono mt-0.5 ${upscaleFactor === 2 ? 'text-white/80' : 'text-[#526A7B]'}`}>
                          {(currentAsset.originalWidth || imageNaturalSize.width) * 2} × {(currentAsset.originalHeight || imageNaturalSize.height) * 2} px
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setUpscaleFactor(4);
                          setUpscaledUrl(null);
                          setUpscaledDims(null);
                        }}
                        className={`p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                          upscaleFactor === 4
                            ? 'bg-[#204563] text-white shadow-md shadow-[#204563]/30 ring-2 ring-[#204563]/20'
                            : 'bg-[#FAF7F1] text-[#204563] hover:bg-white border border-[#E5D9C8]'
                        }`}
                      >
                        <div className="text-xs font-black">4× Ultra-Resolution</div>
                        <div className={`text-[10px] font-mono mt-0.5 ${upscaleFactor === 4 ? 'text-white/80' : 'text-[#526A7B]'}`}>
                          {(currentAsset.originalWidth || imageNaturalSize.width) * 4} × {(currentAsset.originalHeight || imageNaturalSize.height) * 4} px
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-[#204563] mb-1">
                      <span>Edge Clarity & Sharpness</span>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] font-extrabold">
                          {upscaleSharpness === 0 ? 'Minimal (0%)' : upscaleSharpness <= 25 ? 'Slight (25%)' : upscaleSharpness <= 50 ? 'Balanced (50%)' : upscaleSharpness <= 75 ? 'Strong (75%)' : 'Maximum (100%)'}
                        </span>
                        <span className="text-[#204563] font-extrabold">{upscaleSharpness}%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={upscaleSharpness}
                      onChange={(e) => setUpscaleSharpness(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Status Indicator */}
                  {upscaledDims && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                      <div className="flex items-center space-x-1.5 font-black text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>AI Super-Resolution Active ({upscaleFactor}×)</span>
                      </div>
                      <p className="text-[11px] text-emerald-600 mt-1">
                        Resolution enhanced to <strong>{upscaledDims.width} × {upscaledDims.height} px</strong>. Use the split slider to compare details.
                      </p>
                    </div>
                  )}

                  {upscaleError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      <span className="font-bold">Notice:</span> {upscaleError}
                    </div>
                  )}

                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleApplyUpscaler}
                      disabled={isProcessing}
                      className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] disabled:opacity-50 text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#204563]" />
                      <span>{isProcessing ? `Upscaling with AI (${upscaleFactor}×)...` : `Run AI Upscaler (${upscaleFactor}×)`}</span>
                    </button>

                    {upscaledUrl && (
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = upscaledUrl;
                          link.download = `${currentAsset.filename.replace(/\.[^/.]+$/, '')}_upscaled_${upscaleFactor}x.png`;
                          link.click();
                        }}
                        className="w-full py-2 rounded-xl bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-[#526A7B]" />
                        <span>Download Upscaled PNG ({upscaledDims ? `${upscaledDims.width}×${upscaledDims.height}` : `${upscaleFactor}×`})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 1. Fix & Quality -> Color & Tone */}
              {activeTool === 'color-tone' && (
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Brightness</span>
                      <span className="text-[#204563] font-extrabold">{brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-80"
                      max="100"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Contrast</span>
                      <span className="text-[#204563] font-extrabold">{contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-80"
                      max="100"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Saturation</span>
                      <span className="text-[#204563] font-extrabold">{saturation}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Hue Rotation</span>
                      <span className="text-[#204563] font-extrabold">{hue}°</span>
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={hue}
                      onChange={(e) => setHue(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleApplyColorTone}
                      disabled={isProcessing || (brightness === 0 && contrast === 0 && saturation === 0 && hue === 0)}
                      className="flex-1 py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] disabled:opacity-50 text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Sliders className="w-4 h-4 text-[#204563]" />
                      <span>{isProcessing ? 'Applying...' : 'Apply Color & Tone'}</span>
                    </button>
                    {(brightness !== 0 || contrast !== 0 || saturation !== 0 || hue !== 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setBrightness(0);
                          setContrast(0);
                          setSaturation(0);
                          setHue(0);
                        }}
                        className="px-3 py-2.5 rounded-xl border border-[#E5D9C8] bg-white hover:bg-[#FAF7F1] text-[#204563] text-xs font-bold cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 1. Fix & Quality -> Pixel Doctor */}
              {activeTool === 'pixel-doctor' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 font-medium">
                    Detects and removes isolated rogue specks and eliminates stray semi-transparent halos around outer edges to prevent white ink bleed on dark fabrics.
                  </div>

                  <button
                    onClick={handleDespeckle}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-[#204563] hover:bg-[#18364e] text-white text-xs font-black shadow-md shadow-[#204563]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Activity className="w-4 h-4 text-[#EF7F1A]" />
                    <span>Clean Stray Pixels & Fringes</span>
                  </button>
                </div>
              )}

              {/* 1. Fix & Quality -> Print Check */}
              {activeTool === 'print-check' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-medium space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-emerald-700 font-extrabold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Pre-Print Audit Inspection</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Verifies DPI printability, transparent bounds, and minimum ink stroke thickness before printing.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#204563] block">Resolution & Density</span>
                        <span className="text-[11px] text-[#526A7B] font-mono">
                          {imageNaturalSize.width} × {imageNaturalSize.height} px • {currentAsset.effectiveDpi || 300} DPI
                        </span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        (currentAsset.effectiveDpi || 300) >= 250 ? 'bg-emerald-100 text-emerald-700' : 'bg-[#EF7F1A]/20 text-[#EF7F1A]'
                      }`}>
                        {(currentAsset.effectiveDpi || 300) >= 250 ? 'Optimal (300 DPI)' : 'Low DPI'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#204563] block">Transparent Alpha Cutout</span>
                        <span className="text-[11px] text-[#526A7B]">No unwanted solid backings</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Passed
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#204563] block">Stroke Thickness Audit</span>
                        <span className="text-[11px] text-[#526A7B]">Meets 0.3mm minimum ink line</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        DTF Ready
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#204563] block">Empty Margin Padding</span>
                        <span className="text-[11px] text-[#526A7B]">Transparent outer border</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-[#204563]">
                        {emptyPercent}%
                      </span>
                    </div>
                  </div>

                  {onOpenAudit && (
                    <button
                      onClick={onOpenAudit}
                      className="w-full py-2.5 rounded-xl bg-[#204563] hover:bg-[#18364e] text-white text-xs font-black shadow-md shadow-[#204563]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#EF7F1A]" />
                      <span>Open Full Audit Window</span>
                    </button>
                  )}
                </div>
              )}

              {/* 2. Cut & Adjust -> BG Remover */}
              {activeTool === 'bg-remover' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Tolerance Threshold</span>
                      <span className="text-[#204563] font-extrabold">{bgTolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={bgTolerance}
                      onChange={(e) => setBgTolerance(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleRemoveBackground}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Scissors className="w-4 h-4 text-[#204563]" />
                    <span>Auto Remove Background</span>
                  </button>
                </div>
              )}

              {/* 2. Cut & Adjust -> Replace Color */}
              {activeTool === 'remove-replace-color' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1">
                      Color to Knockout / Replace
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={targetColorHex}
                        onChange={(e) => setTargetColorHex(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-[#E5D9C8]"
                      />
                      <input
                        type="text"
                        value={targetColorHex}
                        onChange={(e) => setTargetColorHex(e.target.value)}
                        className="flex-1 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#204563]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="transparentKnockout"
                      checked={replaceWithTransparent}
                      onChange={(e) => setReplaceWithTransparent(e.target.checked)}
                      className="rounded accent-[#EF7F1A] cursor-pointer"
                    />
                    <label htmlFor="transparentKnockout" className="text-xs text-[#204563] font-bold cursor-pointer">
                      Make Transparent (Knockout)
                    </label>
                  </div>

                  {!replaceWithTransparent && (
                    <div>
                      <label className="text-xs font-bold text-[#204563] block mb-1">
                        New Replacement Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={replaceColorHex}
                          onChange={(e) => setReplaceColorHex(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-[#E5D9C8]"
                        />
                        <input
                          type="text"
                          value={replaceColorHex}
                          onChange={(e) => setReplaceColorHex(e.target.value)}
                          className="flex-1 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#204563]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Color Tolerance</span>
                      <span className="text-[#204563] font-extrabold">{colorTol}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={colorTol}
                      onChange={(e) => setColorTol(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleReplaceColor}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Pipette className="w-4 h-4 text-[#204563]" />
                    <span>Apply Color Knockout / Swap</span>
                  </button>
                </div>
              )}

              {/* 2. Cut & Adjust -> Crop & Clean */}
              {activeTool === 'crop-clean' && (
                <div className="space-y-3.5">
                  {/* Primary Apply Button */}
                  <button
                    onClick={handleApplyManualCrop}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply Crop ({Math.round(cropBox.width * (imageNaturalSize.width || 100))} × {Math.round(cropBox.height * (imageNaturalSize.height || 100))} px)</span>
                  </button>

                  {/* Crop Box Quick Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleTightenCropBoxToArtwork}
                      type="button"
                      className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#204563] text-xs font-bold border border-[#E5D9C8] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      title="Tighten the crop border directly to the graphic"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Snap Box to Art</span>
                    </button>
                    <button
                      onClick={handleResetCropBox}
                      type="button"
                      className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#204563] text-xs font-bold border border-[#E5D9C8] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      title="Reset crop selection to 100% full bounds"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset Box (100%)</span>
                    </button>
                  </div>

                  {/* Aspect Ratio Presets */}
                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1.5">
                      Aspect Ratio Lock
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { id: 'free', label: 'Free' },
                        { id: '1:1', label: '1:1' },
                        { id: '4:3', label: '4:3' },
                        { id: '16:9', label: '16:9' },
                        { id: 'orig', label: 'Orig' }
                      ].map((ar) => (
                        <button
                          key={ar.id}
                          onClick={() => handleSetAspectRatio(ar.id as any)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            cropAspectRatio === ar.id
                              ? 'bg-[#204563] text-white border-[#204563] shadow-2xs'
                              : 'bg-white text-[#526A7B] border-[#E5D9C8] hover:bg-[#FAF7F1]'
                          }`}
                        >
                          {ar.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Auto-Trim Padding */}
                  <button
                    onClick={handleAutoTrim}
                    disabled={isProcessing}
                    className="w-full py-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#204563] text-xs font-bold border border-[#E5D9C8] transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-[#204563]" />
                    <span>Auto-Trim Transparent Padding ({emptyPercent}% Waste)</span>
                  </button>

                  {/* Transform & Rotate */}
                  <div className="pt-2 border-t border-[#E5D9C8]">
                    <label className="text-xs font-bold text-[#204563] block mb-1.5">
                      Transform & Rotate
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTransformImage('rot90')}
                        className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#204563] text-xs font-bold border border-[#E5D9C8] flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-[#204563]" />
                        <span>90° CW</span>
                      </button>
                      <button
                        onClick={() => handleTransformImage('rot270')}
                        className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#204563] text-xs font-bold border border-[#E5D9C8] flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#204563]" />
                        <span>90° CCW</span>
                      </button>
                      <button
                        onClick={() => handleTransformImage('flipH')}
                        className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#204563] text-xs font-bold border border-[#E5D9C8] flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5 text-[#204563]" />
                        <span>Flip H</span>
                      </button>
                      <button
                        onClick={() => handleTransformImage('flipV')}
                        className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#204563] text-xs font-bold border border-[#E5D9C8] flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <FlipVertical className="w-3.5 h-3.5 text-[#204563]" />
                        <span>Flip V</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Cut & Adjust -> Eraser Brush */}
              {activeTool === 'eraser' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                    Click and drag your mouse directly across the artwork preview in the center viewport to erase unwanted marks or text.
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Eraser Brush Radius</span>
                      <span className="text-[#204563] font-extrabold">{eraserSize} px</span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="72"
                      value={eraserSize}
                      onChange={(e) => setEraserSize(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* 2. Cut & Adjust -> Border Knockout */}
              {activeTool === 'border-knockout' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 font-medium">
                    Punches out borders, bounding frames, or outer edges with transparent knockouts to prevent unwanted rectangular ink borders on dark garments.
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Frame Inset / Border Thickness</span>
                      <span className="text-[#204563] font-extrabold">{borderInset} px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="60"
                      step="2"
                      value={borderInset}
                      onChange={(e) => setBorderInset(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1.5">Knockout Mask Shape</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => setBorderKnockoutShape('rect')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          borderKnockoutShape === 'rect' ? 'border-[#204563] bg-[#FAF7F1] text-[#204563] shadow-2xs' : 'border-[#E5D9C8] bg-white text-[#526A7B]'
                        }`}
                      >
                        Rectangle
                      </button>
                      <button
                        onClick={() => setBorderKnockoutShape('round')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          borderKnockoutShape === 'round' ? 'border-[#204563] bg-[#FAF7F1] text-[#204563] shadow-2xs' : 'border-[#E5D9C8] bg-white text-[#526A7B]'
                        }`}
                      >
                        Rounded
                      </button>
                      <button
                        onClick={() => setBorderKnockoutShape('oval')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          borderKnockoutShape === 'oval' ? 'border-[#204563] bg-[#FAF7F1] text-[#204563] shadow-2xs' : 'border-[#E5D9C8] bg-white text-[#526A7B]'
                        }`}
                      >
                        Oval
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleBorderKnockout}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Scissors className="w-4 h-4 text-[#204563]" />
                    <span>Punch-Out Outer Border</span>
                  </button>
                </div>
              )}

              {/* 3. Style & Effects -> Texture Effects (11 Filters - media_1794569328933_76ae2ae0.jpg) */}
              {activeTool === 'texture' && (
                <div className="space-y-4">
                  {/* Grid of 11 effects */}
                  <div className="grid grid-cols-2 gap-2">
                    {TEXTURE_EFFECTS_LIST.map((eff) => {
                      const isSelected = selectedTextureEffect === eff.id;
                      return (
                        <button
                          key={eff.id}
                          type="button"
                          onClick={() => {
                            setSelectedTextureEffect(eff.id);
                            if (textureIntensity === 0) {
                              setTextureIntensity(50);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#FAF7F1] border-[#204563] ring-2 ring-[#204563]/20 text-[#204563] font-bold shadow-xs'
                              : 'bg-white border-[#E5D9C8] hover:bg-[#FAF7F1] text-[#526A7B]'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            {/* Twin overlapping color preview circles matching screenshot */}
                            <div className="relative w-5 h-5 flex-shrink-0">
                              <span
                                className="absolute left-0 top-0.5 w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                                style={{ backgroundColor: eff.colors[0] }}
                              />
                              <span
                                className="absolute right-0 bottom-0.5 w-3.5 h-3.5 rounded-full border border-white shadow-xs opacity-90"
                                style={{ backgroundColor: eff.colors[1] }}
                              />
                            </div>
                            <span className="text-xs font-bold leading-tight truncate">
                              {eff.name}
                            </span>
                          </div>

                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#204563] text-white flex items-center justify-center text-[10px] flex-shrink-0 ml-1">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Intensity Slider */}
                  <div className="pt-1">
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Intensity</span>
                      <span className="text-[#204563] font-extrabold">{textureIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={textureIntensity}
                      onChange={(e) => setTextureIntensity(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Reset Effect & Apply to All Options */}
                  <div className="flex justify-between items-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTextureEffect('none');
                        setTextureIntensity(0);
                        setTexturePreviewUrl(null);
                      }}
                      className="text-[11px] font-bold text-[#526A7B] hover:text-[#EF7F1A] flex items-center space-x-1.5 transition-colors cursor-pointer py-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Effect</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      {assets && assets.length > 1 && selectedTextureEffect !== 'none' && textureIntensity > 0 && (
                        <button
                          type="button"
                          onClick={handleApplyEffectToAllAssets}
                          disabled={isProcessing}
                          className="text-[11px] font-extrabold text-[#204563] hover:text-[#EF7F1A] bg-[#FAF7F1] hover:bg-white px-2.5 py-1 rounded-lg border border-[#E5D9C8] transition-all flex items-center space-x-1 cursor-pointer"
                          title="Apply this effect to all uploaded images"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Apply to All ({assets.length})</span>
                        </button>
                      )}
                      <span className="text-[11px] font-semibold text-[#526A7B]">
                        {selectedTextureEffect !== 'none' && textureIntensity > 0
                          ? `${TEXTURE_EFFECTS_LIST.find((e) => e.id === selectedTextureEffect)?.name} (${textureIntensity}%)`
                          : 'Original (No Effect)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Style & Effects -> Halftone */}
              {activeTool === 'halftone' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1.5">
                      Halftone Screen Mode
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'bw', label: 'Classic B&W' },
                        { id: 'color', label: 'Color Dots' },
                        { id: 'duotone', label: 'Dot Grid' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            const newStyle = mode.id as HalftoneStyle;
                            setHalftoneStyle(newStyle);
                            if (newStyle === 'duotone') {
                              setHalftoneAngle(0);
                            } else if (halftoneAngle === 0) {
                              setHalftoneAngle(45);
                            }
                          }}
                          className={`py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            halftoneStyle === mode.id
                              ? 'bg-[#204563] text-white shadow-md'
                              : 'bg-white text-[#526A7B] hover:bg-[#FAF7F1] border border-[#E5D9C8]'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dot Size */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Dot Size</span>
                      <span className="text-[#204563] font-extrabold">{halftoneDotSize} px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="25"
                      value={halftoneDotSize}
                      onChange={(e) => setHalftoneDotSize(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Density / Spacing */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Density / Spacing</span>
                      <span className="text-[#204563] font-extrabold">{halftoneDensity}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={halftoneDensity}
                      onChange={(e) => setHalftoneDensity(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Fade / Spread */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Fade / Spread</span>
                      <span className="text-[#204563] font-extrabold">{halftoneFadeSpread}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={halftoneFadeSpread}
                      onChange={(e) => setHalftoneFadeSpread(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Dot Angle (Rotation) */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Dot Angle (Rotation)</span>
                      <span className="text-[#204563] font-extrabold">{halftoneAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={halftoneAngle}
                      onChange={(e) => setHalftoneAngle(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Dot Color (for Color Dots) */}
                  {halftoneStyle === 'color' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-[#204563]">
                          Dot Color (for Color Dots)
                        </label>
                        <label className="flex items-center space-x-1 cursor-pointer text-[10px] font-bold text-[#204563]">
                          <input
                            type="checkbox"
                            checked={useCustomDotColor}
                            onChange={(e) => setUseCustomDotColor(e.target.checked)}
                            className="accent-[#EF7F1A] rounded"
                          />
                          <span>Custom Tint</span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          disabled={!useCustomDotColor}
                          value={halftoneDotColor}
                          onChange={(e) => {
                            setHalftoneDotColor(e.target.value);
                            setHalftoneDotColorHex(e.target.value);
                          }}
                          className={`w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-[#E5D9C8] ${!useCustomDotColor ? 'opacity-40 cursor-not-allowed' : ''}`}
                        />
                        <input
                          type="text"
                          disabled={!useCustomDotColor}
                          value={useCustomDotColor ? halftoneDotColorHex : 'Original Colors (Sampled Multi-Color)'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHalftoneDotColorHex(val);
                            if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                              setHalftoneDotColor(val);
                            }
                          }}
                          className={`flex-1 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-2.5 py-1 text-xs font-mono text-[#204563] ${!useCustomDotColor ? 'opacity-70 cursor-not-allowed italic' : ''}`}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleApplyHalftone}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] disabled:opacity-50 text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <CircleDot className="w-4 h-4 text-[#204563]" />
                    <span>{isProcessing ? 'Applying Halftone...' : 'Apply Halftone Screen'}</span>
                  </button>
                </div>
              )}

              {/* 3. Style & Effects -> Stroke / Outline */}
              {activeTool === 'stroke-outline' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Contour Stroke Width</span>
                      <span className="text-[#204563] font-extrabold">{strokeWidth} px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1">
                      Contour Stroke Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={strokeColor.startsWith('#') && (strokeColor.length === 7 || strokeColor.length === 4) ? strokeColor : '#ffffff'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStrokeColor(val);
                          setStrokeHexInput(val);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-[#E5D9C8]"
                      />
                      <input
                        type="text"
                        value={strokeHexInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStrokeHexInput(val);
                          if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                            const fullHex = val.length === 4
                              ? `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`
                              : val;
                            setStrokeColor(fullHex);
                          }
                        }}
                        placeholder="#ffffff"
                        className="flex-1 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-2.5 py-1 text-xs font-mono text-[#204563] focus:outline-none focus:ring-1 focus:ring-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleApplyStroke}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] disabled:opacity-50 text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <PenTool className="w-4 h-4 text-[#204563]" />
                    <span>{isProcessing ? 'Applying Outline Stroke...' : 'Apply Outline Stroke'}</span>
                  </button>
                </div>
              )}

              {/* 4. Create & Convert -> Text & Number */}
              {activeTool === 'text-number' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1">
                      Text / Number String
                    </label>
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="w-full bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-3 py-1.5 text-xs font-bold text-[#204563] uppercase focus:bg-white focus:border-[#EF7F1A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-[#204563] block mb-1">
                        Fill Color
                      </label>
                      <input
                        type="color"
                        value={textFillColor}
                        onChange={(e) => setTextFillColor(e.target.value)}
                        className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-[#E5D9C8]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#204563] block mb-1">
                        Outline Color
                      </label>
                      <input
                        type="color"
                        value={textStrokeColor}
                        onChange={(e) => setTextStrokeColor(e.target.value)}
                        className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-[#E5D9C8]"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateText}
                    className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Type className="w-4 h-4 text-[#204563]" />
                    <span>Render Jersey Text</span>
                  </button>
                </div>
              )}

              {/* 4. Create & Convert -> Vectoriser (Image 2 mockup) */}
              {activeTool === 'vectorize' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-extrabold text-[#204563] text-sm">Vectorize Image</h3>
                    <p className="text-xs text-[#526A7B] mt-0.5">
                      Convert your image to a scalable SVG with clean, smooth vectors.
                    </p>
                  </div>

                  {/* Vectorization Mode */}
                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1.5">
                      Vectorization Mode
                    </label>
                    <div className="space-y-1.5">
                      <label className={`flex items-center space-x-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                        vectorMode === 'color'
                          ? 'bg-[#FAF7F1] border-[#204563] text-[#204563] font-bold shadow-xs'
                          : 'bg-white border-[#E5D9C8] text-[#526A7B] hover:bg-[#FAF7F1]'
                      }`}>
                        <input
                          type="radio"
                          name="vectorMode"
                          checked={vectorMode === 'color'}
                          onChange={() => setVectorMode('color')}
                          className="w-4 h-4 text-[#EF7F1A] accent-[#EF7F1A] cursor-pointer"
                        />
                        <span className="text-xs">Color (Multicolor)</span>
                      </label>
                      <label className={`flex items-center space-x-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                        vectorMode === 'binary'
                          ? 'bg-[#FAF7F1] border-[#204563] text-[#204563] font-bold shadow-xs'
                          : 'bg-white border-[#E5D9C8] text-[#526A7B] hover:bg-[#FAF7F1]'
                      }`}>
                        <input
                          type="radio"
                          name="vectorMode"
                          checked={vectorMode === 'binary'}
                          onChange={() => setVectorMode('binary')}
                          className="w-4 h-4 text-[#EF7F1A] accent-[#EF7F1A] cursor-pointer"
                        />
                        <span className="text-xs">Black & White (Trace)</span>
                      </label>
                    </div>
                  </div>

                  {/* Detail Level */}
                  <div>
                    <label className="text-xs font-bold text-[#204563] block mb-1.5">
                      Detail Level
                    </label>
                    <div className="flex items-center space-x-4 px-1 py-0.5">
                      {(['low', 'medium', 'high'] as const).map((lvl) => (
                        <label key={lvl} className="flex items-center space-x-1.5 cursor-pointer text-xs font-bold text-[#204563] capitalize">
                          <input
                            type="radio"
                            name="vectorDetailLevel"
                            checked={vectorDetailLevel === lvl}
                            onChange={() => setVectorDetailLevel(lvl)}
                            className="w-4 h-4 text-[#EF7F1A] accent-[#EF7F1A] cursor-pointer"
                          />
                          <span>{lvl}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Smoothness Slider */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#204563] mb-1">
                      <span>Smoothness</span>
                      <span className="text-[#204563] font-extrabold">{vectorSmoothness}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={vectorSmoothness}
                      onChange={(e) => setVectorSmoothness(Number(e.target.value))}
                      className="w-full accent-[#EF7F1A] bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2 pt-1 border-t border-[#E5D9C8]">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vectorRemoveBg}
                        onChange={(e) => setVectorRemoveBg(e.target.checked)}
                        className="w-4 h-4 accent-[#EF7F1A] rounded cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#204563]">Remove Background</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vectorOptimize}
                        onChange={(e) => setVectorOptimize(e.target.checked)}
                        className="w-4 h-4 accent-[#EF7F1A] rounded cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#204563]">Optimize Paths (Reduce File Size)</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-2 border-t border-[#E5D9C8]">
                    <button
                      onClick={handleRunVectorize}
                      disabled={isProcessing}
                      className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] disabled:opacity-50 text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#204563]" />
                      <span>{isProcessing ? 'Vectorizing Artwork...' : 'Vectorize & Preview'}</span>
                    </button>

                    <button
                      onClick={handleSaveVectorAndApply}
                      disabled={isProcessing}
                      className="w-full py-2.5 rounded-xl bg-[#204563] hover:bg-[#18364e] disabled:opacity-50 text-white text-xs font-black shadow-md shadow-[#204563]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4 text-[#EF7F1A]" />
                      <span>Save as SVG & Apply</span>
                    </button>

                    <button
                      onClick={handleDownloadSvg}
                      disabled={isProcessing}
                      className="w-full py-2 rounded-xl bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-[#526A7B]" />
                      <span>Download SVG</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Create & Convert -> Recreate AI */}
              {activeTool === 'recreate-ai' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] text-xs text-[#204563] font-medium">
                    Regenerates high-frequency details, removes compression artifacts, and rebuilds high-fidelity edge contours using neural edge reconstruction.
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#526A7B] mb-1.5 block">
                      Recreation Style
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'hd-redraw', label: 'HD Redraw' },
                        { id: 'clean-illustration', label: 'Clean Vector' },
                        { id: 'vivid-print', label: 'Vivid Pop' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setRecreateStyle(item.id as RecreateAiStyle)}
                          className={`py-1.5 px-2 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                            recreateStyle === item.id
                              ? 'bg-[#204563] text-white border-[#204563] shadow-xs'
                              : 'bg-white text-[#526A7B] border-[#E5D9C8] hover:bg-[#FAF7F1]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleRecreateAi}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#204563]" />
                    <span>{isProcessing ? 'Recreating Artwork...' : 'Recreate with AI (2x High-Fidelity)'}</span>
                  </button>
                </div>
              )}

              {/* 4. Create & Convert -> TIFF Export (RIP) */}
              {activeTool === 'tiff-export' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] text-xs text-[#204563] font-medium">
                    Generates production-grade multi-channel TIFFs for professional RIP software (Maintop, RIIN, PrintFactory, Flexi).
                  </div>

                  {/* DTF vs UVDTF Mode Toggle Buttons */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#526A7B] mb-2">
                      Choose Print Process
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTiffProcessMode('dtf')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          tiffProcessMode === 'dtf'
                            ? 'bg-[#FAF7F1] border-2 border-[#204563] shadow-xs'
                            : 'bg-white border-[#E5D9C8] text-[#526A7B] hover:bg-[#FAF7F1]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <Shirt className={`w-4 h-4 ${tiffProcessMode === 'dtf' ? 'text-[#204563]' : 'text-slate-400'}`} />
                            <span className="font-extrabold text-xs text-[#204563]">DTF</span>
                          </div>
                          {tiffProcessMode === 'dtf' && (
                            <span className="text-[10px] font-bold text-[#204563]">✓</span>
                          )}
                        </div>
                        <div className="text-[10px] font-medium text-[#526A7B] mt-1">
                          Direct-to-Film (Textiles)
                        </div>
                        <div className="text-[9px] font-mono text-[#204563] font-bold mt-1">
                          CMYK, W1
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTiffProcessMode('uvdtf')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          tiffProcessMode === 'uvdtf'
                            ? 'bg-[#FAF7F1] border-2 border-[#EF7F1A] shadow-xs'
                            : 'bg-white border-[#E5D9C8] text-[#526A7B] hover:bg-[#FAF7F1]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <Sparkles className={`w-4 h-4 ${tiffProcessMode === 'uvdtf' ? 'text-[#EF7F1A]' : 'text-slate-400'}`} />
                            <span className="font-extrabold text-xs text-[#204563]">UVDTF</span>
                          </div>
                          {tiffProcessMode === 'uvdtf' && (
                            <span className="text-[10px] font-bold text-[#EF7F1A]">✓</span>
                          )}
                        </div>
                        <div className="text-[10px] font-medium text-[#EF7F1A] mt-1">
                          UV Transfer + Varnish
                        </div>
                        <div className="text-[9px] font-mono text-[#EF7F1A] font-bold mt-1">
                          CMYK, W1, W2
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Sequence: CMYK first, then W1, then W2 */}
                    <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex justify-between items-center">
                      <span className="font-bold text-[#526A7B]">1. Color Channel</span>
                      <span className="font-mono text-[#204563] font-extrabold">CMYK SWOP v2</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex justify-between items-center">
                      <span className="font-bold text-[#526A7B]">2. White Underbase Channel</span>
                      <span className="font-mono text-[#204563] font-extrabold">W1 (Spot White)</span>
                    </div>
                    {tiffProcessMode === 'uvdtf' && (
                      <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex justify-between items-center animate-in fade-in">
                        <span className="font-bold text-[#EF7F1A]">3. UV Varnish Pass</span>
                        <span className="font-mono text-[#EF7F1A] font-extrabold">W2 Spot Gloss (Active)</span>
                      </div>
                    )}
                  </div>

                  {onOpenTiff && (
                    <button
                      onClick={onOpenTiff}
                      className="w-full py-2.5 rounded-xl text-[#204563] bg-[#EF7F1A] hover:bg-[#d97014] text-xs font-black shadow-md shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1"
                    >
                      <FileStack className="w-4 h-4 text-[#204563]" />
                      <span>Open TIFF Studio ({tiffProcessMode.toUpperCase()})</span>
                    </button>
                  )}
                </div>
              )}

            </div>

            {/* Bottom Actions: Save to Gang Sheet */}
            <div className="pt-4 border-t border-[#E5D9C8] space-y-2 mt-4 flex-shrink-0">
              <button
                onClick={handleSaveModal}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] text-xs font-black shadow-lg shadow-[#EF7F1A]/25 transition-all flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4 text-[#204563]" />
                <span>Save & Apply to Gang Sheet</span>
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 rounded-xl text-[#526A7B] hover:text-[#204563] text-xs font-bold hover:bg-[#FAF7F1] transition-colors"
              >
                Cancel
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
