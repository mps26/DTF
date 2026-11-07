import React from 'react';
import {
  Sliders,
  Maximize2,
  Lock,
  Unlock,
  RotateCw,
  Scissors,
  Sparkles,
  Activity,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Layers,
  Box,
  Cpu,
  Trash2,
  Copy
} from 'lucide-react';
import { ArtworkAsset, SheetSettings, Unit, LayoutResult, PackedPlacement } from '../types';
import { formatUnit, mmToUnit, unitToMm } from '../utils/units';

interface PropertiesSidebarProps {
  selectedAsset: ArtworkAsset | null;
  selectedPlacement: PackedPlacement | null;
  settings: SheetSettings;
  layout: LayoutResult;
  onUpdateAsset: (id: string, updates: Partial<ArtworkAsset>) => void;
  onUpdateSettings: (updates: Partial<SheetSettings>) => void;
  onUnitChange: (unit: Unit) => void;
  onTrimAsset: (id: string) => void;
  onRemoveBgAsset: (id: string) => void;
  onOpenEditModal: (asset: ArtworkAsset) => void;
  onDespeckleAsset: (id: string) => void;
  onAddStrokeAsset: (id: string) => void;
  onRevertAsset: (id: string) => void;
}

export const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({
  selectedAsset,
  selectedPlacement,
  settings,
  layout,
  onUpdateAsset,
  onUpdateSettings,
  onUnitChange,
  onTrimAsset,
  onRemoveBgAsset,
  onOpenEditModal,
  onDespeckleAsset,
  onAddStrokeAsset,
  onRevertAsset
}) => {
  const presets = [
    { label: '11.5" (292 mm)', value: '11.5', widthIn: 11.5 },
    { label: '13.0" (330 mm)', value: '13', widthIn: 13 },
    { label: '22.0" (559 mm)', value: '22', widthIn: 22 },
    { label: '24.0" (610 mm)', value: '24', widthIn: 24 },
    { label: '48.0" (1219 mm)', value: '48', widthIn: 48 },
    { label: '60.0" (1524 mm)', value: '60', widthIn: 60 },
    { label: 'Custom Width', value: 'custom', widthIn: settings.filmWidth }
  ];

  const handleWidthPreset = (val: string) => {
    if (val === 'custom') {
      onUpdateSettings({ filmWidthPreset: 'custom' });
    } else {
      const p = presets.find((x) => x.value === val);
      if (p) {
        onUpdateSettings({
          filmWidthPreset: val,
          filmWidth: p.widthIn,
          filmWidthMm: p.widthIn * 25.4
        });
      }
    }
  };

  return (
    <aside className="w-80 sm:w-84 bg-[#111625] border-l border-[#1e293b] flex flex-col h-full select-none flex-shrink-0 text-slate-300 overflow-y-auto">
      {selectedAsset ? (
        /* ================= 1. SELECTED DESIGN PROPERTIES ================= */
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="pb-3 border-b border-slate-800 flex items-start justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <div
                className="w-10 h-10 rounded border border-slate-700 overflow-hidden flex-shrink-0"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #1e293b 25%, transparent 25%),
                    linear-gradient(-45deg, #1e293b 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #1e293b 75%),
                    linear-gradient(-45deg, transparent 75%, #1e293b 75%)
                  `,
                  backgroundSize: '8px 8px',
                  backgroundColor: '#0f172a'
                }}
              >
                <img
                  src={selectedAsset.processedUrl || selectedAsset.originalUrl}
                  alt={selectedAsset.filename}
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Selected Artwork
                </span>
                <h3 className="font-bold text-xs text-white truncate max-w-[150px]">
                  {selectedAsset.filename}
                </h3>
              </div>
            </div>

            <button
              onClick={() => onOpenEditModal(selectedAsset)}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold flex items-center space-x-1"
            >
              <Edit2 className="w-3 h-3" />
              <span>Studio</span>
            </button>
          </div>

          {/* Transform Section */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Transform & Physical Sizing
            </span>

            {/* Position X / Y if a placement is selected */}
            {selectedPlacement && (
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#0b0e1a] p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Position X</span>
                  <span className="font-bold text-slate-200">
                    {formatUnit(mmToUnit(selectedPlacement.xMm, settings.unit), settings.unit)} {settings.unit === 'inch' ? 'in' : settings.unit}
                  </span>
                </div>
                <div className="bg-[#0b0e1a] p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Position Y</span>
                  <span className="font-bold text-slate-200">
                    {formatUnit(mmToUnit(selectedPlacement.yMm, settings.unit), settings.unit)} {settings.unit === 'inch' ? 'in' : settings.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Target Width & Height */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Width ({settings.unit === 'inch' ? 'in' : settings.unit})
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={selectedAsset.targetWidth}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val <= 0) return;
                    onUpdateAsset(selectedAsset.id, { targetWidth: val });
                  }}
                  className="w-full bg-[#0b0e1a] border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Height ({settings.unit === 'inch' ? 'in' : settings.unit})
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={selectedAsset.targetHeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val <= 0) return;
                    onUpdateAsset(selectedAsset.id, { targetHeight: val });
                  }}
                  className="w-full bg-[#0b0e1a] border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Lock Aspect Ratio & 90 Rotation */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() =>
                  onUpdateAsset(selectedAsset.id, {
                    aspectLocked: !selectedAsset.aspectLocked
                  })
                }
                className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white"
              >
                {selectedAsset.aspectLocked ? (
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Lock Proportions</span>
              </button>

              <button
                onClick={() =>
                  onUpdateAsset(selectedAsset.id, {
                    targetWidth: selectedAsset.targetHeight,
                    targetHeight: selectedAsset.targetWidth,
                    targetWidthMm: selectedAsset.targetHeightMm,
                    targetHeightMm: selectedAsset.targetWidthMm
                  })
                }
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center space-x-1"
                title="Rotate 90 degrees"
              >
                <RotateCw className="w-3 h-3" />
                <span>90° Rotate</span>
              </button>
            </div>

            {/* Copies on Sheet */}
            <div className="bg-[#0b0e1a] p-2 rounded border border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Copies on sheet:</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    onUpdateAsset(selectedAsset.id, {
                      copies: Math.max(1, (selectedAsset.copies || 1) - 1)
                    })
                  }
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                >
                  -
                </button>
                <span className="w-8 text-center font-mono font-bold text-indigo-400 text-xs">
                  {selectedAsset.copies}
                </span>
                <button
                  onClick={() =>
                    onUpdateAsset(selectedAsset.id, {
                      copies: (selectedAsset.copies || 1) + 1
                    })
                  }
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Preflight Inspector */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Print Preflight Audit
            </span>

            <div className="bg-[#0b0e1a] p-2.5 rounded border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Effective DPI:</span>
                <span
                  className={`font-bold px-1.5 py-0.2 rounded ${
                    selectedAsset.dpiStatus === 'green'
                      ? 'text-emerald-400 bg-emerald-950/60'
                      : selectedAsset.dpiStatus === 'amber'
                      ? 'text-amber-400 bg-amber-950/60'
                      : 'text-rose-400 bg-rose-950/60'
                  }`}
                >
                  {selectedAsset.effectiveDpi} DPI
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source Canvas:</span>
                <span className="text-slate-300">
                  {selectedAsset.originalWidth} × {selectedAsset.originalHeight} px
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transparency:</span>
                <span className="text-emerald-400">
                  {selectedAsset.hasAlpha ? 'Alpha Channel Active' : 'Opaque BG'}
                </span>
              </div>
              {selectedAsset.cropBox && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Empty Margin:</span>
                  <span className={selectedAsset.cropBox.emptyPercent > 15 ? 'text-amber-400' : 'text-slate-300'}>
                    {selectedAsset.cropBox.emptyPercent}% space
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Quick Preparation Actions
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onTrimAsset(selectedAsset.id)}
                className="p-2 rounded bg-[#161d31] hover:bg-[#1f2945] border border-slate-700 text-slate-200 text-left flex items-center space-x-1.5"
                title="Crop out empty transparent padding"
              >
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-Trim</span>
              </button>

              <button
                onClick={() => onRemoveBgAsset(selectedAsset.id)}
                className="p-2 rounded bg-[#161d31] hover:bg-[#1f2945] border border-slate-700 text-slate-200 text-left flex items-center space-x-1.5"
                title="Run background removal"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Remove BG</span>
              </button>

              <button
                onClick={() => onDespeckleAsset(selectedAsset.id)}
                className="p-2 rounded bg-[#161d31] hover:bg-[#1f2945] border border-slate-700 text-slate-200 text-left flex items-center space-x-1.5"
                title="Clean 1-2px stray rogue pixels"
              >
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                <span>Pixel Doctor</span>
              </button>

              <button
                onClick={() => onAddStrokeAsset(selectedAsset.id)}
                className="p-2 rounded bg-[#161d31] hover:bg-[#1f2945] border border-slate-700 text-slate-200 text-left flex items-center space-x-1.5"
                title="Add white underbase / contour stroke"
              >
                <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                <span>Underbase</span>
              </button>
            </div>

            <button
              onClick={() => onRevertAsset(selectedAsset.id)}
              className="w-full mt-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Revert to Original Upload</span>
            </button>
          </div>
        </div>
      ) : (
        /* ================= 2. SHEET-LEVEL PRODUCTION SETTINGS ================= */
        <div className="p-4 space-y-4">
          <div className="pb-3 border-b border-slate-800">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              Production Setup
            </span>
            <h3 className="font-bold text-xs text-white">
              DTF Film Roll & Nesting
            </h3>
          </div>

          {/* Unit Toggle [inch, mm, cm, meter] */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
              Measurement Units
            </label>
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#0b0e1a] rounded border border-slate-800 text-[11px] font-mono">
              {(['inch', 'mm', 'cm', 'meter'] as Unit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => onUnitChange(u)}
                  className={`py-1 rounded transition-all text-center ${
                    settings.unit === u
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Film Width Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-slate-400 block">
              Film Width Preset
            </label>
            <select
              value={settings.filmWidthPreset}
              onChange={(e) => handleWidthPreset(e.target.value)}
              className="w-full bg-[#0b0e1a] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-indigo-500"
            >
              {presets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {settings.filmWidthPreset === 'custom' && (
              <div className="mt-1">
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Custom Width ({settings.unit === 'inch' ? 'in' : settings.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.filmWidth}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      onUpdateSettings({
                        filmWidth: val,
                        filmWidthMm: unitToMm(val, settings.unit)
                      });
                    }
                  }}
                  className="w-full bg-[#0b0e1a] border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            )}
          </div>

          {/* Inter-Item Spacing & Outer Margins */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Spacing ({settings.unit === 'inch' ? 'in' : settings.unit})
              </label>
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
                className="w-full bg-[#0b0e1a] border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Margin ({settings.unit === 'inch' ? 'in' : settings.unit})
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={settings.margin}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) {
                    onUpdateSettings({
                      margin: val,
                      marginMm: unitToMm(val, settings.unit)
                    });
                  }
                }}
                className="w-full bg-[#0b0e1a] border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Length Mode (Auto vs Fixed) */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-slate-400 block">
              Sheet Length Mode
            </label>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#0b0e1a] rounded border border-slate-800 text-xs">
              <button
                onClick={() => onUpdateSettings({ lengthMode: 'auto' })}
                className={`py-1 rounded font-bold transition-all ${
                  settings.lengthMode === 'auto'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Auto Length
              </button>
              <button
                onClick={() => onUpdateSettings({ lengthMode: 'fixed' })}
                className={`py-1 rounded font-bold transition-all ${
                  settings.lengthMode === 'fixed'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fixed Length
              </button>
            </div>

            {settings.lengthMode === 'fixed' && (
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Fixed Length ({settings.unit === 'inch' ? 'in' : settings.unit})
                </label>
                <input
                  type="number"
                  step="1"
                  value={settings.fixedLength}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      onUpdateSettings({
                        fixedLength: val,
                        fixedLengthMm: unitToMm(val, settings.unit)
                      });
                    }
                  }}
                  className="w-full bg-[#0b0e1a] border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            )}
          </div>

          {/* Nesting Engine Algorithm */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Nesting Engine
            </span>

            <div className="space-y-1.5 text-xs">
              <div
                onClick={() => onUpdateSettings({ nestingAlgorithm: 'box' })}
                className="p-2 rounded border cursor-pointer flex items-center justify-between bg-indigo-950/60 border-indigo-500 text-white"
              >
                <div className="flex items-center space-x-2">
                  <Box className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-bold">MaxRects BSSF</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">Fast & Optimal</span>
              </div>
            </div>

            <label className="flex items-center space-x-2 text-xs text-slate-300 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowItemRotation}
                onChange={(e) => onUpdateSettings({ allowItemRotation: e.target.checked })}
                className="rounded accent-indigo-600"
              />
              <span>Allow 90° Item Rotation to save film</span>
            </label>
          </div>

          {/* Roll Preflight Summary */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Material Utilization
            </span>

            <div className="bg-[#0b0e1a] p-2.5 rounded border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Placed:</span>
                <span className="font-bold text-white">{layout.totalCopies} copies</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Roll Length:</span>
                <span className="font-bold text-indigo-400">
                  {formatUnit(mmToUnit(layout.usedLengthMm, settings.unit), settings.unit, 1)}{' '}
                  {settings.unit === 'inch' ? 'in' : settings.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Linear Meters:</span>
                <span className="text-slate-200">{layout.usedLengthMeters.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Film Waste:</span>
                <span className="font-bold text-emerald-400">{layout.wastePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Print Ready:</span>
                <span className="text-emerald-400">300 DPI RGBA</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

