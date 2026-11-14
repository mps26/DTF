import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Download,
  Eye,
  Sparkles,
  Layers,
  FileImage,
  FileText,
  Ruler,
  Recycle,
  Lock,
  Unlock,
  Check
} from 'lucide-react';
import { SheetSettings, LayoutResult } from '../types';
import { UserProfile } from '../types/auth';
import { mmToUnit } from '../utils/units';
import {
  RollPreset,
  getPresetsForPrintType,
  findPresetById,
  hasLockedRollAccess,
  getSettingsUpdatesForPreset
} from '../utils/sheetPresets';

interface BottomToolbarProps {
  settings: SheetSettings;
  layout: LayoutResult;
  currentUser?: UserProfile | null;
  onUpdateSettings: (updates: Partial<SheetSettings>) => void;
  onGenerateLayout: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportJobTicket: () => void;
  onExportSingleSheet?: (sheetIndex: number) => void;
  onOpenPreviewModal: () => void;
  onLockedPresetClick?: (preset: RollPreset) => void;
  onSwitchHome?: () => void;
  isGenerating?: boolean;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  settings,
  layout,
  currentUser = null,
  onUpdateSettings,
  onGenerateLayout,
  onExportPng,
  onExportPdf,
  onExportJobTicket,
  onExportSingleSheet,
  onOpenPreviewModal,
  onLockedPresetClick,
  onSwitchHome,
  isGenerating = false
}) => {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  const printType = settings.printType || 'dtf';
  const presets = getPresetsForPrintType(printType);
  const activePreset = findPresetById(settings.filmWidthPreset) || presets[0];
  const isAuthorized = hasLockedRollAccess(currentUser);

  const currentMinLen = activePreset ? activePreset.minLengthIn : (settings.filmWidth <= 11.1 ? 8 : 39);
  const currentMaxLen = activePreset ? activePreset.maxLengthIn : (settings.filmWidth <= 11.1 ? 17 : 100);
  const isFixedPreset = activePreset?.isFixedLength ?? false;

  const [lengthInput, setLengthInput] = useState<string>(() => (settings.fixedLength || currentMinLen).toString());
  const [spacingMmInput, setSpacingMmInput] = useState<string>(() =>
    (Math.round((settings.spacingMm ?? 5) * 100) / 100).toString()
  );
  const [isLengthFocused, setIsLengthFocused] = useState<boolean>(false);
  const [isSpacingFocused, setIsSpacingFocused] = useState<boolean>(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setPresetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLengthFocused) {
      setLengthInput((settings.fixedLength || currentMinLen).toString());
    }
  }, [settings.fixedLength, currentMinLen, isLengthFocused]);

  useEffect(() => {
    if (!isSpacingFocused) {
      setSpacingMmInput((Math.round((settings.spacingMm ?? 5) * 100) / 100).toString());
    }
  }, [settings.spacingMm, isSpacingFocused]);

  const handleLengthChange = (valStr: string) => {
    setLengthInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      const clamped = Math.min(currentMaxLen, val);
      onUpdateSettings({
        fixedLength: clamped,
        fixedLengthMm: clamped * 25.4
      });
    }
  };

  const handleLengthBlur = () => {
    setIsLengthFocused(false);
    const val = parseFloat(lengthInput);
    if (isNaN(val) || val <= 0) {
      const fallback = Math.max(currentMinLen, Math.min(currentMaxLen, settings.fixedLength || currentMinLen));
      setLengthInput(fallback.toString());
      onUpdateSettings({ fixedLength: fallback, fixedLengthMm: fallback * 25.4 });
    } else {
      const clamped = Math.max(currentMinLen, Math.min(currentMaxLen, val));
      setLengthInput(clamped.toString());
      onUpdateSettings({ fixedLength: clamped, fixedLengthMm: clamped * 25.4 });
    }
  };

  const handleSpacingChange = (valStr: string) => {
    setSpacingMmInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 5) {
      onUpdateSettings({
        spacingMm: val,
        spacing: Math.round(mmToUnit(val, settings.unit) * 1000) / 1000
      });
    }
  };

  const handleSpacingBlur = () => {
    setIsSpacingFocused(false);
    const val = parseFloat(spacingMmInput);
    const clamped = isNaN(val) ? Math.max(5, settings.spacingMm ?? 5) : Math.max(5, val);
    const rounded = Math.round(clamped * 100) / 100;
    setSpacingMmInput(rounded.toString());
    onUpdateSettings({
      spacingMm: rounded,
      spacing: Math.round(mmToUnit(rounded, settings.unit) * 1000) / 1000
    });
  };

  const handleSelectPreset = (preset: RollPreset) => {
    setPresetMenuOpen(false);
    if (preset.isLocked && !isAuthorized) {
      if (onLockedPresetClick) {
        onLockedPresetClick(preset);
      }
      return;
    }
    onUpdateSettings(getSettingsUpdatesForPreset(preset));
  };

  return (
    <div className="w-full relative z-30">
      {/* ================= DESKTOP TOOLBAR (lg and up) ================= */}
      <div className="hidden lg:flex bg-[#0b1723]/95 backdrop-blur-xl border border-indigo-900/60 rounded-2xl sm:rounded-3xl px-3 sm:px-4 py-2 shadow-xl shadow-[#0b1723]/60 flex-nowrap items-center justify-between gap-2 text-white relative z-30">
          {/* Left: Mode Badge, Sheet Size, Spacing (mm), Sheet Length */}
          <div className="flex flex-nowrap items-center gap-2.5 xl:gap-3.5 flex-shrink-0">
            {/* PRINT MODE BADGE */}
            <div className="flex-shrink-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 mb-0.5 whitespace-nowrap">
                Mode
              </div>
              <button
                type="button"
                onClick={onSwitchHome}
                className={`px-3 py-1 rounded-xl text-xs sm:text-[13px] font-black tracking-wide uppercase border transition-all cursor-pointer flex items-center whitespace-nowrap ${
                  printType === 'uvdtf'
                    ? 'bg-purple-600/20 border-purple-500/60 text-purple-200 hover:bg-purple-600/30'
                    : 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200 hover:bg-indigo-600/30'
                }`}
                title="Switch between DTF and UVDTF on Home page"
              >
                <span>{printType === 'uvdtf' ? 'UVDTF' : 'DTF'}</span>
              </button>
            </div>

            {/* SHEET WIDTH / ROLL PRESET */}
            <div ref={presetDropdownRef} className="relative flex-shrink-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 mb-0.5 whitespace-nowrap">
                Sheet Size
              </div>
              <button
                type="button"
                onClick={() => setPresetMenuOpen(!presetMenuOpen)}
                className="flex items-center justify-between space-x-1.5 bg-[#132c40] border border-indigo-900/80 hover:border-indigo-500 rounded-xl px-2.5 py-1 text-xs sm:text-[13px] font-bold text-white focus:outline-none cursor-pointer font-mono min-w-[115px] whitespace-nowrap"
              >
                <span>{activePreset ? activePreset.shortLabel : `${settings.filmWidth}"`}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              </button>

              {presetMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-[#0f2232] border border-indigo-800/80 rounded-2xl p-1.5 shadow-2xl z-50 text-left font-sans">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                    {printType === 'uvdtf' ? 'UVDTF Sheet & Roll Options' : 'DTF Roll Options'}
                  </div>
                  {presets.map((preset) => {
                    const isSelected = activePreset?.id === preset.id;
                    const locked = preset.isLocked && !isAuthorized;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                          locked
                            ? 'hover:bg-amber-950/50 text-slate-300'
                            : isSelected
                            ? 'bg-indigo-600/30 text-white border border-indigo-500/40'
                            : 'hover:bg-indigo-950/80 text-slate-200 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {locked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          ) : preset.isLocked ? (
                            <Unlock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          ) : isSelected ? (
                            <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          ) : (
                            <span className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          <div>
                            <div className="font-bold font-mono">{preset.label}</div>
                            <div className="text-[10px] text-slate-400">
                              {locked ? 'Locked — Authorized Email Only' : preset.isFixedLength ? 'Standard Sheet Size' : 'Running Roll'}
                            </div>
                          </div>
                        </div>
                        {locked && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Lock
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SPACING (ALWAYS IN MM) */}
            <div className="flex-shrink-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 mb-0.5 whitespace-nowrap">
                Spacing
              </div>
              <div className="flex items-center bg-[#132c40] border border-indigo-900/80 rounded-xl overflow-hidden px-2.5 py-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={isSpacingFocused ? spacingMmInput : (Math.round((settings.spacingMm ?? 5) * 100) / 100).toString()}
                  onFocus={() => {
                    setIsSpacingFocused(true);
                    setSpacingMmInput((Math.round((settings.spacingMm ?? 5) * 100) / 100).toString());
                  }}
                  onChange={(e) => handleSpacingChange(e.target.value)}
                  onBlur={handleSpacingBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-10 bg-transparent text-xs sm:text-[13px] font-bold text-white focus:outline-none font-mono text-center"
                  placeholder="5"
                />
                <span className="text-slate-300 text-[11px] font-bold uppercase ml-1">
                  mm
                </span>
              </div>
            </div>

            {/* SHEET LENGTH */}
            <div className="flex-shrink-0">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 mb-0.5 whitespace-nowrap">
                Sheet Length {isFixedPreset ? '' : settings.lengthMode === 'fixed' ? `(${currentMinLen}"–${currentMaxLen}")` : '(Auto)'}
              </div>
              {isFixedPreset ? (
                <div className="flex items-center bg-[#132c40] border border-indigo-900/80 rounded-xl px-3 py-1 text-xs sm:text-[13px] font-bold text-indigo-200 font-mono whitespace-nowrap">
                  <span>{currentMaxLen} in</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-[#132c40] p-0.5 rounded-xl border border-indigo-900/80 text-xs sm:text-[13px] font-bold">
                    <button
                      onClick={() => onUpdateSettings({ lengthMode: 'auto' })}
                      className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                        settings.lengthMode === 'auto'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ lengthMode: 'fixed' })}
                      className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                        settings.lengthMode === 'fixed'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Fixed
                    </button>
                  </div>
                  {settings.lengthMode === 'fixed' && (
                    <div className="flex items-center bg-[#132c40] border border-indigo-900/80 rounded-xl overflow-hidden px-2.5 py-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={isLengthFocused ? lengthInput : (settings.fixedLength || currentMinLen).toString()}
                        onFocus={() => {
                          setIsLengthFocused(true);
                          setLengthInput((settings.fixedLength || currentMinLen).toString());
                        }}
                        onChange={(e) => handleLengthChange(e.target.value)}
                        onBlur={handleLengthBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="w-11 bg-transparent text-xs sm:text-[13px] font-bold text-white focus:outline-none font-mono text-center"
                        placeholder={currentMinLen.toString()}
                      />
                      <span className="text-slate-300 text-[11px] font-bold uppercase ml-1">in</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Middle: Status Metrics */}
          <div className="hidden lg:flex items-center space-x-2.5 xl:space-x-3.5 bg-[#132c40] px-3 py-1.5 rounded-xl border border-indigo-900/60 font-mono text-xs whitespace-nowrap flex-shrink-0">
            <div className="flex items-center space-x-1 text-slate-200">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] text-slate-300 uppercase">Copies:</span>
              <span className="font-bold text-white text-[13px]">{layout.totalCopies}</span>
            </div>

            <span className="text-slate-700">|</span>

            <div className="flex items-center space-x-1 text-slate-200">
              <Ruler className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] text-slate-300 uppercase">Length:</span>
              <span className="font-bold text-indigo-200 text-[13px]">
                {layout.usedLengthMeters.toFixed(2)} m
              </span>
            </div>

            <span className="text-slate-700">|</span>

            <div className="flex items-center space-x-1 text-slate-200">
              <Recycle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-slate-300 uppercase">Waste:</span>
              <span className="font-bold text-emerald-400 text-[13px]">{layout.wastePercent}%</span>
            </div>
          </div>

          {/* Right: Preview, Download, Generate */}
          <div className="flex items-center space-x-2 flex-shrink-0 whitespace-nowrap">
            {/* Preview Button */}
            <button
              onClick={onOpenPreviewModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-[13px] font-bold text-slate-100 bg-[#132c40] hover:bg-[#1a3852] border border-indigo-900/80 hover:text-white transition-all shadow-xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Preview</span>
            </button>

            {/* Download Dropdown */}
            <div className="relative">
              <div className="inline-flex rounded-xl shadow-md">
                <button
                  onClick={onExportPng}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-l-xl text-xs sm:text-[13px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                  className="px-2 py-1.5 rounded-r-xl text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 border-l border-indigo-500/50 transition-all cursor-pointer"
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
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-[13px] font-black text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>{isGenerating ? 'Packing...' : 'Generate Layout'}</span>
            </button>
          </div>
        </div>

      {/* ================= MOBILE TOOLBAR (< lg) ================= */}
      {/* 4-Row Clean Mobile Control Panel matching exact specifications */}
      <div className="lg:hidden flex flex-col bg-[#0b1723]/95 backdrop-blur-xl border border-indigo-900/60 rounded-2xl p-2.5 shadow-xl text-white space-y-2 relative z-30">
        {/* ROW 1: DTF Mode & Sheet Size */}
        <div className="grid grid-cols-2 gap-2">
          {/* DTF Mode */}
          <button
            type="button"
            onClick={onSwitchHome}
            className={`h-9 px-3 rounded-xl text-xs font-bold tracking-wide uppercase border flex items-center justify-between transition-all active:scale-98 ${
              printType === 'uvdtf'
                ? 'bg-purple-600/20 border-purple-500/60 text-purple-200'
                : 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
            }`}
            title="Tap to switch between DTF and UVDTF"
          >
            <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Mode</span>
            <span className="font-black text-xs font-mono">{printType === 'uvdtf' ? 'UVDTF' : 'DTF'}</span>
          </button>

          {/* Sheet Size */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPresetMenuOpen(!presetMenuOpen)}
              className="w-full h-9 px-3 bg-[#132c40] border border-indigo-900/80 hover:border-indigo-500 rounded-xl text-xs font-bold text-white font-mono flex items-center justify-between active:scale-98 transition-all"
            >
              <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Size</span>
              <span className="truncate mx-1">{activePreset ? activePreset.shortLabel : `${settings.filmWidth}"`}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {presetMenuOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setPresetMenuOpen(false)} />
                <div className="relative bg-[#0f2232] border border-indigo-800/80 rounded-2xl p-3 shadow-2xl z-10 w-full max-w-xs max-h-[70vh] overflow-y-auto">
                  <div className="px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 border-b border-indigo-900/60 mb-2 flex items-center justify-between">
                    <span>{printType === 'uvdtf' ? 'UVDTF Roll Options' : 'DTF Roll Options'}</span>
                    <button type="button" onClick={() => setPresetMenuOpen(false)} className="text-slate-400 hover:text-white font-bold p-1">✕</button>
                  </div>
                  <div className="space-y-1">
                    {presets.map((preset) => {
                      const isSelected = activePreset?.id === preset.id;
                      const locked = preset.isLocked && !isAuthorized;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors ${
                            locked
                              ? 'text-slate-400 hover:bg-slate-800/40'
                              : isSelected
                              ? 'bg-indigo-600/30 text-white border border-indigo-500/40 font-bold'
                              : 'text-slate-200 hover:bg-indigo-950/80'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {locked ? (
                              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : isSelected ? (
                              <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <div>
                              <div className="font-bold font-mono">{preset.label}</div>
                              <div className="text-[10px] text-slate-400">
                                {locked ? 'Locked — Operator Access' : preset.isFixedLength ? 'Standard Sheet' : 'Running Roll'}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Gap (Spacing mm) & Sheet Length (Auto / Fixed) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Gap */}
          <div className="h-9 flex items-center justify-between bg-[#132c40] border border-indigo-900/80 rounded-xl px-3">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Gap</span>
            <div className="flex items-center space-x-1">
              <input
                type="text"
                inputMode="decimal"
                value={isSpacingFocused ? spacingMmInput : (Math.round((settings.spacingMm ?? 5) * 100) / 100).toString()}
                onFocus={() => {
                  setIsSpacingFocused(true);
                  setSpacingMmInput((Math.round((settings.spacingMm ?? 5) * 100) / 100).toString());
                }}
                onChange={(e) => handleSpacingChange(e.target.value)}
                onBlur={handleSpacingBlur}
                className="w-10 bg-transparent text-xs font-bold text-white focus:outline-none font-mono text-center"
              />
              <span className="text-slate-400 text-[10px] uppercase font-bold">mm</span>
            </div>
          </div>

          {/* Sheet Length (Auto / Fixed) */}
          <div className="h-9 flex items-center justify-between bg-[#132c40] p-1 rounded-xl border border-indigo-900/80">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold px-1.5">Length</span>
            <div className="flex items-center space-x-1 h-full">
              <button
                type="button"
                onClick={() => onUpdateSettings({ lengthMode: 'auto' })}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all ${
                  settings.lengthMode === 'auto' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ lengthMode: 'fixed' })}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all ${
                  settings.lengthMode === 'fixed' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fixed
              </button>
              {settings.lengthMode === 'fixed' && (
                <div className="flex items-center bg-[#0b1723] border border-indigo-700/60 rounded-md px-1 py-0.5 ml-0.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={isLengthFocused ? lengthInput : (settings.fixedLength || currentMinLen).toString()}
                    onFocus={() => {
                      setIsLengthFocused(true);
                      setLengthInput((settings.fixedLength || currentMinLen).toString());
                    }}
                    onChange={(e) => handleLengthChange(e.target.value)}
                    onBlur={handleLengthBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-7 bg-transparent text-[11px] font-bold text-white focus:outline-none font-mono text-center"
                    placeholder={currentMinLen.toString()}
                  />
                  <span className="text-slate-400 text-[8px] uppercase font-bold">in</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: Copies, Sheet Length, Waste */}
        <div className="grid grid-cols-3 gap-2">
          {/* Copies */}
          <div className="bg-[#132c40] border border-indigo-900/60 rounded-xl px-2 py-1.5 text-center flex flex-col justify-center">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-tight">Copies</span>
            <span className="text-xs font-black text-white font-mono mt-0.5">{layout.totalCopies}</span>
          </div>

          {/* Sheet Length */}
          <div className="bg-[#132c40] border border-indigo-900/60 rounded-xl px-2 py-1.5 text-center flex flex-col justify-center">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-tight">Length</span>
            <span className="text-xs font-black text-indigo-300 font-mono mt-0.5">{layout.usedLengthMeters.toFixed(2)}m</span>
          </div>

          {/* Waste */}
          <div className="bg-[#132c40] border border-indigo-900/60 rounded-xl px-2 py-1.5 text-center flex flex-col justify-center">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-tight">Waste</span>
            <span className="text-xs font-black text-emerald-400 font-mono mt-0.5">{layout.wastePercent}%</span>
          </div>
        </div>

        {/* ROW 4: Preview, Save, Pack */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {/* Preview */}
          <button
            type="button"
            onClick={onOpenPreviewModal}
            className="h-9 px-2 rounded-xl text-xs font-bold text-slate-200 bg-[#132c40] hover:bg-[#1a3852] border border-indigo-900/80 flex items-center justify-center space-x-1.5 active:scale-95 transition-transform"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Preview</span>
          </button>

          {/* Save / Download */}
          <button
            type="button"
            onClick={onExportPng}
            className="h-9 px-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-transform shadow-xs flex items-center justify-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          {/* Pack / Generate Layout */}
          <button
            type="button"
            onClick={onGenerateLayout}
            disabled={isGenerating}
            className="h-9 px-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 to-purple-700 active:scale-95 transition-transform shadow-md shadow-purple-600/30 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>{isGenerating ? 'Packing' : 'Pack'}</span>
          </button>
        </div>
      </div>
      </div>
  );
};
