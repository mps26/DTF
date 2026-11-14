import React from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { ArtworkAsset, SheetSettings, LayoutResult } from '../types';

interface PreflightModalProps {
  assets: ArtworkAsset[];
  settings: SheetSettings;
  layout: LayoutResult;
  onClose: () => void;
}

export const PreflightModal: React.FC<PreflightModalProps> = ({
  assets,
  settings,
  layout,
  onClose
}) => {
  const lowDpiAssets = assets.filter((a) => a.dpiStatus === 'red');
  const mediumDpiAssets = assets.filter((a) => a.dpiStatus === 'amber');
  const opaqueAssets = assets.filter((a) => !a.hasAlpha && !a.isBgRemoved);
  const untrimmedWithMargins = assets.filter(
    (a) => a.cropBox && a.cropBox.emptyPercent > 20 && !a.isTrimmed
  );

  const checks = [
    {
      title: 'Roll Boundary & Margin Containment',
      passed: !layout.overflow,
      severity: layout.overflow ? 'error' : 'pass',
      detail: layout.overflow
        ? `Overflow detected: artwork exceeds film constraints by ${layout.overflowCount} items.`
        : `All ${layout.totalCopies} copies fit comfortably within the ${settings.filmWidth} ${settings.unit} roll.`
    },
    {
      title: 'DPI Resolution Preflight',
      passed: lowDpiAssets.length === 0,
      severity: lowDpiAssets.length > 0 ? 'error' : mediumDpiAssets.length > 0 ? 'warning' : 'pass',
      detail:
        lowDpiAssets.length > 0
          ? `${lowDpiAssets.length} image(s) have <150 DPI resolution and will appear blurry.`
          : mediumDpiAssets.length > 0
          ? `${mediumDpiAssets.length} image(s) have between 150-299 DPI (standard acceptable print).`
          : 'All images exceed 300 DPI for ultra-crisp DTF prints.'
    },
    {
      title: 'Alpha Transparency Integrity',
      passed: opaqueAssets.length === 0,
      severity: opaqueAssets.length > 0 ? 'warning' : 'pass',
      detail:
        opaqueAssets.length > 0
          ? `${opaqueAssets.length} design(s) have opaque backgrounds. If intended, proceed, or run Remove BG.`
          : 'Transparent alpha channels confirmed on all active assets.'
    },
    {
      title: 'Film Wastage Optimization',
      passed: untrimmedWithMargins.length === 0,
      severity: untrimmedWithMargins.length > 0 ? 'warning' : 'pass',
      detail:
        untrimmedWithMargins.length > 0
          ? `${untrimmedWithMargins.length} design(s) still have large transparent margins. Trimming will save film.`
          : `Optimal packing achieved. Estimated film waste is only ${layout.wastePercent}%.`
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                DTF Print Preflight Audit
              </h3>
              <p className="text-xs text-slate-500">
                Verification checklist before sending to RIP / Printer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit List */}
        <div className="p-6 overflow-y-auto space-y-4">
          {checks.map((c, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl border text-xs ${
                c.severity === 'pass'
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : c.severity === 'warning'
                  ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                  : 'bg-rose-50/60 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center space-x-2.5 mb-1">
                {c.severity === 'pass' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                )}
                {c.severity === 'warning' && (
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                )}
                {c.severity === 'error' && (
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <h4 className="font-bold text-sm">{c.title}</h4>
              </div>
              <p className="ml-6 text-slate-600 leading-normal">{c.detail}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            {checks.filter((x) => x.severity === 'pass').length} / {checks.length} checks passed
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

