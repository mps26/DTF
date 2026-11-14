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
  topLabel: string;
  sideLabel: string;
  isFixed: boolean;
  boxWidthPx: number;
  boxHeightPx: number;
}

const PRESET_TEMPLATES: TemplatePreset[] = [
  {
    id: 'tpl-11x8',
    name: '11" × 8" Cut Sheet',
    category: 'sheet',
    widthIn: 11,
    lengthIn: 8,
    spacingIn: 0.2,
    marginIn: 0.15,
    recommendedFor: 'Cut Sheet for pocket logos, chest badges, sleeve patches & proofing',
    algorithm: 'box',
    color: 'from-amber-500 to-orange-500',
    badge: '11" × 8"',
    topLabel: '11',
    sideLabel: '8',
    isFixed: true,
    boxWidthPx: 108,
    boxHeightPx: 78
  },
  {
    id: 'tpl-11x17',
    name: '11" × 17" Tabloid Sheet',
    category: 'sheet',
    widthIn: 11,
    lengthIn: 17,
    spacingIn: 0.25,
    marginIn: 0.2,
    recommendedFor: 'Tabloid Sheet for standard front/back apparel graphics & tote bags',
    algorithm: 'box',
    color: 'from-teal-500 to-emerald-600',
    badge: '11" × 17"',
    topLabel: '11',
    sideLabel: '17',
    isFixed: true,
    boxWidthPx: 84,
    boxHeightPx: 130
  },
  {
    id: 'tpl-22x99.5',
    name: '22" × Variable Height Roll',
    category: 'roll',
    widthIn: 22,
    lengthIn: 99.5,
    spacingIn: 0.3,
    marginIn: 0.25,
    recommendedFor: 'Standard 22" Commercial Roll with dynamic continuous height (till 99.5")',
    algorithm: 'true-shape',
    color: 'from-[#204563] to-[#204563]',
    badge: '22" × 99.5" (MAX)',
    topLabel: '22',
    sideLabel: 'height (till 99.5)',
    isFixed: false,
    boxWidthPx: 96,
    boxHeightPx: 148
  },
  {
    id: 'tpl-22.2x99.5',
    name: '22.2" × Variable Height Roll',
    category: 'roll',
    widthIn: 22.2,
    lengthIn: 99.5,
    spacingIn: 0.25,
    marginIn: 0.2,
    recommendedFor: '22.2" Master Wide Roll with full printable edge and continuous feed (till 99.5")',
    algorithm: 'true-shape',
    color: 'from-[#EF7F1A] to-[#d96e12]',
    badge: '22.2" × 99.5" (MAX)',
    topLabel: '22.2',
    sideLabel: 'height (till 99.5)',
    isFixed: false,
    boxWidthPx: 100,
    boxHeightPx: 148
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
      filmWidthPreset: tpl.widthIn.toString(),
      spacing: tpl.spacingIn,
      spacingMm: tpl.spacingIn * 25.4,
      margin: tpl.marginIn,
      marginMm: tpl.marginIn * 25.4,
      fixedLength: tpl.lengthIn,
      fixedLengthMm: tpl.lengthIn * 25.4,
      lengthMode: tpl.isFixed ? 'fixed' : 'auto',
      nestingAlgorithm: tpl.algorithm
    });
    onNotification(`Applied template: "${tpl.name}" (${tpl.widthIn}" × ${tpl.isFixed ? `${tpl.lengthIn}"` : 'Dynamic'})`);
    onBackToStudio();
  };

  const handleSaveCurrentAsTemplate = () => {
    const name = prompt('Enter a name for this custom template:', `Custom_${currentSettings.filmWidth}x${currentSettings.fixedLength || 36}`);
    if (!name) return;

    const w = currentSettings.filmWidth;
    const l = currentSettings.fixedLength || 36;
    const isFix = currentSettings.lengthMode === 'fixed';

    const newTpl: TemplatePreset = {
      id: `custom_${Date.now()}`,
      name,
      category: 'custom',
      widthIn: w,
      lengthIn: l,
      spacingIn: currentSettings.spacing || 0.3,
      marginIn: currentSettings.margin || 0.25,
      recommendedFor: 'Custom User Gang Sheet Configuration',
      algorithm: currentSettings.nestingAlgorithm || 'true-shape',
      color: 'from-[#204563] to-[#EF7F1A]',
      badge: 'CUSTOM',
      topLabel: `${w}`,
      sideLabel: isFix ? `${l}` : `till ${l}`,
      isFixed: isFix,
      boxWidthPx: Math.max(70, Math.min(115, Math.round((w / 22.2) * 95))),
      boxHeightPx: Math.max(70, Math.min(150, Math.round((l / 100) * 140)))
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
    <div className="flex-1 flex flex-col h-full bg-[#F3EBDD] text-[#204563] overflow-hidden font-sans select-none">
      {/* Top Console Header */}
      <div className="h-16 bg-white border-b border-[#E5D9C8] px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onBackToStudio}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#FAF7F1] hover:bg-[#E8DDCA] text-[#204563] text-xs font-bold transition-colors border border-[#E5D9C8] shadow-2xs cursor-pointer"
          >
            <span>← Back to Gang Sheet</span>
          </button>

          <div className="h-5 w-px bg-[#E5D9C8]" />

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#204563] flex items-center justify-center text-[#EF7F1A] shadow-md shadow-[#204563]/25 border border-[#183750]">
              <Copy className="w-4 h-4 text-[#EF7F1A]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm text-[#204563] tracking-tight uppercase">
                  Standard Gang Sheet Templates
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#FCE8D5] text-[#204563] border border-[#EF7F1A]/30 px-2 py-0.5 rounded-full">
                  Width × Height Presets
                </span>
              </div>
              <div className="text-[11px] text-[#526A7B] font-medium">
                Standard cut sheets (11" × 8", 11" × 17") &amp; production rolls (22", 22.2" × up to 99.5")
              </div>
            </div>
          </div>
        </div>

        {/* Save Current Layout CTA */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSaveCurrentAsTemplate}
            className="h-9 px-4 bg-white hover:bg-[#FAF7F1] text-[#204563] hover:text-[#EF7F1A] border border-[#E5D9C8] font-black text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4 text-[#EF7F1A]" />
            <span>Save Current Sheet as Template</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-36 sm:pb-6 space-y-6">
        
        {/* Category Pills Strip */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            {[
              { id: 'all', label: `All Templates (${allTemplates.length})` },
              { id: 'roll', label: 'Roll Formats (22", 22.2")' },
              { id: 'sheet', label: 'Cut Sheets (11×8, 11×17)' },
              ...(customTemplates.length > 0 ? [{ id: 'custom', label: `Custom (${customTemplates.length})` }] : [])
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#EF7F1A] text-[#204563] shadow-xs font-black'
                    : 'bg-white hover:bg-[#FAF7F1] text-[#526A7B] hover:text-[#204563] border border-[#E5D9C8] shadow-2xs'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-[#526A7B] font-medium font-mono">
            Showing {filteredTemplates.length} Production Template(s)
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-3xl border border-[#E5D9C8] p-5 shadow-xs hover:shadow-md hover:border-[#EF7F1A] transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Accent Bar */}
              <div className="h-1.5 w-full absolute top-0 left-0 bg-[#EF7F1A]" />

              <div className="space-y-4">
                {/* Header: Title & Badge */}
                <div className="flex items-start justify-between pt-1">
                  <div>
                    <h3 className="font-black text-sm text-[#204563] tracking-tight group-hover:text-[#EF7F1A] transition-colors">
                      {tpl.name}
                    </h3>
                    <p className="text-[11px] text-[#526A7B] font-medium mt-0.5 leading-snug">
                      {tpl.recommendedFor}
                    </p>
                  </div>
                  <span className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#FCE8D5] text-[#204563] border border-[#EF7F1A]/30 flex-shrink-0 ml-2">
                    {tpl.badge}
                  </span>
                </div>

                {/* Aspect Ratio Illustration Box */}
                <div className="h-56 rounded-2xl bg-[#FAF7F1] border border-[#E5D9C8] flex flex-col items-center justify-center p-3 relative overflow-hidden group-hover:border-[#EF7F1A] transition-colors">
                  {/* Subtle Blueprint Dot Grid */}
                  <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#526A7B_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

                  {/* Top Dimension Indicator */}
                  <div className="relative z-10 flex flex-col items-center mb-1.5" style={{ width: `${tpl.boxWidthPx}px` }}>
                    <span className="font-mono font-black text-xs text-[#204563] bg-white px-2.5 py-0.5 rounded-md border border-[#E5D9C8] shadow-2xs">
                      {tpl.topLabel}
                    </span>
                    {/* Measurement horizontal line with ticks */}
                    <div className="w-full flex items-center justify-between text-[#EF7F1A] text-[10px] px-0.5 mt-0.5">
                      <span className="leading-none select-none">◀</span>
                      <div className="flex-1 border-t-2 border-[#EF7F1A] mx-1"></div>
                      <span className="leading-none select-none">▶</span>
                    </div>
                  </div>

                  {/* Main Diagram Area */}
                  <div className="relative z-10 flex items-center justify-center">
                    <div className="relative">
                      <div
                        className="absolute -top-2 -right-2 border-2 border-[#E5D9C8] bg-[#E8DDCA]/40 rounded-lg pointer-events-none transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        style={{ width: `${tpl.boxWidthPx}px`, height: `${tpl.boxHeightPx}px` }}
                      />

                      <div
                        className="relative border-2 border-[#204563] bg-white shadow-md rounded-lg flex flex-col items-center justify-center p-2 transition-transform group-hover:scale-102 overflow-hidden"
                        style={{ width: `${tpl.boxWidthPx}px`, height: `${tpl.boxHeightPx}px` }}
                      >
                        <div className="w-8 h-1 rounded-full bg-[#EF7F1A] mb-2 pointer-events-none" />

                        <div className="relative z-10 text-center">
                          <div className="font-black font-mono text-xs text-[#204563] leading-tight">
                            {tpl.widthIn}" × {tpl.lengthIn === 99.5 ? '99.5"' : `${tpl.lengthIn}"`}
                          </div>
                          <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#EF7F1A] mt-0.5">
                            {tpl.isFixed ? 'Cut Sheet' : 'Continuous Roll'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Side Dimension Indicator */}
                    <div className="flex items-center ml-3" style={{ height: `${tpl.boxHeightPx}px` }}>
                      <div className="h-full flex flex-col items-center justify-between text-[#EF7F1A] text-[10px] py-0.5 mr-1.5">
                        <span className="leading-none select-none">▲</span>
                        <div className="flex-1 border-l-2 border-[#EF7F1A] my-1"></div>
                        <span className="leading-none select-none">▼</span>
                      </div>
                      <span className="font-mono font-black text-xs text-[#204563] bg-white px-2 py-0.5 rounded-md border border-[#E5D9C8] shadow-2xs whitespace-nowrap">
                        {tpl.sideLabel}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Info Ribbon */}
                  <div className="absolute bottom-1.5 left-3 text-[10px] font-mono text-[#526A7B]">
                    {tpl.isFixed ? 'Cut Sheet' : 'Variable Feed (≤ 99.5")'}
                  </div>
                </div>

                {/* Technical Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8]">
                    <span className="text-[10px] text-[#526A7B] font-semibold block uppercase">Width (Top)</span>
                    <span className="font-extrabold text-[#204563] font-mono">
                      {tpl.widthIn}"
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8]">
                    <span className="text-[10px] text-[#526A7B] font-semibold block uppercase">Height (Side)</span>
                    <span className="font-extrabold text-[#204563] font-mono">
                      {tpl.isFixed ? `${tpl.lengthIn}"` : 'till 99.5"'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8]">
                    <span className="text-[10px] text-[#526A7B] font-semibold block uppercase">Spacing / Margin</span>
                    <span className="font-extrabold text-[#204563] font-mono">
                      {tpl.spacingIn}" / {tpl.marginIn}"
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FAF7F1] border border-[#E5D9C8]">
                    <span className="text-[10px] text-[#526A7B] font-semibold block uppercase">Nesting Mode</span>
                    <span className="font-extrabold text-[#204563] font-mono text-[11px]">
                      {tpl.algorithm === 'true-shape' ? 'True-Shape' : 'Box Packing'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-[#E5D9C8] flex items-center justify-between gap-2 mt-4">
                {tpl.badge === 'CUSTOM' ? (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustom(tpl.id, e)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold p-1 transition-colors cursor-pointer"
                    title="Delete custom template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center space-x-1.5 text-emerald-600 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tested Standard</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleApply(tpl)}
                  className="px-4 py-2 rounded-xl bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer group-hover:scale-102"
                >
                  <span>Apply Template</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#204563]" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
