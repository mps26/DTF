import React, { useState, useMemo } from 'react';
import {
  Layers,
  Sparkles,
  Cpu,
  ShieldCheck,
  Printer,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Sliders,
  Play,
  FileStack,
  RefreshCw,
  BarChart3,
  DollarSign,
  Zap,
  Clock,
  User,
  LogIn,
  LogOut,
  Check,
  Star,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Calculator,
  LayoutGrid,
  FileCheck,
  Percent,
  Scissors,
  Upload,
  ScanLine,
  PackageCheck,
  Download,
  Settings2
} from 'lucide-react';
import { UserProfile } from '../types/auth';

interface LandingPageProps {
  currentUser: UserProfile | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onLaunchStudio: () => void;
  onOpenTiffStudio: () => void;
  onOpenTemplates?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onLaunchStudio,
  onOpenTiffStudio,
  onOpenTemplates
}) => {
  // Guard studio access: redirect unauthenticated users to Sign In / Register
  const handleProtectedAction = (action: () => void) => {
    if (!currentUser) {
      onOpenAuth('login');
      return;
    }
    action();
  };

  // Calculator state
  const [calcQuantity, setCalcQuantity] = useState<number>(60);
  const [calcWidth, setCalcWidth] = useState<number>(10);
  const [calcHeight, setCalcHeight] = useState<number>(11);
  const [calcCostPerFoot, setCalcCostPerFoot] = useState<number>(2.5);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Calculation outputs
  const calcResults = useMemo(() => {
    // 22" printable film width
    const filmWidth = 22;
    // Area of all designs in sq inches
    const totalDesignArea = calcQuantity * (calcWidth * calcHeight);

    // Standard un-optimized layout (approx 65% efficiency)
    const unoptimizedArea = totalDesignArea / 0.65;
    const unoptimizedLengthInches = unoptimizedArea / filmWidth;
    const unoptimizedFeet = Math.ceil(unoptimizedLengthInches / 12);
    const unoptimizedCost = unoptimizedFeet * calcCostPerFoot;

    // DTF Layout PRO True-Shape Nesting (approx 94% efficiency)
    const optimizedArea = totalDesignArea / 0.94;
    const optimizedLengthInches = optimizedArea / filmWidth;
    const optimizedFeet = Math.ceil(optimizedLengthInches / 12);
    const optimizedCost = optimizedFeet * calcCostPerFoot;

    const feetSaved = Math.max(0, unoptimizedFeet - optimizedFeet);
    const dollarsSaved = Math.max(0, unoptimizedCost - optimizedCost);
    const percentSaved = unoptimizedCost > 0 ? Math.round((dollarsSaved / unoptimizedCost) * 100) : 0;

    return {
      optimizedFeet,
      unoptimizedFeet,
      feetSaved,
      dollarsSaved,
      percentSaved,
      optimizedCost: optimizedCost.toFixed(2),
      unoptimizedCost: unoptimizedCost.toFixed(2)
    };
  }, [calcQuantity, calcWidth, calcHeight, calcCostPerFoot]);

  const faqs = [
    {
      q: 'How does the Multi-Channel TIFF RIP Export work?',
      a: 'DTF Layout PRO automatically analyzes the transparency mask of every design on your gang roll and compiles native 300 DPI Photometric 5 multi-channel TIFFs. It auto-generates a dedicated W1 White Underbase spot channel with an automated 1-pixel circular choke to eliminate white border bleed on dark textiles. In UVDTF mode, it also embeds a dedicated W2 Varnish gloss pass.'
    },
    {
      q: 'Which RIP software packages and printers are officially verified?',
      a: 'The generated multi-channel TIFFs and high-resolution PNGs are verified on Maintop (5.3, 6.0, 6.1), Hosonsoft, Cadlink Digital Factory, Wasatch SoftRIP, SAi PhotoPRINT, Epson Edge Print, and AcroRIP. They work seamlessly on dual and quad Epson i3200, XP600, TX800, L1800, and standard 22" - 24" roll-to-roll and flatbed printers.'
    },
    {
      q: 'What is the maximum gang sheet roll size supported?',
      a: 'The engine strictly conforms to commercial roll standards: up to 22 inches (558.8 mm) in width and up to 100 continuous linear inches (2,540 mm) per single gang sheet, rendered in native 300 DPI without browser memory limits or pixel degradation.'
    },
    {
      q: 'How does True-Shape Nesting save 20-30% more film than standard box packing?',
      a: 'Unlike standard rectangular box packing that leaves large empty voids around irregular designs, True-Shape nesting inspects the exact alpha silhouette. Smaller logos, sleeve badges, and pocket tags are automatically nested into the negative spaces of larger front and back graphics with 90° rotation allowed.'
    },
    {
      q: 'What is the difference between DTF mode and UV-DTF mode?',
      a: 'Standard DTF exports CMYK color channels plus a W1 White Underbase channel. UV-DTF mode enables an optional W2 Varnish gloss channel, allowing dual-pass UV flatbed or roll printers to print color, white opacity mask, and raised glossy protective coating in a single pass.'
    },
    {
      q: 'Are my confidential artwork files uploaded to a public cloud?',
      a: 'No. All image processing, alpha boundary calculations, True-Shape nesting, and 300 DPI multi-channel TIFF generations run locally on your workstation inside hardware-accelerated Canvas buffers. Your customer designs and confidential prints stay on your machine.'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans selection:bg-indigo-600 selection:text-white">
      {/* PROFESSIONAL UNCLUTTERED TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Clean Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => handleProtectedAction(onLaunchStudio)}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-lg tracking-tight text-slate-900 uppercase">
                DTF Layout <span className="text-indigo-600">PRO</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                RIP 2.0
              </span>
            </div>
          </div>

          {/* Center Navigation Links - Spacious & Elegant */}
          <nav className="hidden lg:flex items-center space-x-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</a>
            <button
              type="button"
              onClick={() => handleProtectedAction(onOpenTiffStudio)}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              RIP TIFF Tech
            </button>
            <button
              type="button"
              onClick={() => handleProtectedAction(() => onOpenTemplates ? onOpenTemplates() : onLaunchStudio())}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Roll Sizes
            </button>
            <a href="#faq" className="hover:text-indigo-600 transition-colors">FAQ</a>
          </nav>

          {/* Right Action CTAs & Auth Controls */}
          <div className="flex items-center space-x-3">
            {currentUser ? (
              /* User logged in state */
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</span>
                  <span className="text-[11px] text-slate-500 font-medium truncate max-w-[140px]">
                    {currentUser.companyName}
                  </span>
                </div>

                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-tr ${currentUser.avatarColor || 'from-indigo-600 to-purple-600'} text-white flex items-center justify-center font-bold text-xs shadow-sm border-2 border-indigo-200`}
                  title={`${currentUser.name} (${currentUser.companyName})`}
                >
                  {currentUser.initials}
                </div>

                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <span>Open Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Guest / Not logged in state */
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold border border-slate-200 transition-all cursor-pointer"
                >
                  Register
                </button>

                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <span>Launch Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION - PURE WHITE WITH SOFT BLUEPRINT PATTERN */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-white via-indigo-50/20 to-white">
        {/* Subtle Light Blueprint Grid */}
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e2e8f0 1px, transparent 1px),
              linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Ambient Subtle Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-100/60 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Status Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>COMMERCIAL PRINT ROLL AUTOMATION</span>
              <span className="text-indigo-300">•</span>
              <span className="text-indigo-800">True-Shape Nesting Engine</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-950 tracking-tight leading-[1.15]">
              Industrial DTF & UV-DTF{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
                Gang Sheet Builder
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Eliminate substrate waste and save hours of manual prepress. Pack hundreds of graphics into optimized rolls up to <span className="text-slate-900 font-extrabold">22" × 100"</span>, auto-generate <span className="text-slate-900 font-extrabold">W1 White Underbase</span> with 1px choke, and export 100% RIP-ready multi-channel TIFFs.
            </p>

            {/* CTA Button Group */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handleProtectedAction(onLaunchStudio)}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/25 flex items-center justify-center space-x-2.5 transition-all cursor-pointer group"
              >
                <Layers className="w-4 h-4 text-white" />
                <span>Open Gang Sheet Studio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleProtectedAction(onOpenTiffStudio)}
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 font-bold text-sm rounded-2xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <FileStack className="w-4 h-4 text-purple-600" />
                <span>RIP TIFF Compositor</span>
              </button>
            </div>

            {/* Compatible RIPs Tagline */}
            <div className="pt-4 flex items-center justify-center space-x-4 text-xs text-slate-500 font-mono">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-700 font-semibold">Maintop</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-700 font-semibold">Hosonsoft</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-700 font-semibold">Cadlink</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-700 font-semibold">Wasatch</span>
              </span>
            </div>
          </div>

          {/* INTERACTIVE HERO PREVIEW CONSOLE - CLEAN WHITE WORKSTATION */}
          <div className="mt-14 max-w-5xl mx-auto rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            {/* Console Window Header */}
            <div className="h-12 bg-slate-50 border-b border-slate-200 px-6 flex items-center justify-between text-xs text-slate-600 font-mono">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-slate-900 font-bold">DTF_PRODUCTION_ROLL_22x60.TIF</span>
              </div>
              <div className="flex items-center space-x-3 text-[11px]">
                <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  FILM YIELD: 98.4%
                </span>
                <span className="text-slate-300">•</span>
                <span>300 DPI</span>
                <span className="text-slate-300">•</span>
                <span>CHOKE: 1 PX</span>
              </div>
            </div>

            {/* Console Mock Canvas */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-50/40">
              {/* Left Roll Graphic */}
              <div className="md:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative flex flex-col items-center justify-center">
                <div className="w-full h-64 rounded-xl border border-dashed border-indigo-300 relative overflow-hidden flex flex-wrap gap-2.5 p-3.5 items-center justify-center bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[size:16px_16px]">
                  {/* Mock nested items */}
                  <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 text-center font-mono text-[10px] text-indigo-900 shadow-xs">
                    <div className="w-16 h-12 bg-indigo-600/10 rounded flex items-center justify-center font-bold text-indigo-700 mb-1 border border-indigo-100">
                      10" x 11"
                    </div>
                    <span className="font-bold">Back Graphic #1</span>
                  </div>

                  <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200 text-center font-mono text-[10px] text-purple-900 shadow-xs">
                    <div className="w-16 h-12 bg-purple-600/10 rounded flex items-center justify-center font-bold text-purple-700 mb-1 border border-purple-100">
                      10" x 11"
                    </div>
                    <span className="font-bold">Back Graphic #2</span>
                  </div>

                  <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-center font-mono text-[9px] text-emerald-900 shadow-xs">
                    <div className="w-10 h-8 bg-emerald-600/10 rounded flex items-center justify-center font-bold text-emerald-700 mb-1 border border-emerald-100">
                      4" x 4"
                    </div>
                    <span className="font-bold">Chest Logo</span>
                  </div>

                  <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-center font-mono text-[9px] text-amber-900 shadow-xs">
                    <div className="w-10 h-8 bg-amber-600/10 rounded flex items-center justify-center font-bold text-amber-700 mb-1 border border-amber-100">
                      4" x 4"
                    </div>
                    <span className="font-bold">Sleeve Tag</span>
                  </div>

                  <div className="p-2.5 bg-cyan-50 rounded-xl border border-cyan-200 text-center font-mono text-[10px] text-cyan-900 shadow-xs">
                    <div className="w-16 h-12 bg-cyan-600/10 rounded flex items-center justify-center font-bold text-cyan-700 mb-1 border border-cyan-100">
                      10" x 11"
                    </div>
                    <span className="font-bold">Back Graphic #3</span>
                  </div>

                  {/* Corner dimension tags */}
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded text-[9px] font-mono text-slate-700 border border-slate-200 shadow-xs">
                    WIDTH: 22.00 IN
                  </div>
                  <div className="absolute bottom-2 right-2 bg-emerald-50/90 backdrop-blur-sm px-2.5 py-0.5 rounded text-[9px] font-mono text-emerald-700 font-bold border border-emerald-200 shadow-xs">
                    WASTE: 1.6%
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between w-full text-xs text-slate-600 font-mono">
                  <span>Feed Length: 60.00 inches</span>
                  <span>Spacing: 0.30 in • Margin: 0.25 in</span>
                </div>
              </div>

              {/* Right Live Preflight Checklist */}
              <div className="md:col-span-5 space-y-4">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Real-Time Preflight Inspection</span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">White Ink Underbase (W1)</div>
                        <div className="text-[10px] text-slate-500 font-mono">1px Round Choke Applied</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                      VERIFIED
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Resolution & DPI Audit</div>
                        <div className="text-[10px] text-slate-500 font-mono">All assets {'>'}= 300 Native DPI</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                      OPTIMAL
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Max Roll Limits Check</div>
                        <div className="text-[10px] text-slate-500 font-mono">Within 22" × 100" boundaries</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                      COMPLIANT
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <span>Build This Gang Sheet In Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INDUSTRIAL STATS KPI COUNTER STRIP */}
      <section className="border-y border-slate-200 bg-slate-50 py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-indigo-600 font-mono">98.4%</div>
              <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Average Film Yield</div>
              <div className="text-xs text-slate-500">True-shape nesting efficiency</div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-purple-600 font-mono">22" × 100"</div>
              <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Max Single Roll</div>
              <div className="text-xs text-slate-500">Full industrial roll length</div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-cyan-600 font-mono">1 px</div>
              <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Auto White Choke</div>
              <div className="text-xs text-slate-500">Zero border bleed on garments</div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">300 DPI</div>
              <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Native RIP Output</div>
              <div className="text-xs text-slate-500">Lossless Photometric 5 TIFF</div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE INDUSTRIAL PILLARS */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="text-xs font-black uppercase tracking-widest text-indigo-600">
            ENGINEERED FOR PRODUCTION PRINT HOUSES
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Everything You Need For High-Velocity Gang Rolls
          </h2>
          <p className="text-sm text-slate-600">
            From raw customer PNGs to RIP-ready multi-channel TIFFs in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                True-Shape Nesting Engine
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically detects transparency silhouettes and nests smaller logos into the cavities of larger artwork. Supports 90° rotation, custom margins, and spacing down to 0.1".
              </p>
            </div>
            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-indigo-600 font-bold">
              <span>Saves ~24% on PET Film</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-purple-300 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileStack className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Embedded RIP Spot Channels
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Export native Photometric 5 CMYK TIFFs with embedded W1 Spot White Underbase and optional W2 Varnish gloss coats. No manual spot channel authoring required in Photoshop.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-purple-600 font-bold">
              <span>100% RIP Software Ready</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-cyan-300 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                AI Preflight & Image Toolkit
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automatic background removal, lossless alpha bounding-box cropping, AI upscaling to 300 DPI, and pixel bleed audit prevents costly garment reprints and head strikes.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-cyan-600 font-bold">
              <span>Zero Print Bleed Rejects</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>


      {/* HOW IT WORKS — PRODUCTION PIPELINE */}
      <section id="how-it-works" className="py-24 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5" />
              <span>Production Workflow</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              From Artwork to Print-Ready TIFF<br />
              <span className="text-indigo-600">in Five Precise Steps</span>
            </h2>
            <p className="text-sm text-slate-500">
              A fully automated, industrial-grade pipeline engineered for commercial DTF &amp; UV-DTF print houses.
            </p>
          </div>

          {/* Pipeline Steps — Alternating Left/Right Layout */}
          <div className="relative">

            {/* Vertical connector line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-100 via-indigo-200 to-slate-100 hidden lg:block" style={{transform:'translateX(-50%)'}}></div>

            <div className="space-y-12">

              {/* STEP 1 — Upload Artwork */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="lg:text-right lg:pr-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-indigo-500">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black">1</span>
                    <span>Upload Artwork</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Drop Your PNG / JPG Files</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Upload single or multi-design batches at any resolution. The engine reads pixel dimensions, extracts true alpha transparency, and auto-checks DPI for print compliance — flagging anything below 300 DPI before you proceed.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">PNG / JPG</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">Batch Upload</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">✓ DPI Preflight</span>
                  </div>
                </div>

                {/* Center icon node */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30 items-center justify-center z-10">
                  <Upload className="w-5 h-5 text-white" />
                </div>

                <div className="lg:pl-16">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preflight Inspector</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">PASS</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['design_A.png', 'logo_B.png', 'graphic_C.png'].map((f, i) => (
                        <div key={i} className="rounded-xl bg-white border border-slate-200 p-2 text-center">
                          <div className="w-full h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 mb-1.5"></div>
                          <span className="text-[9px] text-slate-500 truncate block">{f}</span>
                          <span className="text-[9px] font-bold text-emerald-600">300 DPI ✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2 — Configure Roll Template */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="lg:order-2 lg:pl-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-purple-500">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px] font-black">2</span>
                    <span>Configure Roll Template</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Select Roll Size &amp; Print Parameters</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Choose from industry-standard roll templates (22"x60", 22"x100", 11"x17" and more) or define a custom sheet. Set spacing margins, choke px for white underbase bleed-prevention, and DPI output mode.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">22" x 100"</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">1px Choke</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">300 DPI</span>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-bold">Custom Margins</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-purple-600 shadow-lg shadow-purple-600/30 items-center justify-center z-10">
                  <Settings2 className="w-5 h-5 text-white" />
                </div>

                <div className="lg:order-1 lg:pr-16">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Roll Configuration</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Template</div>
                        <div className="text-sm font-black text-slate-900">22" x 100"</div>
                        <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Max Roll</div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Choke</div>
                        <div className="text-sm font-black text-slate-900">1 px</div>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Bleed-safe</div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Output DPI</div>
                        <div className="text-sm font-black text-slate-900">300 DPI</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Photometric 5</div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Spacing</div>
                        <div className="text-sm font-black text-slate-900">0.25"</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Inter-design gap</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3 — True-Shape Auto Nesting */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="lg:text-right lg:pr-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-cyan-500">
                    <span className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] font-black">3</span>
                    <span>True-Shape Auto Nesting</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Algorithmic Pack Optimization</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    The nesting engine traces each design's alpha boundary (true-shape, not bounding-box) and fills the roll using a bin-packing algorithm. Designs rotate, interlock, and stack — squeezing every square inch of film without overlap.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 text-[11px] font-bold">True-Shape Trace</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">Auto Rotate</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">Zero Overlap</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-cyan-600 shadow-lg shadow-cyan-600/30 items-center justify-center z-10">
                  <Layers className="w-5 h-5 text-white" />
                </div>

                <div className="lg:pl-16">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Film Utilization</span>
                      <span className="text-xs font-black text-cyan-600">98.4%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500" style={{width:'98.4%'}}></div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 pt-2">
                      {Array.from({length:20}).map((_,i) => (
                        <div key={i} className={`h-8 rounded-md ${i % 7 === 0 ? 'bg-indigo-200' : i % 5 === 0 ? 'bg-purple-200' : i % 3 === 0 ? 'bg-cyan-200' : 'bg-indigo-100'}`}></div>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 text-center pt-1">Packed gang sheet preview — 300 DPI</div>
                  </div>
                </div>
              </div>

              {/* STEP 4 — Multi-Channel Separation */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="lg:order-2 lg:pl-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-amber-500">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-black">4</span>
                    <span>Multi-Channel Separation</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Auto-Generate W1, CMYK &amp; W2 Channels</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    The RIP engine automatically separates the composed sheet into three spot channels: <strong>W1 White Underbase</strong> (computed from alpha with 1px choke), <strong>CMYK Color</strong>, and <strong>W2 Varnish/Gloss</strong> for UV-DTF. No manual Photoshop work required.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold">W1 White Underbase</span>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">CMYK Color</span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">W2 Varnish</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/30 items-center justify-center z-10">
                  <ScanLine className="w-5 h-5 text-white" />
                </div>

                <div className="lg:order-1 lg:pr-16">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2.5">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Spot Channel Stack</div>
                    {[
                      { label: 'W2 · Varnish Gloss', color: 'bg-amber-100 border-amber-200', dot: 'bg-amber-400', tag: 'UV-DTF' },
                      { label: 'CMYK · Color Layer', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', tag: 'Color' },
                      { label: 'W1 · White Underbase', color: 'bg-slate-100 border-slate-300', dot: 'bg-slate-400', tag: 'Base' },
                    ].map((ch, i) => (
                      <div key={i} className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${ch.color}`}>
                        <div className="flex items-center space-x-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${ch.dot}`}></span>
                          <span className="text-xs font-bold text-slate-800">{ch.label}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{ch.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* STEP 5 — Export RIP-Ready TIFF */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="lg:text-right lg:pr-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-emerald-600">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-black">5</span>
                    <span>Export RIP-Ready TIFF</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">One-Click Photometric 5 TIFF Export</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Export a 300 DPI Photometric 5 multi-channel TIFF file — natively compatible with Mainlop, Flexi, Cadlink, Wasatch and all major RIP suites. No conversion, no post-processing, no manual color profiles. Send straight to your RIP print queue.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">Photometric 5 TIFF</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">Mainlop</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">Cadlink</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">Wasatch</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/30 items-center justify-center z-10">
                  <Download className="w-5 h-5 text-white" />
                </div>

                <div className="lg:pl-16">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Export Package</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">RIP READY</span>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-slate-900">DTF_ROLL_22x100.tif</div>
                        <div className="text-[10px] text-slate-400">300 DPI · Photometric 5 · 3 Channels</div>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black flex items-center space-x-1">
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[['Mainlop','✓'],['Cadlink','✓'],['Wasatch','✓']].map(([rip, ok]) => (
                        <div key={rip} className="rounded-lg bg-white border border-slate-200 py-2">
                          <div className="text-[10px] font-bold text-slate-700">{rip}</div>
                          <div className="text-emerald-500 text-xs font-black">{ok}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom CTA strip */}
          <div className="mt-16 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-lg font-black text-slate-900">Ready to run your first gang sheet?</div>
              <div className="text-sm text-slate-500">Free to start · No credit card required · Export in under 2 minutes</div>
            </div>
            <button
              type="button"
              onClick={() => handleProtectedAction(onLaunchStudio)}
              className="shrink-0 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <span>Start Building Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* PROFESSIONAL 2-COLUMN INDUSTRIAL FAQ SECTION */}
      <section id="faq" className="py-24 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column (Sticky info & support card) */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shadow-2xs">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span>KNOWLEDGE BASE & PREPRESS SPECS</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight">
                Frequently Asked <br />
                <span className="text-indigo-600">Questions</span>
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                Everything commercial print shops need to know about automated gang nesting, multi-channel RIP TIFFs, and garment choke tolerances.
              </p>

              {/* Quick Help Card */}
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-xs space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Need Custom RIP Integration?</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Have specific spot channel names (e.g. Spot1, Varnish1) or custom roll widths? Our engine supports full channel remapping in Printer Settings.
                </p>
                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer pt-1 transition-colors"
                >
                  <span>Open Studio Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: FAQ Accordion List */}
            <div className="lg:col-span-7 space-y-3.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isOpen
                        ? 'bg-white border-indigo-300 shadow-md ring-2 ring-indigo-50'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-5 sm:p-6 text-left flex items-start justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-start space-x-3.5">
                        <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-md mt-0.5 transition-colors ${
                          isOpen
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                        }`}>
                          0{idx + 1}
                        </span>
                        <span className={`text-sm sm:text-base font-bold transition-colors ${
                          isOpen ? 'text-indigo-950 font-extrabold' : 'text-slate-800 group-hover:text-indigo-600'
                        }`}>
                          {faq.q}
                        </span>
                      </div>

                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isOpen
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                      }`}>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 sm:px-6 pb-6 pt-0 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
                        <div className="pt-4 space-y-2">
                          {faq.a}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Ready to Automate Your Gang Sheet Production?
          </h2>
          <p className="text-sm text-indigo-100 max-w-xl mx-auto leading-relaxed">
            Join professional print houses saving hours on prepress and hundreds of feet of PET film every week.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={() => handleProtectedAction(onLaunchStudio)}
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-indigo-950 font-black text-xs rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>Launch Studio Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="w-full sm:w-auto px-6 py-3.5 bg-indigo-700/60 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl border border-white/20 transition-all cursor-pointer"
            >
              Create Free Shop Account
            </button>
          </div>
        </div>
      </section>

      {/* CLEAN INDUSTRIAL WHITE/LIGHT FOOTER */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-black text-slate-900 uppercase text-sm">DTF Layout PRO</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Industrial gang sheet nesting and multi-channel RIP TIFF engine for direct-to-film and UV-DTF roll printers.
            </p>
            <div className="text-[10px] text-emerald-700 font-mono font-bold">
              STATUS: ALL RIP ENGINES OPERATIONAL
            </div>
          </div>

          <div>
            <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-3">Product</div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li><button onClick={() => handleProtectedAction(onLaunchStudio)} className="hover:text-indigo-600 cursor-pointer">Gang Sheet Studio</button></li>
              <li><button onClick={() => handleProtectedAction(onOpenTiffStudio)} className="hover:text-indigo-600 cursor-pointer">RIP TIFF Compositor</button></li>
              <li><a href="#calculator" className="hover:text-indigo-600">Film Calculator</a></li>
              <li><button onClick={() => handleProtectedAction(() => onOpenTemplates ? onOpenTemplates() : onLaunchStudio())} className="hover:text-indigo-600 cursor-pointer">Standard Roll Sizes</button></li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-3">RIP Standards</div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>Maintop W1 Spot Driver</li>
              <li>Hosonsoft 300 DPI Photometric 5</li>
              <li>Cadlink Digital Factory</li>
              <li>Wasatch SoftRIP Spot Engine</li>
              <li>1px Round Choke Specification</li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-3">Operator Auth</div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li><button onClick={() => onOpenAuth('login')} className="hover:text-indigo-600 cursor-pointer">Operator Sign In</button></li>
              <li><button onClick={() => onOpenAuth('register')} className="hover:text-indigo-600 cursor-pointer">Register Print Shop</button></li>
              <li><span className="text-slate-400">Max Dimensions: 22" × 100"</span></li>
              <li><span className="text-slate-400">Local Workstation Processing</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-8 mt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <div>© {new Date().getFullYear()} DTF Layout PRO. Industrial Prepress Automation. All rights reserved.</div>
          <div className="flex space-x-4 mt-2 sm:mt-0">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>RIP Documentation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
