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
  Shirt
} from 'lucide-react';
import { ArtworkAsset } from '../types';
import {
  loadImage,
  removeImageBackground,
  calculateAlphaBoundingBox,
  cropImageToBoundingBox,
  despeckleImage,
  addStrokeOutline,
  upscaleImageAi,
  adjustColorAndTone,
  applyTextureEffect,
  applyHalftoneFilter,
  replaceColorInImage,
  applyEmbroideryEffect,
  generateTextArtwork
} from '../utils/imageProcessing';

interface EditModalProps {
  asset: ArtworkAsset | null;
  initialTool?: string;
  onClose: () => void;
  onSave: (updatedAsset: ArtworkAsset) => void;
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
  initialTool = 'upscaler',
  onClose,
  onSave,
  onOpenAudit,
  onOpenTiff
}) => {
  if (!asset) return null;

  // Normalize incoming tool ID
  const normalizeTool = (id: string) => {
    if (id === 'upscale') return 'upscaler';
    if (id === 'remove-color') return 'remove-replace-color';
    return id;
  };

  // 4 Categories matching dtflayout.com
  const categories: CategoryDef[] = [
    {
      id: 'fix',
      name: 'Fix & Quality',
      icon: Sparkles,
      tools: [
        { id: 'upscaler', name: 'Image Upscaler', desc: 'Sharpen & 2x/4x enlarge resolution', badge: 'AI', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
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
        { id: 'special-effects', name: 'Special Effects', desc: 'Neon, sepia, duo-tone & invert', badge: 'AI', badgeColor: 'bg-pink-100 text-pink-700 border-pink-200' },
        { id: 'texture', name: 'Texture Effects', desc: 'Vintage distressed cracked t-shirt', badge: 'PRO', badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
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
        { id: 'recreate-ai', name: 'Recreate with AI', desc: 'Redraw and enhance low-res artwork', badge: 'AI', badgeColor: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
        { id: 'tiff-export', name: 'TIFF Export (RIP)', desc: 'Generate multi-channel W1 underbase', badge: 'RIP', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
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

  // 3. Style & Effects -> Texture
  const [textureType, setTextureType] = useState<'cracked' | 'vintage' | 'grunge'>('cracked');
  const [textureIntensity, setTextureIntensity] = useState<number>(50);

  // 3. Style & Effects -> Halftone
  const [halftoneSpacing, setHalftoneSpacing] = useState<number>(8);
  const [halftoneRadius, setHalftoneRadius] = useState<number>(4);

  // 3. Style & Effects -> Stroke
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [strokeColor, setStrokeColor] = useState<string>('#ffffff');

  // 3. Style & Effects -> Embroidery
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

  const pushHistory = (newUrl: string) => {
    const newHist = history.slice(0, historyIndex + 1);
    newHist.push(newUrl);
    setHistory(newHist);
    setHistoryIndex(newHist.length - 1);
    setCurrentUrl(newUrl);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentUrl(history[historyIndex - 1]);
    }
  };

  const handleRevertOriginal = () => {
    pushHistory(asset.originalUrl);
  };

  // --- ACTIONS ---

  // 1. AI Upscaler
  const handleApplyUpscaler = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const resultUrl = await upscaleImageAi(img, upscaleFactor, upscaleSharpness);
      pushHistory(resultUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Color & Tone
  const handleApplyColorTone = async () => {
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

  // Vectorise & Recreate AI Handlers
  const handleVectorizeTrace = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      const levels = 8;
      const step = 255 / (levels - 1);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 12) {
          data[i + 3] = 0;
          continue;
        }
        data[i] = Math.round(Math.round(data[i] / step) * step);
        data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
        data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
        data[i + 3] = data[i + 3] > 128 ? 255 : data[i + 3];
      }
      ctx.putImageData(imgData, 0, 0);
      const res = canvas.toDataURL('image/png');
      pushHistory(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecreateAi = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const res = await upscaleImageAi(img, 2, 85);
      pushHistory(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. Texture Effects (Distressed / Vintage)
  const handleApplyTexture = async () => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);
      const res = await applyTextureEffect(img, textureType, textureIntensity);
      pushHistory(res);
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
      const img = await loadImage(currentUrl);
      const res = await applyHalftoneFilter(img, halftoneSpacing, halftoneRadius);
      pushHistory(res);
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
      const img = await loadImage(currentUrl);
      const strokedUrl = await addStrokeOutline(img, strokeColor, strokeWidth);
      pushHistory(strokedUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 11. Special Effects Preset
  const handleApplyPresetEffect = async (
    preset: 'neon' | 'sepia' | 'posterize' | 'bw' | 'invert' | 'embroidery'
  ) => {
    setIsProcessing(true);
    try {
      const img = await loadImage(currentUrl);

      if (preset === 'embroidery') {
        const resultUrl = await applyEmbroideryEffect(img, {
          stitchPitch: embroideryPitch,
          sheenIntensity: embroiderySheen,
          stitchAngle: embroideryAngle,
          hasBorder: embroideryHasBorder,
          fabricBacking: embroideryFabric
        });
        pushHistory(resultUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (preset === 'neon') {
        // High-impact Electric Neon Glow for DTF apparel
        // Pass 1: Multi-layer luminous bloom aura on transparent background
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = w;
        glowCanvas.height = h;
        const gCtx = glowCanvas.getContext('2d');
        if (gCtx) {
          // Electric Cyan wide outer bloom
          gCtx.shadowColor = '#00f5ff';
          gCtx.shadowBlur = Math.max(14, Math.round(Math.min(w, h) / 45));
          gCtx.drawImage(img, 0, 0);
          // Vivid Magenta intense inner aura
          gCtx.shadowColor = '#ff00aa';
          gCtx.shadowBlur = Math.max(7, Math.round(Math.min(w, h) / 90));
          gCtx.drawImage(img, 0, 0);
        }

        // Pass 2: Electric color enhancement with edge luminescence
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          let r = d[i];
          let g = d[i + 1];
          let b = d[i + 2];

          // High-contrast S-curve
          r = Math.min(255, Math.max(0, (r - 128) * 1.35 + 128));
          g = Math.min(255, Math.max(0, (g - 128) * 1.35 + 128));
          b = Math.min(255, Math.max(0, (b - 128) * 1.35 + 128));

          // Boost electric neon saturation & vibrance
          if (r >= g && r >= b) {
            d[i] = Math.min(255, r * 1.45 + 25);
            d[i + 1] = Math.max(0, g * 0.75);
            d[i + 2] = Math.min(255, b * 1.35 + 40);
          } else if (g >= r && g >= b) {
            d[i] = Math.max(0, r * 0.7);
            d[i + 1] = Math.min(255, g * 1.45 + 30);
            d[i + 2] = Math.min(255, b * 1.4 + 40);
          } else {
            d[i] = Math.min(255, r * 1.25 + 30);
            d[i + 1] = Math.max(0, g * 0.7);
            d[i + 2] = Math.min(255, b * 1.55 + 35);
          }
        }
        ctx.putImageData(imgData, 0, 0);

        // Blend bloom aura with vibrant core
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = w;
        finalCanvas.height = h;
        const fCtx = finalCanvas.getContext('2d');
        if (fCtx) {
          fCtx.drawImage(glowCanvas, 0, 0);
          fCtx.drawImage(canvas, 0, 0);
          pushHistory(finalCanvas.toDataURL('image/png'));
          return;
        }
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        let r = d[i];
        let g = d[i + 1];
        let b = d[i + 2];

        if (preset === 'invert') {
          d[i] = 255 - r;
          d[i + 1] = 255 - g;
          d[i + 2] = 255 - b;
        } else if (preset === 'bw') {
          // Perceptual luminance + S-curve high contrast
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          let v = lum / 255;
          v = v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v);
          const bwVal = Math.max(0, Math.min(255, Math.round(v * 255)));
          d[i] = bwVal;
          d[i + 1] = bwVal;
          d[i + 2] = bwVal;
        } else if (preset === 'sepia') {
          // Authentic rich vintage sepia with warm contrast
          const tr = r * 0.393 + g * 0.769 + b * 0.189;
          const tg = r * 0.349 + g * 0.686 + b * 0.168;
          const tb = r * 0.272 + g * 0.534 + b * 0.131;
          d[i] = Math.min(255, Math.max(0, tr * 1.08 - 8));
          d[i + 1] = Math.min(255, Math.max(0, tg * 1.02 - 6));
          d[i + 2] = Math.min(255, Math.max(0, tb * 0.88));
        } else if (preset === 'posterize') {
          // Vibrant screenprint / pop-art posterization (5 clean tonal levels + 35% saturation boost)
          const step = 255 / 4; // 63.75 -> 5 discrete bands: 0, 64, 128, 191, 255
          let qr = Math.round(r / step) * step;
          let qg = Math.round(g / step) * step;
          let qb = Math.round(b / step) * step;
          const avg = (qr + qg + qb) / 3;
          d[i] = Math.max(0, Math.min(255, Math.round(avg + (qr - avg) * 1.35)));
          d[i + 1] = Math.max(0, Math.min(255, Math.round(avg + (qg - avg) * 1.35)));
          d[i + 2] = Math.max(0, Math.min(255, Math.round(avg + (qb - avg) * 1.35)));
        }
      }

      ctx.putImageData(imgData, 0, 0);
      pushHistory(canvas.toDataURL('image/png'));
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
      const img = await loadImage(currentUrl);
      const box = await calculateAlphaBoundingBox(img, 8, paddingPx);
      onSave({
        ...asset,
        processedUrl: currentUrl,
        trimmedWidth: img.naturalWidth,
        trimmedHeight: img.naturalHeight,
        cropBox: box,
        isTrimmed: currentUrl !== asset.originalUrl && box.emptyPercent < 5,
        isBgRemoved: true
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
        <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="font-black text-base text-slate-900 tracking-tight">
                  Design Studio & Image Suite
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {asset.filename}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Active: <span className="text-indigo-600 font-bold capitalize">{activeTool.replace('-', ' ')}</span> • {asset.originalWidth} × {asset.originalHeight} px • 300 DPI High-Res
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
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 border border-slate-200 shadow-xs"
              title="Replace current image"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
              <span>Replace File</span>
            </button>

            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 transition-all border border-slate-200"
              title="Undo last change"
            >
              <RotateCcw className="w-4 h-4" />
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
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. TOP CATEGORY SWITCHER (Clean White Tabs) */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center space-x-2 overflow-x-auto flex-shrink-0">
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
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-600/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isCatActive ? 'text-white' : 'text-indigo-600'}`} />
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isCatActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {cat.tools.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. SUB-BAR: ALL TOOLS OF ACTIVE CATEGORY PROMINENTLY VISIBLE */}
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center space-x-2 overflow-x-auto flex-shrink-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-2 flex-shrink-0">
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
                    ? 'bg-indigo-50 border-2 border-indigo-600 text-indigo-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90'
                }`}
              >
                <span>{t.name}</span>
                {t.badge && (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase border ${
                    t.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'
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
          <div className="flex-1 bg-slate-100 p-4 sm:p-6 pt-16 flex flex-col items-center justify-center relative overflow-auto min-w-0 min-h-0">
            
            {/* Viewport Zoom & Garment Background Strip */}
            <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700">
              <span className="text-[10px] uppercase text-slate-400 font-extrabold mr-1">Zoom:</span>
              <button
                onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
                className="p-1 hover:text-indigo-600 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="text-[11px] font-mono text-indigo-700 w-10 text-center font-bold hover:underline cursor-pointer"
                title="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                className="p-1 hover:text-indigo-600 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="text-[10px] text-slate-500 hover:text-slate-900 ml-1 pl-1.5 border-l border-slate-200 cursor-pointer font-bold"
              >
                Fit
              </button>
            </div>

            {/* Garment Backdrop Preview Selector */}
            <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-sm text-xs">
              <span className="text-[10px] text-slate-400 font-extrabold px-1.5">Garment:</span>
              <button
                onClick={() => setGarmentBg('checker')}
                className={`w-6 h-6 rounded-lg border transition-all ${
                  garmentBg === 'checker' ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300'
                }`}
                style={{
                  backgroundImage: `linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)`,
                  backgroundSize: '8px 8px',
                  backgroundColor: '#ffffff'
                }}
                title="Checkerboard (Transparent)"
              />
              <button
                onClick={() => setGarmentBg('black')}
                className={`w-6 h-6 rounded-lg bg-black border transition-all ${
                  garmentBg === 'black' ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300'
                }`}
                title="Black Garment"
              />
              <button
                onClick={() => setGarmentBg('charcoal')}
                className={`w-6 h-6 rounded-lg bg-slate-800 border transition-all ${
                  garmentBg === 'charcoal' ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300'
                }`}
                title="Charcoal T-Shirt"
              />
              <button
                onClick={() => setGarmentBg('white')}
                className={`w-6 h-6 rounded-lg bg-white border transition-all ${
                  garmentBg === 'white' ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300'
                }`}
                title="White Garment"
              />
            </div>

            {/* Canvas / Image Display */}
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
                    src={currentUrl}
                    alt="Current Preview"
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      setImageNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
                    }}
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

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30">
                <div className="flex items-center space-x-2.5 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Processing {activeTool.replace('-', ' ')}...</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Tools Controls Pane: Clean White Panel */}
          <div className="w-full md:w-96 bg-white border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto flex-shrink-0">
            <div className="space-y-4">
              
              {/* Tool Title & Description */}
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-sm text-slate-900 capitalize">
                    {activeTool.replace('-', ' ')}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                    DTF Ready
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust settings below and preview results in real time before applying to your gang sheet.
                </p>
              </div>

              {/* 1. Fix & Quality -> Upscaler */}
              {activeTool === 'upscaler' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Upscale Resolution Factor
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setUpscaleFactor(2)}
                        className={`py-2 rounded-xl text-xs font-black transition-all ${
                          upscaleFactor === 2
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-600/20'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        2× Super-Resolution
                      </button>
                      <button
                        onClick={() => setUpscaleFactor(4)}
                        className={`py-2 rounded-xl text-xs font-black transition-all ${
                          upscaleFactor === 4
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-600/20'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        4× Ultra-Resolution
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Edge Clarity & Sharpness</span>
                      <span className="text-indigo-600 font-extrabold">{upscaleSharpness}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={upscaleSharpness}
                      onChange={(e) => setUpscaleSharpness(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleApplyUpscaler}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Run AI Upscaler ({upscaleFactor}×)</span>
                  </button>
                </div>
              )}

              {/* 1. Fix & Quality -> Color & Tone */}
              {activeTool === 'color-tone' && (
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Brightness</span>
                      <span className="text-indigo-600 font-extrabold">{brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Contrast</span>
                      <span className="text-indigo-600 font-extrabold">{contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Saturation</span>
                      <span className="text-indigo-600 font-extrabold">{saturation}</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="80"
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Hue Rotation</span>
                      <span className="text-indigo-600 font-extrabold">{hue}°</span>
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={hue}
                      onChange={(e) => setHue(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleApplyColorTone}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Apply Color & Tone</span>
                  </button>
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
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md shadow-teal-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Activity className="w-4 h-4" />
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
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Resolution & Density</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {imageNaturalSize.width} × {imageNaturalSize.height} px • {asset.effectiveDpi || 300} DPI
                        </span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        (asset.effectiveDpi || 300) >= 250 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {(asset.effectiveDpi || 300) >= 250 ? 'Optimal (300 DPI)' : 'Low DPI'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Transparent Alpha Cutout</span>
                        <span className="text-[11px] text-slate-500">No unwanted solid backings</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Passed
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Stroke Thickness Audit</span>
                        <span className="text-[11px] text-slate-500">Meets 0.3mm minimum ink line</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        DTF Ready
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Empty Margin Padding</span>
                        <span className="text-[11px] text-slate-500">Transparent outer border</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {emptyPercent}%
                      </span>
                    </div>
                  </div>

                  {onOpenAudit && (
                    <button
                      onClick={onOpenAudit}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Open Full Audit Window</span>
                    </button>
                  )}
                </div>
              )}

              {/* 2. Cut & Adjust -> BG Remover */}
              {activeTool === 'bg-remover' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Tolerance Threshold</span>
                      <span className="text-indigo-600 font-extrabold">{bgTolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={bgTolerance}
                      onChange={(e) => setBgTolerance(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleRemoveBackground}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>Auto Remove Background</span>
                  </button>
                </div>
              )}

              {/* 2. Cut & Adjust -> Replace Color */}
              {activeTool === 'remove-replace-color' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Color to Knockout / Replace
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={targetColorHex}
                        onChange={(e) => setTargetColorHex(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-200"
                      />
                      <input
                        type="text"
                        value={targetColorHex}
                        onChange={(e) => setTargetColorHex(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="transparentKnockout"
                      checked={replaceWithTransparent}
                      onChange={(e) => setReplaceWithTransparent(e.target.checked)}
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="transparentKnockout" className="text-xs text-slate-700 font-bold cursor-pointer">
                      Make Transparent (Knockout)
                    </label>
                  </div>

                  {!replaceWithTransparent && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        New Replacement Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={replaceColorHex}
                          onChange={(e) => setReplaceColorHex(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-200"
                        />
                        <input
                          type="text"
                          value={replaceColorHex}
                          onChange={(e) => setReplaceColorHex(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Color Tolerance</span>
                      <span className="text-indigo-600 font-extrabold">{colorTol}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={colorTol}
                      onChange={(e) => setColorTol(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleReplaceColor}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Pipette className="w-4 h-4" />
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
                      className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      title="Tighten the crop border directly to the graphic"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Snap Box to Art</span>
                    </button>
                    <button
                      onClick={handleResetCropBox}
                      type="button"
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      title="Reset crop selection to 100% full bounds"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset Box (100%)</span>
                    </button>
                  </div>

                  {/* Aspect Ratio Presets */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
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
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Auto-Trim Transparent Padding ({emptyPercent}% Waste)</span>
                  </button>

                  {/* Transform & Rotate */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Transform & Rotate
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTransformImage('rot90')}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                        <span>90° CW</span>
                      </button>
                      <button
                        onClick={() => handleTransformImage('rot270')}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                        <span>90° CCW</span>
                      </button>
                      <button
                        onClick={() => handleTransformImage('flipH')}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Flip H</span>
                      </button>
                      <button
                        onClick={() => handleTransformImage('flipV')}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <FlipVertical className="w-3.5 h-3.5 text-indigo-600" />
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
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Eraser Brush Radius</span>
                      <span className="text-indigo-600 font-extrabold">{eraserSize} px</span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="72"
                      value={eraserSize}
                      onChange={(e) => setEraserSize(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
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
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Frame Inset / Border Thickness</span>
                      <span className="text-indigo-600 font-extrabold">{borderInset} px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="60"
                      step="2"
                      value={borderInset}
                      onChange={(e) => setBorderInset(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Knockout Mask Shape</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => setBorderKnockoutShape('rect')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          borderKnockoutShape === 'rect' ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs' : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        Rectangle
                      </button>
                      <button
                        onClick={() => setBorderKnockoutShape('round')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          borderKnockoutShape === 'round' ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs' : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        Rounded
                      </button>
                      <button
                        onClick={() => setBorderKnockoutShape('oval')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          borderKnockoutShape === 'oval' ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs' : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        Oval
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleBorderKnockout}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>Punch-Out Outer Border</span>
                  </button>
                </div>
              )}

              {/* 3. Style & Effects -> Texture (Vintage T-Shirt Wear) */}
              {activeTool === 'texture' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Distress Texture Style
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['cracked', 'vintage', 'grunge'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setTextureType(st)}
                          className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                            textureType === st
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Wear Intensity</span>
                      <span className="text-indigo-600 font-extrabold">{textureIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      value={textureIntensity}
                      onChange={(e) => setTextureIntensity(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleApplyTexture}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-pink-600/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Apply Distressed Texture</span>
                  </button>
                </div>
              )}

              {/* 3. Style & Effects -> Halftone */}
              {activeTool === 'halftone' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Screen Dot Pitch</span>
                      <span className="text-indigo-600 font-extrabold">{halftoneSpacing} px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="16"
                      value={halftoneSpacing}
                      onChange={(e) => setHalftoneSpacing(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Dot Radius</span>
                      <span className="text-indigo-600 font-extrabold">{halftoneRadius} px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="8"
                      value={halftoneRadius}
                      onChange={(e) => setHalftoneRadius(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleApplyHalftone}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-teal-600/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <CircleDot className="w-4 h-4" />
                    <span>Apply Halftone Screen</span>
                  </button>
                </div>
              )}

              {/* 3. Style & Effects -> Stroke / Outline */}
              {activeTool === 'stroke-outline' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Contour Stroke Width</span>
                      <span className="text-indigo-600 font-extrabold">{strokeWidth} px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Contour Stroke Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-200"
                      />
                      <input
                        type="text"
                        value={strokeColor}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleApplyStroke}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Apply Outline Stroke</span>
                  </button>
                </div>
              )}

              {/* 3. Style & Effects -> Special Effects */}
              {activeTool === 'special-effects' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">
                      Style Filter Presets
                    </label>
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                      DTF Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleApplyPresetEffect('neon')}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs border border-pink-200 text-left transition-colors"
                    >
                      ⚡ Neon Glow
                    </button>
                    <button
                      onClick={() => handleApplyPresetEffect('sepia')}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 text-left transition-colors"
                    >
                      📜 Vintage Sepia
                    </button>
                    <button
                      onClick={() => handleApplyPresetEffect('posterize')}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold text-xs border border-cyan-200 text-left transition-colors"
                    >
                      🎨 Posterize
                    </button>
                    <button
                      onClick={() => handleApplyPresetEffect('bw')}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 text-left transition-colors"
                    >
                      ⚪ Black & White
                    </button>
                    <button
                      onClick={() => handleApplyPresetEffect('invert')}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 text-left transition-colors"
                    >
                      🔄 Invert Colors
                    </button>
                    <button
                      onClick={() => handleApplyPresetEffect('embroidery')}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 text-left transition-colors shadow-xs flex items-center justify-between group"
                    >
                      <span>🧵 Embroidery Effect</span>
                      <span className="text-[10px] bg-emerald-200/90 text-emerald-900 px-1.5 py-0.5 rounded-full font-black group-hover:scale-105 transition-transform">
                        NEW
                      </span>
                    </button>
                  </div>

                  {/* Embroidery Fine-Tuning Controls */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>🧵 3D Realistic Embroidery Controls</span>
                      </span>
                      <button
                        onClick={() => handleApplyPresetEffect('embroidery')}
                        disabled={isProcessing}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {isProcessing ? 'Stitching...' : 'Apply Embroidery'}
                      </button>
                    </div>

                    {/* Stitch Direction */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                        Stitch Angle (Direction)
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: '45°', val: 45 },
                          { label: '-45°', val: -45 },
                          { label: '0° Flat', val: 0 },
                          { label: '90° Vert', val: 90 }
                        ].map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => setEmbroideryAngle(item.val)}
                            className={`py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                              embroideryAngle === item.val
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Outer Satin Border Toggle */}
                    <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Satin Edge Border (Badge Contour)
                        </span>
                        <span className="text-[9px] text-slate-400">
                          3D raised border with turnaround thread loops
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={embroideryHasBorder}
                        onChange={(e) => setEmbroideryHasBorder(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Fabric Backing Selection */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 mb-1.5 block">
                        Fabric Backing (Background)
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'transparent', label: 'Transparent (DTF Film)' },
                          { id: 'twill-canvas', label: 'Twill Canvas (Khaki)' },
                          { id: 'dark-denim', label: 'Dark Denim' },
                          { id: 'heather-gray', label: 'Heather Gray' }
                        ].map((fab) => (
                          <button
                            key={fab.id}
                            type="button"
                            onClick={() => setEmbroideryFabric(fab.id as any)}
                            className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border text-left transition-all cursor-pointer ${
                              embroideryFabric === fab.id
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-1 ring-emerald-400 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {fab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sliders */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>Thread Thickness (Stitch Density)</span>
                        <span className="text-slate-800 font-mono">{embroideryPitch}px</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="24"
                        step="1"
                        value={embroideryPitch}
                        onChange={(e) => setEmbroideryPitch(Number(e.target.value))}
                        className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>Thread Luster & 3D Specular Sheen</span>
                        <span className="text-slate-800 font-mono">{embroiderySheen}%</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="100"
                        step="5"
                        value={embroiderySheen}
                        onChange={(e) => setEmbroiderySheen(Number(e.target.value))}
                        className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Create & Convert -> Text & Number */}
              {activeTool === 'text-number' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Text / Number String
                    </label>
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 uppercase focus:bg-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Fill Color
                      </label>
                      <input
                        type="color"
                        value={textFillColor}
                        onChange={(e) => setTextFillColor(e.target.value)}
                        className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Outline Color
                      </label>
                      <input
                        type="color"
                        value={textStrokeColor}
                        onChange={(e) => setTextStrokeColor(e.target.value)}
                        className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-slate-200"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateText}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-amber-500/25 transition-all flex items-center justify-center space-x-2"
                  >
                    <Type className="w-4 h-4" />
                    <span>Render Jersey Text</span>
                  </button>
                </div>
              )}

              {/* 4. Create & Convert -> Vectorise */}
              {activeTool === 'vectorize' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-xs text-cyan-900 font-medium">
                    Traces pixel boundaries into clean, sharp vector-like contour edges and eliminates anti-aliasing blur for plotter cutting and crisp screen printing.
                  </div>
                  <button
                    onClick={handleVectorizeTrace}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-md shadow-cyan-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Vectorize & Trace Vector Contours</span>
                  </button>
                </div>
              )}

              {/* 4. Create & Convert -> Recreate AI */}
              {activeTool === 'recreate-ai' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-fuchsia-50 border border-fuchsia-200 text-xs text-fuchsia-900 font-medium">
                    Regenerates high-frequency details, removes compression artifacts, and rebuilds high-fidelity edge contours using neural edge reconstruction.
                  </div>
                  <button
                    onClick={handleRecreateAi}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-fuchsia-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Recreate with AI (2x High-Fidelity)</span>
                  </button>
                </div>
              )}

              {/* 4. Create & Convert -> TIFF Export (RIP) */}
              {activeTool === 'tiff-export' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-medium">
                    Generates production-grade multi-channel TIFFs for professional RIP software (Maintop, RIIN, PrintFactory, Flexi).
                  </div>

                  {/* DTF vs UVDTF Mode Toggle Buttons */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                      Choose Print Process
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTiffProcessMode('dtf')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          tiffProcessMode === 'dtf'
                            ? 'bg-indigo-50/80 border-2 border-indigo-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <Shirt className={`w-4 h-4 ${tiffProcessMode === 'dtf' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className="font-extrabold text-xs text-slate-900">DTF</span>
                          </div>
                          {tiffProcessMode === 'dtf' && (
                            <span className="text-[10px] font-bold text-indigo-600">✓</span>
                          )}
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 mt-1">
                          Direct-to-Film (Textiles)
                        </div>
                        <div className="text-[9px] font-mono text-indigo-700 font-bold mt-1">
                          CMYK, W1
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTiffProcessMode('uvdtf')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          tiffProcessMode === 'uvdtf'
                            ? 'bg-purple-50/80 border-2 border-purple-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <Sparkles className={`w-4 h-4 ${tiffProcessMode === 'uvdtf' ? 'text-purple-600' : 'text-slate-400'}`} />
                            <span className="font-extrabold text-xs text-slate-900">UVDTF</span>
                          </div>
                          {tiffProcessMode === 'uvdtf' && (
                            <span className="text-[10px] font-bold text-purple-600">✓</span>
                          )}
                        </div>
                        <div className="text-[10px] font-medium text-purple-700 mt-1">
                          UV Transfer + Varnish
                        </div>
                        <div className="text-[9px] font-mono text-purple-800 font-bold mt-1">
                          CMYK, W1, W2
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Sequence: CMYK first, then W1, then W2 */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-700">1. Color Channel</span>
                      <span className="font-mono text-slate-800 font-extrabold">CMYK SWOP v2</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-700">2. White Underbase Channel</span>
                      <span className="font-mono text-indigo-600 font-extrabold">W1 (Spot White)</span>
                    </div>
                    {tiffProcessMode === 'uvdtf' && (
                      <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex justify-between items-center animate-in fade-in">
                        <span className="font-bold text-purple-900">3. UV Varnish Pass</span>
                        <span className="font-mono text-purple-700 font-extrabold">W2 Spot Gloss (Active)</span>
                      </div>
                    )}
                  </div>

                  {onOpenTiff && (
                    <button
                      onClick={onOpenTiff}
                      className={`w-full py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1 ${
                        tiffProcessMode === 'uvdtf'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-600/25'
                          : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                      }`}
                    >
                      <FileStack className="w-4 h-4" />
                      <span>Open TIFF Studio ({tiffProcessMode.toUpperCase()})</span>
                    </button>
                  )}
                </div>
              )}

            </div>

            {/* Bottom Actions: Save to Gang Sheet */}
            <div className="pt-4 border-t border-slate-200 space-y-2 mt-4 flex-shrink-0">
              <button
                onClick={handleSaveModal}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Save & Apply to Gang Sheet</span>
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold hover:bg-slate-100 transition-colors"
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
