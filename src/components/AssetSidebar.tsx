import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  FolderPlus,
  Plus,
  Minus,
  Trash2,
  Copy,
  Scissors,
  Sparkles,
  Lock,
  Unlock,
  RotateCw,
  Eye,
  EyeOff,
  Search,
  CheckSquare,
  Square,
  MoreVertical,
  Layers
} from 'lucide-react';
import { ArtworkAsset, Unit } from '../types';
import { formatUnit } from '../utils/units';

interface AssetSidebarProps {
  assets: ArtworkAsset[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  selectedAssetIds: string[];
  onToggleMultiSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  unit: Unit;
  mode: 'multiple' | 'repeat';
  onModeChange: (mode: 'multiple' | 'repeat') => void;
  onFilesSelected: (files: FileList | File[]) => void;
  onOpenGallery: () => void;
  onUpdateAsset: (id: string, updates: Partial<ArtworkAsset>) => void;
  onDeleteAsset: (id: string) => void;
  onDuplicateAsset: (id: string) => void;
  onTrimAsset: (id: string) => void;
  onRemoveBgAsset: (id: string) => void;
  onEditAsset: (asset: ArtworkAsset) => void;
  onBatchTrim: () => void;
  onBatchDelete: () => void;
}

export const AssetSidebar: React.FC<AssetSidebarProps> = ({
  assets,
  selectedAssetId,
  onSelectAsset,
  selectedAssetIds,
  onToggleMultiSelect,
  onSelectAll,
  unit,
  mode,
  onModeChange,
  onFilesSelected,
  onOpenGallery,
  onUpdateAsset,
  onDeleteAsset,
  onDuplicateAsset,
  onTrimAsset,
  onRemoveBgAsset,
  onEditAsset,
  onBatchTrim,
  onBatchDelete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const filteredAssets = assets.filter((a) =>
    a.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCopies = assets.reduce((sum, a) => sum + (a.copies || 1), 0);
  const allSelected = assets.length > 0 && selectedAssetIds.length === assets.length;

  return (
    <aside className="w-80 sm:w-84 md:w-90 bg-[#111625] border-r border-[#1e293b] flex flex-col h-full select-none flex-shrink-0 text-slate-300">
      {/* Top Header */}
      <div className="p-3 border-b border-[#1e293b]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-xs tracking-wider text-slate-100 uppercase">
              Artwork Queue
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {assets.length} designs • {totalCopies} copies
            </span>
          </div>

          {/* Mode Switch: Multiple / Repeat */}
          <div className="flex bg-[#0b0f19] p-0.5 rounded border border-slate-800 text-[10px] font-medium">
            <button
              onClick={() => onModeChange('multiple')}
              className={`px-2 py-0.5 rounded transition-all ${
                mode === 'multiple' ? 'bg-[#EF7F1A] text-[#204563] font-black' : 'text-slate-400 hover:text-white'
              }`}
              title="Pack multiple different designs on sheet"
            >
              Multi
            </button>
            <button
              onClick={() => onModeChange('repeat')}
              className={`px-2 py-0.5 rounded transition-all ${
                mode === 'repeat' ? 'bg-[#EF7F1A] text-[#204563] font-black' : 'text-slate-400 hover:text-white'
              }`}
              title="Repeat single design across sheet"
            >
              Repeat
            </button>
          </div>
        </div>

        {/* Compact Industrial Upload Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#EF7F1A] bg-[#204563]/30 text-[#EF7F1A]'
              : 'border-slate-700 hover:border-slate-500 bg-[#0d1220] hover:bg-[#13192c]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={mode === 'multiple'}
            accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onFilesSelected(e.target.files);
            }}
          />
          <div className="flex items-center justify-center space-x-2">
            <UploadCloud className="w-4 h-4 text-[#EF7F1A] flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-200">
              Drop artwork or click to upload
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            PNG (transparent) • JPG (auto BG-cut)
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-2.5 flex items-center space-x-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search designs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1220] border border-slate-800 rounded px-2.5 py-1 pl-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#EF7F1A]"
            />
          </div>

          <button
            onClick={onOpenGallery}
            className="px-2 py-1 bg-[#1a2138] hover:bg-[#222b48] border border-slate-700 text-slate-300 text-xs rounded transition-colors flex items-center space-x-1"
            title="Load Reference Samples"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Demo</span>
          </button>
        </div>

        {/* Batch selection and action bar */}
        {assets.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <button
              onClick={() => onSelectAll(!allSelected)}
              className="flex items-center space-x-1 hover:text-white transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#EF7F1A]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Select All</span>
            </button>

            {selectedAssetIds.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onBatchTrim}
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                  title="Trim all selected"
                >
                  Trim Selected
                </button>
                <button
                  onClick={onBatchDelete}
                  className="text-rose-400 hover:text-rose-300 font-medium transition-colors"
                  title="Delete selected"
                >
                  Delete ({selectedAssetIds.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Asset List Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredAssets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {searchQuery ? 'No designs match your search.' : 'No designs uploaded yet.'}
          </div>
        ) : (
          filteredAssets.map((asset, index) => {
            const isSelected = selectedAssetId === asset.id;
            const isMultiSelected = selectedAssetIds.includes(asset.id);
            const isVisible = asset.visible !== false;

            const dpiColor =
              asset.dpiStatus === 'green'
                ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50'
                : asset.dpiStatus === 'amber'
                ? 'text-amber-400 bg-amber-950/50 border-amber-800/50'
                : 'text-rose-400 bg-rose-950/50 border-rose-800/50';

            return (
              <div
                key={asset.id}
                onClick={() => onSelectAsset(asset.id)}
                className={`p-2.5 rounded-lg border transition-all text-xs cursor-pointer relative group ${
                  isSelected
                    ? 'bg-[#132537] border-[#EF7F1A] shadow-sm ring-1 ring-[#EF7F1A]/30 text-white'
                    : isMultiSelected
                    ? 'bg-[#0f1d2c] border-[#204563] text-slate-200'
                    : 'bg-[#0f1424] hover:bg-[#141b30] border-slate-800 text-slate-300'
                } ${!isVisible ? 'opacity-40' : ''}`}
              >
                {/* Top Row: Checkbox, Index, Thumbnail, Filename, Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2 min-w-0">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMultiSelect(asset.id);
                      }}
                      className="mt-0.5 text-slate-500 hover:text-[#EF7F1A]"
                    >
                      {isMultiSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#EF7F1A]" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Industrial Checkerboard Thumbnail */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAsset(asset);
                      }}
                      className="w-10 h-10 rounded border border-slate-700 overflow-hidden relative flex-shrink-0"
                      style={{
                        backgroundImage: `
                          linear-gradient(45deg, #1e293b 25%, transparent 25%),
                          linear-gradient(-45deg, #1e293b 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #1e293b 75%),
                          linear-gradient(-45deg, transparent 75%, #1e293b 75%)
                        `,
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                        backgroundColor: '#0f172a'
                      }}
                      title="Click to open image editor"
                    >
                      <img
                        src={asset.processedUrl || asset.originalUrl}
                        alt={asset.filename}
                        className="w-full h-full object-contain p-0.5"
                      />
                    </div>

                    {/* Metadata & Title */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs truncate max-w-[130px] text-slate-100">
                          {asset.filename}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {asset.originalWidth} × {asset.originalHeight} px • {asset.fileType.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Top Right Badges */}
                  <div className="flex items-center space-x-1">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${dpiColor}`}
                    >
                      {asset.effectiveDpi} DPI
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateAsset(asset.id, { visible: !isVisible });
                      }}
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                      title={isVisible ? 'Hide from sheet' : 'Show on sheet'}
                    >
                      {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-500" />}
                    </button>
                  </div>
                </div>

                {/* Sizing & Copies Row */}
                <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                  {/* Width & Height */}
                  <div className="flex items-center space-x-1 bg-[#0b0e1a] px-1.5 py-1 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-mono">W:</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {formatUnit(asset.targetWidth, unit)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">×</span>
                    <span className="text-[10px] text-slate-500 font-mono">H:</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {formatUnit(asset.targetHeight, unit)}
                    </span>
                  </div>

                  {/* Copies Stepper */}
                  <div className="flex items-center justify-between bg-[#0b0e1a] px-1.5 py-1 rounded border border-slate-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = Math.max(1, (asset.copies || 1) - 1);
                        onUpdateAsset(asset.id, { copies: next });
                      }}
                      disabled={asset.copies <= 1}
                      className="text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-xs text-[#EF7F1A]">
                      {asset.copies} {asset.copies === 1 ? 'copy' : 'copies'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateAsset(asset.id, { copies: (asset.copies || 1) + 1 });
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Quick Trim Margin Banner if Detected */}
                {asset.cropBox && asset.cropBox.emptyPercent >= 15 && !asset.isTrimmed && (
                  <div className="mt-2 bg-amber-950/40 border border-amber-800/60 rounded px-2 py-1 flex items-center justify-between text-[10px] text-amber-300">
                    <span className="flex items-center space-x-1 truncate">
                      <Scissors className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{asset.cropBox.emptyPercent}% empty space</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrimAsset(asset.id);
                      }}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-2 py-0.5 rounded text-[10px] transition-colors"
                    >
                      Trim
                    </button>
                  </div>
                )}

                {/* Auto BG Removal Notification if Opaque */}
                {!asset.hasAlpha && !asset.isBgRemoved && (
                  <div className="mt-2 bg-[#132537] border border-[#204563] rounded px-2 py-1 flex items-center justify-between text-[10px] text-slate-200">
                    <span className="flex items-center space-x-1 truncate">
                      <Sparkles className="w-3 h-3 flex-shrink-0 text-[#EF7F1A]" />
                      <span className="truncate">Opaque background</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveBgAsset(asset.id);
                      }}
                      className="bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] font-black px-2 py-0.5 rounded text-[10px] transition-colors"
                    >
                      Cut BG
                    </button>
                  </div>
                )}

                {/* Hover Quick Actions Bar */}
                <div className="mt-2 pt-1 flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateAsset(asset.id);
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Duplicate design entry"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Rotate 90
                      onUpdateAsset(asset.id, {
                        targetWidth: asset.targetHeight,
                        targetHeight: asset.targetWidth,
                        targetWidthMm: asset.targetHeightMm,
                        targetHeightMm: asset.targetWidthMm
                      });
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAsset(asset.id);
                    }}
                    className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Delete design"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

