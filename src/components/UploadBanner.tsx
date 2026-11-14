import React, { useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Copy, Layers, FolderPlus } from 'lucide-react';

interface UploadBannerProps {
  mode: 'multiple' | 'repeat';
  onModeChange: (mode: 'multiple' | 'repeat') => void;
  uploadedCount: number;
  maxCount?: number;
  onFilesSelected: (files: FileList | File[]) => void;
  onOpenGallery: () => void;
}

export const UploadBanner: React.FC<UploadBannerProps> = ({
  mode,
  onModeChange,
  uploadedCount,
  maxCount = 120,
  onFilesSelected,
  onOpenGallery
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-6 px-4">
      {/* Title & Subtitle */}
      <div className="text-center mb-5">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
          Create Your <span className="text-indigo-600">Gang Sheet</span>
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
          Upload your designs and generate optimized layouts for DTF printing
        </p>
      </div>

      {/* Mode Switcher Pill */}
      <div className="inline-flex p-1 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-indigo-100 mb-6">
        <button
          onClick={() => onModeChange('multiple')}
          className={`flex items-center space-x-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            mode === 'multiple'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Multiple designs</span>
        </button>

        <button
          onClick={() => onModeChange('repeat')}
          className={`flex items-center space-x-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            mode === 'repeat'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Copy className="w-4 h-4" />
          <span>Repeat one design</span>
        </button>
      </div>

      {/* Main Upload Dropzone Pill */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="w-full max-w-3xl bg-white/95 backdrop-blur-md hover:bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-3xl p-4 sm:p-5 shadow-xl shadow-indigo-900/5 transition-all cursor-pointer group flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={mode === 'multiple'}
          accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Left: Icon & Description */}
        <div className="flex items-center space-x-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors shadow-inner flex-shrink-0">
            <UploadCloud className="w-6 h-6 transform group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-base group-hover:text-indigo-600 transition-colors">
              Drop images here or click to browse
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">
              PNG, JPG, JPEG • Auto background removal & crop • Max 100 MB each
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center space-x-2.5 flex-shrink-0 w-full sm:w-auto justify-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onOpenGallery}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all shadow-sm"
          >
            <FolderPlus className="w-4 h-4 text-slate-500" />
            <span>Add from Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/30"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Browse Files</span>
          </button>
        </div>
      </div>

      {/* Upload Counter */}
      <div className="mt-3 flex items-center space-x-2 text-xs font-semibold text-indigo-600/90 bg-indigo-50/70 border border-indigo-100 px-3.5 py-1 rounded-full">
        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
        <span>{uploadedCount} / {maxCount} images uploaded</span>
      </div>
    </div>
  );
};

