import React, { useState, useMemo, useEffect } from 'react';
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
  Settings2,
  Menu,
  X
} from 'lucide-react';
import { UserProfile } from '../types/auth';

interface LandingPageProps {
  currentUser: UserProfile | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onLaunchStudio: () => void;
  onOpenTiffStudio: () => void;
  onOpenTemplates?: () => void;
  onOpenProfile?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onLaunchStudio,
  onOpenTiffStudio,
  onOpenTemplates,
  onOpenProfile
}) => {
  // Mobile navigation slide-out menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

    // DTF Set Files True-Shape Nesting (approx 94% efficiency)
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
      a: 'DTF Set Files automatically analyzes the transparency mask of every design on your gang roll and compiles native 300 DPI Photometric 5 multi-channel TIFFs. It auto-generates a dedicated W1 White Underbase spot channel with an automated 1-pixel circular choke to eliminate white border bleed on dark textiles. In UVDTF mode, it also embeds a dedicated W2 Varnish gloss pass.'
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
    <div className="min-h-screen w-full bg-[#F3EBDD] text-[#204563] font-sans selection:bg-[#EF7F1A] selection:text-[#204563] overflow-x-hidden">
      {/* PROFESSIONAL RESPONSIVE TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-[#F3EBDD]/95 backdrop-blur-md border-b border-[#E5D9C8] shadow-2xs w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Clean Brand Logo */}
          <div
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group shrink-0"
            onClick={() => handleProtectedAction(onLaunchStudio)}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#204563] border border-[#3a6b94] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform shrink-0">
              <Layers className="w-5 h-5 text-[#EF7F1A]" />
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-black text-base sm:text-lg tracking-tight text-[#204563] uppercase whitespace-nowrap">
                DTF Set Files
              </span>
              <span className="hidden xs:inline-flex text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                RIP 2.0
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8 text-sm font-semibold text-[#526A7B]">
            <a href="#features" className="hover:text-[#EF7F1A] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#EF7F1A] transition-colors">How It Works</a>
            <button
              type="button"
              onClick={() => handleProtectedAction(onOpenTiffStudio)}
              className="hover:text-[#EF7F1A] transition-colors cursor-pointer"
            >
              RIP TIFF Tech
            </button>
            <button
              type="button"
              onClick={() => handleProtectedAction(() => onOpenTemplates ? onOpenTemplates() : onLaunchStudio())}
              className="hover:text-[#EF7F1A] transition-colors cursor-pointer"
            >
              Roll Sizes
            </button>
            <a href="#faq" className="hover:text-[#EF7F1A] transition-colors">FAQ</a>
          </nav>

          {/* Right Action CTAs & Auth Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {currentUser ? (
              /* User logged in state */
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => onOpenProfile ? onOpenProfile() : handleProtectedAction(onLaunchStudio)}
                  className="hidden md:flex flex-col text-right hover:opacity-80 transition-opacity cursor-pointer"
                  title="View Profile & Settings"
                >
                  <span className="text-xs font-bold text-[#204563] leading-tight">{currentUser.name}</span>
                  <span className="text-[11px] text-[#526A7B] font-medium truncate max-w-[140px]">
                    {currentUser.companyName}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenProfile ? onOpenProfile() : handleProtectedAction(onLaunchStudio)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#204563] text-white flex items-center justify-center font-bold text-xs shadow-sm border-2 border-[#EF7F1A] shrink-0 hover:scale-105 transition-all cursor-pointer"
                  title={`${currentUser.name} (${currentUser.companyName}) - View Profile`}
                >
                  {currentUser.initials}
                </button>

                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="hidden sm:flex px-3.5 sm:px-4 py-2 sm:py-2.5 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] rounded-xl text-xs font-black shadow-md shadow-orange-500/25 items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Open Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white hover:bg-rose-50 text-[#526A7B] hover:text-rose-600 items-center justify-center transition-colors border border-[#E5D9C8] cursor-pointer shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Guest / Not logged in state */
              <div className="flex items-center space-x-1.5 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="hidden sm:inline-block px-3.5 py-2 text-xs sm:text-sm font-bold text-[#204563] hover:text-[#EF7F1A] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="hidden md:inline-block px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF7F1] text-[#204563] text-xs sm:text-sm font-bold border border-[#E5D9C8] transition-all cursor-pointer whitespace-nowrap"
                >
                  Register
                </button>

                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] rounded-xl text-xs sm:text-sm font-black shadow-md shadow-orange-500/25 flex items-center space-x-1 sm:space-x-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Launch Studio</span>
                  <span className="sm:hidden">Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Mobile Navigation Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer shrink-0 ml-1"
              aria-label="Open mobile navigation menu"
            >
              <Menu className="w-5 h-5 text-slate-800" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SLIDE-OUT NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-out Menu Panel */}
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-[#F3EBDD] shadow-2xl z-50 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-[#E5D9C8]">
            <div className="space-y-6">
              {/* Drawer Top Header with Logo & Close */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E5D9C8]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#204563] flex items-center justify-center text-white font-bold shadow-xs">
                    <Layers className="w-4 h-4 text-[#EF7F1A]" />
                  </div>
                  <div>
                    <span className="font-black text-sm tracking-tight text-[#204563] uppercase">
                      DTF Set Files
                    </span>
                    <span className="ml-1.5 text-[9px] font-black uppercase bg-[#FAF7F1] text-[#204563] px-1.5 py-0.5 rounded border border-[#E5D9C8]">
                      RIP 2.0
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-[#FAF7F1] text-[#526A7B] hover:text-[#204563] flex items-center justify-center transition-colors cursor-pointer border border-[#E5D9C8]"
                  aria-label="Close mobile navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Operator Status */}
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenProfile) onOpenProfile();
                    else handleProtectedAction(onLaunchStudio);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] flex items-center space-x-3 transition-colors cursor-pointer"
                  title="View Profile & Settings"
                >
                  <div
                    className="w-10 h-10 rounded-full bg-[#204563] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 border border-[#EF7F1A]"
                  >
                    {currentUser.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#204563] truncate">{currentUser.name}</div>
                    <div className="text-[11px] text-[#526A7B] truncate">{currentUser.companyName}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#EF7F1A] shrink-0" />
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5D9C8] text-xs text-[#526A7B]">
                  <div className="font-bold text-[#204563] mb-0.5">Commercial Prepress Station</div>
                  <div className="text-[11px] text-[#526A7B]">Sign in to save custom roll presets &amp; print history.</div>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="flex flex-col space-y-1">
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#204563] hover:text-[#EF7F1A] hover:bg-white flex items-center justify-between transition-colors"
                >
                  <span>Features</span>
                  <ChevronRight className="w-4 h-4 text-[#526A7B]" />
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#204563] hover:text-[#EF7F1A] hover:bg-white flex items-center justify-between transition-colors"
                >
                  <span>How It Works</span>
                  <ChevronRight className="w-4 h-4 text-[#526A7B]" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleProtectedAction(onOpenTiffStudio);
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#204563] hover:text-[#EF7F1A] hover:bg-white flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>RIP TIFF Tech</span>
                  <ChevronRight className="w-4 h-4 text-[#526A7B]" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleProtectedAction(() => onOpenTemplates ? onOpenTemplates() : onLaunchStudio());
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#204563] hover:text-[#EF7F1A] hover:bg-white flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Roll Sizes</span>
                  <ChevronRight className="w-4 h-4 text-[#526A7B]" />
                </button>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#204563] hover:text-[#EF7F1A] hover:bg-white flex items-center justify-between transition-colors"
                >
                  <span>FAQ &amp; Knowledge Base</span>
                  <ChevronRight className="w-4 h-4 text-[#526A7B]" />
                </a>
              </nav>
            </div>

            {/* Bottom Actions inside Mobile Drawer */}
            <div className="pt-6 border-t border-[#E5D9C8] space-y-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleProtectedAction(onLaunchStudio);
                }}
                className="w-full py-3 bg-[#EF7F1A] text-[#204563] rounded-xl text-xs font-black shadow-md shadow-orange-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Open Gang Sheet Studio</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleProtectedAction(onOpenTiffStudio);
                }}
                className="w-full py-2.5 bg-white border border-[#E5D9C8] text-[#204563] hover:bg-[#FAF7F1] rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <FileStack className="w-4 h-4 text-[#EF7F1A]" />
                <span>RIP TIFF Compositor</span>
              </button>

              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('login');
                    }}
                    className="py-2.5 bg-white hover:bg-[#FAF7F1] text-[#204563] rounded-xl text-xs font-bold text-center border border-[#E5D9C8] transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('register');
                    }}
                    className="py-2.5 bg-[#FAF7F1] hover:bg-[#E8DDCA] text-[#204563] rounded-xl text-xs font-bold text-center border border-[#E5D9C8] transition-colors cursor-pointer"
                  >
                    Register
                  </button>
                </div>
              )}

              <div className="pt-2 text-center text-[10px] text-[#526A7B] font-mono">
                MAX ROLL: 22" × 100" • 300 NATIVE DPI
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION - WARM BEIGE WITH SOFT BLUEPRINT PATTERN */}
      <section className="relative pt-8 pb-14 sm:pt-14 sm:pb-20 md:pt-20 md:pb-28 overflow-hidden bg-[#F3EBDD] w-full">
        {/* Subtle Light Blueprint Grid */}
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #E8DDCA 1px, transparent 1px),
              linear-gradient(to bottom, #E8DDCA 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Ambient Subtle Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[90vw] sm:w-[700px] h-[220px] sm:h-[350px] bg-[#E8DDCA]/40 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
            {/* Status Pill Badge - Responsive and Non-Clipping */}
            <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] text-[10px] sm:text-xs font-bold shadow-xs max-w-full">
              <span className="w-2 h-2 rounded-full bg-[#EF7F1A] animate-pulse shrink-0" />
              <span className="tracking-wide">COMMERCIAL PRINT ROLL AUTOMATION</span>
              <span className="hidden sm:inline text-[#526A7B]">•</span>
              <span className="text-[#204563]">True-Shape Nesting Engine</span>
            </div>

            {/* Main Title - Responsive clamp-like scaling */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-[#204563] tracking-tight leading-[1.15] break-words">
              Industrial DTF &amp; UV-DTF{' '}
              <span className="text-[#EF7F1A] block sm:inline mt-1 sm:mt-0">
                Gang Sheet Builder
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xs sm:text-base md:text-lg text-[#526A7B] max-w-2xl mx-auto leading-relaxed px-1 sm:px-0">
              Eliminate substrate waste and save hours of manual prepress. Pack hundreds of graphics into optimized rolls up to <span className="text-[#204563] font-extrabold">22" × 100"</span>, auto-generate <span className="text-[#204563] font-extrabold">W1 White Underbase</span> with 1px choke, and export 100% RIP-ready multi-channel TIFFs.
            </p>

            {/* CTA Button Group - Responsive Stacking */}
            <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none mx-auto">
              <button
                type="button"
                onClick={() => handleProtectedAction(onLaunchStudio)}
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-orange-500/25 flex items-center justify-center space-x-2.5 transition-all cursor-pointer group min-h-[48px]"
              >
                <Layers className="w-4 h-4 text-[#204563]" />
                <span>Open Gang Sheet Studio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleProtectedAction(onOpenTiffStudio)}
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] font-bold text-xs sm:text-sm rounded-2xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer min-h-[48px]"
              >
                <FileStack className="w-4 h-4 text-[#EF7F1A]" />
                <span>RIP TIFF Compositor</span>
              </button>
            </div>

            {/* Compatible RIPs Tagline - Clean Wrapping */}
            <div className="pt-3 sm:pt-4 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-[11px] sm:text-xs text-[#526A7B] font-mono px-2">
              <span className="flex items-center space-x-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[#204563] font-semibold">Maintop</span>
              </span>
              <span className="text-[#526A7B]">•</span>
              <span className="flex items-center space-x-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[#204563] font-semibold">Hosonsoft</span>
              </span>
              <span className="text-[#526A7B]">•</span>
              <span className="flex items-center space-x-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[#204563] font-semibold">Cadlink</span>
              </span>
              <span className="text-[#526A7B]">•</span>
              <span className="flex items-center space-x-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[#204563] font-semibold">Wasatch</span>
              </span>
            </div>
          </div>

          {/* INTERACTIVE HERO PREVIEW CONSOLE - CLEAN WHITE WORKSTATION */}
          <div className="mt-10 sm:mt-14 max-w-5xl mx-auto rounded-2xl sm:rounded-3xl bg-white border border-[#E5D9C8] shadow-xl sm:shadow-2xl overflow-hidden w-full">
            {/* Console Window Header - Responsive Flex */}
            <div className="min-h-12 bg-[#FAF7F1] border-b border-[#E5D9C8] px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#526A7B] font-mono">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="flex items-center space-x-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-400" />
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#EF7F1A]" />
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400" />
                </div>
                <span className="ml-1 sm:ml-2 text-[#204563] font-bold text-[11px] sm:text-xs truncate">
                  DTF_PRODUCTION_ROLL_22x60.TIF
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-[11px]">
                <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                  FILM YIELD: 98.4%
                </span>
                <span className="hidden xs:inline text-slate-300">•</span>
                <span className="bg-white text-[#204563] px-1.5 py-0.5 rounded border border-[#E5D9C8] font-semibold shrink-0">
                  300 DPI
                </span>
                <span className="hidden xs:inline text-slate-300">•</span>
                <span className="bg-[#FAF7F1] text-[#204563] px-1.5 py-0.5 rounded border border-[#E5D9C8] font-semibold shrink-0">
                  CHOKE: 1 PX
                </span>
              </div>
            </div>

            {/* Console Mock Canvas - Fully Responsive Grid */}
            <div className="p-3.5 sm:p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center bg-[#FAF7F1]/50">
              {/* Left Roll Graphic Preview */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-3 sm:p-5 border border-[#E5D9C8] shadow-sm relative flex flex-col items-center justify-center">
                <div className="w-full h-56 sm:h-64 md:h-72 rounded-xl border border-dashed border-[#E5D9C8] relative overflow-hidden flex flex-wrap gap-2 sm:gap-2.5 p-2.5 sm:p-3.5 items-center justify-center bg-[linear-gradient(45deg,#FAF7F1_25%,transparent_25%),linear-gradient(-45deg,#FAF7F1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#FAF7F1_75%),linear-gradient(-45deg,transparent_75%,#FAF7F1_75%)] bg-[size:16px_16px]">
                  {/* Mock nested items with responsive dimensions */}
                  <div className="p-2 sm:p-2.5 bg-[#FAF7F1] rounded-lg sm:rounded-xl border border-[#E5D9C8] text-center font-mono text-[9px] sm:text-[10px] text-[#204563] shadow-2xs">
                    <div className="w-14 sm:w-16 h-10 sm:h-12 bg-[#204563]/10 rounded flex items-center justify-center font-bold text-[#204563] mb-1 border border-[#E5D9C8] text-[10px] sm:text-xs">
                      10" x 11"
                    </div>
                    <span className="font-bold">Back Graphic #1</span>
                  </div>

                  <div className="p-2 sm:p-2.5 bg-[#FAF7F1] rounded-lg sm:rounded-xl border border-[#E5D9C8] text-center font-mono text-[9px] sm:text-[10px] text-[#204563] shadow-2xs">
                    <div className="w-14 sm:w-16 h-10 sm:h-12 bg-[#EF7F1A]/10 rounded flex items-center justify-center font-bold text-[#EF7F1A] mb-1 border border-[#E5D9C8] text-[10px] sm:text-xs">
                      10" x 11"
                    </div>
                    <span className="font-bold">Back Graphic #2</span>
                  </div>

                  <div className="p-1.5 sm:p-2 bg-emerald-50/90 rounded-lg sm:rounded-xl border border-emerald-200 text-center font-mono text-[8px] sm:text-[9px] text-emerald-900 shadow-2xs">
                    <div className="w-9 sm:w-10 h-7 sm:h-8 bg-emerald-600/10 rounded flex items-center justify-center font-bold text-emerald-700 mb-1 border border-emerald-100 text-[9px] sm:text-[10px]">
                      4" x 4"
                    </div>
                    <span className="font-bold">Chest Logo</span>
                  </div>

                  <div className="p-1.5 sm:p-2 bg-amber-50/90 rounded-lg sm:rounded-xl border border-amber-200 text-center font-mono text-[8px] sm:text-[9px] text-amber-900 shadow-2xs">
                    <div className="w-9 sm:w-10 h-7 sm:h-8 bg-amber-600/10 rounded flex items-center justify-center font-bold text-amber-700 mb-1 border border-amber-100 text-[9px] sm:text-[10px]">
                      4" x 4"
                    </div>
                    <span className="font-bold">Sleeve Tag</span>
                  </div>

                  <div className="p-2 sm:p-2.5 bg-[#FAF7F1] rounded-lg sm:rounded-xl border border-[#E5D9C8] text-center font-mono text-[9px] sm:text-[10px] text-[#204563] shadow-2xs">
                    <div className="w-14 sm:w-16 h-10 sm:h-12 bg-[#204563]/10 rounded flex items-center justify-center font-bold text-[#204563] mb-1 border border-[#E5D9C8] text-[10px] sm:text-xs">
                      10" x 11"
                    </div>
                    <span className="font-bold">Back Graphic #3</span>
                  </div>

                  {/* Corner dimension tags */}
                  <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-mono text-[#204563] border border-[#E5D9C8] shadow-2xs z-10">
                    WIDTH: 22.00 IN
                  </div>

                  <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 bg-emerald-50/95 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-mono text-emerald-700 font-bold border border-emerald-200 shadow-2xs z-10">
                    WASTE: 1.6%
                  </div>
                </div>

                <div className="mt-3 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1 w-full text-[10px] sm:text-xs text-[#526A7B] font-mono">
                  <span>Feed Length: 60.00 inches</span>
                  <span>Spacing: 0.30 in • Margin: 0.25 in</span>
                </div>
              </div>

              {/* Right Live Preflight Checklist */}
              <div className="lg:col-span-5 space-y-3 sm:space-y-4">
                <div className="text-xs font-black uppercase tracking-wider text-[#526A7B] flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Real-Time Preflight Inspection</span>
                </div>

                <div className="space-y-2 sm:space-y-2.5">
                  <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white border border-[#E5D9C8] shadow-xs flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#204563] truncate">White Ink Underbase (W1)</div>
                        <div className="text-[10px] text-[#526A7B] font-mono">1px Round Choke Applied</div>
                      </div>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                      VERIFIED
                    </span>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white border border-[#E5D9C8] shadow-xs flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#204563] truncate">Resolution &amp; DPI Audit</div>
                        <div className="text-[10px] text-[#526A7B] font-mono">All assets &gt;= 300 Native DPI</div>
                      </div>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                      OPTIMAL
                    </span>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white border border-[#E5D9C8] shadow-xs flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#204563] truncate">Max Roll Limits Check</div>
                        <div className="text-[10px] text-[#526A7B] font-mono">Within 22" × 100" boundaries</div>
                      </div>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                      COMPLIANT
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="w-full py-3 sm:py-3.5 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-orange-500/20 min-h-[44px]"
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
      <section className="border-y border-[#E5D9C8] bg-[#FAF7F1] py-8 sm:py-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 text-center">
            <div className="space-y-1 p-2">
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-[#EF7F1A] font-mono">98.4%</div>
              <div className="text-[11px] sm:text-xs font-extrabold text-[#204563] uppercase tracking-wider">Average Film Yield</div>
              <div className="text-[10px] sm:text-xs text-[#526A7B]">True-shape nesting efficiency</div>
            </div>

            <div className="space-y-1 p-2">
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-[#204563] font-mono">22" × 100"</div>
              <div className="text-[11px] sm:text-xs font-extrabold text-[#204563] uppercase tracking-wider">Max Single Roll</div>
              <div className="text-[10px] sm:text-xs text-[#526A7B]">Full industrial roll length</div>
            </div>

            <div className="space-y-1 p-2">
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-[#EF7F1A] font-mono">1 px</div>
              <div className="text-[11px] sm:text-xs font-extrabold text-[#204563] uppercase tracking-wider">Auto White Choke</div>
              <div className="text-[10px] sm:text-xs text-[#526A7B]">Zero border bleed on garments</div>
            </div>

            <div className="space-y-1 p-2">
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-600 font-mono">300 DPI</div>
              <div className="text-[11px] sm:text-xs font-extrabold text-[#204563] uppercase tracking-wider">Native RIP Output</div>
              <div className="text-[10px] sm:text-xs text-[#526A7B]">Lossless Photometric 5 TIFF</div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE INDUSTRIAL PILLARS */}
      <section id="features" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 bg-[#F3EBDD] w-full">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-2.5 sm:space-y-3">
          <div className="text-xs font-black uppercase tracking-widest text-[#EF7F1A]">
            ENGINEERED FOR PRODUCTION PRINT HOUSES
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#204563] tracking-tight">
            Everything You Need For High-Velocity Gang Rolls
          </h2>
          <p className="text-xs sm:text-sm text-[#526A7B]">
            From raw customer PNGs to RIP-ready multi-channel TIFFs in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1 */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-[#E5D9C8] shadow-xs hover:shadow-xl hover:border-[#EF7F1A] transition-all flex flex-col justify-between group">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Cpu className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#204563] tracking-tight">
                True-Shape Nesting Engine
              </h3>
              <p className="text-xs text-[#526A7B] leading-relaxed">
                Automatically detects transparency silhouettes and nests smaller logos into the cavities of larger artwork. Supports 90° rotation, custom margins, and spacing down to 0.1".
              </p>
            </div>
            <div className="pt-5 sm:pt-6 border-t border-[#E5D9C8] mt-5 sm:mt-6 flex items-center justify-between text-xs text-[#204563] font-bold">
              <span>Saves ~24% on PET Film</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-[#E5D9C8] shadow-xs hover:shadow-xl hover:border-[#EF7F1A] transition-all flex flex-col justify-between group">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FCE8D5] text-[#EF7F1A] border border-[#EF7F1A]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileStack className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#204563] tracking-tight">
                Embedded RIP Spot Channels
              </h3>
              <p className="text-xs text-[#526A7B] leading-relaxed">
                Export native Photometric 5 CMYK TIFFs with embedded W1 Spot White Underbase and optional W2 Varnish gloss coats. No manual spot channel authoring required in Photoshop.
              </p>
            </div>
            <div className="pt-5 sm:pt-6 border-t border-[#E5D9C8] mt-5 sm:mt-6 flex items-center justify-between text-xs text-[#EF7F1A] font-bold">
              <span>100% RIP Software Ready</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-[#E5D9C8] shadow-xs hover:shadow-xl hover:border-[#EF7F1A] transition-all flex flex-col justify-between group">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#204563] tracking-tight">
                AI Preflight &amp; Image Toolkit
              </h3>
              <p className="text-xs text-[#526A7B] leading-relaxed">
                Automatic background removal, lossless alpha bounding-box cropping, AI upscaling to 300 DPI, and pixel bleed audit prevents costly garment reprints and head strikes.
              </p>
            </div>
            <div className="pt-5 sm:pt-6 border-t border-[#E5D9C8] mt-5 sm:mt-6 flex items-center justify-between text-xs text-[#204563] font-bold">
              <span>Zero Print Bleed Rejects</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — PRODUCTION PIPELINE */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-[#FAF7F1] border-t border-[#E5D9C8] w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#FCE8D5] border border-[#EF7F1A]/30 text-[#204563] text-xs font-black uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 text-[#EF7F1A]" />
              <span>Production Workflow</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#204563] tracking-tight">
              From Artwork to Print-Ready TIFF<br />
              <span className="text-[#EF7F1A]">in Five Precise Steps</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#526A7B]">
              A fully automated, industrial-grade pipeline engineered for commercial DTF &amp; UV-DTF print houses.
            </p>
          </div>

          {/* Pipeline Steps — Alternating Left/Right on Desktop, Stacked on Mobile */}
          <div className="relative">
            {/* Vertical connector line on large screens */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#EF7F1A]/30 via-[#204563]/20 to-[#E5D9C8] hidden lg:block" style={{ transform: 'translateX(-50%)' }}></div>

            <div className="space-y-10 sm:space-y-12">
              {/* STEP 1 — Upload Artwork */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                <div className="lg:text-right lg:pr-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#204563]">
                    <span className="w-6 h-6 rounded-full bg-[#204563] text-white flex items-center justify-center text-[11px] font-black">1</span>
                    <span>Upload Artwork</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#204563]">Drop Your PNG / JPG Files</h3>
                  <p className="text-xs sm:text-sm text-[#526A7B] leading-relaxed">
                    Upload single or multi-design batches at any resolution. The engine reads pixel dimensions, extracts true alpha transparency, and auto-checks DPI for print compliance — flagging anything below 300 DPI before you proceed.
                  </p>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">PNG / JPG</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">Batch Upload</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">✓ DPI Preflight</span>
                  </div>
                </div>

                {/* Center icon node (Desktop only) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-[#204563] shadow-lg shadow-[#204563]/30 items-center justify-center z-10">
                  <Upload className="w-5 h-5 text-white" />
                </div>

                <div className="lg:pl-16">
                  <div className="rounded-2xl border border-[#E5D9C8] bg-white p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#526A7B] uppercase tracking-wider">Preflight Inspector</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">PASS</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['design_A.png', 'logo_B.png', 'graphic_C.png'].map((f, i) => (
                        <div key={i} className="rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] p-2 text-center">
                          <div className="w-full h-8 sm:h-10 rounded-lg bg-gradient-to-br from-[#E8DDCA] to-[#FAF7F1] mb-1.5"></div>
                          <span className="text-[9px] text-[#526A7B] truncate block">{f}</span>
                          <span className="text-[9px] font-bold text-emerald-600">300 DPI ✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2 — Configure Roll Template */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                <div className="lg:order-2 lg:pl-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#EF7F1A]">
                    <span className="w-6 h-6 rounded-full bg-[#EF7F1A] text-[#204563] flex items-center justify-center text-[11px] font-black">2</span>
                    <span>Configure Roll Template</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#204563]">Select Roll Size &amp; Print Parameters</h3>
                  <p className="text-xs sm:text-sm text-[#526A7B] leading-relaxed">
                    Choose from industry-standard roll templates (22"x60", 22"x100", 11"x17" and more) or define a custom sheet. Set spacing margins, choke px for white underbase bleed-prevention, and DPI output mode.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">22" x 100"</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">1px Choke</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">300 DPI</span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#FCE8D5] border border-[#EF7F1A]/30 text-[#204563] text-[11px] font-bold">Custom Margins</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-[#EF7F1A] shadow-lg shadow-orange-500/30 items-center justify-center z-10">
                  <Settings2 className="w-5 h-5 text-[#204563]" />
                </div>

                <div className="lg:order-1 lg:pr-16">
                  <div className="rounded-2xl border border-[#E5D9C8] bg-white p-4 sm:p-5 space-y-3">
                    <div className="text-xs font-bold text-[#526A7B] uppercase tracking-wider mb-2">Roll Configuration</div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] p-2.5 sm:p-3">
                        <div className="text-[10px] text-[#526A7B] uppercase font-bold mb-0.5">Template</div>
                        <div className="text-xs sm:text-sm font-black text-[#204563]">22" x 100"</div>
                        <div className="text-[10px] text-[#EF7F1A] font-semibold mt-0.5">Max Roll</div>
                      </div>
                      <div className="rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] p-2.5 sm:p-3">
                        <div className="text-[10px] text-[#526A7B] uppercase font-bold mb-0.5">Choke</div>
                        <div className="text-xs sm:text-sm font-black text-[#204563]">1 px</div>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Bleed-safe</div>
                      </div>
                      <div className="rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] p-2.5 sm:p-3">
                        <div className="text-[10px] text-[#526A7B] uppercase font-bold mb-0.5">Output DPI</div>
                        <div className="text-xs sm:text-sm font-black text-[#204563]">300 DPI</div>
                        <div className="text-[10px] text-[#526A7B] font-semibold mt-0.5">Photometric 5</div>
                      </div>
                      <div className="rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] p-2.5 sm:p-3">
                        <div className="text-[10px] text-[#526A7B] uppercase font-bold mb-0.5">Spacing</div>
                        <div className="text-xs sm:text-sm font-black text-[#204563]">0.25"</div>
                        <div className="text-[10px] text-[#526A7B] font-semibold mt-0.5">Gap</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3 — True-Shape Auto Nesting */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                <div className="lg:text-right lg:pr-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#204563]">
                    <span className="w-6 h-6 rounded-full bg-[#204563] text-white flex items-center justify-center text-[11px] font-black">3</span>
                    <span>True-Shape Auto Nesting</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#204563]">Algorithmic Pack Optimization</h3>
                  <p className="text-xs sm:text-sm text-[#526A7B] leading-relaxed">
                    The nesting engine traces each design's alpha boundary (true-shape, not bounding-box) and fills the roll using a bin-packing algorithm. Designs rotate, interlock, and stack — squeezing every square inch of film without overlap.
                  </p>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <span className="px-2.5 py-1 rounded-lg bg-[#FCE8D5] border border-[#EF7F1A]/30 text-[#204563] text-[11px] font-bold">True-Shape Trace</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">Auto Rotate</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">Zero Overlap</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-[#204563] shadow-lg shadow-[#204563]/30 items-center justify-center z-10">
                  <Layers className="w-5 h-5 text-white" />
                </div>

                <div className="lg:pl-16">
                  <div className="rounded-2xl border border-[#E5D9C8] bg-white p-4 sm:p-5 space-y-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#526A7B] uppercase tracking-wider">Film Utilization</span>
                      <span className="text-xs font-black text-[#EF7F1A]">98.4%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#E5D9C8] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#EF7F1A] to-[#204563]" style={{ width: '98.4%' }}></div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 pt-2">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className={`h-6 sm:h-8 rounded-md ${i % 7 === 0 ? 'bg-[#EF7F1A]/20' : i % 5 === 0 ? 'bg-[#204563]/20' : i % 3 === 0 ? 'bg-[#E8DDCA]' : 'bg-[#FAF7F1]'}`}></div>
                      ))}
                    </div>
                    <div className="text-[10px] text-[#526A7B] text-center pt-1">Packed gang sheet preview — 300 DPI</div>
                  </div>
                </div>
              </div>

              {/* STEP 4 — Multi-Channel Separation */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                <div className="lg:order-2 lg:pl-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#EF7F1A]">
                    <span className="w-6 h-6 rounded-full bg-[#EF7F1A] text-[#204563] flex items-center justify-center text-[11px] font-black">4</span>
                    <span>Multi-Channel Separation</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#204563]">Auto-Generate W1, CMYK &amp; W2 Channels</h3>
                  <p className="text-xs sm:text-sm text-[#526A7B] leading-relaxed">
                    The RIP engine automatically separates the composed sheet into three spot channels: <strong>W1 White Underbase</strong> (computed from alpha with 1px choke), <strong>CMYK Color</strong>, and <strong>W2 Varnish/Gloss</strong> for UV-DTF. No manual Photoshop work required.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">W1 White Underbase</span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#FCE8D5] border border-[#EF7F1A]/30 text-[#204563] text-[11px] font-bold">CMYK Color</span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">W2 Varnish</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-[#EF7F1A] shadow-lg shadow-orange-500/30 items-center justify-center z-10">
                  <ScanLine className="w-5 h-5 text-[#204563]" />
                </div>

                <div className="lg:order-1 lg:pr-16">
                  <div className="rounded-2xl border border-[#E5D9C8] bg-white p-4 sm:p-5 space-y-2.5">
                    <div className="text-xs font-bold text-[#526A7B] uppercase tracking-wider mb-2">Spot Channel Stack</div>
                    {[
                      { label: 'W2 · Varnish Gloss', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', tag: 'UV-DTF' },
                      { label: 'CMYK · Color Layer', color: 'bg-[#FAF7F1] border-[#E5D9C8]', dot: 'bg-[#EF7F1A]', tag: 'Color' },
                      { label: 'W1 · White Underbase', color: 'bg-[#FAF7F1] border-[#E5D9C8]', dot: 'bg-[#204563]', tag: 'Base' },
                    ].map((ch, i) => (
                      <div key={i} className={`flex items-center justify-between rounded-xl border px-3 sm:px-3.5 py-2 sm:py-2.5 ${ch.color}`}>
                        <div className="flex items-center space-x-2 sm:space-x-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${ch.dot}`}></span>
                          <span className="text-xs font-bold text-[#204563]">{ch.label}</span>
                        </div>
                        <span className="text-[10px] font-black text-[#526A7B] uppercase tracking-wider">{ch.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* STEP 5 — Export RIP-Ready TIFF */}
              <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                <div className="lg:text-right lg:pr-16 space-y-3">
                  <div className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-emerald-600">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-black">5</span>
                    <span>Export RIP-Ready TIFF</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#204563]">One-Click Photometric 5 TIFF Export</h3>
                  <p className="text-xs sm:text-sm text-[#526A7B] leading-relaxed">
                    Export a 300 DPI Photometric 5 multi-channel TIFF file — natively compatible with Maintop, Hosonsoft, Cadlink, Wasatch and all major RIP suites. Send straight to your RIP print queue.
                  </p>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">Photometric 5 TIFF</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">Maintop</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">Cadlink</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E5D9C8] text-[#204563] text-[11px] font-bold">Wasatch</span>
                  </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex w-12 h-12 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/30 items-center justify-center z-10">
                  <Download className="w-5 h-5 text-white" />
                </div>

                <div className="lg:pl-16">
                  <div className="rounded-2xl border border-[#E5D9C8] bg-white p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#526A7B] uppercase tracking-wider">Export Package</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">RIP READY</span>
                    </div>
                    <div className="rounded-xl bg-[#FAF7F1] border border-[#E5D9C8] px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col xs:flex-row xs:items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-black text-[#204563] truncate">DTF_ROLL_22x100.tif</div>
                        <div className="text-[10px] text-[#526A7B]">300 DPI · Photometric 5 · 3 Channels</div>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-[#EF7F1A] text-[#204563] text-[11px] font-black flex items-center justify-center space-x-1 shrink-0">
                        <Download className="w-3 h-3 text-[#204563]" />
                        <span>Download</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[['Maintop', '✓'], ['Cadlink', '✓'], ['Wasatch', '✓']].map(([rip, ok]) => (
                        <div key={rip} className="rounded-lg bg-white border border-[#E5D9C8] py-2">
                          <div className="text-[10px] font-bold text-[#204563]">{rip}</div>
                          <div className="text-emerald-600 text-xs font-black">{ok}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom CTA strip inside pipeline */}
          <div className="mt-12 sm:mt-16 rounded-2xl bg-white border border-[#E5D9C8] p-5 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 shadow-xs">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-base sm:text-lg font-black text-[#204563]">Ready to run your first gang sheet?</div>
              <div className="text-xs sm:text-sm text-[#526A7B]">Free to start · No credit card required · Export in under 2 minutes</div>
            </div>
            <button
              type="button"
              onClick={() => handleProtectedAction(onLaunchStudio)}
              className="shrink-0 w-full sm:w-auto px-6 sm:px-8 py-3 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs rounded-xl shadow-md shadow-orange-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer min-h-[44px]"
            >
              <span>Start Building Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* PROFESSIONAL 2-COLUMN INDUSTRIAL FAQ SECTION */}
      <section id="faq" className="py-16 sm:py-24 bg-white border-t border-[#E5D9C8] w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column (Sticky info & support card) */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4 sm:space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] text-xs font-bold shadow-2xs">
                <HelpCircle className="w-3.5 h-3.5 text-[#EF7F1A]" />
                <span>KNOWLEDGE BASE &amp; PREPRESS SPECS</span>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#204563] tracking-tight leading-tight">
                Frequently Asked <br className="hidden sm:inline" />
                <span className="text-[#EF7F1A]">Questions</span>
              </h2>

              <p className="text-xs sm:text-sm text-[#526A7B] leading-relaxed max-w-md">
                Everything commercial print shops need to know about automated gang nesting, multi-channel RIP TIFFs, and garment choke tolerances.
              </p>

              {/* Quick Help Card */}
              <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#FAF7F1] border border-[#E5D9C8] shadow-xs space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-[#204563] flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Need Custom RIP Integration?</span>
                </div>
                <p className="text-xs text-[#526A7B] leading-relaxed">
                  Have specific spot channel names (e.g. Spot1, Varnish1) or custom roll widths? Our engine supports full channel remapping in Printer Settings.
                </p>
                <button
                  type="button"
                  onClick={() => handleProtectedAction(onLaunchStudio)}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#EF7F1A] hover:text-[#d96e12] cursor-pointer pt-1 transition-colors"
                >
                  <span>Open Studio Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: FAQ Accordion List */}
            <div className="lg:col-span-7 space-y-3 sm:space-y-3.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isOpen
                        ? 'bg-[#FAF7F1] border-[#EF7F1A] shadow-md ring-2 ring-[#EF7F1A]/20'
                        : 'bg-white border-[#E5D9C8] hover:border-[#EF7F1A]/50 shadow-2xs'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-4 sm:p-5 sm:p-6 text-left flex items-start justify-between gap-3 sm:gap-4 cursor-pointer group"
                    >
                      <div className="flex items-start space-x-2.5 sm:space-x-3.5 min-w-0">
                        <span className={`text-[11px] sm:text-xs font-black font-mono px-2 py-0.5 rounded-md mt-0.5 transition-colors shrink-0 ${
                          isOpen
                            ? 'bg-[#EF7F1A] text-[#204563]'
                            : 'bg-[#FAF7F1] text-[#526A7B] group-hover:bg-[#FCE8D5] group-hover:text-[#204563]'
                        }`}>
                          0{idx + 1}
                        </span>
                        <span className={`text-xs sm:text-sm md:text-base font-bold transition-colors ${
                          isOpen ? 'text-[#204563] font-black' : 'text-[#204563] group-hover:text-[#EF7F1A]'
                        }`}>
                          {faq.q}
                        </span>
                      </div>

                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isOpen
                          ? 'bg-[#FCE8D5] text-[#204563]'
                          : 'bg-[#FAF7F1] text-[#526A7B] group-hover:bg-[#FCE8D5] group-hover:text-[#204563]'
                      }`}>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-0 border-t border-[#E5D9C8] text-xs sm:text-sm text-[#526A7B] leading-relaxed">
                        <div className="pt-3 sm:pt-4 space-y-2">
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
      <section className="py-12 sm:py-16 bg-[#204563] text-white px-4 sm:px-6 w-full">
        <div className="max-w-5xl mx-auto text-center space-y-4 sm:space-y-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
            Ready to Automate Your Gang Sheet Production?
          </h2>
          <p className="text-xs sm:text-sm text-[#E8DDCA] max-w-xl mx-auto leading-relaxed">
            Join professional print houses saving hours on prepress and hundreds of feet of PET film every week.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-3.5 w-full max-w-md sm:max-w-none mx-auto">
            <button
              type="button"
              onClick={() => handleProtectedAction(onLaunchStudio)}
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs sm:text-sm rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center space-x-2 min-h-[48px]"
            >
              <span>Launch Studio Free</span>
              <ArrowRight className="w-4 h-4 text-[#204563]" />
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/20 transition-all cursor-pointer min-h-[48px]"
            >
              Create Free Shop Account
            </button>
          </div>
        </div>
      </section>

      {/* CLEAN INDUSTRIAL FOOTER */}
      <footer className="bg-[#0b1723] border-t border-[#183750] py-10 sm:py-12 text-[#E8DDCA] text-xs px-4 sm:px-6 w-full">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#204563] border border-[#183750] flex items-center justify-center text-[#EF7F1A] font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-black text-white uppercase text-sm">DTF Set Files</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Industrial gang sheet nesting and multi-channel RIP TIFF engine for direct-to-film and UV-DTF roll printers.
            </p>
            <div className="text-[10px] text-emerald-400 font-mono font-bold">
              STATUS: ALL RIP ENGINES OPERATIONAL
            </div>
          </div>

          <div>
            <div className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">Product</div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li><button onClick={() => handleProtectedAction(onLaunchStudio)} className="hover:text-[#EF7F1A] cursor-pointer">Gang Sheet Studio</button></li>
              <li><button onClick={() => handleProtectedAction(onOpenTiffStudio)} className="hover:text-[#EF7F1A] cursor-pointer">RIP TIFF Compositor</button></li>
              <li><a href="#features" className="hover:text-[#EF7F1A]">Nesting Technology</a></li>
              <li><button onClick={() => handleProtectedAction(() => onOpenTemplates ? onOpenTemplates() : onLaunchStudio())} className="hover:text-[#EF7F1A] cursor-pointer">Standard Roll Sizes</button></li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">RIP Standards</div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>Maintop W1 Spot Driver</li>
              <li>Hosonsoft 300 DPI Photometric 5</li>
              <li>Cadlink Digital Factory</li>
              <li>Wasatch SoftRIP Spot Engine</li>
              <li>1px Round Choke Specification</li>
            </ul>
          </div>

          <div>
            <div className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">Operator Auth</div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li><button onClick={() => onOpenAuth('login')} className="hover:text-[#EF7F1A] cursor-pointer">Operator Sign In</button></li>
              <li><button onClick={() => onOpenAuth('register')} className="hover:text-[#EF7F1A] cursor-pointer">Register Print Shop</button></li>
              <li><span className="text-slate-400">Max Dimensions: 22" × 100"</span></li>
              <li><span className="text-slate-400">Local Workstation Processing</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-[#183750] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-slate-400">
          <div>© {new Date().getFullYear()} DTF Set Files. Industrial Prepress Automation. All rights reserved.</div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-4">
            <span className="hover:text-[#EF7F1A] cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#EF7F1A] cursor-pointer">Terms of Service</span>
            <span className="hover:text-[#EF7F1A] cursor-pointer">RIP Documentation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
