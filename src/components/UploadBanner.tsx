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
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#204563]">
          Create Your <span className="text-[#EF7F1A]">Gang Sheet</span>
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-[#526A7B] max-w-xl mx-auto">
          Upload your designs and generate optimized layouts for DTF printing
        </p>
      </div>

      {/* Mode Switcher Pill */}
      <div className="inline-flex p-1 bg-white rounded-full shadow-sm border border-[#E5D9C8] mb-6">
        <button
          onClick={() => onModeChange('multiple')}
          className={`flex items-center space-x-2 px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
            mode === 'multiple'
              ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-sm'
              : 'text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Multiple designs</span>
        </button>

        <button
          onClick={() => onModeChange('repeat')}
          className={`flex items-center space-x-2 px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
            mode === 'repeat'
              ? 'bg-[#EF7F1A] text-[#204563] font-black shadow-sm'
              : 'text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1]'
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
        className="w-full max-w-3xl bg-white hover:bg-[#FAF7F1]/30 border-2 border-[#E5D9C8] hover:border-[#EF7F1A] rounded-3xl p-4 sm:p-5 shadow-xl shadow-[#204563]/5 transition-all cursor-pointer group flex flex-col sm:flex-row items-center justify-between gap-4"
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
          <div className="w-12 h-12 rounded-2xl bg-[#FAF7F1] group-hover:bg-[#EF7F1A]/10 text-[#EF7F1A] flex items-center justify-center transition-colors shadow-inner flex-shrink-0 border border-[#E5D9C8]/60">
            <UploadCloud className="w-6 h-6 transform group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <div>
            <div className="font-bold text-[#204563] text-base group-hover:text-[#EF7F1A] transition-colors">
              Drop images here or click to browse
            </div>
            <div className="text-xs text-[#526A7B] mt-0.5 font-medium">
              PNG, JPG, JPEG • Auto background removal & crop • Max 100 MB each
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center space-x-2.5 flex-shrink-0 w-full sm:w-auto justify-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onOpenGallery}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-[#204563] bg-[#FAF7F1] hover:bg-[#F3EBDD] border border-[#E5D9C8] transition-all shadow-sm"
          >
            <FolderPlus className="w-4 h-4 text-[#526A7B]" />
            <span>Add from Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl text-xs font-black text-[#204563] bg-[#EF7F1A] hover:bg-[#d97014] transition-all shadow-md shadow-[#EF7F1A]/20"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Browse Files</span>
          </button>
        </div>
      </div>

      {/* Upload Counter */}
      <div className="mt-3 flex items-center space-x-2 text-xs font-bold text-[#204563] bg-[#FAF7F1] border border-[#E5D9C8] px-3.5 py-1 rounded-full shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-[#EF7F1A] animate-pulse"></span>
        <span>{uploadedCount} / {maxCount} images uploaded</span>
      </div>
    </div>
  );
};

