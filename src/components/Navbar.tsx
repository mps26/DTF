import React from 'react';
import { Layers, HelpCircle, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenHowToUse: () => void;
  onOpenPreflight: () => void;
  onLoadSampleMulti: () => void;
  onLoadSampleRepeat: () => void;
  onReset: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenHowToUse,
  onOpenPreflight,
  onLoadSampleMulti,
  onLoadSampleRepeat,
  onReset
}) => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-indigo-100/60 sticky top-0 z-40 transition-all">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white font-black text-xl">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 bg-clip-text text-transparent">
                DTF Layout
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full">
                Auto Gang Sheet Pro
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Print Preparation & Automatic Nesting Engine
            </p>
          </div>
        </div>

        {/* Action Pills & Shortcuts */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden lg:flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs">
            <button
              onClick={onLoadSampleMulti}
              className="px-3 py-1.5 rounded-lg font-medium text-slate-700 hover:text-indigo-600 hover:bg-white transition-all flex items-center space-x-1.5"
              title="Load the 4 reference designs from the specification screenshot"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Multi-Design Demo</span>
            </button>
            <button
              onClick={onLoadSampleRepeat}
              className="px-3 py-1.5 rounded-lg font-medium text-slate-700 hover:text-indigo-600 hover:bg-white transition-all flex items-center space-x-1.5"
              title="Load Screen 1 (om.png x 10 copies)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
              <span>Repeat 10× Demo</span>
            </button>
          </div>

          <button
            onClick={onOpenPreflight}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/80 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline">Print Audit</span>
          </button>

          <button
            onClick={onOpenHowToUse}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all"
          >
            <HelpCircle className="w-4 h-4 text-indigo-500" />
            <span>How to use</span>
          </button>

          <button
            onClick={onReset}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title="Reset Workspace"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

