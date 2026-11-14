import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  Crop,
  Wand2,
  Cpu,
  ChevronDown,
  Plus,
  ShieldCheck,
  HelpCircle,
  Sliders,
  Activity,
  CheckCircle2,
  Pipette,
  Eraser,
  SquareDashedBottom,
  CircleDot,
  PenTool,
  Type,
  Maximize2,
  BookOpen,
  Play,
  FileStack,
  Scissors,
  LogOut,
  User,
  Globe,
  Building2,
  Printer,
  LogIn,
  X
} from 'lucide-react';
import { UserProfile } from '../types/auth';

interface ToolItem {
  id: string;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeBg?: string;
  iconColor: string;
}

interface Category {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  activeBg: string;
  tools: ToolItem[];
}

interface TopNavBarProps {
  onSelectTool: (toolId: string) => void;
  onCreateLayout?: () => void;
  onLoadMultiDemo: () => void;
  onLoadRepeatDemo: () => void;
  onOpenAudit: () => void;
  onOpenGuide: () => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onLogout?: () => void;
  onGoToLanding?: () => void;
  onOpenProfile?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  onSelectTool,
  onLoadMultiDemo,
  onLoadRepeatDemo,
  onOpenAudit,
  onOpenGuide,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onGoToLanding,
  onOpenProfile
}) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [demoMenuOpen, setDemoMenuOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const navRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
        setDemoMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnterCategory = (catId: string) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setDemoMenuOpen(false);
    setActiveDropdown(catId);
  };

  const handleMouseLeaveCategory = () => {
    leaveTimerRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 160);
  };

  const categories: Category[] = [
    {
      id: 'fix',
      name: 'Fix & Quality',
      subtitle: 'Upscale, color, pixel fix & audit',
      icon: Sparkles,
      accentColor: 'text-purple-400',
      activeBg: 'bg-purple-600',
      tools: [
        {
          id: 'upscale',
          name: 'Image Upscaler',
          desc: 'Sharpen & enlarge resolution',
          icon: Maximize2,
          badge: 'AI',
          badgeBg: 'bg-purple-600',
          iconColor: 'text-purple-400'
        },
        {
          id: 'color-tone',
          name: 'Color & Tone',
          desc: 'Levels, saturation & balance',
          icon: Sliders,
          iconColor: 'text-amber-400'
        },
        {
          id: 'pixel-doctor',
          name: 'Pixel Doctor',
          desc: 'Fix stray pixels & fringes',
          icon: Activity,
          iconColor: 'text-teal-400'
        },
        {
          id: 'print-check',
          name: 'Print Check',
          desc: 'Automated pre-print audit',
          icon: CheckCircle2,
          iconColor: 'text-emerald-400'
        }
      ]
    },
    {
      id: 'cut',
      name: 'Cut & Adjust',
      subtitle: 'Remove color, crop, erase & border',
      icon: Crop,
      accentColor: 'text-blue-400',
      activeBg: 'bg-blue-600',
      tools: [
        {
          id: 'bg-remover',
          name: 'Background Remover',
          desc: 'Auto cut-out transparent background',
          icon: Scissors,
          badge: 'AUTO',
          badgeBg: 'bg-blue-600',
          iconColor: 'text-blue-400'
        },
        {
          id: 'remove-color',
          name: 'Remove/Replace Color',
          desc: 'Pick & swap specific color channels',
          icon: Pipette,
          iconColor: 'text-indigo-400'
        },
        {
          id: 'crop-clean',
          name: 'Crop & Clean',
          desc: 'Trim transparent padding & rotate',
          icon: Crop,
          iconColor: 'text-sky-400'
        },
        {
          id: 'eraser',
          name: 'Eraser',
          desc: 'Manual wipe & cleanup tool',
          icon: Eraser,
          iconColor: 'text-slate-400'
        },
        {
          id: 'border-knockout',
          name: 'Border Knockout',
          desc: 'Punch-out frames & borders',
          icon: SquareDashedBottom,
          iconColor: 'text-rose-400'
        }
      ]
    },
    {
      id: 'style',
      name: 'Style & Effects',
      subtitle: 'AI styles, texture, halftone & outline',
      icon: Wand2,
      accentColor: 'text-pink-400',
      activeBg: 'bg-pink-600',
      tools: [
        {
          id: 'texture',
          name: 'Texture Effects',
          desc: '11 creative color & texture filters',
          icon: Layers,
          badge: '11',
          badgeBg: 'bg-purple-600',
          iconColor: 'text-purple-400'
        },
        {
          id: 'halftone',
          name: 'Halftone',
          desc: 'Print-ready dot screen filter',
          icon: CircleDot,
          badge: 'NEW',
          badgeBg: 'bg-emerald-500',
          iconColor: 'text-emerald-400'
        },
        {
          id: 'stroke-outline',
          name: 'Stroke / Outline',
          desc: 'Contour edge outline & choke',
          icon: PenTool,
          iconColor: 'text-cyan-400'
        }
      ]
    },
    {
      id: 'create',
      name: 'Create & Convert',
      subtitle: 'Text, vector, recreate & guide',
      icon: Cpu,
      accentColor: 'text-teal-400',
      activeBg: 'bg-teal-600',
      tools: [
        {
          id: 'tiff-export',
          name: 'TIFF Export (RIP)',
          desc: 'W1 underbase + CMYK multi-channel',
          icon: FileStack,
          badge: 'RIP',
          badgeBg: 'bg-indigo-600',
          iconColor: 'text-indigo-400'
        },
        {
          id: 'text-number',
          name: 'Text & Number',
          desc: 'Custom jersey typography',
          icon: Type,
          iconColor: 'text-blue-400'
        },
        {
          id: 'vectorize',
          name: 'Image Vectoriser',
          desc: 'Trace raster artwork into vectors',
          icon: Sparkles,
          badge: 'AI',
          badgeBg: 'bg-purple-600',
          iconColor: 'text-purple-400'
        },
        {
          id: 'recreate-ai',
          name: 'Recreate with AI',
          desc: 'Redraw low-res artwork with AI',
          icon: Cpu,
          badge: 'AI',
          badgeBg: 'bg-pink-600',
          iconColor: 'text-pink-400'
        },
        {
          id: 'guide',
          name: 'Guide',
          desc: 'DTF production manual',
          icon: BookOpen,
          iconColor: 'text-teal-400'
        }
      ]
    }
  ];

  const handleToolClick = (toolId: string) => {
    setActiveDropdown(null);
    onSelectTool(toolId);
  };

  return (
    <header
      ref={navRef}
      className="bg-[#090d19] border-b border-[#1b2238] text-slate-200 select-none z-50 flex-shrink-0 relative shadow-sm"
    >
      {/* ================= DESKTOP VIEW (lg and up) ================= */}
      <div className="hidden lg:flex h-16 w-full items-center justify-between px-4 sm:px-6">
        {/* ================= LEFT SECTION: BRAND & CREATE BUTTON ================= */}
        <div className="flex items-center space-x-3.5 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 flex-shrink-0">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center space-x-1.5 leading-none">
                <span className="font-black text-sm tracking-tight text-white whitespace-nowrap">
                  DTF Set Files
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium whitespace-nowrap mt-1 leading-none">
                DTF Gang Sheet Builder
              </div>
            </div>
          </div>
        </div>

        {/* ================= CENTER SECTION: THE 4 PREP OPTIONS ================= */}
        <div className="flex items-center space-x-1 bg-[#101426] p-1 rounded-2xl border border-slate-800/90 text-xs shadow-inner shadow-black/30 mx-2 flex-shrink-0">
          {categories.map((cat) => {
            const isOpen = activeDropdown === cat.id;
            const Icon = cat.icon;

            return (
              <div
                key={cat.id}
                className="relative"
                onMouseEnter={() => handleMouseEnterCategory(cat.id)}
                onMouseLeave={handleMouseLeaveCategory}
              >
                <button
                  onClick={() => {
                    setDemoMenuOpen(false);
                    setActiveDropdown(isOpen ? null : cat.id);
                  }}
                  className={`h-8.5 px-3.5 rounded-xl font-bold text-xs flex items-center space-x-2 whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isOpen
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/35'
                      : 'text-slate-300 hover:text-white hover:bg-[#181f38]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isOpen ? 'text-white' : cat.accentColor}`} />
                  <span className="leading-none">{cat.name}</span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {/* Floating Dropdown Menu (Opens on hover or click) */}
                {isOpen && (
                  <div
                    className="absolute top-full left-0 pt-2 w-84 z-50 text-left animate-in fade-in slide-in-from-top-1 duration-150"
                    onMouseEnter={() => {
                      if (leaveTimerRef.current) {
                        clearTimeout(leaveTimerRef.current);
                        leaveTimerRef.current = null;
                      }
                    }}
                    onMouseLeave={handleMouseLeaveCategory}
                  >
                    <div className="bg-[#0e1324] border border-[#1e2746] rounded-2xl shadow-2xl p-2.5">
                      {/* Category Header */}
                      <div className="px-3 py-2 border-b border-slate-800/80 mb-1.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <Icon className={`w-4 h-4 ${cat.accentColor}`} />
                            <span className="font-extrabold text-xs text-white">
                              {cat.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {cat.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Tool Items Grid */}
                      <div className="space-y-1">
                        {cat.tools.map((tool) => {
                          const ToolIcon = tool.icon;
                          return (
                            <button
                              key={tool.id}
                              onClick={() => handleToolClick(tool.id)}
                              className="w-full p-2 rounded-xl hover:bg-[#161d36] transition-colors flex items-start space-x-3 text-left group cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-lg bg-[#19223c] border border-slate-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform mt-0.5 shadow-xs">
                                <ToolIcon className={`w-4 h-4 ${tool.iconColor}`} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-200 group-hover:text-white leading-snug">
                                    {tool.name}
                                  </span>
                                  {tool.badge && (
                                    <span
                                      className={`text-[9px] font-black uppercase tracking-wider text-white px-1.5 py-0.2 rounded-full ${
                                        tool.badgeBg || 'bg-purple-600'
                                      }`}
                                    >
                                      {tool.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium leading-snug">
                                  {tool.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ================= RIGHT SECTION: DEMOS, AUDIT, GUIDE, AVATAR ================= */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0">
          {/* Compact Demos Button Group or Pills */}
          <div className="relative">
            <button
              onClick={() => {
                setActiveDropdown(null);
                setDemoMenuOpen(!demoMenuOpen);
              }}
              className="h-8.5 px-3 bg-[#13192f] hover:bg-[#1b2342] border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 hover:text-white flex items-center space-x-1.5 whitespace-nowrap transition-colors shadow-2xs cursor-pointer"
              title="Load demo samples"
            >
              <Play className="w-3 h-3 text-indigo-400 fill-indigo-400" />
              <span>Demos</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${demoMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Demos Dropdown */}
            {demoMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#0e1324] border border-[#1e2746] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    setDemoMenuOpen(false);
                    onLoadMultiDemo();
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-[#161d36] text-left transition-colors flex flex-col cursor-pointer"
                >
                  <div className="font-bold text-xs text-white">Multi-Design Demo</div>
                  <div className="text-[11px] text-slate-400">Load 4 mixed artwork samples</div>
                </button>

                <button
                  onClick={() => {
                    setDemoMenuOpen(false);
                    onLoadRepeatDemo();
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-[#161d36] text-left transition-colors flex flex-col cursor-pointer"
                >
                  <div className="font-bold text-xs text-white">Repeat 10× Demo</div>
                  <div className="text-[11px] text-slate-400">Load repeated pattern on roll</div>
                </button>
              </div>
            )}
          </div>

          {/* Print Audit Pill */}
          <button
            onClick={onOpenAudit}
            className="h-8.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 rounded-xl text-xs font-bold text-emerald-300 flex items-center space-x-1.5 whitespace-nowrap transition-colors shadow-2xs cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Print Audit</span>
          </button>

          {/* How to use */}
          <button
            onClick={onOpenGuide}
            className="h-8.5 px-2.5 bg-[#13192f] hover:bg-[#1b2342] border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 whitespace-nowrap transition-colors shadow-2xs cursor-pointer"
            title="DTF Gang Sheet Production Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="hidden xl:inline">How to use</span>
          </button>

          {/* User Profile Avatar & Menu Popover */}
          <div className="relative">
            {currentUser ? (
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`w-8.5 h-8.5 rounded-full bg-gradient-to-tr ${currentUser.avatarColor || 'from-purple-500 to-indigo-600'} text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-indigo-400/40 hover:scale-105 transition-all cursor-pointer flex-shrink-0`}
                title={`${currentUser.name} (${currentUser.companyName})`}
              >
                {currentUser.initials}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="h-8.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* User Popover Menu */}
            {userMenuOpen && currentUser && (
              <div className="absolute right-0 top-11 w-64 bg-[#0d1326] border border-[#222c4d] rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-2 border-b border-slate-800">
                  <div className="font-black text-xs text-white leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                  <div className="mt-1 flex items-center space-x-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {currentUser.plan}
                    </span>
                  </div>
                </div>

                <div className="py-1 text-xs text-slate-300 space-y-0.5">
                  <div className="px-2 py-1.5 flex items-center space-x-2 text-[11px] text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{currentUser.companyName}</span>
                  </div>

                  <div className="px-2 py-1.5 flex items-center space-x-2 text-[11px] text-slate-400">
                    <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{currentUser.printerModel}</span>
                  </div>

                  <div className="h-px bg-slate-800/80 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenProfile?.();
                    }}
                    className="w-full px-2 py-1.5 hover:bg-indigo-600/20 text-indigo-300 hover:text-white rounded-xl text-left transition-colors flex items-center space-x-2 cursor-pointer font-medium"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Operator Profile & Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout?.();
                    }}
                    className="w-full px-2 py-1.5 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 rounded-xl text-left transition-colors flex items-center space-x-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MOBILE VIEW (< lg) ================= */}
      <div className="lg:hidden flex flex-col w-full">
        {/* Mobile Top Row: Brand & Quick Actions */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-[#182035]">
          {/* Brand */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xs sm:text-sm tracking-tight text-white leading-tight">
                DTF Set Files
              </span>
              <span className="text-[10px] text-indigo-300 font-medium leading-none">
                Gang Sheet Builder
              </span>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-2">
            {/* Demos Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(null);
                  setDemoMenuOpen(!demoMenuOpen);
                }}
                className="h-8 px-2.5 bg-[#13192f] hover:bg-[#1b2342] border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 flex items-center space-x-1"
              >
                <Play className="w-3 h-3 text-indigo-400 fill-indigo-400" />
                <span className="text-[11px]">Demos</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${demoMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {demoMenuOpen && (
                <div className="fixed inset-x-4 top-20 max-w-xs mx-auto bg-[#0e1324] border border-[#1e2746] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2 border-b border-slate-800 text-[11px] font-bold text-indigo-300">
                    Sample Datasets
                  </div>
                  <button
                    onClick={() => {
                      setDemoMenuOpen(false);
                      onLoadMultiDemo();
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-[#161d36] text-left transition-colors flex flex-col"
                  >
                    <div className="font-bold text-xs text-white">Multi-Design Demo</div>
                    <div className="text-[10px] text-slate-400">Load 4 mixed artwork samples</div>
                  </button>

                  <button
                    onClick={() => {
                      setDemoMenuOpen(false);
                      onLoadRepeatDemo();
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-[#161d36] text-left transition-colors flex flex-col"
                  >
                    <div className="font-bold text-xs text-white">Repeat 10× Demo</div>
                    <div className="text-[10px] text-slate-400">Load repeated pattern on roll</div>
                  </button>
                </div>
              )}
            </div>

            {/* Print Audit Button */}
            <button
              type="button"
              onClick={onOpenAudit}
              className="h-8 px-2.5 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-xs font-bold text-emerald-300 flex items-center space-x-1"
              title="Preflight & DPI Audit"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] hidden sm:inline">Audit</span>
            </button>

            {/* User Profile Avatar / Sign In */}
            <div className="relative">
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`w-8 h-8 rounded-full bg-gradient-to-tr ${
                    currentUser.avatarColor || 'from-purple-500 to-indigo-600'
                  } text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-indigo-400/40`}
                >
                  {currentUser.initials}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('login')}
                  className="h-8 px-3 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center space-x-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Sign In</span>
                </button>
              )}

              {userMenuOpen && currentUser && (
                <div className="fixed inset-x-4 top-20 max-w-xs mx-auto bg-[#0d1326] border border-[#222c4d] rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-2 border-b border-slate-800">
                    <div className="font-black text-xs text-white leading-tight">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                    <div className="mt-1 flex items-center space-x-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {currentUser.plan}
                      </span>
                    </div>
                  </div>

                  <div className="py-1 text-xs text-slate-300 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenProfile?.();
                      }}
                      className="w-full px-2 py-2 hover:bg-indigo-600/20 text-indigo-300 hover:text-white rounded-xl text-left transition-colors flex items-center space-x-2"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Operator Profile & Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout?.();
                      }}
                      className="w-full px-2 py-2 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 rounded-xl text-left transition-colors flex items-center space-x-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Second Row: Horizontal Scrollable Category Toolbar */}
        <div className="h-10 px-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar scroll-smooth bg-[#060913]">
          {categories.map((cat) => {
            const isOpen = activeDropdown === cat.id;
            const Icon = cat.icon;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setDemoMenuOpen(false);
                  setUserMenuOpen(false);
                  setActiveDropdown(isOpen ? null : cat.id);
                }}
                className={`h-7 px-2.5 rounded-lg font-bold text-[11px] flex items-center space-x-1.5 whitespace-nowrap flex-shrink-0 transition-all ${
                  isOpen
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 bg-[#101426] border border-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-3 h-3 ${isOpen ? 'text-white' : cat.accentColor}`} />
                <span>{cat.name}</span>
                <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180 text-white' : 'text-slate-500'}`} />
              </button>
            );
          })}

          {/* Guide Shortcut */}
          <button
            type="button"
            onClick={onOpenGuide}
            className="h-7 px-2.5 rounded-lg font-bold text-[11px] flex items-center space-x-1 whitespace-nowrap flex-shrink-0 text-slate-300 bg-[#101426] border border-slate-800 hover:text-white"
          >
            <HelpCircle className="w-3 h-3 text-indigo-400" />
            <span>Guide</span>
          </button>
        </div>

        {/* Mobile Dropdown Dialog & Backdrop */}
        {activeDropdown && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 select-none">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setActiveDropdown(null)}
            />

            {/* Modal Dialog for Category Tools */}
            {(() => {
              const activeCat = categories.find((c) => c.id === activeDropdown);
              if (!activeCat) return null;
              const Icon = activeCat.icon;

              return (
                <div className="relative bg-[#0e1324] border border-[#1e2746] rounded-2xl shadow-2xl p-3 z-10 w-full max-w-sm animate-in fade-in zoom-in-95 duration-150 max-h-[75vh] overflow-y-auto">
                  {/* Category Header */}
                  <div className="px-2 py-2 border-b border-slate-800 mb-2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-4 h-4 ${activeCat.accentColor}`} />
                        <span className="font-extrabold text-xs text-white">{activeCat.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{activeCat.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(null)}
                      className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tools List */}
                  <div className="space-y-1">
                    {activeCat.tools.map((tool) => {
                      const ToolIcon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => handleToolClick(tool.id)}
                          className="w-full p-2.5 rounded-xl hover:bg-[#161d36] active:bg-indigo-600/30 transition-colors flex items-start space-x-3 text-left group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#19223c] border border-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <ToolIcon className={`w-4 h-4 ${tool.iconColor}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-200 group-hover:text-white">
                                {tool.name}
                              </span>
                              {tool.badge && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-white px-1.5 py-0.2 rounded-full bg-purple-600">
                                  {tool.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                              {tool.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </header>
  );
};
