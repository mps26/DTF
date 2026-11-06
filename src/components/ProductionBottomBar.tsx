import React, { useState } from 'react';
import {
  ChevronDown,
  Download,
  Eye,
  Sparkles,
  Layers,
  FileImage,
  FileText,
  Sliders,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { SheetSettings, Unit, LayoutResult } from '../types';
import { formatUnit, mmToUnit, unitToMm } from '../utils/units';

interface ProductionBottomBarProps {
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

export const ProductionBottomBar: React.FC<ProductionBottomBarProps> = ({
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
    { label: '11.5"', value: '11.5', widthIn: 11.5 },
    { label: '13.0"', value: '13', widthIn: 13 },
    { label: '22.0"', value: '22', widthIn: 22 },
    { label: '24.0"', value: '24', widthIn: 24 },
    { label: '48.0"', value: '48', widthIn: 48 },
    { label: '60.0"', value: '60', widthIn: 60 }
  ];

  return (
    <footer className="h-12 bg-[#0a0e19] border-t border-[#1e293b] px-3 flex items-center justify-between text-xs text-slate-300 select-none z-30 flex-shrink-0">
      {/* Left: Quick Production Settings */}
      <div className="flex items-center space-x-3">
        {/* Film Width */}
        <div className="flex items-center space-x-1.5 font-mono">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Roll Width:</span>
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
            className="bg-[#121828] border border-slate-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
          >
            {presets.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Spacing */}
        <div className="flex items-center space-x-1.5 font-mono">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Gap:</span>
          <div className="flex items-center bg-[#121828] border border-slate-700 rounded px-1.5 py-0.5">
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
              className="w-12 bg-transparent text-white font-bold focus:outline-none text-xs"
            />
            <span className="text-[10px] text-slate-500 ml-1">
              {settings.unit === 'inch' ? 'in' : settings.unit}
            </span>
          </div>
        </div>

        {/* Length Mode */}
        <div className="hidden sm:flex items-center space-x-1 font-mono">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Length:</span>
          <div className="flex bg-[#121828] p-0.5 rounded border border-slate-700 text-[10px]">
            <button
              onClick={() => onUpdateSettings({ lengthMode: 'auto' })}
              className={`px-2 py-0.5 rounded transition-all ${
                settings.lengthMode === 'auto'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => onUpdateSettings({ lengthMode: 'fixed' })}
              className={`px-2 py-0.5 rounded transition-all ${
                settings.lengthMode === 'fixed'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fixed
            </button>
          </div>
        </div>
      </div>

      {/* Middle: Live Production Metrics */}
      <div className="hidden lg:flex items-center space-x-3 font-mono text-[11px] bg-[#121727] px-3 py-1 rounded border border-slate-800">
        <span className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{layout.totalCopies} copies placed</span>
        </span>
        <span className="text-slate-600">•</span>
        <span>
          Length:{' '}
          <strong className="text-indigo-400">
            {formatUnit(mmToUnit(layout.usedLengthMm, settings.unit), settings.unit, 1)}{' '}
            {settings.unit === 'inch' ? 'in' : settings.unit}
          </strong>{' '}
          ({layout.usedLengthMeters.toFixed(2)}m)
        </span>
        <span className="text-slate-600">•</span>
        <span>
          Waste: <strong className="text-emerald-400">{layout.wastePercent}%</strong>
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2">
        {/* Preview Button */}
        <button
          onClick={onOpenPreviewModal}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Preview</span>
        </button>

        {/* Download Split Dropdown */}
        <div className="relative">
          <div className="inline-flex rounded shadow-xs">
            <button
              onClick={onExportPng}
              className="flex items-center space-x-1.5 px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-l transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              className="px-1.5 py-1 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-600 rounded-r border-l border-indigo-500/40 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download Options Menu */}
          {downloadMenuOpen && (
            <div
              className="absolute right-0 bottom-full mb-1.5 w-60 bg-[#0e1322] border border-slate-700 rounded-lg p-1.5 shadow-2xl z-50 text-left font-sans"
              onClick={() => setDownloadMenuOpen(false)}
            >
              <button
                onClick={onExportPng}
                className="w-full flex items-center space-x-2 p-2 rounded hover:bg-indigo-950/80 text-left text-xs transition-colors"
              >
                <FileImage className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-bold text-white">Print-Ready 300 DPI PNG</div>
                  <div className="text-[10px] text-slate-400">Transparent RGBA for RIP</div>
                </div>
              </button>

              <button
                onClick={onExportPdf}
                className="w-full flex items-center space-x-2 p-2 rounded hover:bg-indigo-950/80 text-left text-xs transition-colors"
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                <div>
                  <div className="font-bold text-white">Production High-Res PDF</div>
                  <div className="text-[10px] text-slate-400">Standard document sheet</div>
                </div>
              </button>

              <button
                onClick={onExportJobTicket}
                className="w-full flex items-center space-x-2 p-2 rounded hover:bg-indigo-950/80 text-left text-xs transition-colors"
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

        {/* Generate & Pack Prominent Button */}
        <button
          onClick={onGenerateLayout}
          disabled={isGenerating}
          className="flex items-center space-x-1.5 px-4 py-1 text-xs font-black text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
          <span>{isGenerating ? 'Packing...' : 'Generate Layout'}</span>
        </button>
      </div>
    </footer>
  );
};

