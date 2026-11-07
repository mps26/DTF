import React from 'react';
import {
  Lock,
  Unlock,
  Minus,
  Plus,
  Edit2,
  Trash2,
  RotateCw,
  Scissors,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { ArtworkAsset, Unit } from '../types';
import { formatUnit } from '../utils/units';

interface ArtworkCardProps {
  asset: ArtworkAsset;
  index: number;
  unit: Unit;
  onUpdate: (id: string, updates: Partial<ArtworkAsset>) => void;
  onDelete: (id: string) => void;
  onEdit: (asset: ArtworkAsset) => void;
  onTrim: (id: string) => void;
  onRemoveBg: (id: string) => void;
}

export const ArtworkCard: React.FC<ArtworkCardProps> = ({
  asset,
  index,
  unit,
  onUpdate,
  onDelete,
  onEdit,
  onTrim,
  onRemoveBg
}) => {
  const handleWidthChange = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;
    onUpdate(asset.id, { targetWidth: val });
  };

  const handleHeightChange = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;
    onUpdate(asset.id, { targetHeight: val });
  };

  const handleCopiesChange = (delta: number) => {
    const newCopies = Math.max(1, (asset.copies || 1) + delta);
    onUpdate(asset.id, { copies: newCopies });
  };

  const handleToggleAspect = () => {
    onUpdate(asset.id, { aspectLocked: !asset.aspectLocked });
  };

  const handleToggleRotation = () => {
    // Swap width and height
    const w = asset.targetWidth;
    const h = asset.targetHeight;
    onUpdate(asset.id, {
      targetWidth: h,
      targetHeight: w,
      targetWidthMm: asset.targetHeightMm,
      targetHeightMm: asset.targetWidthMm
    });
  };

  // DPI badge color styling
  const dpiBg =
    asset.dpiStatus === 'green'
      ? 'bg-emerald-500 text-white'
      : asset.dpiStatus === 'amber'
      ? 'bg-amber-500 text-white'
      : 'bg-rose-500 text-white';

  return (
    <div className="bg-white rounded-3xl border border-indigo-100 shadow-md shadow-indigo-900/5 p-4 sm:p-5 transition-all hover:shadow-lg hover:border-indigo-200 relative group flex flex-col justify-between">
      {/* Top Header: Thumbnail, Filename, DPI Badge, Red Counter */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Checkerboard preview container */}
            <div
              onClick={() => onEdit(asset)}
              className="w-14 h-14 rounded-2xl border border-slate-200 overflow-hidden relative cursor-pointer group/thumb flex-shrink-0 shadow-inner"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                  linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                  linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)
                `,
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px'
              }}
            >
              <img
                src={asset.processedUrl || asset.originalUrl}
                alt={asset.filename}
                className="w-full h-full object-contain p-1 group-hover/thumb:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                <Edit2 className="w-4 h-4 text-indigo-700 drop-shadow" />
              </div>
            </div>

            {/* Filename & Details */}
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-900 truncate max-w-[140px] sm:max-w-[180px]">
                  {asset.filename}
                </h3>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs ${dpiBg}`}>
                  {asset.effectiveDpi} DPI
                </span>
                {asset.isBgRemoved && (
                  <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                    BG Removed
                  </span>
                )}
                {asset.isTrimmed && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Trimmed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Red index badge matching Screenshot 2 */}
          <div className="w-6 h-6 rounded-full bg-rose-500 text-white font-bold text-xs flex items-center justify-center shadow-xs flex-shrink-0">
            {index + 1}
          </div>
        </div>

        {/* Dimension Inputs */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          {/* Target Width */}
          <div>
            <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
              Width
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={formatUnit(asset.targetWidth, unit)}
                onChange={(e) => handleWidthChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <span className="absolute right-2 text-[10px] font-medium text-slate-400 pointer-events-none">
                {unit === 'inch' ? 'inches' : unit}
              </span>
            </div>
          </div>

          {/* Target Height */}
          <div>
            <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
              Height
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={formatUnit(asset.targetHeight, unit)}
                onChange={(e) => handleHeightChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <span className="absolute right-2 text-[10px] font-medium text-slate-400 pointer-events-none">
                {unit === 'inch' ? 'inches' : unit}
              </span>
            </div>
          </div>
        </div>

        {/* Original Resolution Note */}
        <div className="text-[10px] font-medium text-slate-400 mb-3">
          Original: {asset.originalWidth} × {asset.originalHeight} px
        </div>

        {/* Lock Aspect Ratio Pill Switch */}
        <div className="flex items-center justify-between py-1 mb-3">
          <label
            onClick={handleToggleAspect}
            className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-slate-600 select-none"
          >
            <div
              className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ${
                asset.aspectLocked ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  asset.aspectLocked ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="flex items-center space-x-1">
              {asset.aspectLocked ? (
                <Lock className="w-3 h-3 text-indigo-600" />
              ) : (
                <Unlock className="w-3 h-3 text-slate-400" />
              )}
              <span className="text-xs font-semibold">Lock Aspect Ratio</span>
            </span>
          </label>

          <button
            onClick={handleToggleRotation}
            title="Rotate 90° (Swap Width & Height)"
            className="text-slate-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Amber Banner if Empty Space Detected (Direct match for Screenshot 2!) */}
        {asset.cropBox && asset.cropBox.emptyPercent >= 15 && !asset.isTrimmed && (
          <div className="mb-3 bg-amber-50/90 border border-amber-200/80 rounded-2xl p-2.5 flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
            <div className="flex items-center space-x-1.5 font-medium truncate">
              <Scissors className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="truncate">
                {asset.cropBox.emptyPercent}% of this is empty space
              </span>
            </div>
            <button
              onClick={() => onTrim(asset.id)}
              className="ml-2 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] shadow-xs flex-shrink-0 transition-colors"
            >
              Trim it
            </button>
          </div>
        )}

        {/* Background removal prompt if opaque PNG / JPG */}
        {!asset.hasAlpha && !asset.isBgRemoved && (
          <div className="mb-3 bg-purple-50 border border-purple-200 rounded-2xl p-2.5 flex items-center justify-between text-xs text-purple-900">
            <div className="flex items-center space-x-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Opaque background detected</span>
            </div>
            <button
              onClick={() => onRemoveBg(asset.id)}
              className="ml-2 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] shadow-xs flex-shrink-0 transition-colors"
            >
              Remove BG
            </button>
          </div>
        )}

        {/* DPI Warning if low resolution */}
        {asset.dpiStatus === 'red' && (
          <div className="mb-3 bg-rose-50 border border-rose-200 rounded-xl p-2 flex items-center space-x-1.5 text-[11px] text-rose-700">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span>Low print resolution (&lt;150 DPI). May appear pixelated.</span>
          </div>
        )}
      </div>

      {/* Bottom Section: Copies on sheet stepper, Edit, Delete */}
      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 flex items-center space-x-1">
            <span className="text-slate-400">Copies on sheet</span>
          </span>

          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
            <button
              onClick={() => handleCopiesChange(-1)}
              disabled={asset.copies <= 1}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-40 transition-all"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center text-xs font-extrabold text-slate-800">
              {asset.copies}
            </span>
            <button
              onClick={() => handleCopiesChange(1)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(asset)}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => onDelete(asset.id)}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
            title="Delete design"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

