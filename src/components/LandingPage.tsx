import React, { useState, useEffect } from 'react';
import {
  Layers,
  ArrowRight,
  CheckCircle2,
  LogOut,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { UserProfile } from '../types/auth';
import myPrintStyleLogo from '../assets/my-print-style-logo.png';

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

  return (
    <div className="h-screen w-full flex flex-col bg-[#F3EBDD] text-[#204563] font-sans selection:bg-[#EF7F1A] selection:text-[#204563] overflow-hidden">
      {/* PROFESSIONAL RESPONSIVE TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-[#F3EBDD]/95 backdrop-blur-md border-b border-[#E5D9C8] shadow-2xs w-full shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 md:h-20 flex items-center justify-between">
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

          {/* Center Brand Logo (Properly Proportioned & Balanced) */}
          <div className="hidden sm:flex items-center justify-center px-4">
            <img
              src={myPrintStyleLogo}
              alt="My Print Style"
              className="h-10 sm:h-12 md:h-13 lg:h-14 w-auto object-contain select-none transition-transform hover:scale-105 duration-200"
            />
          </div>

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

              {/* Brand Logo in Mobile Drawer */}
              <div className="py-3 flex items-center justify-center border-y border-[#E5D9C8] bg-white/40 rounded-xl">
                <img
                  src={myPrintStyleLogo}
                  alt="My Print Style"
                  className="h-11 sm:h-12 w-auto object-contain"
                />
              </div>
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
      <section className="relative flex-1 flex flex-col justify-center items-center overflow-hidden bg-[#F3EBDD] w-full px-4 sm:px-6">
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 -mt-6 sm:-mt-10 md:-mt-14">
          <div className="text-center max-w-3xl mx-auto space-y-6 sm:space-y-8">
            {/* Main Title - Responsive clamp-like scaling */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-[#204563] tracking-tight leading-[1.15] break-words">
              MPS DTF &amp; UV-DTF{' '}
              <span className="text-[#EF7F1A] block sm:inline mt-1 sm:mt-0">
                Gang Sheet Builder
              </span>
            </h1>

            {/* CTA Button Group */}
            <div className="pt-2 sm:pt-3 flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleProtectedAction(onLaunchStudio)}
                className="w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-orange-500/25 flex items-center justify-center space-x-2.5 transition-all cursor-pointer group min-h-[48px]"
              >
                <Layers className="w-4 h-4 text-[#204563]" />
                <span>Open Gang Sheet Studio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Compatible RIPs Tagline - Clean Wrapping */}
            <div className="pt-2 sm:pt-3 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-[11px] sm:text-xs text-[#526A7B] font-mono px-2">
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
        </div>
      </section>
    </div>
  );
};
