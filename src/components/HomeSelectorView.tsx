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
    <div className="flex-1 overflow-y-auto bg-[#F3EBDD] px-4 sm:px-8 pt-6 pb-36 sm:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] text-xs font-extrabold tracking-wide uppercase shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-[#EF7F1A]" />
            <span>Production Home</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#204563] tracking-tight">
            Choose Your <span className="text-[#EF7F1A]">Print Technology</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#526A7B] font-medium max-w-xl mx-auto">
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
                ? 'border-[#204563] ring-4 ring-[#204563]/10'
                : 'border-[#E5D9C8] hover:border-[#204563]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#204563] flex items-center justify-center text-white shadow-lg shadow-[#204563]/25">
                  <Layers className="w-6 h-6 text-white" />
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] text-[11px] font-extrabold uppercase tracking-wider">
                  Apparel &amp; Fabric
                </span>
              </div>

              <h2 className="text-2xl font-black text-[#204563] mb-1.5 group-hover:text-[#EF7F1A] transition-colors">
                DTF Gang Sheet
              </h2>
              <p className="text-xs sm:text-sm text-[#526A7B] font-medium mb-5">
                Direct-to-Film continuous production rolls measured in inches.
              </p>

              {/* DTF Available Sizes */}
              <div className="space-y-2.5 mb-6">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#526A7B]">
                  Available Roll Sizes (Inches)
                </div>
                {DTF_PRESETS.map((preset) => {
                  const locked = preset.isLocked && !isAuthorized;
                  return (
                    <div
                      key={preset.id}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold ${
                        locked
                          ? 'bg-[#FAF7F1] border-[#E5D9C8] text-[#526A7B]'
                          : 'bg-[#FAF7F1] border-[#E5D9C8] text-[#204563]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {locked ? (
                          <Lock className="w-3.5 h-3.5 text-[#EF7F1A] flex-shrink-0" />
                        ) : preset.isLocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#204563] flex-shrink-0" />
                        )}
                        <span className="font-mono">{preset.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                          locked
                            ? 'bg-[#FCE8D5] text-[#204563]'
                            : preset.isLocked
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-[#E8DDCA] text-[#204563]'
                        }`}
                      >
                        {locked ? 'Locked' : preset.isLocked ? 'Unlocked' : 'Standard'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5D9C8] flex items-center justify-end">
              <span className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#204563] group-hover:bg-[#183750] text-white text-xs font-extrabold shadow-md shadow-[#204563]/20 transition-all">
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
                ? 'border-[#EF7F1A] ring-4 ring-[#EF7F1A]/10'
                : 'border-[#E5D9C8] hover:border-[#EF7F1A]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#EF7F1A] flex items-center justify-center text-[#204563] shadow-lg shadow-[#EF7F1A]/25">
                  <Sparkles className="w-6 h-6 text-[#204563]" />
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FCE8D5] border border-[#fed4aa] text-[#204563] text-[11px] font-extrabold uppercase tracking-wider">
                  Hard Surfaces &amp; Stickers
                </span>
              </div>

              <h2 className="text-2xl font-black text-[#204563] mb-1.5 group-hover:text-[#EF7F1A] transition-colors">
                UVDTF Gang Sheet
              </h2>
              <p className="text-xs sm:text-sm text-[#526A7B] font-medium mb-5">
                UV Direct-to-Film sheets (A4, A3), 1-meter sheets, and 23" running rolls in inches.
              </p>

              {/* UVDTF Available Sizes */}
              <div className="space-y-2 mb-6">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#526A7B]">
                  Available Sheet &amp; Roll Sizes (Inches)
                </div>
                {UVDTF_PRESETS.map((preset) => {
                  const locked = preset.isLocked && !isAuthorized;
                  return (
                    <div
                      key={preset.id}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-bold ${
                        locked
                          ? 'bg-[#FAF7F1] border-[#E5D9C8] text-[#526A7B]'
                          : 'bg-[#FAF7F1] border-[#E5D9C8] text-[#204563]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {locked ? (
                          <Lock className="w-3.5 h-3.5 text-[#EF7F1A] flex-shrink-0" />
                        ) : preset.isLocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#EF7F1A] flex-shrink-0" />
                        )}
                        <span className="font-mono">{preset.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                          locked
                            ? 'bg-[#FCE8D5] text-[#204563]'
                            : preset.isLocked
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-[#FCE8D5] text-[#204563]'
                        }`}
                      >
                        {locked ? 'Locked' : preset.isLocked ? 'Unlocked' : 'Standard'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5D9C8] flex items-center justify-end">
              <span className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#EF7F1A] group-hover:bg-[#d96e12] text-[#204563] text-xs font-black shadow-md shadow-[#EF7F1A]/20 transition-all">
                <span>Open UVDTF Studio</span>
                <ArrowRight className="w-4 h-4 text-[#204563] group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
