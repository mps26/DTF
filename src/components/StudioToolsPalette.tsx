import React from 'react';
import {
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
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface StudioToolsPaletteProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectTool: (toolId: string) => void;
}

export const StudioToolsPalette: React.FC<StudioToolsPaletteProps> = ({
  isOpen,
  onToggle,
  onSelectTool
}) => {
  return (
    <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl border border-indigo-100/90 shadow-md p-4 sm:p-5 mb-5 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
              <span>Studio AI & Prep Tools</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Professional image preparation for DTF printing
            </p>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-indigo-50"
        >
          <span>{isOpen ? 'Hide Tool Palette' : 'Show Tool Palette'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 4 Tool Category Panels (Image 2) */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          {/* Category 1: FIX & QUALITY */}
          <div className="bg-[#fbfcff] rounded-2xl border border-indigo-100/70 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 mb-2.5 text-indigo-600">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-extrabold text-[11px] tracking-wider uppercase text-indigo-700">
                Fix & Quality
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectTool('upscale')}
                className="p-2.5 rounded-xl bg-white hover:bg-indigo-50/50 border border-indigo-100/80 hover:border-indigo-300 text-left transition-all hover:scale-[1.02] shadow-2xs group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Maximize2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-[9px] font-black uppercase tracking-wider bg-purple-600 text-white px-1.5 py-0.2 rounded-full">
                    AI TOOL
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600">Image Upscaler</div>
                <div className="text-[10px] text-slate-400 truncate">Sharpen & enlarge</div>
              </button>

              <button
                onClick={() => onSelectTool('color-tone')}
                className="p-2.5 rounded-xl bg-white hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Sliders className="w-4 h-4 text-amber-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-amber-600">Color & Tone</div>
                <div className="text-[10px] text-slate-400 truncate">Levels & colour</div>
              </button>

              <button
                onClick={() => onSelectTool('pixel-doctor')}
                className="p-2.5 rounded-xl bg-white hover:bg-teal-50/50 border border-slate-200/80 hover:border-teal-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Activity className="w-4 h-4 text-teal-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-teal-600">Pixel Doctor</div>
                <div className="text-[10px] text-slate-400 truncate">Fix stray pixels</div>
              </button>

              <button
                onClick={() => onSelectTool('print-check')}
                className="p-2.5 rounded-xl bg-white hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-600">Print Check</div>
                <div className="text-[10px] text-slate-400 truncate">Pre-print audit</div>
              </button>
            </div>
          </div>

          {/* Category 2: CUT & ADJUST */}
          <div className="bg-[#fbfcff] rounded-2xl border border-blue-100/70 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 mb-2.5 text-blue-600">
              <Crop className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-extrabold text-[11px] tracking-wider uppercase text-blue-700">
                Cut & Adjust
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectTool('remove-color')}
                className="p-2.5 rounded-xl bg-white hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Pipette className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 leading-tight">
                  Remove/Replace Color
                </div>
                <div className="text-[10px] text-slate-400 truncate">Pick & swap</div>
              </button>

              <button
                onClick={() => onSelectTool('crop-clean')}
                className="p-2.5 rounded-xl bg-white hover:bg-sky-50/50 border border-slate-200/80 hover:border-sky-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Crop className="w-4 h-4 text-sky-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-sky-600">Crop & Clean</div>
                <div className="text-[10px] text-slate-400 truncate">Trim • Flip • Rotate</div>
              </button>

              <button
                onClick={() => onSelectTool('eraser')}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Eraser className="w-4 h-4 text-slate-600" />
                </div>
                <div className="font-bold text-xs text-slate-900">Eraser</div>
                <div className="text-[10px] text-slate-400 truncate">Rub out areas</div>
              </button>

              <button
                onClick={() => onSelectTool('border-knockout')}
                className="p-2.5 rounded-xl bg-white hover:bg-rose-50/50 border border-slate-200/80 hover:border-rose-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <SquareDashedBottom className="w-4 h-4 text-rose-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-rose-600">Border Knockout</div>
                <div className="text-[10px] text-slate-400 truncate">Punch-out frames</div>
              </button>
            </div>
          </div>

          {/* Category 3: STYLE & EFFECTS */}
          <div className="bg-[#fbfcff] rounded-2xl border border-pink-100/70 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 mb-2.5 text-pink-600">
              <Wand2 className="w-3.5 h-3.5 text-pink-500" />
              <span className="font-extrabold text-[11px] tracking-wider uppercase text-pink-700">
                Style & Effects
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectTool('texture')}
                className="p-2.5 rounded-xl bg-white hover:bg-purple-50/50 border border-slate-200/80 hover:border-purple-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span className="text-[9px] font-black uppercase tracking-wider bg-purple-600 text-white px-1.5 py-0.2 rounded-full">
                    11
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-purple-600">Texture Effects</div>
                <div className="text-[10px] text-slate-400 truncate">11 creative filters</div>
              </button>

              <button
                onClick={() => onSelectTool('halftone')}
                className="p-2.5 rounded-xl bg-white hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <CircleDot className="w-4 h-4 text-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.2 rounded-full">
                    NEW
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-600">Halftone</div>
                <div className="text-[10px] text-slate-400 truncate">Dot screen</div>
              </button>

              <button
                onClick={() => onSelectTool('stroke-outline')}
                className="p-2.5 rounded-xl bg-white hover:bg-cyan-50/50 border border-slate-200/80 hover:border-cyan-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <PenTool className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-cyan-600">Stroke / Outline</div>
                <div className="text-[10px] text-slate-400 truncate">Clean outlines</div>
              </button>
            </div>
          </div>

          {/* Category 4: CREATE & CONVERT */}
          <div className="bg-[#fbfcff] rounded-2xl border border-teal-100/70 p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center space-x-1.5 mb-2.5 text-teal-600">
              <Cpu className="w-3.5 h-3.5 text-teal-500" />
              <span className="font-extrabold text-[11px] tracking-wider uppercase text-teal-700">
                Create & Convert
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectTool('text-number')}
                className="p-2.5 rounded-xl bg-white hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Type className="w-4 h-4 text-blue-600" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-blue-600">Text & Number</div>
                <div className="text-[10px] text-slate-400 truncate">Names & numbers</div>
              </button>

              <button
                onClick={() => onSelectTool('vectorize')}
                className="p-2.5 rounded-xl bg-white hover:bg-purple-50/50 border border-slate-200/80 hover:border-purple-300 text-left transition-all hover:scale-[1.02] shadow-2xs group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-[9px] font-black uppercase tracking-wider bg-purple-600 text-white px-1.5 py-0.2 rounded-full">
                    AI TOOL
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-purple-600">Image Vectoriser</div>
                <div className="text-[10px] text-slate-400 truncate">Trace to vector</div>
              </button>

              <button
                onClick={() => onSelectTool('recreate-ai')}
                className="p-2.5 rounded-xl bg-white hover:bg-pink-50/50 border border-slate-200/80 hover:border-pink-300 text-left transition-all hover:scale-[1.02] shadow-2xs group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Cpu className="w-4 h-4 text-pink-600" />
                  <span className="text-[9px] font-black uppercase tracking-wider bg-pink-600 text-white px-1.5 py-0.2 rounded-full">
                    AI TOOL
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-pink-600">Recreate with AI</div>
                <div className="text-[10px] text-slate-400 truncate">Redraw any image</div>
              </button>

              <button
                onClick={() => onSelectTool('guide')}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-left transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                </div>
                <div className="font-bold text-xs text-slate-900">Guide</div>
                <div className="text-[10px] text-slate-400 truncate">How-to manual</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

