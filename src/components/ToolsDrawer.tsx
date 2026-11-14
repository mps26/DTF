import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  Activity,
  CheckCircle2,
  Pipette,
  Crop,
  Eraser,
  SquareDashedBottom,
  Wand2,
  Layers,
  CircleDot,
  PenTool,
  Type,
  Maximize2,
  Cpu,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import { ArtworkAsset } from '../types';

interface ToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: ArtworkAsset | null;
  onOpenEditModal: (asset: ArtworkAsset) => void;
  onOpenPreflight: () => void;
  onOpenGuide: () => void;
  onApplyToolAction: (toolId: string) => void;
}

export const ToolsDrawer: React.FC<ToolsDrawerProps> = ({
  isOpen,
  onClose,
  selectedAsset,
  onOpenEditModal,
  onOpenPreflight,
  onOpenGuide,
  onApplyToolAction
}) => {
  if (!isOpen) return null;

  const [activeCategory, setActiveCategory] = useState<'all' | 'fix' | 'cut' | 'style' | 'create'>('all');

  const categories = [
    { id: 'all', label: 'All Tools' },
    { id: 'fix', label: 'Fix & Quality' },
    { id: 'cut', label: 'Cut & Adjust' },
    { id: 'style', label: 'Style & Effects' },
    { id: 'create', label: 'Create & Convert' }
  ];

  const tools = [
    // Category 1: FIX & QUALITY
    {
      id: 'upscale',
      cat: 'fix',
      name: 'Image Upscaler',
      desc: 'AI Super-resolution 2x/4x for low DPI raster designs',
      badge: 'AI TOOL',
      badgeColor: 'bg-[#EF7F1A]/20 text-[#EF7F1A] border-[#EF7F1A]/40',
      icon: Maximize2,
      action: () => onApplyToolAction('upscale')
    },
    {
      id: 'color-tone',
      cat: 'fix',
      name: 'Color & Tone Levels',
      desc: 'Brightness, contrast, saturation & white-point calibration',
      badge: 'PRO',
      badgeColor: 'bg-amber-900/60 text-amber-300 border-amber-700',
      icon: Sliders,
      action: () => onApplyToolAction('color-tone')
    },
    {
      id: 'pixel-doctor',
      cat: 'fix',
      name: 'Pixel Doctor',
      desc: 'Despeckle & erase stray isolated 1-2px noise pixels',
      badge: 'CLEANUP',
      badgeColor: 'bg-teal-900/60 text-teal-300 border-teal-700',
      icon: Activity,
      action: () => onApplyToolAction('pixel-doctor')
    },
    {
      id: 'print-check',
      cat: 'fix',
      name: 'Print Check Audit',
      desc: 'Verify resolution, bounds, transparency & RIP readiness',
      badge: 'AUDIT',
      badgeColor: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
      icon: CheckCircle2,
      action: () => onOpenPreflight()
    },

    // Category 2: CUT & ADJUST
    {
      id: 'remove-color',
      cat: 'cut',
      name: 'Remove / Replace Color',
      desc: 'Perimeter flood-fill and chroma key knockout',
      badge: 'CORE',
      badgeColor: 'bg-[#204563]/60 text-white border-[#204563]',
      icon: Pipette,
      action: () => onApplyToolAction('remove-color')
    },
    {
      id: 'crop-clean',
      cat: 'cut',
      name: 'Crop & Auto-Trim',
      desc: 'Snap bounding box to visible alpha artwork with 2px padding',
      badge: 'AUTO',
      badgeColor: 'bg-sky-900/60 text-sky-300 border-sky-700',
      icon: Crop,
      action: () => onApplyToolAction('crop-clean')
    },
    {
      id: 'eraser',
      cat: 'cut',
      name: 'Precision Eraser',
      desc: 'Rub out unwanted customer signatures or backgrounds',
      badge: 'MANUAL',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      icon: Eraser,
      action: () => onApplyToolAction('eraser')
    },
    {
      id: 'border-knockout',
      cat: 'cut',
      name: 'Border Knockout',
      desc: 'Punch out rectangular frames and background banners',
      badge: 'VECTOR',
      badgeColor: 'bg-rose-900/60 text-rose-300 border-rose-700',
      icon: SquareDashedBottom,
      action: () => onApplyToolAction('border-knockout')
    },

    // Category 3: STYLE & EFFECTS
    {
      id: 'texture',
      cat: 'style',
      name: 'Texture Effects',
      desc: '11 creative color and texture filters with live intensity',
      badge: '11',
      badgeColor: 'bg-[#EF7F1A]/20 text-[#EF7F1A] border-[#EF7F1A]/40',
      icon: Layers,
      action: () => onApplyToolAction('texture')
    },
    {
      id: 'halftone',
      cat: 'style',
      name: 'DTF Halftone Screen',
      desc: 'Simulate screen-print dot matrix for breathable soft prints',
      badge: 'NEW',
      badgeColor: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
      icon: CircleDot,
      action: () => onApplyToolAction('halftone')
    },
    {
      id: 'stroke-outline',
      cat: 'style',
      name: 'Stroke / White Underbase',
      desc: 'Generate white backing contour for dark fabric adhesion',
      badge: 'ESSENTIAL',
      badgeColor: 'bg-cyan-900/60 text-cyan-300 border-cyan-700',
      icon: PenTool,
      action: () => onApplyToolAction('stroke-outline')
    },

    // Category 4: CREATE & CONVERT
    {
      id: 'text-number',
      cat: 'create',
      name: 'Text & Jersey Numbers',
      desc: 'Team player names, varsity fonts, and number stencils',
      badge: 'VECTOR',
      badgeColor: 'bg-blue-900/60 text-blue-300 border-blue-700',
      icon: Type,
      action: () => onApplyToolAction('text-number')
    },
    {
      id: 'vectorize',
      cat: 'create',
      name: 'Image Vectoriser',
      desc: 'Trace raster artwork to clean SVG and cut contour paths',
      badge: 'AI TOOL',
      badgeColor: 'bg-[#EF7F1A]/20 text-[#EF7F1A] border-[#EF7F1A]/40',
      icon: Sparkles,
      action: () => onApplyToolAction('vectorize')
    },
    {
      id: 'recreate-ai',
      cat: 'create',
      name: 'Recreate with AI',
      desc: 'Re-render degraded logos into clean print-ready graphics',
      badge: 'AI TOOL',
      badgeColor: 'bg-pink-900/60 text-pink-300 border-pink-700',
      icon: Cpu,
      action: () => onApplyToolAction('recreate-ai')
    },
    {
      id: 'guide',
      cat: 'create',
      name: 'Production Guide',
      desc: 'RIP software settings, wash tests, and DTF press instructions',
      badge: 'DOCS',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      icon: BookOpen,
      action: () => onOpenGuide()
    }
  ];

  const filteredTools =
    activeCategory === 'all' ? tools : tools.filter((t) => t.cat === activeCategory);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-[#0c101c] border-l border-[#1e293b] shadow-2xl flex flex-col select-none text-slate-300 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-white flex items-center space-x-1.5">
            <span>Studio AI & Prep Tool Library</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {selectedAsset ? `Target: ${selectedAsset.filename}` : 'Select an artwork on canvas to apply tools'}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="p-2 border-b border-[#1e293b] flex items-center space-x-1 overflow-x-auto text-xs font-medium">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id as any)}
            className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-all ${
              activeCategory === c.id
                ? 'bg-[#EF7F1A] text-[#204563] font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTools.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              onClick={() => {
                t.action();
              }}
              className="p-3 rounded-lg bg-[#111728] hover:bg-[#182038] border border-slate-800/80 hover:border-[#EF7F1A]/60 transition-all cursor-pointer group flex items-start justify-between"
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#1b233a] border border-slate-700/80 text-[#EF7F1A] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-white group-hover:text-[#EF7F1A] transition-colors">
                      {t.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded border ${t.badgeColor}`}
                    >
                      {t.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {t.desc}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white flex-shrink-0 mt-1 transition-colors" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

