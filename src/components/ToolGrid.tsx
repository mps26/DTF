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
  BookOpen
} from 'lucide-react';

interface ToolGridProps {
  onSelectTool: (toolId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ToolGrid: React.FC<ToolGridProps> = ({ onSelectTool, collapsed = false, onToggleCollapse }) => {
  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
          Studio AI & Prep Tools
        </h2>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-xs font-bold text-[#204563] hover:text-[#EF7F1A] transition-colors"
          >
            {collapsed ? 'Show Tool Palette' : 'Hide Tool Palette'}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Group 1: FIX & QUALITY */}
          <div className="bg-[#FAF7F1] p-3.5 rounded-2xl border border-[#E5D9C8] shadow-sm">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-extrabold tracking-wider text-[#204563] uppercase">
                Fix & Quality
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Image Upscaler */}
              <button
                onClick={() => onSelectTool('upscale')}
                className="bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] hover:border-[#EF7F1A] p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-xs">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-[#EF7F1A] text-[#204563] px-1.5 py-0.5 rounded-full">
                    AI TOOL
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-800">Image Upscaler</div>
                <div className="text-[10px] text-slate-500 truncate">Sharpen & enlarge</div>
              </button>

              {/* Color & Tone */}
              <button
                onClick={() => onSelectTool('color-tone')}
                className="bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Color & Tone</div>
                <div className="text-[10px] text-slate-500 truncate">Levels & colour</div>
              </button>

              {/* Pixel Doctor */}
              <button
                onClick={() => onSelectTool('pixel-doctor')}
                className="bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-500 text-white flex items-center justify-center shadow-xs">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Pixel Doctor</div>
                <div className="text-[10px] text-slate-500 truncate">Fix stray pixels</div>
              </button>

              {/* Print Check */}
              <button
                onClick={() => onSelectTool('print-check')}
                className="bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Print Check</div>
                <div className="text-[10px] text-slate-500 truncate">Pre-print audit</div>
              </button>
            </div>
          </div>

          {/* Group 2: CUT & ADJUST */}
          <div className="bg-gradient-to-b from-blue-50/40 to-white p-3.5 rounded-2xl border border-blue-100/70 shadow-sm">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-extrabold tracking-wider text-blue-700 uppercase">
                Cut & Adjust
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Remove/Replace Color */}
              <button
                onClick={() => onSelectTool('remove-color')}
                className="bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] hover:border-[#EF7F1A] p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-xs">
                    <Pipette className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Remove/Replace Color</div>
                <div className="text-[10px] text-slate-500 truncate">Pick & swap</div>
              </button>

              {/* Crop & Clean */}
              <button
                onClick={() => onSelectTool('crop-clean')}
                className="bg-sky-50/70 hover:bg-sky-100/80 border border-sky-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-xs">
                    <Crop className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Crop & Clean</div>
                <div className="text-[10px] text-slate-500 truncate">Trim • Flip • Rotate</div>
              </button>

              {/* Eraser */}
              <button
                onClick={() => onSelectTool('eraser')}
                className="bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-slate-600 text-white flex items-center justify-center shadow-xs">
                    <Eraser className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Eraser</div>
                <div className="text-[10px] text-slate-500 truncate">Rub out areas</div>
              </button>

              {/* Border Knockout */}
              <button
                onClick={() => onSelectTool('border-knockout')}
                className="bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center shadow-xs">
                    <SquareDashedBottom className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Border Knockout</div>
                <div className="text-[10px] text-slate-500 truncate">Punch-out frames</div>
              </button>
            </div>
          </div>

          {/* Group 3: STYLE & EFFECTS */}
          <div className="bg-[#FAF7F1] p-3.5 rounded-2xl border border-[#E5D9C8] shadow-sm">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-extrabold tracking-wider text-[#204563] uppercase">
                Style & Effects
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Texture Effects */}
              <button
                onClick={() => onSelectTool('texture')}
                className="bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] hover:border-[#EF7F1A] p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-xs">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-[#EF7F1A] text-[#204563] px-1.5 py-0.5 rounded-full">
                    11
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-800">Texture Effects</div>
                <div className="text-[10px] text-slate-500 truncate">11 creative filters</div>
              </button>

              {/* Halftone */}
              <button
                onClick={() => onSelectTool('halftone')}
                className="bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] hover:border-[#EF7F1A] p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-xs">
                    <CircleDot className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                    NEW
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-800">Halftone</div>
                <div className="text-[10px] text-slate-500 truncate">Dot screen</div>
              </button>

              {/* Stroke / Outline */}
              <button
                onClick={() => onSelectTool('stroke-outline')}
                className="bg-cyan-50/70 hover:bg-cyan-100/80 border border-cyan-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-cyan-600 text-white flex items-center justify-center shadow-xs">
                    <PenTool className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Stroke / Outline</div>
                <div className="text-[10px] text-slate-500 truncate">Clean outlines</div>
              </button>
            </div>
          </div>

          {/* Group 4: CREATE & CONVERT */}
          <div className="bg-gradient-to-b from-teal-50/40 to-white p-3.5 rounded-2xl border border-teal-100/70 shadow-sm">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-extrabold tracking-wider text-teal-700 uppercase">
                Create & Convert
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Text & Number */}
              <button
                onClick={() => onSelectTool('text-number')}
                className="bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Type className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Text & Number</div>
                <div className="text-[10px] text-slate-500 truncate">Names & numbers</div>
              </button>

              {/* Image Vectoriser */}
              <button
                onClick={() => onSelectTool('vectorize')}
                className="bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] hover:border-[#EF7F1A] p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-[#EF7F1A] text-[#204563] px-1.5 py-0.5 rounded-full">
                    AI TOOL
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-800">Image Vectoriser</div>
                <div className="text-[10px] text-slate-500 truncate">Trace to vector</div>
              </button>

              {/* Recreate with AI */}
              <button
                onClick={() => onSelectTool('recreate-ai')}
                className="bg-pink-50/70 hover:bg-pink-100/80 border border-pink-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-pink-600 text-white flex items-center justify-center shadow-xs">
                    <Cpu className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-pink-600 text-white px-1.5 py-0.5 rounded-full">
                    AI TOOL
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-800">Recreate with AI</div>
                <div className="text-[10px] text-slate-500 truncate">Redraw any image</div>
              </button>

              {/* Guide */}
              <button
                onClick={() => onSelectTool('guide')}
                className="bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/60 p-2.5 rounded-xl text-left transition-all hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-slate-600 text-white flex items-center justify-center shadow-xs">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-bold text-xs text-slate-800">Guide</div>
                <div className="text-[10px] text-slate-500 truncate">How-to manual</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

