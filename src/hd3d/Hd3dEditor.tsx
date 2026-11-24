/**
 * 3D HD layer editor: paint / select the W1 (raised white) and W2 (gloss) layers,
 * apply clipped textures, and preview Original / W1 / CMY / W2 / Combined.
 * All layers live on the artwork's own pixel grid, so they cannot drift apart.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush, Eraser, Wand2, Pipette, Hand, ZoomIn, ZoomOut, Maximize, Undo2, Redo2, RotateCcw,
  Eye, EyeOff, Check, Plus, Shapes, SquareDashedMousePointer, Minus, Trash2, Sparkles, Layers, Expand, Shrink, Contrast, Loader2, Info
} from 'lucide-react';
import type { HdDesign, HdLayerState, HdPreviewMode, HdTexture, Mask, TextureApplication, TextureTarget } from './types';
import {
  bakeCmy, combineInto, countOn, finalMasks, generateW1Mask, generateW2Mask, growShrink, invertWithin, layerCoverage, paintStroke,
  removeSpecks, selectArtwork, selectColor, selectObject, selectRect, selectShape, smoothMask, suggestRegion, TileLookup
} from './maskOps';
import { renderView, W1_PREVIEW, W2_PREVIEW } from './render';
import { textureThumbnail } from './textureStore';
import { newId } from './hdImage';

type EditLayer = 'w1' | 'w2' | 'region';
type Tool = 'brush' | 'eraser' | 'object' | 'color' | 'shape' | 'box' | 'pan';

interface Snapshot { w1: Mask; w2: Mask; region: Mask; textures: TextureApplication[]; w2ExcludesW1: boolean }

interface Props {
  design: HdDesign;
  textures: HdTexture[];
  onCancel: () => void;
  onSave: (layers: HdLayerState) => void;
}

const LAYER_META: Record<EditLayer, { label: string; sub: string; rgb: [number, number, number] }> = {
  w1: { label: 'W1 White Base', sub: 'Raised 3D white ink', rgb: W1_PREVIEW },
  w2: { label: 'W2 Gloss Varnish', sub: 'Glossy finish', rgb: W2_PREVIEW },
  region: { label: 'Texture Region', sub: 'Where a texture is clipped', rgb: [0, 200, 90] }
};

const MODES: { id: HdPreviewMode; label: string }[] = [
  { id: 'combined', label: '3D HD Result' },
  { id: 'cmy', label: 'Original / CMYK' },
  { id: 'w1', label: 'W1 (White Base / Raised)' },
  { id: 'w2', label: 'W2 (Varnish / Glossy)' }
];

const TARGETS: { id: TextureTarget; label: string; hint: string }[] = [
  { id: 'w1', label: 'W1 raised', hint: 'Pattern becomes raised white ink' },
  { id: 'w2', label: 'W2 gloss', hint: 'Pattern becomes gloss varnish' },
  { id: 'cmy', label: 'CMY detail', hint: 'Pattern shades the colours' }
];

const copy = (m: Mask) => new Uint8Array(m);

export const Hd3dEditor: React.FC<Props> = ({ design, textures, onCancel, onSave }) => {
  const W = design.width, H = design.height, N = W * H;
  const artwork = useMemo(() => selectArtwork(design.rgba, W, H, 1), [design.rgba, W, H]);
  const lookup: TileLookup = useCallback((id) => {
    const t = textures.find((x) => x.id === id);
    return t ? { tile: t.tile, size: t.size } : undefined;
  }, [textures]);

  // --- Editable state (masks are mutated in place while painting, then snapshotted).
  const w1Ref = useRef<Mask>(copy(design.layers.w1));
  const w2Ref = useRef<Mask>(copy(design.layers.w2));
  const regionRef = useRef<Mask>(new Uint8Array(N));
  const [appliedTextures, setAppliedTextures] = useState<TextureApplication[]>(design.layers.textures);
  const [w2ExcludesW1, setW2ExcludesW1] = useState(design.layers.w2ExcludesW1);
  const [rev, setRev] = useState(0); // bumps on every mask edit
  const bump = () => setRev((r) => r + 1);

  // --- History.
  const maxDepth = Math.max(3, Math.min(30, Math.floor(600e6 / (3 * N))));
  const history = useRef<Snapshot[]>([]);
  const [histIndex, setHistIndex] = useState(0);
  const snapshot = useCallback((texts: TextureApplication[], excl: boolean): Snapshot => ({
    w1: copy(w1Ref.current), w2: copy(w2Ref.current), region: copy(regionRef.current), textures: texts, w2ExcludesW1: excl
  }), []);
  useEffect(() => {
    history.current = [snapshot(design.layers.textures, design.layers.w2ExcludesW1)];
    setHistIndex(0);
  }, [design, snapshot]);
  const commit = useCallback((texts = appliedTextures, excl = w2ExcludesW1) => {
    const h = history.current.slice(0, histIndex + 1);
    h.push(snapshot(texts, excl));
    while (h.length > maxDepth) h.shift();
    history.current = h;
    setHistIndex(h.length - 1);
    setRegionCount(countOn(regionRef.current));
    bump();
  }, [appliedTextures, w2ExcludesW1, histIndex, maxDepth, snapshot]);
  const restore = (i: number) => {
    const s = history.current[i];
    if (!s) return;
    w1Ref.current = copy(s.w1); w2Ref.current = copy(s.w2); regionRef.current = copy(s.region);
    setAppliedTextures(s.textures); setW2ExcludesW1(s.w2ExcludesW1);
    setRegionCount(countOn(regionRef.current));
    setHistIndex(i); bump();
  };

  // --- Final print masks (what will be exported), recomputed after edits.
  const [finals, setFinals] = useState(() => {
    const fm = finalMasks(design.rgba, W, H, design.layers, lookup, artwork);
    return { ...fm, cmy: design.rgba };
  });
  const [computing, setComputing] = useState(false);
  useEffect(() => {
    setComputing(true);
    const t = setTimeout(() => {
      const layers: HdLayerState = { w1: w1Ref.current, w2: w2Ref.current, w2ExcludesW1, textures: appliedTextures };
      const fm = finalMasks(design.rgba, W, H, layers, lookup, artwork);
      setFinals({ ...fm, cmy: design.rgba });
      setComputing(false);
    }, 90);
    return () => clearTimeout(t);
  }, [rev, appliedTextures, w2ExcludesW1, design.rgba, W, H, lookup]);
  // Same calculation as the design cards and the export check.
  const coverage = useMemo(() => {
    const c = layerCoverage(design.rgba, W, H, finals);
    return { w1: c.w1Pct, w2: c.w2Pct, identical: c.identical };
  }, [finals, design.rgba, W, H]);

  // --- Tools & view state.
  const [tool, setTool] = useState<Tool>('object');
  const [layer, setLayer] = useState<EditLayer>('w1');
  const [mode, setMode] = useState<HdPreviewMode>('cmy');
  const [show, setShow] = useState({ w1: true, cmy: true, w2: true });
  const [showOverlay, setShowOverlay] = useState(true);
  const [maskOnly, setMaskOnly] = useState(false);
  const [brush, setBrush] = useState(() => Math.max(4, Math.round(Math.max(W, H) / 80)));
  const [tolerance, setTolerance] = useState(32);
  const [selMode, setSelMode] = useState<'add' | 'subtract'>('add');
  const [edgePx, setEdgePx] = useState(2);
  const [speckPx, setSpeckPx] = useState(40);
  /** Box selection being dragged (artwork coordinates). */
  const boxRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [regionCount, setRegionCount] = useState(0);
  /** Heavy operations on large artwork: show "working" first, then run (the UI never looks frozen without feedback). */
  const runHeavy = (label: string, fn: () => void) => {
    if (busy) return;
    setBusy(label);
    setTimeout(() => {
      try { fn(); } finally { setBusy(null); }
    }, 30);
  };

  // --- Texture panel.
  const [texId, setTexId] = useState<string>(textures[0]?.id ?? '');
  const [texTarget, setTexTarget] = useState<TextureTarget>('w1');
  const [texScale, setTexScale] = useState(1);
  const [texIntensity, setTexIntensity] = useState(0.5);
  const [texOffX, setTexOffX] = useState(0);
  const [texOffY, setTexOffY] = useState(0);
  const [editingTexId, setEditingTexId] = useState<string | null>(null);
  const thumbs = useMemo(() => Object.fromEntries(textures.map((t) => [t.id, textureThumbnail(t, 72)])), [textures]);

  // --- Viewport.
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ zoom: 1, panX: 0, panY: 0, w: 0, h: 0, dpr: 1 });
  const [zoomLabel, setZoomLabel] = useState(100);
  const frame = useRef(0);

  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const c = canvasRef.current;
      if (!c || !view.current.w) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const v = view.current;
      const img = ctx.createImageData(c.width, c.height);
      const active = layer === 'w1' ? w1Ref.current : layer === 'w2' ? w2Ref.current : regionRef.current;
      const overlayOn = showOverlay && mode !== 'w1' && mode !== 'w2' && mode !== 'cmy' && mode !== 'original';
      renderView(
        { width: W, height: H, original: design.rgba, cmy: design.rgba, w1: finals.w1, w2: finals.w2 },
        {
          mode, zoom: v.zoom * v.dpr, panX: v.panX * v.dpr, panY: v.panY * v.dpr, show, maskOnly,
          overlay: overlayOn && layer !== 'region' ? { mask: active, rgb: LAYER_META[layer].rgb, opacity: 0.55 } : null,
          overlay2: overlayOn && (layer === 'region' || regionCount > 0)
            ? { mask: regionRef.current, rgb: LAYER_META.region.rgb, opacity: layer === 'region' ? 0.5 : 0.22 } : null
        },
        img.data, c.width, c.height
      );
      ctx.putImageData(img, 0, 0);
      const bx = boxRef.current;
      if (bx) {
        const z = v.zoom * v.dpr, ox = v.panX * v.dpr, oy = v.panY * v.dpr;
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5 * v.dpr;
        ctx.strokeStyle = '#EF7F1A';
        ctx.strokeRect(ox + Math.min(bx.x0, bx.x1) * z, oy + Math.min(bx.y0, bx.y1) * z, Math.abs(bx.x1 - bx.x0) * z, Math.abs(bx.y1 - bx.y0) * z);
        ctx.restore();
      }
    });
  }, [W, H, design.rgba, finals, mode, show, showOverlay, layer, regionCount, maskOnly]);

  const fit = useCallback(() => {
    const v = view.current;
    if (!v.w) return;
    const z = Math.min(v.w / W, v.h / H) * 0.92;
    v.zoom = z; v.panX = (v.w - W * z) / 2; v.panY = (v.h - H * z) / 2;
    setZoomLabel(Math.round(z * 100));
    draw();
  }, [W, H, draw]);

  useEffect(() => {
    const el = wrapRef.current, c = canvasRef.current;
    if (!el || !c) return;
    let first = true;
    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      view.current.w = r.width; view.current.h = r.height; view.current.dpr = dpr;
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
      c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
      if (first) { first = false; fit(); } else draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener('resize', resize);
    return () => { ro.disconnect(); window.removeEventListener('resize', resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { draw(); }, [draw, rev]);

  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const v = view.current;
    const x = cx ?? v.w / 2, y = cy ?? v.h / 2;
    const nz = Math.max(0.02, Math.min(32, v.zoom * factor));
    v.panX = x - ((x - v.panX) * nz) / v.zoom;
    v.panY = y - ((y - v.panY) * nz) / v.zoom;
    v.zoom = nz;
    setZoomLabel(Math.round(nz * 100));
    draw();
  };

  // --- Pointer handling: paint, select, pan, pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: 'none' | 'paint' | 'pan' | 'pinch' | 'box'; lastX: number; lastY: number; dist: number; dirty: boolean }>({ kind: 'none', lastX: 0, lastY: 0, dist: 0, dirty: false });
  const spaceDown = useRef(false);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = true;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) restore(histIndex + 1); else restore(histIndex - 1); }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  });

  const toSource = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = view.current;
    return { x: (clientX - r.left - v.panX) / v.zoom, y: (clientY - r.top - v.panY) / v.zoom, lx: clientX - r.left, ly: clientY - r.top };
  };
  const activeMask = () => (layer === 'w1' ? w1Ref.current : layer === 'w2' ? w2Ref.current : regionRef.current);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2) {
      // Second finger: switch to pinch / pan (a paint stroke in progress is kept).
      const [a, b] = [...pointers.current.values()];
      g.kind = 'pinch'; g.dist = Math.hypot(a.x - b.x, a.y - b.y); g.lastX = (a.x + b.x) / 2; g.lastY = (a.y + b.y) / 2;
      return;
    }
    const p = toSource(e.clientX, e.clientY);
    if (tool === 'pan' || e.button === 1 || e.button === 2 || spaceDown.current) {
      g.kind = 'pan'; g.lastX = e.clientX; g.lastY = e.clientY;
      return;
    }
    if (tool === 'brush' || tool === 'eraser') {
      const value = tool === 'brush' && !e.altKey ? 255 : 0;
      paintStroke(activeMask(), W, H, p.x, p.y, p.x, p.y, brush / 2, value);
      g.kind = 'paint'; g.lastX = p.x; g.lastY = p.y; g.dirty = true;
      draw();
      return;
    }
    if (tool === 'box') {
      boxRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      g.kind = 'box';
      return;
    }
    // Wand / colour / shape selection.
    const subtract = e.altKey || selMode === 'subtract';
    runHeavy('Selecting…', () => {
      const sel = tool === 'object' ? selectObject(design.rgba, W, H, p.x, p.y, tolerance)
        : tool === 'shape' ? selectShape(design.rgba, W, H, p.x, p.y)
        : selectColor(design.rgba, W, H, p.x, p.y, tolerance);
      const n = countOn(sel);
      if (n === 0) { setMessage('Nothing selected there — click on a visible part of the artwork.'); return; }
      combineInto(activeMask(), sel, subtract ? 'subtract' : 'add');
      setMessage(`${subtract ? 'Removed' : 'Added'} ${n.toLocaleString()} px ${layer === 'region' ? 'to the texture region' : `on ${layer.toUpperCase()}`}.`);
      commit();
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const r = canvasRef.current!.getBoundingClientRect();
      view.current.panX += mx - g.lastX; view.current.panY += my - g.lastY;
      if (g.dist > 0) zoomAt(d / g.dist, mx - r.left, my - r.top); else draw();
      g.dist = d; g.lastX = mx; g.lastY = my;
      return;
    }
    if (g.kind === 'pan') {
      view.current.panX += e.clientX - g.lastX; view.current.panY += e.clientY - g.lastY;
      g.lastX = e.clientX; g.lastY = e.clientY;
      draw();
      return;
    }
    if (g.kind === 'box' && boxRef.current) {
      const p = toSource(e.clientX, e.clientY);
      boxRef.current.x1 = p.x; boxRef.current.y1 = p.y;
      draw();
      return;
    }
    if (g.kind === 'paint') {
      const p = toSource(e.clientX, e.clientY);
      paintStroke(activeMask(), W, H, g.lastX, g.lastY, p.x, p.y, brush / 2, tool === 'brush' && !e.altKey ? 255 : 0);
      g.lastX = p.x; g.lastY = p.y;
      draw();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) return;
    if (g.dirty) { g.dirty = false; commit(); }
    if (g.kind === 'box' && boxRef.current) {
      const b = boxRef.current;
      boxRef.current = null;
      const subtract = e.altKey || selMode === 'subtract';
      if (Math.abs(b.x1 - b.x0) < 1 || Math.abs(b.y1 - b.y0) < 1) { draw(); }
      else runHeavy('Selecting…', () => {
        const sel = selectRect(design.rgba, W, H, b.x0, b.y0, b.x1, b.y1);
        combineInto(activeMask(), sel, subtract ? 'subtract' : 'add');
        setMessage(`${subtract ? 'Removed' : 'Added'} ${countOn(sel).toLocaleString()} px (box) ${layer === 'region' ? 'to the texture region' : `on ${layer.toUpperCase()}`}.`);
        commit();
      });
    }
    g.kind = 'none';
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  };

  // --- Layer commands.
  const layerCmd = (cmd: 'all' | 'clear' | 'invert' | 'grow' | 'shrink' | 'fromW1' | 'fromW2' | 'w1Objects' | 'smooth' | 'specks' | 'suggestFg' | 'suggestBg' | 'autoW1' | 'autoW2') => runHeavy(cmd === 'grow' || cmd === 'shrink' ? 'Moving the boundary…' : cmd.startsWith('suggest') || cmd.startsWith('auto') ? 'Generating layer…' : 'Updating…', () => {
    const m = activeMask();
    if (cmd === 'all') combineInto(m, artwork, 'add');
    else if (cmd === 'clear') m.fill(0);
    else if (cmd === 'invert') invertWithin(m, artwork);
    else if (cmd === 'grow' || cmd === 'shrink') {
      const next = growShrink(m, W, H, cmd === 'grow' ? edgePx : -edgePx, artwork);
      m.set(next);
    } else if (cmd === 'fromW1') combineInto(m, finals.w1, 'replace');
    else if (cmd === 'fromW2') combineInto(m, finals.w2, 'replace');
    else if (cmd === 'w1Objects') combineInto(m, w1Ref.current, 'add'); // W1's selected objects, without its textures
    else if (cmd === 'smooth') m.set(smoothMask(m, W, H, edgePx)); // stays strictly 0 / 100 %
    else if (cmd === 'specks') m.set(removeSpecks(m, W, H, speckPx));
    else if (cmd === 'autoW1') {
      const gen = generateW1Mask(design.rgba, W, H, lookup);
      w1Ref.current.set(gen.mask);
      const nextTextures = gen.textureApp ? [gen.textureApp] : [];
      setAppliedTextures(nextTextures);
      setLayer('w1');
      setMode('w1');
      setMessage(`Generated W1 white/raised mask: foreground objects + fine surface relief (${countOn(gen.mask).toLocaleString()} px).`);
      commit(nextTextures);
      return;
    } else if (cmd === 'autoW2') {
      const w2 = generateW2Mask(design.rgba, W, H);
      w2Ref.current.set(w2);
      setLayer('w2');
      setMode('w2');
      setMessage(`Generated W2 gloss mask: selective foreground objects (${countOn(w2).toLocaleString()} px). Background forest unselected.`);
      commit();
      return;
    } else if (cmd === 'suggestFg' || cmd === 'suggestBg') {
      const sug = suggestRegion(design.rgba, W, H, cmd === 'suggestFg' ? 'foreground' : 'background');
      combineInto(m, sug, selMode === 'subtract' ? 'subtract' : 'add');
      setMessage(`Suggested ${cmd === 'suggestFg' ? 'foreground objects' : 'background (main colour)'}: ${countOn(sug).toLocaleString()} px — edit it with the tools if needed.`);
    }
    commit();
  });

  // --- Textures.
  const applyTexture = () => {
    const region = regionRef.current;
    if (!texId) return;
    const clip = new Uint8Array(N);
    let n = 0;
    for (let i = 0; i < N; i++) if (region[i] && artwork[i]) { clip[i] = 255; n++; }
    if (n === 0) {
      setLayer('region');
      setMessage('Select the texture region first: choose "Texture Region", then click an object or paint it (or use the quick buttons).');
      return;
    }
    const app: TextureApplication = { id: newId('texapp'), textureId: texId, target: texTarget, clip, scale: texScale, intensity: texIntensity, offsetX: texOffX, offsetY: texOffY };
    const next = [...appliedTextures, app];
    setAppliedTextures(next);
    setEditingTexId(app.id);
    setMessage(`Texture applied to ${n.toLocaleString()} px (${TARGETS.find((t) => t.id === texTarget)!.label}).`);
    region.fill(0); // the region is stored with the texture; start fresh for the next one
    commit(next);
  };
  const updateApplied = (id: string, patch: Partial<TextureApplication>, record = false) => {
    const next = appliedTextures.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setAppliedTextures(next);
    if (record) commit(next);
  };
  const selectApplied = (t: TextureApplication) => {
    setEditingTexId(t.id);
    setTexId(t.textureId); setTexTarget(t.target); setTexScale(t.scale); setTexIntensity(t.intensity); setTexOffX(t.offsetX); setTexOffY(t.offsetY);
  };
  const removeApplied = (id: string) => {
    const next = appliedTextures.filter((t) => t.id !== id);
    setAppliedTextures(next);
    if (editingTexId === id) setEditingTexId(null);
    commit(next);
  };
  // Live parameter edits on the selected applied texture.
  const setParam = <K extends keyof TextureApplication>(key: K, val: TextureApplication[K]) => {
    if (key === 'scale') setTexScale(val as number);
    if (key === 'intensity') setTexIntensity(val as number);
    if (key === 'offsetX') setTexOffX(val as number);
    if (key === 'offsetY') setTexOffY(val as number);
    if (key === 'target') setTexTarget(val as TextureTarget);
    if (key === 'textureId') setTexId(val as string);
    if (editingTexId) updateApplied(editingTexId, { [key]: val } as Partial<TextureApplication>);
  };

  const resetAll = () => {
    w1Ref.current.fill(0); w2Ref.current.fill(0); regionRef.current.fill(0);
    setAppliedTextures([]); setW2ExcludesW1(true); setEditingTexId(null);
    commit([], true);
    setMessage('All layers reset: W1 and W2 cleared, textures removed. The original artwork is unchanged.');
  };

  const save = () => {
    onSave({ w1: w1Ref.current, w2: w2Ref.current, w2ExcludesW1, textures: appliedTextures });
  };

  const tex = textures.find((t) => t.id === texId);
  const editing = appliedTextures.find((t) => t.id === editingTexId) ?? null;
  const toolBtn = (id: Tool, Icon: React.FC<{ className?: string }>, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setTool(id)}
      title={label}
      aria-label={label}
      aria-pressed={tool === id}
      className={`min-h-11 md:min-h-0 flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-colors ${
        tool === id ? 'bg-[#204563] text-white border-[#204563]' : 'bg-white text-[#204563] border-[#E5D9C8] hover:border-[#204563]/40'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-7xl h-[100dvh] md:h-[94vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 px-3 md:px-5 py-2.5 border-b border-[#E5D9C8]">
          <div className="w-9 h-9 rounded-xl bg-[#204563] flex items-center justify-center flex-shrink-0">
            <Layers className="w-4.5 h-4.5 text-[#EF7F1A]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-[15px] text-[#204563] truncate">3D HD Layer Editor</h3>
            <p className="text-[11px] text-[#526A7B] truncate">
              {design.filename} • {W} × {H} px • W1 {coverage.w1.toFixed(1)}% • W2 {coverage.w2.toFixed(1)}% of artwork
              {(computing || busy) && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => restore(histIndex - 1)} disabled={histIndex <= 0} className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#E5D9C8] text-[#526A7B] disabled:opacity-30" title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={() => restore(histIndex + 1)} disabled={histIndex >= history.current.length - 1} className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#E5D9C8] text-[#526A7B] disabled:opacity-30" title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 className="w-4 h-4" /></button>
            <button type="button" onClick={resetAll} className="h-10 px-3 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold flex items-center gap-1.5" title="Clear W1, W2 and textures"><RotateCcw className="w-3.5 h-3.5" />Reset</button>
            <button type="button" onClick={onCancel} className="h-10 px-3 rounded-xl border border-[#E5D9C8] text-[#526A7B] text-xs font-bold">Cancel</button>
            <button type="button" onClick={save} className="h-10 px-4 rounded-xl bg-[#EF7F1A] text-[#204563] text-xs font-black flex items-center gap-1.5 shadow-md shadow-[#EF7F1A]/25"><Check className="w-4 h-4" />Save Layers</button>
          </div>
        </div>

        {/* Preview modes + view controls */}
        <div className="flex items-center gap-2 px-3 md:px-5 py-2 border-b border-[#E5D9C8] bg-[#FAF7F1] overflow-x-auto no-scrollbar-mobile">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
              className={`flex-shrink-0 h-9 px-3 rounded-xl text-xs font-bold border ${mode === m.id ? 'bg-[#EF7F1A] border-[#EF7F1A] text-[#204563]' : 'bg-white border-[#E5D9C8] text-[#204563]'}`}>
              {m.label}
            </button>
          ))}
          <span className="w-px h-6 bg-[#E5D9C8] mx-1 flex-shrink-0" />
          {mode === 'combined' && (['w1', 'cmy', 'w2'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
              className="flex-shrink-0 h-9 px-2.5 rounded-xl text-[11px] font-bold border border-[#E5D9C8] bg-white text-[#204563] flex items-center gap-1">
              {show[k] ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-50" />}{k.toUpperCase()}
            </button>
          ))}
          {(mode === 'w1' || mode === 'w2') && (
            <button type="button" onClick={() => setMaskOnly((v) => !v)} aria-pressed={maskOnly} className="flex-shrink-0 h-9 px-2.5 rounded-xl text-[11px] font-bold border border-[#E5D9C8] bg-white text-[#204563] flex items-center gap-1" title="Show the mask without the artwork">
              {maskOnly ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-50" />}Mask only
            </button>
          )}
          <button type="button" onClick={() => setShowOverlay((v) => !v)} className="flex-shrink-0 h-9 px-2.5 rounded-xl text-[11px] font-bold border border-[#E5D9C8] bg-white text-[#204563] flex items-center gap-1" title="Tint the selected areas of the active layer">
            {showOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-50" />}Selection overlay
          </button>
          <span className="ml-auto flex items-center gap-1 flex-shrink-0">
            <button type="button" onClick={() => zoomAt(1 / 1.25)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#E5D9C8] bg-white" aria-label="Zoom out"><ZoomOut className="w-4 h-4 text-[#204563]" /></button>
            <span className="w-12 text-center text-[11px] font-mono font-bold text-[#204563]">{zoomLabel}%</span>
            <button type="button" onClick={() => zoomAt(1.25)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#E5D9C8] bg-white" aria-label="Zoom in"><ZoomIn className="w-4 h-4 text-[#204563]" /></button>
            <button type="button" onClick={fit} className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#E5D9C8] bg-white" aria-label="Fit to view"><Maximize className="w-4 h-4 text-[#204563]" /></button>
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Workspace */}
          <div className="relative flex-1 min-h-[200px] bg-[#d6d0c4]">
            <div ref={wrapRef} className="absolute inset-0">
              <canvas
                ref={canvasRef}
                className={`block touch-none ${tool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={onWheel}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
            <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 max-w-[calc(100%-1rem)]">
              {toolBtn('object', Wand2, 'Wand')}
              {toolBtn('color', Pipette, 'Colour')}
              {toolBtn('shape', Shapes, 'Shape')}
              {toolBtn('box', SquareDashedMousePointer, 'Box')}
              {toolBtn('brush', Brush, 'Brush')}
              {toolBtn('eraser', Eraser, 'Eraser')}
              {toolBtn('pan', Hand, 'Pan')}
            </div>
            <div className="absolute left-2 bottom-2 right-2 flex flex-wrap items-center gap-2 pointer-events-none">
              <span className="pointer-events-auto px-2.5 py-1 rounded-lg bg-white/95 border border-[#E5D9C8] text-[11px] font-bold text-[#204563] shadow-xs">
                Editing: <span className="text-[#EF7F1A]">{LAYER_META[layer].label}</span>
              </span>
              {busy && (
                <span className="pointer-events-auto px-2.5 py-1 rounded-lg bg-[#EF7F1A] text-[#204563] text-[11px] font-black shadow-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{busy}</span>
              )}
              {message && !busy && (
                <span className="pointer-events-auto px-2.5 py-1 rounded-lg bg-[#204563] text-white text-[11px] font-semibold shadow-xs max-w-full truncate">{message}</span>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-full md:w-[340px] max-h-[48dvh] md:max-h-none overflow-y-auto overscroll-contain border-t md:border-t-0 md:border-l border-[#E5D9C8] p-3 space-y-4 bg-white">
            {/* Layers */}
            <section className="space-y-1.5">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#526A7B]">Physical Print Stack (Top to Bottom)</h4>
              {(['w2', 'cmy', 'w1'] as const).map((k) => {
                const isActive = k !== 'cmy' && layer === k;
                return (
                  <div key={k} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${isActive ? 'border-[#EF7F1A] bg-[#FCE8D5]/50' : 'border-[#E5D9C8] bg-[#FAF7F1]'}`}>
                    <button type="button" onClick={() => { setMode('combined'); setShow((s) => ({ ...s, [k]: !s[k] })); }} aria-label={`Toggle ${k.toUpperCase()} visibility`} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-[#E5D9C8]">
                      {show[k] ? <Eye className="w-4 h-4 text-[#204563]" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                    </button>
                    <button type="button" className="flex-1 text-left min-w-0" onClick={() => { if (k === 'cmy') setMode('cmy'); else { setLayer(k); if (mode === 'w1' || mode === 'w2') setMode(k); } }}>
                      <div className="text-xs font-black text-[#204563]">
                        {k === 'w2' ? 'W2 – Varnish / Glossy' : k === 'cmy' ? 'CMYK – Colour' : 'W1 – White Base'}
                      </div>
                      <div className="text-[10px] text-[#526A7B] truncate">
                        {k === 'w2' ? `${coverage.w2.toFixed(1)}% • Top glossy finish on selected areas` : k === 'cmy' ? 'Original design colours' : `${coverage.w1.toFixed(1)}% • White ink and raised portions`}
                      </div>
                    </button>
                    <button type="button" onClick={() => setMode(k)} className="text-[10px] font-bold text-[#204563] px-2 py-1 rounded-lg border border-[#E5D9C8] bg-white">View</button>
                  </div>
                );
              })}
              <button type="button" onClick={() => setLayer('region')} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left ${layer === 'region' ? 'border-emerald-500 bg-emerald-50' : 'border-dashed border-[#E5D9C8]'}`}>
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-[#204563]">Texture Region <span className="font-medium text-[#526A7B]">({regionCount.toLocaleString()} px)</span></span>
              </button>
              <label className="flex items-start gap-2 text-[11px] text-[#204563] font-semibold pt-1">
                <input type="checkbox" checked={w2ExcludesW1} onChange={(e) => { setW2ExcludesW1(e.target.checked); commit(appliedTextures, e.target.checked); }} className="mt-0.5 accent-[#EF7F1A]" />
                <span>Prevent overlap: remove W1 areas from W2 <span className="text-[#526A7B] font-medium">— off by default; W1 and W2 are independent and may overlap</span></span>
              </label>
              {coverage.identical && (
                <p className="text-[10px] font-bold text-amber-700">W1 and W2 currently cover exactly the same pixels.</p>
              )}
            </section>

            {/* Tool options */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#526A7B]">Selection on {LAYER_META[layer].label}</h4>
              {(tool === 'object' || tool === 'color') && (
                <>
                  <div className="flex gap-1.5">
                    {(['add', 'subtract'] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setSelMode(m)} className={`flex-1 h-9 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${selMode === m ? 'bg-[#204563] text-white border-[#204563]' : 'bg-white text-[#204563] border-[#E5D9C8]'}`}>
                        {m === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}{m === 'add' ? 'Add' : 'Remove'}
                      </button>
                    ))}
                  </div>
                  <label className="block text-[11px] font-bold text-[#204563]">Colour tolerance: {tolerance}
                    <input type="range" min={0} max={120} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} className="w-full accent-[#EF7F1A]" />
                  </label>
                  <p className="text-[10px] text-[#526A7B]">{tool === 'object' ? 'Magic wand: click an area — its connected pixels of similar colour are selected.' : 'Click a colour: every area of that colour is selected.'} Hold Alt to remove.</p>
                </>
              )}
              {(tool === 'shape' || tool === 'box') && (
                <>
                  <div className="flex gap-1.5">
                    {(['add', 'subtract'] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setSelMode(m)} className={`flex-1 h-9 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${selMode === m ? 'bg-[#204563] text-white border-[#204563]' : 'bg-white text-[#204563] border-[#E5D9C8]'}`}>
                        {m === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}{m === 'add' ? 'Add' : 'Remove'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#526A7B]">{tool === 'shape' ? 'Click a shape: the whole connected visible object is selected, whatever its colours.' : 'Drag a box: the visible artwork inside it is selected.'} Hold Alt to remove.</p>
                </>
              )}
              {(tool === 'brush' || tool === 'eraser') && (
                <label className="block text-[11px] font-bold text-[#204563]">Brush size: {brush} px
                  <input type="range" min={1} max={Math.max(50, Math.round(Math.max(W, H) / 6))} value={brush} onChange={(e) => setBrush(+e.target.value)} className="w-full accent-[#EF7F1A]" />
                </label>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => layerCmd('all')} className="h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563]">Whole art</button>
                <button type="button" onClick={() => layerCmd('invert')} className="h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563] flex items-center justify-center gap-1"><Contrast className="w-3.5 h-3.5" />Invert</button>
                <button type="button" onClick={() => layerCmd('clear')} className="h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-red-600 flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" />Clear</button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#204563] whitespace-nowrap">Boundary</span>
                <input type="number" min={1} max={200} value={edgePx} onChange={(e) => setEdgePx(Math.max(1, Math.min(200, +e.target.value || 1)))} className="w-14 h-9 px-2 rounded-xl border border-[#E5D9C8] text-xs font-mono" aria-label="Boundary adjustment in pixels" />
                <span className="text-[11px] text-[#526A7B]">px</span>
                <button type="button" onClick={() => layerCmd('grow')} className="flex-1 h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563] flex items-center justify-center gap-1"><Expand className="w-3.5 h-3.5" />Grow</button>
                <button type="button" onClick={() => layerCmd('shrink')} className="flex-1 h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563] flex items-center justify-center gap-1"><Shrink className="w-3.5 h-3.5" />Shrink</button>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => layerCmd('smooth')} className="flex-1 h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563]" title="Smooths jagged edges and fills pin-holes (radius = Boundary px). The mask stays 0 % / 100 %.">Smooth edges</button>
                <button type="button" onClick={() => layerCmd('specks')} className="flex-1 h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563]" title="Removes isolated selected islands smaller than the given number of pixels">Remove specks &lt;</button>
                <input type="number" min={1} max={100000} value={speckPx} onChange={(e) => setSpeckPx(Math.max(1, Math.min(100000, +e.target.value || 1)))} className="w-16 h-9 px-2 rounded-xl border border-[#E5D9C8] text-xs font-mono" aria-label="Smallest island to keep, in pixels" />
              </div>
              <div className="rounded-xl border border-dashed border-[#EF7F1A]/60 p-2 space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[#526A7B]">Independent Layer Generation</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => layerCmd('autoW1')} className="h-9 rounded-xl bg-[#204563] text-white text-[11px] font-bold" title="Generate W1 white/raised mask with foreground objects + background foliage texture">Auto-Generate W1</button>
                  <button type="button" onClick={() => layerCmd('autoW2')} className="h-9 rounded-xl bg-[#EF7F1A] text-[#204563] text-[11px] font-black" title="Generate W2 gloss mask with selective foreground coverage (background forest unselected)">Auto-Generate W2</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button type="button" onClick={() => layerCmd('suggestFg')} className="h-8 rounded-xl border border-[#E5D9C8] text-[10px] font-bold text-[#204563]" title="Foreground objects only">Foreground objects</button>
                  <button type="button" onClick={() => layerCmd('suggestBg')} className="h-8 rounded-xl border border-[#E5D9C8] text-[10px] font-bold text-[#204563]" title="Background relief area">Background region</button>
                </div>
                <p className="text-[10px] text-[#526A7B]">W1 and W2 are independently generated and edited. Manual brush, wand, region, and texture tools apply to active layer.</p>
              </div>
              {layer === 'w2' && !w2ExcludesW1 && (
                <button type="button" onClick={() => layerCmd('w1Objects')} className="w-full h-9 rounded-xl border border-[#E5D9C8] text-[11px] font-bold text-[#204563]" title="Adds the objects selected on W1 (not W1 textures) to W2. You can then add or remove areas.">
                  Add W1 objects to W2 (without textures)
                </button>
              )}
              {layer === 'region' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => layerCmd('fromW1')} className="h-9 rounded-xl border border-emerald-300 text-[11px] font-bold text-emerald-700">Region = W1</button>
                  <button type="button" onClick={() => layerCmd('fromW2')} className="h-9 rounded-xl border border-emerald-300 text-[11px] font-bold text-emerald-700">Region = W2</button>
                </div>
              )}
            </section>

            {/* Textures */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#526A7B] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#EF7F1A]" />Texture library</h4>
              <div className="grid grid-cols-4 gap-1.5">
                {textures.map((t) => (
                  <button key={t.id} type="button" onClick={() => setParam('textureId', t.id)} title={`${t.name} (${t.category})`}
                    className={`rounded-lg overflow-hidden border-2 ${texId === t.id ? 'border-[#EF7F1A]' : 'border-transparent'}`}>
                    <img src={thumbs[t.id]} alt={t.name} className="w-full aspect-square object-cover" />
                    <span className="block text-[9px] font-bold text-[#204563] truncate px-0.5">{t.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {TARGETS.map((t) => (
                  <button key={t.id} type="button" onClick={() => setParam('target', t.id)} title={t.hint}
                    className={`flex-1 h-9 rounded-xl text-[11px] font-bold border ${texTarget === t.id ? 'bg-[#204563] text-white border-[#204563]' : 'bg-white text-[#204563] border-[#E5D9C8]'}`}>{t.label}</button>
                ))}
              </div>
              <label className="block text-[11px] font-bold text-[#204563]">Scale: {texScale.toFixed(2)}×
                <input type="range" min={0.1} max={8} step={0.05} value={texScale} onChange={(e) => setParam('scale', +e.target.value)} onPointerUp={() => editing && commit()} className="w-full accent-[#EF7F1A]" />
              </label>
              <label className="block text-[11px] font-bold text-[#204563]">Intensity: {Math.round(texIntensity * 100)}%
                <input type="range" min={0.05} max={1} step={0.01} value={texIntensity} onChange={(e) => setParam('intensity', +e.target.value)} onPointerUp={() => editing && commit()} className="w-full accent-[#EF7F1A]" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-bold text-[#204563]">Offset X: {texOffX}
                  <input type="range" min={0} max={Math.round((tex?.size ?? 256) * texScale)} value={texOffX} onChange={(e) => setParam('offsetX', +e.target.value)} onPointerUp={() => editing && commit()} className="w-full accent-[#EF7F1A]" />
                </label>
                <label className="block text-[11px] font-bold text-[#204563]">Offset Y: {texOffY}
                  <input type="range" min={0} max={Math.round((tex?.size ?? 256) * texScale)} value={texOffY} onChange={(e) => setParam('offsetY', +e.target.value)} onPointerUp={() => editing && commit()} className="w-full accent-[#EF7F1A]" />
                </label>
              </div>
              <button type="button" onClick={applyTexture} className="w-full h-11 rounded-xl bg-[#204563] text-white text-xs font-black flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" />Apply texture to region ({regionCount > 0 ? `${regionCount.toLocaleString()} px` : 'select a region'})
              </button>
              {appliedTextures.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#526A7B]">Applied ({appliedTextures.length}) — click to edit</div>
                  {appliedTextures.map((t) => {
                    const tx = textures.find((x) => x.id === t.textureId);
                    return (
                      <div key={t.id} className={`flex items-center gap-2 p-1.5 rounded-xl border ${editingTexId === t.id ? 'border-[#EF7F1A] bg-[#FCE8D5]/40' : 'border-[#E5D9C8]'}`}>
                        <button type="button" onClick={() => selectApplied(t)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          {tx && <img src={thumbs[tx.id]} alt="" className="w-8 h-8 rounded-md" />}
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold text-[#204563] truncate">{tx?.name ?? 'Missing texture'}</span>
                            <span className="block text-[10px] text-[#526A7B]">{TARGETS.find((x) => x.id === t.target)?.label} • {t.scale.toFixed(2)}× • {Math.round(t.intensity * 100)}%</span>
                          </span>
                        </button>
                        <button type="button" onClick={() => removeApplied(t.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50" aria-label="Remove texture"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                  {editing && <button type="button" onClick={() => setEditingTexId(null)} className="text-[10px] font-bold text-[#526A7B] underline">Done editing — new settings apply to the next texture</button>}
                </div>
              )}
              <p className="text-[10px] text-[#526A7B] flex gap-1"><Info className="w-3 h-3 flex-shrink-0 mt-0.5" />Textures stay inside their region and the artwork. W1/W2 textures become 100 % ink in the pattern; the 3D shading you see is only the preview.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
