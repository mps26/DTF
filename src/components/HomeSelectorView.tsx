import React from 'react';
import {
  Layers,
  Sparkles,
  Lock,
  Unlock,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { PrintType } from '../types';
import { UserProfile } from '../types/auth';
import {
  DTF_PRESETS,
  UVDTF_PRESETS,
  hasLockedRollAccess
} from '../utils/sheetPresets';

interface HomeSelectorViewProps {
  currentUser: UserProfile | null;
  activePrintType?: PrintType;
  onSelectPrintType: (printType: PrintType) => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
}

export const HomeSelectorView: React.FC<HomeSelectorViewProps> = ({
  currentUser,
  activePrintType = 'dtf',
  onSelectPrintType
}) => {
  const isAuthorized = hasLockedRollAccess(currentUser);

  return (
    <div className="flex-1 overflow-y-auto bg-[#edf3f8] px-4 sm:px-8 pt-6 pb-36 sm:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-xs font-extrabold tracking-wide uppercase">
            <Layers className="w-3.5 h-3.5" />
            <span>Production Home</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Choose Your <span className="text-indigo-600">Print Technology</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl mx-auto">
            Select <strong>DTF</strong> or <strong>UVDTF</strong> to open the Gang Sheet Studio with the exact roll sizes and sheet dimensions.
          </p>
        </div>

        {/* Two Main Mode Cards: DTF & UVDTF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1: DTF */}
          <div
            onClick={() => onSelectPrintType('dtf')}
            className={`group bg-white rounded-3xl p-6 sm:p-7 border-2 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between ${
              activePrintType === 'dtf'
                ? 'border-indigo-500 ring-4 ring-indigo-500/10'
                : 'border-slate-200/80 hover:border-indigo-400'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-extrabold uppercase tracking-wider">
                  Apparel &amp; Fabric
                </span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors">
                DTF Gang Sheet
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mb-5">
                Direct-to-Film continuous production rolls measured in inches.
              </p>

              {/* DTF Available Sizes */}
              <div className="space-y-2.5 mb-6">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Available Roll Sizes (Inches)
                </div>
                {DTF_PRESETS.map((preset) => {
                  const locked = preset.isLocked && !isAuthorized;
                  return (
                    <div
                      key={preset.id}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold ${
                        locked
                          ? 'bg-amber-50/60 border-amber-200/80 text-slate-700'
                          : 'bg-slate-50 border-slate-200/80 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {locked ? (
                          <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        ) : preset.isLocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        )}
                        <span className="font-mono">{preset.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                          locked
                            ? 'bg-amber-100 text-amber-800'
                            : preset.isLocked
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {locked ? 'Locked' : preset.isLocked ? 'Unlocked' : 'Standard'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <span className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 group-hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all">
                <span>Open DTF Studio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>

          {/* Option 2: UVDTF */}
          <div
            onClick={() => onSelectPrintType('uvdtf')}
            className={`group bg-white rounded-3xl p-6 sm:p-7 border-2 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between ${
              activePrintType === 'uvdtf'
                ? 'border-purple-500 ring-4 ring-purple-500/10'
                : 'border-slate-200/80 hover:border-purple-400'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-extrabold uppercase tracking-wider">
                  Hard Surfaces &amp; Stickers
                </span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-1.5 group-hover:text-purple-600 transition-colors">
                UVDTF Gang Sheet
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mb-5">
                UV Direct-to-Film sheets (A4, A3), 1-meter sheets, and 23" running rolls in inches.
              </p>

              {/* UVDTF Available Sizes */}
              <div className="space-y-2 mb-6">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Available Sheet &amp; Roll Sizes (Inches)
                </div>
                {UVDTF_PRESETS.map((preset) => {
                  const locked = preset.isLocked && !isAuthorized;
                  return (
                    <div
                      key={preset.id}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-bold ${
                        locked
                          ? 'bg-amber-50/60 border-amber-200/80 text-slate-700'
                          : 'bg-slate-50 border-slate-200/80 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {locked ? (
                          <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        ) : preset.isLocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                        )}
                        <span className="font-mono">{preset.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                          locked
                            ? 'bg-amber-100 text-amber-800'
                            : preset.isLocked
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {locked ? 'Locked' : preset.isLocked ? 'Unlocked' : 'Standard'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <span className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-purple-600 group-hover:bg-purple-700 text-white text-xs font-extrabold shadow-md shadow-purple-600/20 transition-all">
                <span>Open UVDTF Studio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
