import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  UploadCloud,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Edit3,
  Trash2,
  Download,
  Eye,
  Layers,
  Sparkles,
  Maximize2,
  FileImage
} from 'lucide-react';
import { ArtworkAsset } from '../types';

interface AssetGalleryViewProps {
  assets: ArtworkAsset[];
  onAddFiles: (files: FileList | File[]) => void;
  onUpdateAssetCopies: (id: string, copies: number) => void;
  onEditAsset: (asset: ArtworkAsset) => void;
  onDeleteAsset: (id: string) => void;
  onBackToStudio: () => void;
  onNotification: (msg: string) => void;
  onSetFileSheet?: (assetId: string) => void;
}

export const AssetGalleryView: React.FC<AssetGalleryViewProps> = ({
  assets,
  onAddFiles,
  onUpdateAssetCopies,
  onEditAsset,
  onDeleteAsset,
  onBackToStudio,
  onNotification,
  onSetFileSheet
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewAsset, setPreviewAsset] = useState<ArtworkAsset | null>(null);

  const filteredAssets = assets.filter((asset) => {
    return asset.filename.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalCopiesOnSheet = assets.reduce((sum, a) => sum + (a.copies || 0), 0);
  const highDpiCount = assets.filter((a) => (a.effectiveDpi || 300) >= 250).length;

  const handleDownloadAsset = (asset: ArtworkAsset) => {
    const a = document.createElement('a');
    a.href = asset.processedUrl || asset.originalUrl;
    a.download = asset.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onNotification(`Downloaded ${asset.filename}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] text-slate-800 overflow-hidden font-sans select-none">
      {/* Top Console Header */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onBackToStudio}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors border border-slate-200 shadow-2xs cursor-pointer"
          >
            <span>← Back to Gang Sheet</span>
          </button>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm text-slate-900 tracking-tight uppercase">
                  Asset Gallery & Media Library
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {assets.length} Artwork Assets
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                High-resolution vector & raster artwork catalog for DTF gang sheet production
              </div>
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onAddFiles(e.target.files);
              onNotification(`Uploaded ${e.target.files.length} design(s) to gallery`);
            }
          }}
          className="hidden"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Search & Upload Controls Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search designs by filename..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Center: Upload New Artwork Button (Image 3) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-full shadow-md shadow-indigo-600/30 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-white" />
              <span>Upload New Artwork</span>
            </button>
          </div>

          {/* Quick Stats Pill */}
          <div className="hidden lg:flex items-center space-x-3 text-xs font-bold text-slate-500">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{highDpiCount} Optimal DPI</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>{totalCopiesOnSheet} Total Placements</span>
            </span>
          </div>

        </div>

        {/* Artwork Grid */}
        {filteredAssets.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-12 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-inner">
              <FileImage className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              {searchQuery ? 'No matching designs found' : 'No designs in gallery yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No files matching "${searchQuery}". Try a different search query.`
                : 'Upload transparent PNGs or graphics to start organizing your DTF gang sheet assets.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 inline-flex items-center space-x-2 transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Browse Images to Upload</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {filteredAssets.map((asset) => {
              const isHighDpi = (asset.effectiveDpi || 300) >= 250;
              const isLowDpi = (asset.effectiveDpi || 300) < 150;

              return (
                <div
                  key={asset.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* Card Thumbnail Section */}
                  <div className="relative aspect-square w-full bg-slate-100 flex items-center justify-center p-4 overflow-hidden border-b border-slate-100">
                    {/* Checkerboard Backdrop */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `
                          linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
                          linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
                          linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
                        `,
                        backgroundSize: '12px 12px',
                        backgroundColor: '#ffffff'
                      }}
                    />

                    {/* Artwork Preview */}
                    <img
                      src={asset.processedUrl || asset.originalUrl}
                      alt={asset.filename}
                      className="relative z-10 max-h-full max-w-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
                    />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 z-20 flex items-center space-x-1.5">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shadow-2xs ${
                          isHighDpi
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isLowDpi
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {asset.effectiveDpi || 300} DPI
                      </span>
                    </div>

                    {/* Quick Preview Eye Button */}
                    <button
                      type="button"
                      onClick={() => setPreviewAsset(asset)}
                      className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-lg bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 flex items-center justify-center shadow-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Inspect full image"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card Details */}
                  <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <span
                          className="font-black text-xs text-slate-900 truncate flex-1 pr-2"
                          title={asset.filename}
                        >
                          {asset.filename}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                          {asset.fileType}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500 mt-1">
                        <span>{asset.targetWidth || 4}" × {asset.targetHeight || 4}"</span>
                        <span>•</span>
                        <span>{asset.originalWidth} × {asset.originalHeight} px</span>
                      </div>
                    </div>

                    {/* Copies Stepper & Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* Quantity Controller */}
                      <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => onUpdateAssetCopies(asset.id, Math.max(0, asset.copies - 1))}
                          className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                          title="Decrease copies"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="font-mono font-extrabold text-xs text-slate-800 w-6 text-center">
                          {asset.copies}
                        </span>

                        <button
                          type="button"
                          onClick={() => onUpdateAssetCopies(asset.id, asset.copies + 1)}
                          className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                          title="Add copy to gang sheet"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Tool Action Buttons: Edit, Download, Delete */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => onEditAsset(asset)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Edit in Image Tools Studio"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadAsset(asset)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Download original image"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove design"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Set File Sheet Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if ((asset.copies || 0) < 1) {
                          onUpdateAssetCopies(asset.id, 1);
                        }
                        if (onSetFileSheet) {
                          onSetFileSheet(asset.id);
                        } else {
                          onBackToStudio();
                        }
                      }}
                      className="w-full mt-2.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/90 hover:border-indigo-600 font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer group/btn"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-600 group-hover/btn:text-white" />
                      <span>Set File Sheet</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Quick Image Lightbox Inspector */}
      {previewAsset && (
        <div
          onClick={() => setPreviewAsset(null)}
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-6 select-none animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-black text-sm text-slate-900">{previewAsset.filename}</h4>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {previewAsset.originalWidth} × {previewAsset.originalHeight} px • {previewAsset.targetWidth}" × {previewAsset.targetHeight}"
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div
              className="w-full h-80 rounded-2xl border border-slate-200 flex items-center justify-center p-4 relative overflow-hidden"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                  linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                  linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)
                `,
                backgroundSize: '16px 16px',
                backgroundColor: '#ffffff'
              }}
            >
              <img
                src={previewAsset.processedUrl || previewAsset.originalUrl}
                alt={previewAsset.filename}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500">
                Copies on sheet: <span className="font-bold text-slate-900">{previewAsset.copies}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    onEditAsset(previewAsset);
                    setPreviewAsset(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Open in Image Editor</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

