import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  Download,
  Eye,
  Sparkles,
  Layers,
  FileImage,
  FileText,
  Ruler,
  Recycle
} from 'lucide-react';
import { SheetSettings, LayoutResult } from '../types';
import { formatUnit, mmToUnit, unitToMm } from '../utils/units';

interface BottomToolbarProps {
  settings: SheetSettings;
  layout: LayoutResult;
  onUpdateSettings: (updates: Partial<SheetSettings>) => void;
  onGenerateLayout: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportJobTicket: () => void;
  onExportSingleSheet?: (sheetIndex: number) => void;
  onOpenPreviewModal: () => void;
  isGenerating?: boolean;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  settings,
  layout,
  onUpdateSettings,
  onGenerateLayout,
  onExportPng,
  onExportPdf,
  onExportJobTicket,
  onExportSingleSheet,
  onOpenPreviewModal,
  isGenerating = false
}) => {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const presets = [
    { label: '11 inches', value: '11', widthIn: 11 },
    { label: '22 inches', value: '22', widthIn: 22 },
    { label: '22.2 inches', value: '22.2', widthIn: 22.2 }
  ];

  const currentMinLen = settings.filmWidth <= 11.1 ? 8 : 1;
  const currentMaxLen = settings.filmWidth <= 11.1 ? 17 : 100;

  const [lengthInput, setLengthInput] = useState<string>(() => (settings.fixedLength || 100).toString());
  const [spacingInput, setSpacingInput] = useState<string>(() => settings.spacing.toString());
  const [isLengthFocused, setIsLengthFocused] = useState<boolean>(false);
  const [isSpacingFocused, setIsSpacingFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isLengthFocused) {
      setLengthInput((settings.fixedLength || 100).toString());
    }
  }, [settings.fixedLength, isLengthFocused]);

  useEffect(() => {
    if (!isSpacingFocused) {
      setSpacingInput(settings.spacing.toString());
    }
  }, [settings.spacing, isSpacingFocused]);

  const handleLengthChange = (valStr: string) => {
    setLengthInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      onUpdateSettings({
        fixedLength: Math.min(currentMaxLen, val),
        fixedLengthMm: Math.min(currentMaxLen, val) * 25.4
      });
    }
  };

  const handleLengthBlur = () => {
    setIsLengthFocused(false);
    const val = parseFloat(lengthInput);
    if (isNaN(val) || val <= 0) {
      const fallback = Math.max(1, settings.fixedLength || 100);
      setLengthInput(fallback.toString());
      onUpdateSettings({ fixedLength: fallback, fixedLengthMm: fallback * 25.4 });
    } else {
      const clamped = Math.max(1, Math.min(currentMaxLen, val));
      setLengthInput(clamped.toString());
      onUpdateSettings({ fixedLength: clamped, fixedLengthMm: clamped * 25.4 });
    }
  };

  const handleSpacingChange = (valStr: string) => {
    setSpacingInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 0) {
      onUpdateSettings({
        spacing: val,
        spacingMm: unitToMm(val, settings.unit)
      });
    }
  };

  const handleSpacingBlur = () => {
    setIsSpacingFocused(false);
    const val = parseFloat(spacingInput);
    if (isNaN(val) || val < 0) {
      setSpacingInput(settings.spacing.toString());
    } else {
      onUpdateSettings({
        spacing: val,
        spacingMm: unitToMm(val, settings.unit)
      });
    }
  };

  return (
    <div className="w-full">
      {/* Dark Navy / Violet Glassmorphic Control Bar matching Image 1 */}
      <div className="bg-[#0b0e1b]/95 backdrop-blur-xl border border-indigo-900/60 rounded-2xl sm:rounded-3xl p-2.5 sm:px-6 sm:py-2.5 shadow-xl shadow-indigo-950/50 flex flex-wrap items-center justify-between gap-3 text-white">
          {/* Left: Sheet Width, Spacing, Sheet Length */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            {/* SHEET WIDTH */}
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                Sheet Width
              </div>
              <div className="relative">
                <select
                  value={settings.filmWidthPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    const p = presets.find((x) => x.value === val);
                    if (p) {
                      const minL = p.widthIn <= 11.1 ? 8 : (p.widthIn >= 21.9 ? 39 : 1);
                      const maxL = p.widthIn <= 11.1 ? 17 : 100;
                      let newLen = settings.fixedLength || minL;
                      if (newLen < minL) newLen = minL;
                      if (newLen > maxL) newLen = maxL;

                      onUpdateSettings({
                        filmWidthPreset: val,
                        filmWidth: p.widthIn,
                        filmWidthMm: p.widthIn * 25.4,
                        fixedLength: newLen,
                        fixedLengthMm: newLen * 25.4
                      });
                    }
                  }}
                  className="appearance-none bg-[#161c32] border border-indigo-900/80 hover:border-indigo-600 rounded-xl px-3 py-1.5 pr-8 text-xs font-bold text-slate-100 focus:outline-none cursor-pointer font-mono"
                >
                  {presets.map((p) => (
                    <option key={p.value} value={p.value} className="bg-[#12162d] text-white">
                      {p.label}
                    </option>
                  ))}
                  {!presets.some((p) => p.value === settings.filmWidthPreset) && (
                    <option value={settings.filmWidthPreset} className="bg-[#12162d] text-white">
                      {settings.filmWidth}" (Custom)
                    </option>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* SPACING */}
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                Spacing
              </div>
              <div className="flex items-center bg-[#161c32] border border-indigo-900/80 rounded-xl overflow-hidden px-2.5 py-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={isSpacingFocused ? spacingInput : settings.spacing.toString()}
                  onFocus={() => {
                    setIsSpacingFocused(true);
                    setSpacingInput(settings.spacing.toString());
                  }}
                  onChange={(e) => handleSpacingChange(e.target.value)}
                  onBlur={handleSpacingBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-12 bg-transparent text-xs font-bold text-white focus:outline-none font-mono text-center"
                  placeholder="0.3"
                />
                <span className="text-slate-400 text-[10px] font-bold uppercase ml-1">
                  {settings.unit === 'inch' ? 'in' : settings.unit}
                </span>
              </div>
            </div>

            {/* SHEET LENGTH */}
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                Sheet Length {settings.lengthMode === 'fixed' ? `(Max ${currentMaxLen}")` : '(Auto)'}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-[#161c32] p-0.5 rounded-xl border border-indigo-900/80 text-xs font-bold">
                  <button
                    onClick={() => onUpdateSettings({ lengthMode: 'auto' })}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      settings.lengthMode === 'auto'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ lengthMode: 'fixed' })}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      settings.lengthMode === 'fixed'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Fixed
                  </button>
                </div>
                {settings.lengthMode === 'fixed' && (
                  <div className="flex items-center bg-[#161c32] border border-indigo-900/80 rounded-xl overflow-hidden px-2.5 py-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={isLengthFocused ? lengthInput : (settings.fixedLength || 100).toString()}
                      onFocus={() => {
                        setIsLengthFocused(true);
                        setLengthInput((settings.fixedLength || 100).toString());
                      }}
                      onChange={(e) => handleLengthChange(e.target.value)}
                      onBlur={handleLengthBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="w-14 bg-transparent text-xs font-bold text-white focus:outline-none font-mono text-center"
                      placeholder="100"
                    />
                    <span className="text-slate-400 text-[10px] font-bold uppercase ml-1">in</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Middle: Status Metrics matching Image 1 */}
          <div className="hidden md:flex items-center space-x-4 bg-[#141a2e] px-4 py-1.5 rounded-xl border border-indigo-900/60 font-mono text-xs">
            <div className="flex items-center space-x-1.5 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] text-slate-400 uppercase">Total Copies:</span>
              <span className="font-bold text-white">{layout.totalCopies}</span>
            </div>

            <span className="text-slate-700">|</span>

            <div className="flex items-center space-x-1.5 text-slate-300">
              <Ruler className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] text-slate-400 uppercase">Sheet Length:</span>
              <span className="font-bold text-indigo-300">
                {layout.usedLengthMeters.toFixed(2)} m
              </span>
            </div>

            <span className="text-slate-700">|</span>

            <div className="flex items-center space-x-1.5 text-slate-300">
              <Recycle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-slate-400 uppercase">Film Waste:</span>
              <span className="font-bold text-emerald-400">{layout.wastePercent}%</span>
            </div>
          </div>

          {/* Right: Preview, Download, Generate */}
          <div className="flex items-center space-x-2.5">
            {/* Preview Button */}
            <button
              onClick={onOpenPreviewModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-[#161c32] hover:bg-[#202848] border border-indigo-900/80 hover:text-white transition-all shadow-xs"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Preview</span>
            </button>

            {/* Download Dropdown */}
            <div className="relative">
              <div className="inline-flex rounded-xl shadow-md">
                <button
                  onClick={onExportPng}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-l-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                  className="px-2 py-2 rounded-r-xl text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 border-l border-indigo-500/50 transition-all"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {downloadMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-72 bg-[#141830] border border-indigo-900/90 rounded-2xl p-2 shadow-2xl z-50 text-left font-sans"
                  onClick={() => setDownloadMenuOpen(false)}
                >
                  <button
                    onClick={onExportPng}
                    className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-indigo-950/80 text-left text-xs font-medium text-slate-200 hover:text-white"
                  >
                    <FileImage className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-bold text-white">
                        {layout.sheets && layout.sheets.length > 1
                          ? `Download All Sheets (${layout.sheets.length} files)`
                          : 'Print-Ready PNG (300 DPI)'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {layout.sheets && layout.sheets.length > 1
                          ? 'Downloads each gang sheet separately'
                          : 'Transparent RGBA for DTF RIP'}
                      </div>
                    </div>
                  </button>

                  {/* Individual sheet download options when multiple gang sheets exist */}
                  {layout.sheets && layout.sheets.length > 1 && (
                    <div className="border-t border-indigo-900/60 pt-1.5 mt-1">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Download Individual Sheets
                      </div>
                      {layout.sheets.map((s) => (
                        <button
                          key={s.sheetIndex}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDownloadMenuOpen(false);
                            if (onExportSingleSheet) onExportSingleSheet(s.sheetIndex);
                            else onExportPng();
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-indigo-950/80 text-left text-xs text-slate-200 hover:text-white"
                        >
                          <div className="flex items-center space-x-2">
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="font-bold text-white">Sheet {s.sheetIndex + 1}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {Math.round((s.usedLengthMm / 25.4))} in • {s.totalCopies} copies
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-indigo-900/60 pt-1 mt-1">
                    <button
                      onClick={onExportPdf}
                      className="w-full flex items-center space-x-2.5 p-2 rounded-xl hover:bg-indigo-950/80 text-left text-xs font-medium text-slate-200 hover:text-white"
                    >
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <div>
                        <div className="font-bold text-white">High-Res Print PDF</div>
                        <div className="text-[10px] text-slate-400">Standard document format</div>
                      </div>
                    </button>

                    <button
                      onClick={onExportJobTicket}
                      className="w-full flex items-center space-x-2.5 p-2 rounded-xl hover:bg-indigo-950/80 text-left text-xs font-medium text-slate-200 hover:text-white"
                    >
                      <Layers className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="font-bold text-white">Job Ticket (JSON)</div>
                        <div className="text-[10px] text-slate-400">Placements & cut coordinates</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Layout Prominent Action */}
            <button
              onClick={onGenerateLayout}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>{isGenerating ? 'Packing...' : 'Generate Layout'}</span>
            </button>
          </div>
        </div>
      </div>
  );
};
