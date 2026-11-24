/**
 * 3D HD Gang Sheet Studio: PNG upload → W1 / CMY / W2 layer editing → fixed
 * 11 × 17 in gang sheet (shared MaxRects engine, 90° rotation) → TIFF export.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, UploadCloud, Layers, Lock, Copy, Trash2, Pencil, Minus, Plus, Download, Loader2,
  CheckCircle2, AlertTriangle, RotateCw, FileDown, X, Info, Trash, ImagePlus, ExternalLink, Maximize2
} from 'lucide-react';
import type { UserProfile } from '../types/auth';
import type { ArtworkAsset, LayoutResult, SheetSettings } from '../types';
import { packGangSheet } from '../utils/packing';
import { findPresetById, getSettingsUpdatesForPreset } from '../utils/sheetPresets';
import type { HdDesign, HdLayerState, HdPreviewMode, HdTexture } from './types';
import { HD3D_SHEET_LENGTH_IN, HD3D_SHEET_WIDTH_IN } from './types';
import { loadDesign, formatBytes, HdImageError, newId, isPng } from './hdImage';
import { bakeCmy, finalMasks, layerCoverage } from './maskOps';
import { renderThumbnail, W1_PREVIEW, W2_PREVIEW } from './render';
import { addUploadedTexture, canManageTextures, deleteUploadedTexture, loadTextureLibrary, textureThumbnail } from './textureStore';
import { Hd3dEditor } from './Hd3dEditor';
import { Hd3dSheetViewer } from './Hd3dSheetViewer';
import type { Hd3dExportMessage, Hd3dExportRequest, Hd3dVerification } from '../workers/hd3dExportWorker';
import type { ExportFormat } from './sheetCompose';

interface Props {
  currentUser: UserProfile | null;
  onBack: () => void;
  onNotification: (message: string, type?: 'info' | 'warning' | 'success') => void;
}

const IN = 25.4;
const MODES: { id: HdPreviewMode; label: string }[] = [
  { id: 'combined', label: '3D HD Result' },
  { id: 'cmy', label: 'Original / CMYK' },
  { id: 'w1', label: 'W1 (White Base / Raised)' },
  { id: 'w2', label: 'W2 (Varnish / Glossy)' }
];
const DPI_OPTIONS = [300, 360, 600, 720];

/** Coverage label: "none" for an empty layer, otherwise the share of the artwork. */
const fmtPct = (v: number) => (v <= 0 ? 'none' : v < 1 ? `${v.toFixed(1)}%` : `${v.toFixed(0)}%`);

// Designs survive leaving and re-opening the studio during this browser session.
let sessionDesigns: HdDesign[] = [];

interface Derived {
  rev: number;
  textureKey: string;
  w1: Uint8Array;
  w2: Uint8Array;
  cmy: Uint8ClampedArray;
  w1Pct: number;
  identical: boolean;
  w2Pct: number;
  thumbs: Record<string, HTMLCanvasElement>;
}

export const Hd3dStudio: React.FC<Props> = ({ currentUser, onBack, onNotification }) => {
  const [designs, setDesignsState] = useState<HdDesign[]>(sessionDesigns);
  const setDesigns = useCallback((fn: (d: HdDesign[]) => HdDesign[]) => {
    setDesignsState((prev) => { const next = fn(prev); sessionDesigns = next; return next; });
  }, []);
  const [textures, setTextures] = useState<HdTexture[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<HdPreviewMode>('cmy');
  const [spacingMm, setSpacingMm] = useState(4);
  const [marginMm, setMarginMm] = useState(5);
  const [rotation, setRotation] = useState(true);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [inspect, setInspect] = useState<{ sheet: number; index: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const isAdmin = canManageTextures(currentUser);

  useEffect(() => { loadTextureLibrary().then(setTextures); }, []);
  const lookup = useCallback((id: string) => {
    const t = textures.find((x) => x.id === id);
    return t ? { tile: t.tile, size: t.size } : undefined;
  }, [textures]);

  // --- Upload.
  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const rejected = list.filter((f) => !isPng(f));
    if (rejected.length) onNotification(`${rejected.length} file(s) skipped: 3D HD accepts PNG only.`, 'warning');
    const pngs = list.filter(isPng);
    const added: HdDesign[] = [];
    for (let i = 0; i < pngs.length; i++) {
      setLoading(`Reading ${pngs[i].name} (${i + 1}/${pngs.length})…`);
      try {
        // Leave room for the default 5 mm margins.
        added.push(await loadDesign(pngs[i], HD3D_SHEET_WIDTH_IN - 0.4, HD3D_SHEET_LENGTH_IN - 0.4));
      } catch (err) {
        onNotification(err instanceof HdImageError ? err.message : `${pngs[i].name} could not be read.`, 'warning');
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    setLoading(null);
    if (added.length) {
      setDesigns((d) => [...d, ...added]);
      onNotification(`${added.length} PNG design(s) added to the 3D HD sheet`, 'success');
    }
  };

  // --- Derived print data per design (final masks, CMY with textures, thumbnails).
  const [derived, setDerived] = useState<Record<string, Derived>>({});
  const textureKey = useMemo(() => textures.map((t) => t.id).join(','), [textures]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const d of designs) {
        const cur = derived[d.id];
        if (cur && cur.rev === d.revision && cur.textureKey === textureKey) continue;
        await new Promise((r) => setTimeout(r, 0));
        if (cancelled) return;
        const fm = finalMasks(d.rgba, d.width, d.height, d.layers, lookup);
        const cmy = d.rgba; // CMY must remain the original colour artwork throughout the entire processing workflow
        const cov = layerCoverage(d.rgba, d.width, d.height, fm); // same calculation as the editor and the export check
        const entry: Derived = { rev: d.revision, textureKey, w1: fm.w1, w2: fm.w2, cmy, w1Pct: cov.w1Pct, w2Pct: cov.w2Pct, identical: cov.identical, thumbs: {} };
        if (cancelled) return;
        setDerived((prev) => ({ ...prev, [d.id]: entry }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designs, textureKey, lookup]);
  const [maskOnly, setMaskOnly] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const thumbFor = (d: HdDesign, m: HdPreviewMode, px = 640, mo = maskOnly): HTMLCanvasElement | null => {
    const dv = derived[d.id];
    if (!dv) return null;
    const key = `${mo && (m === 'w1' || m === 'w2') ? `${m}-mask` : m}@${px}`; // cached per view and size
    if (!dv.thumbs[key]) {
      dv.thumbs[key] = renderThumbnail({ width: d.width, height: d.height, original: d.rgba, cmy: dv.cmy, w1: dv.w1, w2: dv.w2 }, m, px, undefined, mo);
    }
    return dv.thumbs[key]!;
  };

  // --- Layout on the fixed 11 × 17 sheet.
  const settings: SheetSettings = useMemo(() => ({
    ...getSettingsUpdatesForPreset(findPresetById('uvdtf-a3')!), // 11 × 17, fixed length
    printType: 'uvdtf',
    unit: 'inch',
    spacing: spacingMm / IN, spacingMm,
    margin: marginMm / IN, marginMm,
    exportDpi: 300,
    allowItemRotation: rotation,
    keepDesignsTogether: true,
    nestingAlgorithm: 'box',
    mode: 'multiple'
  } as SheetSettings), [spacingMm, marginMm, rotation]);
  const layout: LayoutResult | null = useMemo(() => {
    if (!designs.length) return null;
    const assets: ArtworkAsset[] = designs.map((d) => ({
      id: d.id, filename: d.filename, fileType: 'png', fileSize: d.fileSize, originalWidth: d.width, originalHeight: d.height,
      hasAlpha: true, originalUrl: d.url, processedUrl: d.url, trimmedWidth: d.width, trimmedHeight: d.height, cropBox: null,
      isTrimmed: false, isBgRemoved: false, targetWidth: d.widthIn, targetHeight: d.heightIn, targetWidthMm: d.widthIn * IN,
      targetHeightMm: d.heightIn * IN, aspectLocked: true, copies: d.copies, allowRotation: true,
      effectiveDpi: d.width / d.widthIn, dpiStatus: 'green', status: 'ready'
    }));
    return packGangSheet(assets, settings);
  }, [designs, settings]);
  const sheets = layout?.sheets ?? [];
  useEffect(() => { if (sheetIdx >= sheets.length) setSheetIdx(0); }, [sheets.length, sheetIdx]);
  const totalCopies = designs.reduce((n, d) => n + d.copies, 0);
  const rotatedCount = layout?.placements.filter((p) => p.rotated).length ?? 0;
  const usableW = HD3D_SHEET_WIDTH_IN - (2 * marginMm) / IN, usableH = HD3D_SHEET_LENGTH_IN - (2 * marginMm) / IN;
  const fitsSheet = (d: HdDesign) => (d.widthIn <= usableW + 1e-6 && d.heightIn <= usableH + 1e-6) || (rotation && d.heightIn <= usableW + 1e-6 && d.widthIn <= usableH + 1e-6);

  // --- Sheet preview canvas.
  const sheetWrap = useRef<HTMLDivElement>(null);
  const sheetCanvas = useRef<HTMLCanvasElement>(null);
  const [sheetBox, setSheetBox] = useState({ w: 300, h: 464 });
  useEffect(() => {
    const el = sheetWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const s = Math.min(r.width / HD3D_SHEET_WIDTH_IN, Math.max(320, r.height) / HD3D_SHEET_LENGTH_IN);
      setSheetBox({ w: Math.floor(HD3D_SHEET_WIDTH_IN * s), h: Math.floor(HD3D_SHEET_LENGTH_IN * s) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = sheetCanvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = sheetBox.w * dpr; c.height = sheetBox.h * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = sheetBox.w / (HD3D_SHEET_WIDTH_IN * IN); // px per mm
    // Transparent film as a light checkerboard; "mask only" W1/W2 views are white ink on black.
    const maskView = maskOnly && (mode === 'w1' || mode === 'w2');
    ctx.fillStyle = maskView ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, sheetBox.w, sheetBox.h);
    if (!maskView) {
      ctx.fillStyle = '#f1ede6';
      for (let y = 0; y < sheetBox.h; y += 10) for (let x = (y / 10) % 2 ? 10 : 0; x < sheetBox.w; x += 20) ctx.fillRect(x, y, 10, 10);
    }
    ctx.strokeStyle = maskView ? '#333333' : '#d9cdb9';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(marginMm * k, marginMm * k, sheetBox.w - 2 * marginMm * k, sheetBox.h - 2 * marginMm * k);
    ctx.setLineDash([]);
    const sheet = sheets[sheetIdx];
    if (!sheet) return;
    sheet.placements.forEach((p, i) => {
      const d = designs.find((x) => x.id === p.assetId);
      if (!d) return;
      const x = p.xMm * k, y = p.yMm * k, w = p.widthMm * k, h = p.heightMm * k;
      const img = thumbFor(d, mode);
      ctx.save();
      ctx.imageSmoothingQuality = 'high';
      if (p.rotated) { ctx.translate(x + w, y); ctx.rotate(Math.PI / 2); if (img) ctx.drawImage(img, 0, 0, h, w); }
      else if (img) ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      const sel = inspect && inspect.sheet === sheetIdx && inspect.index === i;
      if (sel || selectedId === d.id) {
        ctx.strokeStyle = sel ? '#EF7F1A' : 'rgba(239,127,26,0.6)';
        ctx.lineWidth = sel ? 2.5 : 1.5;
        ctx.strokeRect(x, y, w, h);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetBox, sheets, sheetIdx, mode, derived, designs, inspect, selectedId, marginMm, maskOnly]);

  const onSheetClick = (e: React.MouseEvent) => {
    const sheet = sheets[sheetIdx];
    if (!sheet) return;
    const r = sheetCanvas.current!.getBoundingClientRect();
    const k = sheetBox.w / (HD3D_SHEET_WIDTH_IN * IN);
    const mx = (e.clientX - r.left) / k, my = (e.clientY - r.top) / k;
    const i = sheet.placements.findIndex((p) => mx >= p.xMm && mx <= p.xMm + p.widthMm && my >= p.yMm && my <= p.yMm + p.heightMm);
    setInspect(i >= 0 ? { sheet: sheetIdx, index: i } : null);
    if (i >= 0) setSelectedId(sheet.placements[i].assetId);
  };
  const inspected = inspect ? sheets[inspect.sheet]?.placements[inspect.index] : undefined;

  // --- Design actions (all three layers always travel together).
  const update = (id: string, patch: Partial<HdDesign>) => setDesigns((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const duplicate = (d: HdDesign) => {
    const layers: HdLayerState = {
      w1: new Uint8Array(d.layers.w1), w2: new Uint8Array(d.layers.w2), w2ExcludesW1: d.layers.w2ExcludesW1,
      textures: d.layers.textures.map((t) => ({ ...t, id: newId('texapp'), clip: new Uint8Array(t.clip) }))
    };
    const copy: HdDesign = { ...d, id: newId('hd'), filename: d.filename.replace(/(\.png)?$/i, ' (copy)$1'), rgba: d.rgba, layers, revision: 0 };
    setDesigns((ds) => { const i = ds.findIndex((x) => x.id === d.id); const next = [...ds]; next.splice(i + 1, 0, copy); return next; });
    onNotification('Design duplicated with its W1, CMY and W2 layers', 'success');
  };
  const remove = (d: HdDesign) => {
    setDesigns((ds) => ds.filter((x) => x.id !== d.id));
    if (!designs.some((x) => x.id !== d.id && x.url === d.url)) URL.revokeObjectURL(d.url); // duplicates share the original file
    setInspect(null);
  };
  const setWidth = (d: HdDesign, wIn: number) => {
    if (!(wIn > 0)) return;
    update(d.id, { widthIn: wIn, heightIn: (wIn * d.height) / d.width });
  };

  // --- Export.
  const [dpi, setDpi] = useState(360);
  const [format, setFormat] = useState<ExportFormat>('single');
  const [invertSpots, setInvertSpots] = useState(false);
  const [exporting, setExporting] = useState<{ fraction: number; label: string } | null>(null);
  const [result, setResult] = useState<{ files: { name: string; blob: Blob; url: string }[]; verification: Hd3dVerification[]; stats: { w1Pixels: number; w2Pixels: number; widthPx: number; heightPx: number }[]; designs: { id: string; w1Pct: number; w2Pct: number; identical: boolean }[] } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pxW = Math.round(HD3D_SHEET_WIDTH_IN * dpi), pxH = Math.round(HD3D_SHEET_LENGTH_IN * dpi);
  const clearResult = () => { result?.files.forEach((f) => URL.revokeObjectURL(f.url)); setResult(null); };
  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const startExport = () => {
    if (!layout || !sheets.length) return;
    if ((layout.validationErrors ?? []).length) { onNotification('The layout has overlapping designs and cannot be exported.', 'warning'); return; }
    clearResult();
    const used = new Set(designs.flatMap((d) => d.layers.textures.map((t) => t.textureId)));
    const tiles: Hd3dExportRequest['tiles'] = {};
    textures.forEach((t) => { if (used.has(t.id)) tiles[t.id] = { tile: t.tile, size: t.size }; });
    const req: Hd3dExportRequest = {
      dpi, format, invertSpots, sheetWidthIn: HD3D_SHEET_WIDTH_IN, sheetLengthIn: HD3D_SHEET_LENGTH_IN,
      designs: designs.map((d) => ({ id: d.id, width: d.width, height: d.height, rgba: d.rgba, layers: d.layers })),
      tiles,
      sheets: sheets.map((s) => s.placements.map((p) => ({ designId: p.assetId, xMm: p.xMm, yMm: p.yMm, widthMm: p.widthMm, heightMm: p.heightMm, rotated: p.rotated })))
    };
    let w: Worker;
    try {
      w = new Worker(new URL('../workers/hd3dExportWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      onNotification('This browser cannot run the export in the background.', 'warning');
      return;
    }
    workerRef.current = w;
    setExporting({ fraction: 0, label: 'Starting export…' });
    w.onmessage = (e: MessageEvent<Hd3dExportMessage>) => {
      const m = e.data;
      if (m.type === 'progress') { setExporting({ fraction: m.fraction, label: m.label }); return; }
      w.terminate(); workerRef.current = null; setExporting(null);
      if (m.type === 'error') { onNotification(`Export failed: ${m.message}`, 'warning'); return; }
      const files = m.files.map((f) => { const blob = new Blob(f.parts as BlobPart[], { type: 'image/tiff' }); return { name: f.name, blob, url: URL.createObjectURL(blob) }; });
      setResult({ files, verification: m.verification, stats: m.stats, designs: m.coverage });
      onNotification(`3D HD TIFF ready: ${files.length} file(s)`, 'success');
    };
    w.onerror = (e) => { w.terminate(); workerRef.current = null; setExporting(null); onNotification(`Export failed: ${e.message}`, 'warning'); };
    w.postMessage(req);
  };
  const cancelExport = () => { workerRef.current?.terminate(); workerRef.current = null; setExporting(null); onNotification('Export cancelled', 'info'); };
  const download = (f: { name: string; url: string }) => {
    const a = document.createElement('a');
    a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  };

  // --- Texture library management (administrators).
  const [libOpen, setLibOpen] = useState(false);
  const [texName, setTexName] = useState('');
  const [texCat, setTexCat] = useState('Custom');
  const texFile = useRef<HTMLInputElement>(null);
  const texThumbs = useMemo(() => Object.fromEntries(textures.map((t) => [t.id, textureThumbnail(t, 64)])), [textures]);
  const uploadTexture = async (file: File) => {
    if (!currentUser) return;
    try {
      await addUploadedTexture(file, texName, texCat, currentUser);
      setTextures(await loadTextureLibrary());
      setTexName('');
      onNotification('Texture added to the library', 'success');
    } catch (err) {
      onNotification(err instanceof Error ? err.message : 'Texture upload failed', 'warning');
    }
  };
  const removeTexture = async (t: HdTexture) => {
    if (!currentUser) return;
    const inUse = designs.some((d) => d.layers.textures.some((a) => a.textureId === t.id));
    if (inUse) { onNotification('This texture is used by a design. Remove it from the design first.', 'warning'); return; }
    await deleteUploadedTexture(t.id, currentUser);
    setTextures(await loadTextureLibrary());
  };

  const editing = designs.find((d) => d.id === editingId) ?? null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F3EBDD] pb-36 md:pb-10">
      {/* Header */}
      <div className="bg-white border-b border-[#E5D9C8] px-4 md:px-8 py-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="h-10 px-3 rounded-xl border border-[#E5D9C8] text-[#204563] text-xs font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" />Technologies</button>
        <div className="order-3 sm:order-none w-full sm:w-auto sm:flex-1 min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 rounded-2xl bg-gradient-to-br from-[#204563] to-[#3a6b8f] flex items-center justify-center shadow-md"><Layers className="w-5 h-5 text-[#EF7F1A]" /></div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-black text-[#204563] leading-tight">3D HD Gang Sheet Studio</h1>
            <p className="text-[11px] md:text-xs text-[#526A7B]">W1 raised white • CMY colour • W2 gloss — one aligned print file</p>
          </div>
        </div>
        <span className="ml-auto sm:ml-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] text-xs font-black text-[#204563] font-mono whitespace-nowrap"><Lock className="w-3.5 h-3.5 text-[#EF7F1A]" />11" × 17" fixed</span>
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-6 pt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)_minmax(0,300px)] gap-4">
        {/* Designs */}
        <section className="space-y-3 min-w-0">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
            className="bg-white rounded-2xl border-2 border-dashed border-[#E5D9C8] p-4 text-center"
          >
            <input ref={fileInput} type="file" accept="image/png,.png" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
            <UploadCloud className="w-7 h-7 mx-auto text-[#EF7F1A]" />
            <p className="text-sm font-black text-[#204563] mt-1">Upload PNG artwork</p>
            <p className="text-[11px] text-[#526A7B]">Transparent PNGs, full resolution — the original file is never changed</p>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={!!loading} className="mt-3 h-10 px-4 rounded-xl bg-[#EF7F1A] text-[#204563] text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}{loading ?? 'Browse PNG files'}
            </button>
          </div>

          {designs.map((d) => {
            const dv = derived[d.id];
            const effDpi = Math.round(d.width / d.widthIn);
            const thumb = thumbFor(d, mode, 160);
            return (
              <div key={d.id} className={`bg-white rounded-2xl border p-3 space-y-2.5 ${selectedId === d.id ? 'border-[#EF7F1A] ring-2 ring-[#EF7F1A]/20' : 'border-[#E5D9C8]'}`} onClick={() => setSelectedId(d.id)}>
                <div className="flex gap-3">
                  <div className="w-20 h-20 flex-shrink-0 rounded-xl bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px] flex items-center justify-center overflow-hidden border border-[#E5D9C8]">
                    {thumb ? <img src={thumb.toDataURL()} alt="" className="max-w-full max-h-full" /> : <Loader2 className="w-5 h-5 animate-spin text-[#526A7B]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-[#204563] truncate" title={d.filename}>{d.filename}</div>
                    <div className="text-[10px] text-[#526A7B] font-mono">{d.width} × {d.height} px • {formatBytes(d.fileSize)}</div>
                    <div className="text-[10px] text-[#526A7B]">File DPI: {d.fileDpi ?? 'not set'} • Print: <span className={effDpi >= 300 ? 'text-emerald-700 font-bold' : effDpi >= 200 ? 'text-amber-600 font-bold' : 'text-red-600 font-bold'}>{effDpi} DPI</span></div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: `rgb(${W1_PREVIEW.join(',')})` }}>W1 {dv ? fmtPct(dv.w1Pct) : '…'}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: `rgb(${W2_PREVIEW.join(',')})` }}>W2 {dv ? fmtPct(dv.w2Pct) : '…'}</span>
                      {dv?.identical && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="W1 and W2 cover exactly the same pixels">W1 = W2</span>}
                      {d.layers.textures.length > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#EF7F1A] text-[#204563]">{d.layers.textures.length} texture(s)</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-[11px] font-bold text-[#204563]">W
                    <input type="number" step={0.01} min={0.1} value={Number(d.widthIn.toFixed(2))} onChange={(e) => setWidth(d, +e.target.value)} className="w-16 h-8 px-1.5 rounded-lg border border-[#E5D9C8] font-mono text-xs" aria-label="Print width in inches" />
                  </label>
                  <span className="text-[11px] font-bold text-[#204563]">× {d.heightIn.toFixed(2)} in</span>
                  <span className="flex items-center gap-1 ml-auto">
                    <button type="button" onClick={() => setDesigns((ds) => ds.map((x) => (x.id === d.id ? { ...x, copies: Math.max(1, x.copies - 1) } : x)))} className="w-8 h-8 rounded-lg border border-[#E5D9C8] flex items-center justify-center" aria-label="Fewer copies"><Minus className="w-3.5 h-3.5" /></button>
                    <input type="number" min={1} value={d.copies} onChange={(e) => update(d.id, { copies: Math.max(1, Math.min(500, Math.round(+e.target.value) || 1)) })} className="w-12 h-8 text-center rounded-lg border border-[#E5D9C8] font-mono text-xs" aria-label="Copies" />
                    <button type="button" onClick={() => setDesigns((ds) => ds.map((x) => (x.id === d.id ? { ...x, copies: Math.min(500, x.copies + 1) } : x)))} className="w-8 h-8 rounded-lg border border-[#E5D9C8] flex items-center justify-center" aria-label="More copies"><Plus className="w-3.5 h-3.5" /></button>
                  </span>
                </div>
                {!fitsSheet(d) && <p className="text-[10px] font-bold text-red-600 flex gap-1"><AlertTriangle className="w-3 h-3" />Larger than the printable 11 × 17 area — reduce the width.</p>}
                <div className="grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setEditingId(d.id); }} className="h-9 rounded-xl bg-[#204563] text-white text-[11px] font-black flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" />Edit layers</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); duplicate(d); }} className="h-9 rounded-xl border border-[#E5D9C8] text-[#204563] text-[11px] font-bold flex items-center justify-center gap-1"><Copy className="w-3.5 h-3.5" />Duplicate</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); remove(d); }} className="h-9 rounded-xl border border-red-200 text-red-600 text-[11px] font-bold flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Sheet preview */}
        <section className="bg-white rounded-2xl border border-[#E5D9C8] p-3 min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)} className={`h-9 px-3 rounded-xl text-xs font-bold border ${mode === m.id ? 'bg-[#EF7F1A] border-[#EF7F1A] text-[#204563]' : 'bg-white border-[#E5D9C8] text-[#204563]'}`}>{m.label}</button>
            ))}
            {(mode === 'w1' || mode === 'w2') && (
              <label className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563] cursor-pointer">
                <input type="checkbox" checked={maskOnly} onChange={(e) => setMaskOnly(e.target.checked)} className="accent-[#EF7F1A]" />Mask only
              </label>
            )}
          </div>
          {(mode === 'w1' || mode === 'w2') && designs.length > 0 && (() => {
            const empty = designs.filter((d) => derived[d.id] && (mode === 'w1' ? derived[d.id].w1Pct : derived[d.id].w2Pct) === 0);
            const col = mode === 'w1' ? W1_PREVIEW : W2_PREVIEW;
            return (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#204563]">
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm border border-slate-400" style={{ background: maskOnly ? '#ffffff' : `rgb(${col.join(',')})` }} />= {mode === 'w1' ? 'W1 raised white' : 'W2 gloss'} at 100 %{maskOnly ? ' (black = no ink)' : ' (red preview overlay only)'}</span>
                {empty.length > 0 && <span className="text-amber-700">{empty.length === designs.length ? 'No design has' : `${empty.length} design(s) have no`} {mode.toUpperCase()} yet — use Edit layers to select it.</span>}
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-[#526A7B] mb-2">
            <span>Designs: <span className="text-[#204563]">{designs.length}</span></span>
            <span>Copies: <span className="text-[#204563]">{layout?.totalCopies ?? 0} / {totalCopies}</span></span>
            <span>Sheets: <span className="text-[#204563]">{sheets.length}</span></span>
            <span>Rotated 90°: <span className="text-[#204563]">{rotatedCount}</span></span>
            <span>Sheet: <span className="text-[#204563] font-mono">11 × 17 in</span></span>
          </div>
          {sheets.length > 1 && (
            <div className="flex gap-1.5 mb-2 overflow-x-auto">
              {sheets.map((s, i) => (
                <button key={i} type="button" onClick={() => { setSheetIdx(i); setInspect(null); }} className={`flex-shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold border ${sheetIdx === i ? 'bg-[#204563] text-white border-[#204563]' : 'border-[#E5D9C8] text-[#204563]'}`}>Sheet {i + 1} ({s.placements.length})</button>
              ))}
            </div>
          )}
          {designs.length > 0 && (
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#526A7B]">How it will print</span>
              <button type="button" onClick={() => setViewerOpen(true)} className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold text-[#204563] bg-white border border-[#E5D9C8] shadow-2xs hover:bg-[#FAF7F1] hover:text-[#EF7F1A] transition-all">
                <ExternalLink className="w-3.5 h-3.5 text-[#EF7F1A]" />
                <span>Tap a file to see it big</span>
              </button>
              <button type="button" onClick={() => setViewerOpen(true)} className="p-1.5 rounded-lg text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1]" title="Full-screen preview" aria-label="Full-screen preview">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <div ref={sheetWrap} className="flex-1 min-h-[360px] flex items-start justify-center">
            {designs.length === 0 ? (
              <div className="text-center text-[#526A7B] text-xs font-semibold mt-16">Upload PNG designs to build the 11 × 17 sheet.</div>
            ) : (
              <canvas ref={sheetCanvas} onClick={onSheetClick} style={{ width: sheetBox.w, height: sheetBox.h }} className="rounded-lg shadow-md border border-[#E5D9C8] cursor-pointer" />
            )}
          </div>
          {inspected && (() => {
            const d = designs.find((x) => x.id === inspected.assetId);
            if (!d) return null;
            return (
              <div className="mt-2 p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-black text-[#204563] truncate max-w-[180px]">{d.filename}</span>
                <span className="text-[#526A7B]">copy {inspected.copyIndex + 1} • {(inspected.widthMm / IN).toFixed(2)} × {(inspected.heightMm / IN).toFixed(2)} in at ({(inspected.xMm / IN).toFixed(2)}, {(inspected.yMm / IN).toFixed(2)}) in{inspected.rotated ? ' • rotated 90°' : ''}</span>
                <button type="button" onClick={() => setEditingId(d.id)} className="ml-auto h-8 px-3 rounded-lg bg-[#204563] text-white font-bold flex items-center gap-1"><Pencil className="w-3.5 h-3.5" />Edit layers</button>
                <button type="button" onClick={() => setInspect(null)} className="w-8 h-8 rounded-lg border border-[#E5D9C8] flex items-center justify-center" aria-label="Close"><X className="w-3.5 h-3.5" /></button>
              </div>
            );
          })()}
          {layout && layout.totalCopies < totalCopies && (
            <p className="mt-2 text-[11px] font-bold text-red-600 flex gap-1"><AlertTriangle className="w-3.5 h-3.5" />{totalCopies - layout.totalCopies} copies do not fit — reduce their size.</p>
          )}
        </section>

        {/* Settings & export */}
        <section className="space-y-3 min-w-0">
          <div className="bg-white rounded-2xl border border-[#E5D9C8] p-3 space-y-2.5">
            <h3 className="text-xs font-black text-[#204563] uppercase tracking-wider">Sheet</h3>
            <div className="flex items-center justify-between text-xs"><span className="font-bold text-[#526A7B]">Size</span><span className="font-mono font-black text-[#204563] flex items-center gap-1"><Lock className="w-3 h-3 text-[#EF7F1A]" />11 × 17 in</span></div>
            <label className="flex items-center justify-between text-xs font-bold text-[#526A7B]">Spacing (mm)
              <input type="number" min={0} max={50} step={0.5} value={spacingMm} onChange={(e) => setSpacingMm(Math.max(0, Math.min(50, +e.target.value || 0)))} className="w-20 h-9 px-2 rounded-lg border border-[#E5D9C8] font-mono text-[#204563]" />
            </label>
            <label className="flex items-center justify-between text-xs font-bold text-[#526A7B]">Margin (mm)
              <input type="number" min={0} max={30} step={0.5} value={marginMm} onChange={(e) => setMarginMm(Math.max(0, Math.min(30, +e.target.value || 0)))} className="w-20 h-9 px-2 rounded-lg border border-[#E5D9C8] font-mono text-[#204563]" />
            </label>
            <button type="button" role="switch" aria-checked={rotation} onClick={() => setRotation((r) => !r)} className="w-full h-10 px-3 rounded-xl border border-[#E5D9C8] flex items-center justify-between text-xs font-bold text-[#204563]">
              <span className="flex items-center gap-1.5"><RotateCw className="w-4 h-4" />90° rotation (when it helps)</span>
              <span className={`w-9 h-5 rounded-full p-0.5 flex ${rotation ? 'bg-[#EF7F1A] justify-end' : 'bg-slate-300 justify-start'}`}><span className="w-4 h-4 rounded-full bg-white" /></span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5D9C8] p-3 space-y-2.5">
            <h3 className="text-xs font-black text-[#204563] uppercase tracking-wider">TIFF export</h3>
            <label className="block text-xs font-bold text-[#526A7B]">Resolution
              <select value={dpi} onChange={(e) => { setDpi(+e.target.value); clearResult(); }} className="mt-1 w-full h-10 px-2 rounded-xl border border-[#E5D9C8] text-[#204563] font-bold">
                {DPI_OPTIONS.map((v) => <option key={v} value={v}>{v} DPI — {Math.round(11 * v)} × {Math.round(17 * v)} px</option>)}
              </select>
            </label>
            <div className="space-y-1.5">
              {([['single', 'One TIFF: CMY + W1 + W2 spot channels'], ['separate', 'Separate TIFFs: CMY + W1 mask + W2 mask']] as const).map(([id, label]) => (
                <label key={id} className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer ${format === id ? 'border-[#EF7F1A] bg-[#FCE8D5]/40' : 'border-[#E5D9C8]'}`}>
                  <input type="radio" name="hd3d-format" checked={format === id} onChange={() => { setFormat(id); clearResult(); }} className="mt-0.5 accent-[#EF7F1A]" />
                  <span className="text-[11px] font-bold text-[#204563]">{label}</span>
                </label>
              ))}
            </div>
            <label className="flex items-start gap-2 text-[11px] font-semibold text-[#204563]">
              <input type="checkbox" checked={invertSpots} onChange={(e) => { setInvertSpots(e.target.checked); clearResult(); }} className="mt-0.5 accent-[#EF7F1A]" />
              <span>Inverted spot channel data (0 = 100 % ink) <span className="text-[#526A7B] font-medium">— single TIFF only, if your RIP expects it</span></span>
            </label>
            {format === 'separate' && <p className="text-[10px] text-[#526A7B]">W1 / W2 mask files are positive separations: black = 100 % ink, white = no ink.</p>}
            <p className="text-[10px] text-[#526A7B] flex gap-1"><Info className="w-3 h-3 flex-shrink-0 mt-0.5" />RGB colour (your RIP converts to its CMY profile), transparency kept, W1/W2 strictly 0 % or 100 %. {dpi >= 600 && 'High DPI needs a lot of memory.'} Sheet: {pxW} × {pxH} px.</p>
            {exporting ? (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-[#F3EBDD] overflow-hidden"><div className="h-full bg-[#EF7F1A] transition-all" style={{ width: `${Math.round(exporting.fraction * 100)}%` }} /></div>
                <div className="flex items-center gap-2 text-[11px] text-[#204563] font-semibold"><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="flex-1 truncate">{exporting.label}</span>
                  <button type="button" onClick={cancelExport} className="h-8 px-3 rounded-lg border border-red-200 text-red-600 font-bold">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={startExport} disabled={!layout || !sheets.length || designs.some((d) => !fitsSheet(d))} className="w-full h-11 rounded-xl bg-[#EF7F1A] text-[#204563] text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-[#EF7F1A]/25 disabled:opacity-50">
                <FileDown className="w-4 h-4" />Generate 3D HD TIFF{sheets.length > 1 ? ` (${sheets.length} sheets)` : ''}
              </button>
            )}
            {result && (
              <div className="space-y-2 pt-1">
                {result.files.map((f, i) => {
                  const v = result.verification[i];
                  return (
                    <div key={f.name} className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-[11px] font-black text-[#204563] truncate flex-1" title={f.name}>{f.name}</span>
                        <button type="button" onClick={() => download(f)} className="h-8 px-2.5 rounded-lg bg-[#204563] text-white text-[11px] font-bold flex items-center gap-1"><Download className="w-3.5 h-3.5" />{formatBytes(f.blob.size)}</button>
                      </div>
                      {v?.checkedPixels && (
                        <div className="text-[10px] text-[#526A7B] font-mono">
                          Re-imported: {v.width} × {v.height} px @ {Math.round(v.dpi)} DPI = {(v.width / v.dpi).toFixed(2)} × {(v.height / v.dpi).toFixed(2)} in • {v.samplesPerPixel} ch{v.channelNames.length ? ` • ${v.channelNames.map((n, j) => `${n}${v.spotKinds[j] === 2 ? ' (spot)' : ''}`).join(', ')}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
                {result.stats.map((s, i) => (
                  <div key={i} className="text-[10px] text-[#526A7B]">Sheet {i + 1}: W1 {(s.w1Pixels / (s.widthPx * s.heightPx) * 100).toFixed(1)}% • W2 {(s.w2Pixels / (s.widthPx * s.heightPx) * 100).toFixed(1)}% of the sheet</div>
                ))}
                {result.designs.map((c) => {
                  const d = designs.find((x) => x.id === c.id);
                  return (
                    <div key={c.id} className="text-[10px] text-[#526A7B]">
                      {d?.filename ?? 'Design'}: W1 {fmtPct(c.w1Pct)} • W2 {fmtPct(c.w2Pct)} of the artwork{c.identical ? ' • W1 and W2 identical' : ''}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E5D9C8] p-3 space-y-2">
            <button type="button" onClick={() => setLibOpen((o) => !o)} className="w-full flex items-center justify-between text-xs font-black text-[#204563] uppercase tracking-wider">
              Texture library ({textures.length}) <span className="text-[10px] normal-case font-bold text-[#EF7F1A]">{libOpen ? 'Hide' : 'Show'}</span>
            </button>
            {libOpen && (
              <>
                <div className="grid grid-cols-4 gap-1.5">
                  {textures.map((t) => (
                    <div key={t.id} className="relative">
                      <img src={texThumbs[t.id]} alt={t.name} title={`${t.name} — ${t.category}${t.builtIn ? ' (built-in)' : ''}`} className="w-full aspect-square rounded-lg border border-[#E5D9C8]" />
                      <span className="block text-[9px] font-bold text-[#204563] truncate">{t.name}</span>
                      {isAdmin && !t.builtIn && (
                        <button type="button" onClick={() => removeTexture(t)} className="absolute top-0.5 right-0.5 w-6 h-6 rounded-md bg-white/90 text-red-600 flex items-center justify-center" aria-label={`Delete ${t.name}`}><Trash className="w-3 h-3" /></button>
                      )}
                    </div>
                  ))}
                </div>
                {isAdmin ? (
                  <div className="space-y-1.5 pt-1 border-t border-[#E5D9C8]">
                    <div className="text-[10px] font-bold uppercase text-[#526A7B]">Add texture (administrator)</div>
                    <input value={texName} onChange={(e) => setTexName(e.target.value)} placeholder="Name" className="w-full h-9 px-2 rounded-lg border border-[#E5D9C8] text-xs" />
                    <input value={texCat} onChange={(e) => setTexCat(e.target.value)} placeholder="Category" className="w-full h-9 px-2 rounded-lg border border-[#E5D9C8] text-xs" />
                    <input ref={texFile} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTexture(f); e.target.value = ''; }} />
                    <button type="button" onClick={() => texFile.current?.click()} className="w-full h-9 rounded-lg border border-[#204563] text-[#204563] text-[11px] font-bold flex items-center justify-center gap-1"><UploadCloud className="w-3.5 h-3.5" />Upload texture image</button>
                    <p className="text-[10px] text-[#526A7B]">Light areas become raised. Stored in this browser for every user on this device.</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-[#526A7B]">Textures are managed by administrators.</p>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {viewerOpen && sheets.length > 0 && (
        <Hd3dSheetViewer
          sheets={sheets}
          designs={designs}
          marginMm={marginMm}
          initialSheet={sheetIdx}
          initialMode={mode}
          initialMaskOnly={maskOnly}
          getImage={(d, m, px, mo) => thumbFor(d, m, px, mo)}
          onClose={() => setViewerOpen(false)}
          onEditDesign={(id) => { setViewerOpen(false); setEditingId(id); }}
        />
      )}

      {editing && (
        <Hd3dEditor
          design={editing}
          textures={textures}
          onCancel={() => setEditingId(null)}
          onSave={(layers) => {
            update(editing.id, { layers, revision: editing.revision + 1 });
            setEditingId(null);
            clearResult();
            onNotification('Layers saved — W1, CMY and W2 stay aligned on every copy', 'success');
          }}
        />
      )}
    </div>
  );
};
