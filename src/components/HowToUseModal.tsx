import React from 'react';
import { X, CheckCircle2, AlertCircle, Layers, Scissors, FileImage, ShieldCheck } from 'lucide-react';

interface HowToUseModalProps {
  onClose: () => void;
}

export const HowToUseModal: React.FC<HowToUseModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl border border-[#E5D9C8] shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5D9C8] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#EF7F1A]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#204563]">
                DTF Gang Sheet Production Guide
              </h3>
              <p className="text-xs text-[#526A7B]">
                Professional direct-to-film print preparation workflow & RIP rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#526A7B] hover:text-[#204563] hover:bg-[#FAF7F1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#526A7B] leading-relaxed">
          {/* Step 1 */}
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-[#204563] text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
              1
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#204563] mb-1">
                Upload & Format Inspection
              </h4>
              <p>
                Upload PNG, JPG, or JPEG images. Transparent PNG files preserve existing alpha channels without unnecessary re-rasterization. For JPGs or opaque files, the automatic edge flood removal strips white/colored backgrounds while protecting internal white letters.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-[#204563] text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
              2
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#204563] mb-1">
                Alpha Margin Auto-Trim
              </h4>
              <p>
                Artwork often has large transparent empty borders that falsely consume film roll width. When the system detects over 15% empty canvas, an amber alert banner highlights the opportunity: click <strong>Trim it</strong> to snap the bounding box to genuine visible artwork with 2px safety padding.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-[#204563] text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
              3
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#204563] mb-1">
                Dimensions & DPI Preflight
              </h4>
              <p>
                Enter physical print width and height. With <strong>Lock Aspect Ratio</strong> enabled, dimensions stay proportional. Check the DPI badge:
              </p>
              <ul className="mt-1.5 space-y-1 list-disc list-inside">
                <li><strong className="text-emerald-700">Green (≥ 300 DPI):</strong> Optimal sharp print quality.</li>
                <li><strong className="text-amber-700">Amber (150–299 DPI):</strong> Acceptable for large apparel graphics.</li>
                <li><strong className="text-rose-700">Red (&lt; 150 DPI):</strong> Pixelation warning. Upscaling recommended.</li>
              </ul>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-[#204563] text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
              4
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#204563] mb-1">
                MaxRects Packing & Minimal Film Waste
              </h4>
              <p>
                Set your film width (e.g. 11.5", 13", 22", 24", 60") and spacing (default 0.3"). The <strong>MaxRects BSSF</strong> nesting algorithm packs all virtual copy instances, testing 90° rotations to calculate the shortest possible roll length and minimize film waste.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-[#204563] text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">
              5
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#204563] mb-1">
                Print-Ready 300 DPI Export
              </h4>
              <p>
                Click <strong>Download → Print-Ready PNG</strong> to generate an exact high-resolution transparent RGBA PNG canvas. Width equals <code className="bg-[#FAF7F1] border border-[#E5D9C8] px-1 py-0.5 rounded text-[#204563]">WidthInches × 300 px</code>, and height equals <code className="bg-[#FAF7F1] border border-[#E5D9C8] px-1 py-0.5 rounded text-[#204563]">LengthInches × 300 px</code>, ready to feed into AcroRIP, CADlink, Digital Factory, or Wasatch RIP software.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5D9C8] bg-[#FAF7F1] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] font-black text-xs shadow-md shadow-[#EF7F1A]/20"
          >
            Got it, Let's Print!
          </button>
        </div>
      </div>
    </div>
  );
};

