/**
 * Full-screen 3D HD sheet preview ("Tap a file to see it big"):
 * zoom − / % / +, Fit, 100 % (actual print size), background swatches,
 * bounding boxes, layer views (3D result / Original / W1 / CMY / W2) and
 * click-to-inspect. Display only — print data is never changed here.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Pencil, RotateCw } from 'lucide-react';
import type { SheetInfo } from '../types';
import type { HdDesign, HdPreviewMode } from './types';
import { HD3D_SHEET_LENGTH_IN, HD3D_SHEET_WIDTH_IN } from './types';

const IN = 25.4;
/** CSS pixels per inch: 100 % shows the sheet at its actual printed size. */
const CSS_PX_PER_IN = 96;
const ZOOM_MIN = 5, ZOOM_MAX = 400;
const MODES: { id: HdPreviewMode; label: string }[] = [
  { id: 'combined', label: '3D HD Result' },
  { id: 'cmy', label: 'Original / CMYK' },
  { id: 'w1', label: 'W1 (White Base / Raised)' },
  { id: 'w2', label: 'W2 (Varnish / Glossy)' }
];
type Bg = 'checker' | 'gray' | 'black';

interface Props {
  sheets: SheetInfo[];
  designs: HdDesign[];
  marginMm: number;
  initialSheet: number;
  initialMode: HdPreviewMode;
  initialMaskOnly: boolean;
  /** Rendered preview of a design for a view, at about `px` pixels on its long side (cached by the caller). */
  getImage: (d: HdDesign, mode: HdPreviewMode, px: number, maskOnly: boolean) => HTMLCanvasElement | null;
  onClose: () => void;
  onEditDesign: (designId: string) => void;
}

export const Hd3dSheetViewer: React.FC<Props> = ({
  sheets, designs, marginMm, initialSheet, initialMode, initialMaskOnly, getImage, onClose, onEditDesign
}) => {
  const [sheetIdx, setSheetIdx] = useState(Math.min(initialSheet, Math.max(0, sheets.length - 1)));
  const [zoom, setZoom] = useState(50);
  const [fit, setFit] = useState(true);
  const [bg, setBg] = useState<Bg>('checker');
  const [showBox, setShowBox] = useState(true);
  const [mode, setMode] = useState<HdPreviewMode>(initialMode);
  const [maskOnly, setMaskOnly] = useState(initialMaskOnly);
  const [picked, setPicked] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sheetWcss = (z: number) => HD3D_SHEET_WIDTH_IN * CSS_PX_PER_IN * (z / 100);
  const sheetHcss = (z: number) => HD3D_SHEET_LENGTH_IN * CSS_PX_PER_IN * (z / 100);

  const fitZoom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return 50;
    const padX = 120, padY = 90; // room for the dimension labels
    const z = Math.min((el.clientWidth - padX) / (HD3D_SHEET_WIDTH_IN * CSS_PX_PER_IN), (el.clientHeight - padY) / (HD3D_SHEET_LENGTH_IN * CSS_PX_PER_IN)) * 100;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(z)));
  }, []);

  // Fit on open and whenever the window changes size while in Fit mode.
  useLayoutEffect(() => { if (fit) setZoom(fitZoom()); }, [fit, fitZoom]);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (fit) setZoom(fitZoom()); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, fitZoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const zoomIn = () => { setFit(false); setZoom((z) => Math.min(ZOOM_MAX, z + (z >= 100 ? 25 : 10))); };
  const zoomOut = () => { setFit(false); setZoom((z) => Math.max(ZOOM_MIN, z - (z > 100 ? 25 : 10))); };
  const doFit = () => {
    setFit(true);
    setZoom(fitZoom());
    if (viewportRef.current) { viewportRef.current.scrollTop = 0; viewportRef.current.scrollLeft = 0; }
  };
  const do100 = () => { setFit(false); setZoom(100); };
  // Ctrl / ⌘ + wheel zooms the sheet (not the browser page); a plain wheel scrolls.
  // Native, non-passive listener: React's onWheel cannot prevent the page zoom.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setFit(false);
      setZoom((z) => (e.deltaY < 0 ? Math.min(ZOOM_MAX, z + (z >= 100 ? 25 : 10)) : Math.max(ZOOM_MIN, z - (z > 100 ? 25 : 10))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // --- Draw the selected sheet.
  const sheet = sheets[sheetIdx];
  const wCss = sheetWcss(zoom), hCss = sheetHcss(zoom);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !sheet) return;
    const dpr = window.devicePixelRatio || 1;
    // Limit the backing store (~40 MP) so very high zoom levels stay responsive.
    const s = Math.max(0.25, Math.min(dpr, Math.sqrt(40e6 / (wCss * hCss))));
    c.width = Math.round(wCss * s);
    c.height = Math.round(hCss * s);
    c.style.width = `${wCss}px`;
    c.style.height = `${hCss}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const k = wCss / (HD3D_SHEET_WIDTH_IN * IN); // CSS px per mm

    const maskView = maskOnly && (mode === 'w1' || mode === 'w2');
    if (maskView) {
      ctx.fillStyle = '#000000'; // mask only: white = 100 % ink on black
      ctx.fillRect(0, 0, wCss, hCss);
    } else if (bg === 'checker') {
      const cs = Math.max(6, Math.round(10 * Math.sqrt(zoom / 50)));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, wCss, hCss);
      ctx.fillStyle = '#eef1f5';
      for (let y = 0, r = 0; y < hCss; y += cs, r++) for (let x = r % 2 ? cs : 0; x < wCss; x += cs * 2) ctx.fillRect(x, y, cs, cs);
    } else {
      ctx.fillStyle = bg === 'gray' ? '#64748b' : '#0f172a';
      ctx.fillRect(0, 0, wCss, hCss);
    }
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = bg === 'checker' ? '#cbd5e1' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginMm * k, marginMm * k, wCss - 2 * marginMm * k, hCss - 2 * marginMm * k);
    ctx.setLineDash([]);

    sheet.placements.forEach((p, i) => {
      const d = designs.find((x) => x.id === p.assetId);
      if (!d) return;
      const x = p.xMm * k, y = p.yMm * k, w = p.widthMm * k, h = p.heightMm * k;
      // Request a preview sharp enough for the current zoom (cached in steps by the caller).
      const need = Math.max(w, h) * s;
      const px = [256, 512, 1024, 2048, 4096].find((b) => b >= need) ?? 4096;
      const img = getImage(d, mode, Math.min(px, Math.max(d.width, d.height)), maskOnly);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (p.rotated) { ctx.translate(x + w, y); ctx.rotate(Math.PI / 2); if (img) ctx.drawImage(img, 0, 0, h, w); }
      else if (img) ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      if (showBox || picked === i) {
        ctx.strokeStyle = picked === i ? '#EF7F1A' : '#6366f1';
        ctx.lineWidth = picked === i ? 2.5 : 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
    });
  }, [sheet, designs, mode, maskOnly, bg, showBox, picked, zoom, wCss, hCss, marginMm, getImage]);

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!sheet) return;
    const r = canvasRef.current!.getBoundingClientRect();
    const k = r.width / (HD3D_SHEET_WIDTH_IN * IN);
    const mx = (e.clientX - r.left) / k, my = (e.clientY - r.top) / k;
    const i = sheet.placements.findIndex((p) => mx >= p.xMm && mx <= p.xMm + p.widthMm && my >= p.yMm && my <= p.yMm + p.heightMm);
    setPicked(i >= 0 ? i : null);
  };
  const pickedP = picked !== null ? sheet?.placements[picked] : undefined;
  const pickedD = pickedP ? designs.find((d) => d.id === pickedP.assetId) : undefined;

  const pill = 'flex items-center bg-white border border-[#E5D9C8] rounded-lg shadow-2xs';
  const divider = <div className="h-5 w-px bg-[#E5D9C8] flex-shrink-0" />;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-stretch justify-center p-0 md:p-4" role="dialog" aria-label="3D HD sheet preview">
      <div className="bg-[#FAF7F1] w-full max-w-7xl h-[100dvh] md:h-auto md:max-h-[96vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#E5D9C8] px-3 md:px-5 py-2.5 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-[15px] text-[#204563]">3D HD Sheet Preview</h3>
            <p className="text-[11px] text-[#526A7B]">11" × 17" fixed • {sheet?.placements.length ?? 0} copies on this sheet • {sheet?.placements.filter((p) => p.rotated).length ?? 0} rotated 90°</p>
          </div>
          {sheets.length > 1 && (
            <div className="flex items-center gap-1.5 font-mono">
              {sheets.map((s, i) => (
                <button key={i} type="button" onClick={() => { setSheetIdx(i); setPicked(null); }}
                  className={`h-8 px-3 rounded-lg text-xs font-bold ${sheetIdx === i ? 'bg-[#EF7F1A] text-[#204563]' : 'bg-white border border-[#E5D9C8] text-[#204563]'}`}>Sheet {i + 1}</button>
              ))}
            </div>
          )}
          <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#204563] text-white" aria-label="Close preview"><X className="w-5 h-5" /></button>
        </div>

        {/* Toolbar: layer views | zoom stepper | Fit / 100% | backgrounds | Bounding Box */}
        <div className="bg-white/70 border-b border-[#E5D9C8] px-3 md:px-5 py-2 flex flex-wrap lg:flex-nowrap items-center gap-2 md:gap-2.5">
          <div className={`${pill} p-0.5 gap-0.5 flex-shrink-0`}>
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap ${mode === m.id ? 'bg-[#EF7F1A] text-[#204563] font-black' : 'text-[#526A7B] font-semibold hover:text-[#204563]'}`}>{m.label}</button>
            ))}
          </div>
          {(mode === 'w1' || mode === 'w2') && (
            <label className={`${pill} px-2 py-1 gap-1.5 text-xs font-semibold text-[#204563] cursor-pointer flex-shrink-0 whitespace-nowrap`}>
              <input type="checkbox" checked={maskOnly} onChange={(e) => setMaskOnly(e.target.checked)} className="accent-[#EF7F1A]" />Mask only
            </label>
          )}
          <span className="hidden lg:block ml-auto" />
          <div className={`${pill} px-2 py-1 gap-1.5 flex-shrink-0`}>
            <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} className="w-6 h-6 flex items-center justify-center text-[#526A7B] hover:text-[#204563] font-bold rounded hover:bg-[#FAF7F1] disabled:opacity-30" title="Zoom out" aria-label="Zoom out">–</button>
            <span className="font-mono font-bold text-[#204563] min-w-10 text-center text-xs" aria-live="polite">{zoom}%</span>
            <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} className="w-6 h-6 flex items-center justify-center text-[#526A7B] hover:text-[#204563] font-bold rounded hover:bg-[#FAF7F1] disabled:opacity-30" title="Zoom in" aria-label="Zoom in">+</button>
          </div>
          {divider}
          <div className={`${pill} p-0.5 gap-0.5 flex-shrink-0`}>
            <button type="button" onClick={doFit} aria-pressed={fit} className={`px-2.5 py-1 rounded text-xs ${fit ? 'bg-[#EF7F1A] text-[#204563] font-black' : 'text-[#526A7B] font-medium hover:text-[#204563]'}`} title="Fit the whole sheet into view">Fit</button>
            <button type="button" onClick={do100} aria-pressed={!fit && zoom === 100} className={`px-2.5 py-1 rounded text-xs ${!fit && zoom === 100 ? 'bg-[#EF7F1A] text-[#204563] font-black' : 'text-[#526A7B] font-medium hover:text-[#204563]'}`} title="Actual printed size on screen">100%</button>
          </div>
          {divider}
          <div className={`${pill} px-2 py-1 gap-1.5 flex-shrink-0`}>
            {([
              ['checker', 'Transparent film (checkerboard)', { backgroundImage: 'linear-gradient(45deg,#cbd5e1 25%,transparent 25%),linear-gradient(-45deg,#cbd5e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cbd5e1 75%),linear-gradient(-45deg,transparent 75%,#cbd5e1 75%)', backgroundSize: '5px 5px', backgroundColor: '#fff' }],
              ['gray', 'Grey background', { backgroundColor: '#64748b' }],
              ['black', 'Black background', { backgroundColor: '#0f172a' }]
            ] as const).map(([id, title, style]) => (
              <button key={id} type="button" onClick={() => setBg(id)} title={title} aria-label={title} aria-pressed={bg === id}
                className={`w-5 h-5 rounded-full border transition-transform ${bg === id ? 'border-[#EF7F1A] ring-2 ring-[#EF7F1A]/40 scale-110' : 'border-[#E5D9C8] hover:scale-105'}`}
                style={style as React.CSSProperties} />
            ))}
          </div>
          {divider}
          <button type="button" onClick={() => setShowBox((v) => !v)} aria-pressed={showBox}
            className={`px-2.5 py-1 rounded-lg text-xs border flex-shrink-0 whitespace-nowrap ${showBox ? 'bg-[#EF7F1A] border-[#EF7F1A] text-[#204563] font-black' : 'bg-white border-[#E5D9C8] text-[#526A7B] font-semibold hover:text-[#204563]'}`}>
            Bounding Box
          </button>
        </div>

        {/* Viewport */}
        <div
          ref={viewportRef}
          className="relative flex-1 min-h-[300px] md:min-h-[60vh] overflow-auto"
          style={{ backgroundImage: 'radial-gradient(#526A7B 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          <div className="min-w-full w-max min-h-full flex items-center justify-center p-10">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className="mb-1 px-3 py-0.5 rounded-full bg-white border border-[#E5D9C8] text-xs font-bold font-mono text-[#204563]">⟷ 11" wide</div>
                <div className="h-2 border-b border-l border-r border-[#EF7F1A] mb-1" style={{ width: wCss }} />
                <canvas ref={canvasRef} onClick={onCanvasClick} className="block shadow-xl ring-1 ring-[#E5D9C8] cursor-pointer" />
              </div>
              <div className="flex items-center gap-1.5 self-end" style={{ height: hCss }}>
                <div className="w-2 h-full border-r-2 border-t-2 border-b-2 border-[#EF7F1A] rounded-r" />
                <span className="text-xs font-mono font-bold text-[#204563] whitespace-nowrap">17"</span>
              </div>
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div className="bg-white border-t border-[#E5D9C8] px-3 md:px-5 py-2 min-h-12 flex flex-wrap items-center gap-2 text-[11px]">
          {pickedP && pickedD ? (
            <>
              <span className="font-black text-[#204563] truncate max-w-[220px]">{pickedD.filename}</span>
              <span className="text-[#526A7B]">copy {pickedP.copyIndex + 1} • {(pickedP.widthMm / IN).toFixed(2)} × {(pickedP.heightMm / IN).toFixed(2)} in at ({(pickedP.xMm / IN).toFixed(2)}, {(pickedP.yMm / IN).toFixed(2)}) in</span>
              {pickedP.rotated && <span className="inline-flex items-center gap-1 text-[#204563] font-bold"><RotateCw className="w-3 h-3" />rotated 90°</span>}
              <button type="button" onClick={() => onEditDesign(pickedD.id)} className="ml-auto h-8 px-3 rounded-lg bg-[#204563] text-white font-bold flex items-center gap-1"><Pencil className="w-3.5 h-3.5" />Edit layers</button>
            </>
          ) : (
            <span className="text-[#526A7B] font-semibold">Click a design to inspect it. Ctrl + scroll to zoom; scroll to move around.</span>
          )}
        </div>
      </div>
    </div>
  );
};
