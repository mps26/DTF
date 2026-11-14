import React, { useState } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
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
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface ToolsSidebarProps {
  onCreateLayout: () => void;
  onSelectTool: (toolId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ToolsSidebar: React.FC<ToolsSidebarProps> = ({
  onCreateLayout,
  onSelectTool,
  isCollapsed,
  onToggleCollapse
}) => {
  // Accordion open/close state for each of the 4 categories
  const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>({
    fix: false,
    cut: false,
    style: false,
    create: false
  });

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (isCollapsed) {
    return (
      <aside className="w-12 bg-[#0d1222] border-r border-[#1e263d] flex flex-col items-center py-3 select-none flex-shrink-0 transition-all">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mb-3"
          title="Expand Tools Sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>

        <button
          onClick={onCreateLayout}
          className="w-8 h-8 rounded-lg bg-[#EF7F1A] text-[#204563] font-black flex items-center justify-center shadow-md mb-4"
          title="Create Layout"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="flex flex-col space-y-3">
          <button
            onClick={() => {
              onToggleCollapse();
              setOpenCategories((p) => ({ ...p, fix: true }));
            }}
            className="w-8 h-8 rounded-lg bg-[#132537] border border-[#204563] text-[#EF7F1A] flex items-center justify-center hover:scale-105 transition-transform"
            title="Fix & Quality"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onToggleCollapse();
              setOpenCategories((p) => ({ ...p, cut: true }));
            }}
            className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-400 flex items-center justify-center hover:scale-105 transition-transform"
            title="Cut & Adjust"
          >
            <Crop className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onToggleCollapse();
              setOpenCategories((p) => ({ ...p, style: true }));
            }}
            className="w-8 h-8 rounded-lg bg-pink-950/60 border border-pink-800/60 text-pink-400 flex items-center justify-center hover:scale-105 transition-transform"
            title="Style & Effects"
          >
            <Wand2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onToggleCollapse();
              setOpenCategories((p) => ({ ...p, create: true }));
            }}
            className="w-8 h-8 rounded-lg bg-teal-950/60 border border-teal-800/60 text-teal-400 flex items-center justify-center hover:scale-105 transition-transform"
            title="Create & Convert"
          >
            <Cpu className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-[#0c101e] border-r border-[#1a223a] flex flex-col h-full select-none flex-shrink-0 text-slate-300 overflow-y-auto transition-all">
      {/* Top Header with Create Layout and Collapse button */}
      <div className="p-3 border-b border-[#1a223a] flex items-center space-x-2">
        <button
          onClick={onCreateLayout}
          className="flex-1 py-2.5 px-3 bg-[#EF7F1A] hover:bg-[#d97014] text-[#204563] rounded-xl font-black text-xs shadow-md shadow-[#EF7F1A]/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 text-[#204563]" />
          <span>Create Layout</span>
        </button>

        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Header: STUDIO AI & PREP TOOLS matching Image 4 */}
      <div className="px-4 pt-3.5 pb-2">
        <h2 className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
          Studio AI & Prep Tools
        </h2>
      </div>

      {/* Accordion Categories matching Image 4 */}
      <div className="p-2.5 space-y-2.5">
        {/* Category 1: Fix & Quality (Image 4 exact design) */}
        <div className="rounded-2xl bg-[#11172a] border border-[#1e2846] hover:border-[#EF7F1A] transition-all overflow-hidden shadow-xs">
          <div
            onClick={() => toggleCategory('fix')}
            className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-[#151d34] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-md shadow-[#204563]/30 flex-shrink-0">
                <Sparkles className="w-5 h-5 text-[#EF7F1A]" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-white tracking-tight">Fix & Quality</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">Upscale, color, pixel fix & audit</div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory('fix');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              {openCategories.fix ? (
                <ChevronUp className="w-4 h-4 text-[#EF7F1A]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {openCategories.fix && (
            <div className="p-2.5 pt-0 space-y-1 text-xs border-t border-[#1a233d] mt-1 animate-in fade-in duration-150">
              <button
                onClick={() => onSelectTool('upscale')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center justify-between text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Maximize2 className="w-3.5 h-3.5 text-[#EF7F1A]" />
                  <span className="font-semibold">Image Upscaler</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-[#EF7F1A] text-[#204563] px-1.5 py-0.2 rounded-full shadow-2xs">
                  AI
                </span>
              </button>

              <button
                onClick={() => onSelectTool('color-tone')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold">Color & Tone</span>
              </button>

              <button
                onClick={() => onSelectTool('pixel-doctor')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-semibold">Pixel Doctor</span>
              </button>

              <button
                onClick={() => onSelectTool('print-check')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold">Print Check</span>
              </button>
            </div>
          )}
        </div>

        {/* Category 2: Cut & Adjust (Image 4 exact design) */}
        <div className="rounded-2xl bg-[#11172a] border border-[#1e2846] hover:border-blue-500/50 transition-all overflow-hidden shadow-xs">
          <div
            onClick={() => toggleCategory('cut')}
            className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-[#151d34] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-md shadow-[#204563]/30 flex-shrink-0">
                <Crop className="w-5 h-5 text-[#EF7F1A]" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-white tracking-tight">Cut & Adjust</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">Remove color, crop, erase & border</div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory('cut');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              {openCategories.cut ? (
                <ChevronUp className="w-4 h-4 text-blue-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {openCategories.cut && (
            <div className="p-2.5 pt-0 space-y-1 text-xs border-t border-[#1a233d] mt-1 animate-in fade-in duration-150">
              <button
                onClick={() => onSelectTool('remove-color')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <Pipette className="w-3.5 h-3.5 text-[#EF7F1A]" />
                <span className="font-semibold">Remove/Replace Color</span>
              </button>

              <button
                onClick={() => onSelectTool('crop-clean')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <Crop className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold">Crop & Clean</span>
              </button>

              <button
                onClick={() => onSelectTool('eraser')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">Eraser</span>
              </button>

              <button
                onClick={() => onSelectTool('border-knockout')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <SquareDashedBottom className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold">Border Knockout</span>
              </button>
            </div>
          )}
        </div>

        {/* Category 3: Style & Effects (Image 4 exact design) */}
        <div className="rounded-2xl bg-[#11172a] border border-[#1e2846] hover:border-pink-500/50 transition-all overflow-hidden shadow-xs">
          <div
            onClick={() => toggleCategory('style')}
            className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-[#151d34] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#204563] text-[#EF7F1A] flex items-center justify-center shadow-md shadow-[#204563]/30 flex-shrink-0">
                <Wand2 className="w-5 h-5 text-[#EF7F1A]" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-white tracking-tight">Style & Effects</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">AI styles, texture, halftone & outline</div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory('style');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              {openCategories.style ? (
                <ChevronUp className="w-4 h-4 text-pink-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {openCategories.style && (
            <div className="p-2.5 pt-0 space-y-1 text-xs border-t border-[#1a233d] mt-1 animate-in fade-in duration-150">
              <button
                onClick={() => onSelectTool('texture')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center justify-between text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Layers className="w-3.5 h-3.5 text-[#EF7F1A]" />
                  <span className="font-semibold">Texture Effects</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-[#EF7F1A] text-[#204563] px-1.5 py-0.2 rounded-full shadow-2xs">
                  11
                </span>
              </button>

              <button
                onClick={() => onSelectTool('halftone')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center justify-between text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold">Halftone</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.2 rounded-full shadow-2xs">
                  NEW
                </span>
              </button>

              <button
                onClick={() => onSelectTool('stroke-outline')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <PenTool className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold">Stroke / Outline</span>
              </button>
            </div>
          )}
        </div>

        {/* Category 4: Create & Convert (Image 4 exact design) */}
        <div className="rounded-2xl bg-[#11172a] border border-[#1e2846] hover:border-teal-500/50 transition-all overflow-hidden shadow-xs">
          <div
            onClick={() => toggleCategory('create')}
            className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-[#151d34] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/30 flex-shrink-0">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-white tracking-tight">Create & Convert</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">Text, vector, recreate & guide</div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory('create');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              {openCategories.create ? (
                <ChevronUp className="w-4 h-4 text-teal-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {openCategories.create && (
            <div className="p-2.5 pt-0 space-y-1 text-xs border-t border-[#1a233d] mt-1 animate-in fade-in duration-150">
              <button
                onClick={() => onSelectTool('text-number')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <Type className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold">Text & Number</span>
              </button>

              <button
                onClick={() => onSelectTool('vectorize')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center justify-between text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#EF7F1A]" />
                  <span className="font-semibold">Image Vectoriser</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-[#EF7F1A] text-[#204563] px-1.5 py-0.2 rounded-full shadow-2xs">
                  AI
                </span>
              </button>

              <button
                onClick={() => onSelectTool('recreate-ai')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center justify-between text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Cpu className="w-3.5 h-3.5 text-pink-400" />
                  <span className="font-semibold">Recreate with AI</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-pink-600 text-white px-1.5 py-0.2 rounded-full shadow-2xs">
                  AI
                </span>
              </button>

              <button
                onClick={() => onSelectTool('guide')}
                className="w-full py-2 px-2.5 rounded-xl hover:bg-[#19223e] text-left flex items-center space-x-2 text-slate-200 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-semibold">Guide</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
