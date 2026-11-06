import React, { useState } from 'react';
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
  onOpenPreviewModal,
  isGenerating = false
}) => {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const presets = [
    { label: '11.5 inches', value: '11.5', widthIn: 11.5 },
    { label: '13 inches', value: '13', widthIn: 13 },
    { label: '17 inches', value: '17', widthIn: 17 },
    { label: '22 inches (Max)', value: '22', widthIn: 22 }
  ];

  return (
    <div className="fixed bottom-0 left-16 right-0 z-30 p-2.5 sm:p-3 pointer-events-none">
      <div className="max-w-[1720px] mx-auto pointer-events-auto">
        {/* Dark Navy / Violet Glassmorphic Dock Container matching Image 1 */}
        <div className="bg-[#0b0e1b]/95 backdrop-blur-xl border border-indigo-900/60 rounded-2xl sm:rounded-3xl p-2.5 sm:px-6 sm:py-3 shadow-2xl shadow-indigo-950/70 flex flex-wrap items-center justify-between gap-3 text-white">
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
                      onUpdateSettings({
                        filmWidthPreset: val,
                        filmWidth: p.widthIn,
                        filmWidthMm: p.widthIn * 25.4
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
              <div className="flex items-center bg-[#161c32] border border-indigo-900/80 rounded-xl overflow-hidden px-2 py-1">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={settings.spacing}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      onUpdateSettings({
                        spacing: val,
                        spacingMm: unitToMm(val, settings.unit)
                      });
                    }
                  }}
                  className="w-12 bg-transparent text-xs font-bold text-white focus:outline-none font-mono"
                />
                <span className="text-slate-400 text-[10px] font-bold uppercase">
                  {settings.unit === 'inch' ? 'in' : settings.unit}
                </span>
              </div>
            </div>

            {/* SHEET LENGTH */}
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                Sheet Length (Max 100")
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-[#161c32] p-0.5 rounded-xl border border-indigo-900/80 text-xs font-bold">
                  <button
                    onClick={() => onUpdateSettings({ lengthMode: 'auto' })}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      settings.lengthMode === 'auto'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ lengthMode: 'fixed' })}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      settings.lengthMode === 'fixed'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Fixed
                  </button>
                </div>
                {settings.lengthMode === 'fixed' && (
                  <div className="flex items-center bg-[#161c32] border border-indigo-900/80 rounded-xl overflow-hidden px-2 py-1">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      value={Math.round((settings.fixedLength || 30) * 10) / 10}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(1, parseFloat(e.target.value) || 1));
                        onUpdateSettings({
                          fixedLength: val,
                          fixedLengthMm: val * 25.4
                        });
                      }}
                      className="w-10 bg-transparent text-xs font-bold text-white focus:outline-none font-mono text-center"
                    />
                    <span className="text-slate-400 text-[10px] font-bold uppercase">in</span>
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
                  className="absolute right-0 bottom-full mb-2 w-64 bg-[#141830] border border-indigo-900/90 rounded-2xl p-2 shadow-2xl z-50 text-left font-sans"
                  onClick={() => setDownloadMenuOpen(false)}
                >
                  <button
                    onClick={onExportPng}
                    className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-indigo-950/80 text-left text-xs font-medium text-slate-200 hover:text-white"
                  >
                    <FileImage className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-bold text-white">Print-Ready PNG (300 DPI)</div>
                      <div className="text-[10px] text-slate-400">Transparent RGBA for DTF RIP</div>
                    </div>
                  </button>

                  <button
                    onClick={onExportPdf}
                    className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-indigo-950/80 text-left text-xs font-medium text-slate-200 hover:text-white"
                  >
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-bold text-white">High-Res Print PDF</div>
                      <div className="text-[10px] text-slate-400">Standard document format</div>
                    </div>
                  </button>

                  <button
                    onClick={onExportJobTicket}
                    className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-indigo-950/80 text-left text-xs font-medium text-slate-200 hover:text-white"
                  >
                    <Layers className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="font-bold text-white">Job Ticket (JSON)</div>
                      <div className="text-[10px] text-slate-400">Placements & cut coordinates</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Generate Layout Prominent Action */}
            <button
              onClick={onGenerateLayout}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/30"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>{isGenerating ? 'Packing...' : 'Generate Layout'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
