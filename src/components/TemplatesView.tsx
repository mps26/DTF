import React, { useState } from 'react';
import {
  Copy,
  Layers,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Sliders,
  Printer,
  ShieldCheck,
  BookmarkPlus,
  Trash2
} from 'lucide-react';
import { SheetSettings, NestingAlgorithm } from '../types';

interface TemplatesViewProps {
  currentSettings: SheetSettings;
  onApplyTemplate: (newSettings: Partial<SheetSettings>) => void;
  onBackToStudio: () => void;
  onNotification: (msg: string) => void;
}

interface TemplatePreset {
  id: string;
  name: string;
  category: 'roll' | 'sheet' | 'custom';
  widthIn: number;
  lengthIn: number;
  spacingIn: number;
  marginIn: number;
  recommendedFor: string;
  algorithm: NestingAlgorithm;
  color: string;
  badge: string;
}

const PRESET_TEMPLATES: TemplatePreset[] = [
  {
    id: 'tpl-22x60',
    name: '22" × 60" Production Roll',
    category: 'roll',
    widthIn: 22,
    lengthIn: 60,
    spacingIn: 0.3,
    marginIn: 0.25,
    recommendedFor: 'Standard Apparel Gang Sheet (T-Shirts, Hoodies, Bulk Front/Back)',
    algorithm: 'true-shape',
    color: 'from-blue-600 to-indigo-600',
    badge: '22" × 60"'
  },
  {
    id: 'tpl-22x100',
    name: '22" × 100" Master Roll',
    category: 'roll',
    widthIn: 22,
    lengthIn: 100,
    spacingIn: 0.25,
    marginIn: 0.2,
    recommendedFor: 'Maximum Volume Output, Full 100" Max Roll Capacity',
    algorithm: 'true-shape',
    color: 'from-indigo-600 to-purple-600',
    badge: '22" × 100"'
  },
  {
    id: 'tpl-11x17',
    name: '11" × 17" Tabloid Sheet',
    category: 'sheet',
    widthIn: 11,
    lengthIn: 17,
    spacingIn: 0.25,
    marginIn: 0.2,
    recommendedFor: 'Medium Gang Sheets, Front Chest Graphics & Tote Bags',
    algorithm: 'box',
    color: 'from-teal-600 to-emerald-600',
    badge: '11" × 17"'
  },
  {
    id: 'tpl-8x11',
    name: '8" × 11" Letter Sheet',
    category: 'sheet',
    widthIn: 8,
    lengthIn: 11,
    spacingIn: 0.2,
    marginIn: 0.15,
    recommendedFor: 'Sample Prints, Pocket Logos, Sleeve Badges & Hat Patches',
    algorithm: 'box',
    color: 'from-amber-600 to-orange-600',
    badge: '8" × 11"'
  },
  {
    id: 'tpl-22x39',
    name: '22" × 39" 1-Meter Roll',
    category: 'roll',
    widthIn: 22,
    lengthIn: 39,
    spacingIn: 0.25,
    marginIn: 0.2,
    recommendedFor: 'Standard 1-Meter (100 cm) Roll Output & UV-DTF Decals',
    algorithm: 'true-shape',
    color: 'from-purple-600 to-fuchsia-600',
    badge: '22" × 39"'
  }
];

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  currentSettings,
  onApplyTemplate,
  onBackToStudio,
  onNotification
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'roll' | 'sheet' | 'custom'>('all');
  const [customTemplates, setCustomTemplates] = useState<TemplatePreset[]>(() => {
    try {
      const saved = localStorage.getItem('dtf_custom_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleApply = (tpl: TemplatePreset) => {
    onApplyTemplate({
      filmWidth: tpl.widthIn,
      filmWidthMm: tpl.widthIn * 25.4,
      spacing: tpl.spacingIn,
      spacingMm: tpl.spacingIn * 25.4,
      margin: tpl.marginIn,
      marginMm: tpl.marginIn * 25.4,
      fixedLength: tpl.lengthIn,
      fixedLengthMm: tpl.lengthIn * 25.4,
      lengthMode: 'fixed',
      nestingAlgorithm: tpl.algorithm
    });
    onNotification(`Applied template: "${tpl.name}" (${tpl.widthIn}" × ${tpl.lengthIn}")`);
    onBackToStudio();
  };

  const handleSaveCurrentAsTemplate = () => {
    const name = prompt('Enter a name for this custom template:', `Custom_${currentSettings.filmWidth}x${currentSettings.fixedLength || 36}`);
    if (!name) return;

    const newTpl: TemplatePreset = {
      id: `custom_${Date.now()}`,
      name,
      category: 'custom',
      widthIn: currentSettings.filmWidth,
      lengthIn: currentSettings.fixedLength || 36,
      spacingIn: currentSettings.spacing || 0.3,
      marginIn: currentSettings.margin || 0.25,
      recommendedFor: 'Custom User Configuration',
      algorithm: currentSettings.nestingAlgorithm || 'true-shape',
      color: 'from-indigo-600 to-blue-600',
      badge: 'CUSTOM'
    };

    const updated = [newTpl, ...customTemplates];
    setCustomTemplates(updated);
    try {
      localStorage.setItem('dtf_custom_templates', JSON.stringify(updated));
    } catch {}
    onNotification(`Saved custom template: "${name}"`);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem('dtf_custom_templates', JSON.stringify(updated));
    } catch {}
    onNotification('Removed custom template');
  };

  const allTemplates = [...customTemplates, ...PRESET_TEMPLATES];
  const filteredTemplates = allTemplates.filter((tpl) => {
    if (selectedCategory === 'all') return true;
    return tpl.category === selectedCategory;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] text-slate-800 overflow-hidden font-sans select-none">
      {/* Top Console Header */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onBackToStudio}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors border border-slate-200 shadow-2xs cursor-pointer"
          >
            <span>← Back to Gang Sheet</span>
          </button>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25">
              <Copy className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm text-slate-900 tracking-tight uppercase">
                  Gang Sheet Production Templates
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Standard Roll Sizes
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                One-click optimized roll configurations conforming strictly to max 22" × 100" print bounds
              </div>
            </div>
          </div>
        </div>

        {/* Save Current Layout CTA */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSaveCurrentAsTemplate}
            className="h-9 px-4 bg-white hover:bg-slate-50 text-indigo-600 hover:text-indigo-700 border border-indigo-200 font-extrabold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>Save Current Sheet as Template</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Category Pills Strip */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            {[
              { id: 'all', label: 'All Templates (5)' },
              { id: 'roll', label: 'Roll Formats (22")' },
              { id: 'sheet', label: 'Cut Sheets (11×17, 8×11)' }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium font-mono">
            Showing {filteredTemplates.length} Production Template(s)
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Accent Gradient Bar */}
              <div className={`h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r ${tpl.color}`} />

              <div className="space-y-4">
                {/* Header: Title & Badge */}
                <div className="flex items-start justify-between pt-1">
                  <div>
                    <h3 className="font-black text-sm text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                      {tpl.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {tpl.recommendedFor}
                    </p>
                  </div>
                  <span className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex-shrink-0">
                    {tpl.badge}
                  </span>
                </div>

                {/* Aspect Ratio Illustration Box */}
                <div className="h-28 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-center p-3 relative overflow-hidden">
                  {/* Miniature Sheet Illustration */}
                  <div
                    className="border-2 border-indigo-500 bg-white shadow-md rounded flex items-center justify-center font-mono font-bold text-[10px] text-indigo-900 transition-transform group-hover:scale-105"
                    style={{
                      width: `${Math.max(48, Math.min(180, (tpl.widthIn / 22) * 120))}px`,
                      height: `${Math.max(38, Math.min(90, (tpl.lengthIn / 100) * 85))}px`
                    }}
                  >
                    <span>{tpl.widthIn}" × {tpl.lengthIn}"</span>
                  </div>

                  <div className="absolute bottom-2 right-3 font-mono text-[10px] text-slate-400">
                    Max: 22" × 100"
                  </div>
                </div>

                {/* Technical Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Dimensions</span>
                    <span className="font-extrabold text-slate-800 font-mono">
                      {tpl.widthIn}" × {tpl.lengthIn}"
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Spacing / Margin</span>
                    <span className="font-extrabold text-slate-800 font-mono">
                      {tpl.spacingIn}" / {tpl.marginIn}"
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
                {tpl.badge === 'CUSTOM' ? (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustom(tpl.id, e)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold p-1 transition-colors"
                    title="Delete custom template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center space-x-1.5 text-emerald-600 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tested on RIP</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleApply(tpl)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer group-hover:scale-102"
                >
                  <span>Apply Template</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
