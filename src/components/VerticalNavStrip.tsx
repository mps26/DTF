import React, { useState } from 'react';
import {
  Layers,
  Home,
  LayoutGrid,
  Image as ImageIcon,
  Copy,
  Clock,
  Settings,
  FileStack,
  Menu,
  X,
  User,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { UserProfile } from '../types/auth';

interface VerticalNavStripProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: UserProfile | null;
}

export const VerticalNavStrip: React.FC<VerticalNavStripProps> = ({
  activeTab,
  onTabChange,
  currentUser
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleMobileNav = (tab: string) => {
    onTabChange(tab);
    setMobileDrawerOpen(false);
  };

  const isStudioActive = activeTab === 'studio' || activeTab === 'designs';

  return (
    <>
      {/* ================= 1. DESKTOP VERTICAL ICON NAV STRIP (lg and up) ================= */}
      <aside className="hidden lg:flex w-16 bg-[#204563] border-r border-[#183750] flex-col items-center justify-between py-3 flex-shrink-0 z-40 select-none">
        {/* Top: Brand Icon (Click to view Landing Page) */}
        <div className="flex flex-col items-center space-y-4">
          <button
            type="button"
            onClick={() => onTabChange('landing')}
            className={`w-10 h-10 rounded-2xl bg-[#EF7F1A] flex items-center justify-center text-[#204563] shadow-lg shadow-orange-500/25 font-black cursor-pointer hover:scale-105 transition-all ${activeTab === 'landing' ? 'ring-2 ring-white' : ''
              }`}
            title="DTF Set Files Landing Page"
          >
            <Layers className="w-5 h-5 text-[#204563]" />
          </button>

          {/* Navigation Icons */}
          <div className="flex flex-col items-center space-y-2 pt-2">
            {/* Home (DTF / UVDTF Selector) */}
            <button
              onClick={() => onTabChange('home')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTab === 'home'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-md shadow-orange-500/30 ring-2 ring-[#EF7F1A]/40'
                  : 'text-white/80 hover:text-[#EF7F1A] hover:bg-[#183750]'
                }`}
              title="Home — Choose DTF or UVDTF"
            >
              <Home className="w-5 h-5" />
            </button>

            {/* Grid / Studio */}
            <button
              onClick={() => onTabChange('studio')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${isStudioActive
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-md shadow-orange-500/30 ring-2 ring-[#EF7F1A]/40'
                  : 'text-white/80 hover:text-[#EF7F1A] hover:bg-[#183750]'
                }`}
              title="Gang Sheet Studio"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>

            {/* TIFF Export - RIP Ready W1 & CMYK Channels */}
            <button
              onClick={() => onTabChange('tiff-export')}
              className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative cursor-pointer ${activeTab === 'tiff-export'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-md shadow-orange-500/30 ring-2 ring-[#EF7F1A]/40'
                  : 'text-white/80 hover:text-[#EF7F1A] hover:bg-[#183750]'
                }`}
              title="TIFF Export - RIP Ready W1 & CMYK Channels"
            >
              <FileStack className="w-4 h-4" />
              <span className="text-[8px] font-black tracking-tight leading-none mt-0.5 scale-90">TIFF</span>
              {activeTab !== 'tiff-export' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#EF7F1A] animate-pulse" />
              )}
            </button>

            {/* Gallery / Images */}
            <button
              onClick={() => onTabChange('gallery')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTab === 'gallery'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-md shadow-orange-500/30 ring-2 ring-[#EF7F1A]/40'
                  : 'text-white/80 hover:text-[#EF7F1A] hover:bg-[#183750]'
                }`}
              title="Asset Gallery & Media Library"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {/* Templates / Gang Sheets */}
            <button
              onClick={() => onTabChange('templates')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTab === 'templates'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-md shadow-orange-500/30 ring-2 ring-[#EF7F1A]/40'
                  : 'text-white/80 hover:text-[#EF7F1A] hover:bg-[#183750]'
                }`}
              title="Gang Sheet Templates"
            >
              <Copy className="w-5 h-5" />
            </button>

            {/* History / Jobs */}
            <button
              onClick={() => onTabChange('history')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTab === 'history'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-md shadow-orange-500/30 ring-2 ring-[#EF7F1A]/40'
                  : 'text-white/80 hover:text-[#EF7F1A] hover:bg-[#183750]'
                }`}
              title="Production History & Export Logs"
            >
              <Clock className="w-5 h-5" />
            </button>

            {/* Settings */}
            <button
              onClick={() => onTabChange('settings')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTab === 'settings'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-md shadow-orange-500/30 ring-2 ring-[#EF7F1A]/40'
                  : 'text-white/80 hover:text-[#EF7F1A] hover:bg-[#183750]'
                }`}
              title="Printer Hardware & RIP Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom: User Avatar */}
        {currentUser ? (
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            className="w-10 h-10 rounded-full bg-[#EF7F1A] text-[#204563] flex items-center justify-center font-extrabold text-xs shadow-md border-2 border-white hover:scale-105 transition-all cursor-pointer"
            title={`${currentUser.name} (${currentUser.companyName}) - Settings`}
          >
            {currentUser.initials}
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
      </aside>

      {/* ================= 2. MOBILE BOTTOM NAVIGATION BAR (< lg) ================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#204563]/95 backdrop-blur-xl border-t border-[#183750] z-40 px-2 py-1.5 flex items-center justify-around select-none shadow-2xl pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {/* Studio Button */}
        <button
          type="button"
          onClick={() => handleMobileNav('studio')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${isStudioActive
              ? 'text-[#EF7F1A] font-extrabold'
              : 'text-white/75 hover:text-white'
            }`}
        >
          <div className={`p-1 rounded-lg ${isStudioActive ? 'bg-[#EF7F1A]/20' : ''}`}>
            <LayoutGrid className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none font-semibold">Studio</span>
        </button>

        {/* Home Button */}
        <button
          type="button"
          onClick={() => handleMobileNav('home')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${activeTab === 'home'
              ? 'text-[#EF7F1A] font-extrabold'
              : 'text-white/75 hover:text-white'
            }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'home' ? 'bg-[#EF7F1A]/20' : ''}`}>
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none font-semibold">Home</span>
        </button>

        {/* TIFF RIP Button */}
        <button
          type="button"
          onClick={() => handleMobileNav('tiff-export')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${activeTab === 'tiff-export'
              ? 'text-[#EF7F1A] font-extrabold'
              : 'text-white/75 hover:text-white'
            }`}
        >
          <div className={`p-1 rounded-lg relative ${activeTab === 'tiff-export' ? 'bg-[#EF7F1A]/20' : ''}`}>
            <FileStack className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#EF7F1A] animate-pulse" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none font-semibold">TIFF RIP</span>
        </button>

        {/* Gallery Button */}
        <button
          type="button"
          onClick={() => handleMobileNav('gallery')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${activeTab === 'gallery'
              ? 'text-[#EF7F1A] font-extrabold'
              : 'text-white/75 hover:text-white'
            }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'gallery' ? 'bg-[#EF7F1A]/20' : ''}`}>
            <ImageIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none font-semibold">Gallery</span>
        </button>

        {/* More Menu Drawer Trigger */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${mobileDrawerOpen || activeTab === 'templates' || activeTab === 'history' || activeTab === 'settings'
              ? 'text-[#EF7F1A] font-extrabold'
              : 'text-white/75 hover:text-white'
            }`}
        >
          <div className="p-1 rounded-lg">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 leading-none font-semibold">Menu</span>
        </button>
      </nav>

      {/* ================= 3. MOBILE SLIDE-UP DRAWER MENU ================= */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative bg-[#FAF7F1] border-t border-[#E5D9C8] rounded-t-3xl shadow-2xl p-4 sm:p-6 z-10 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 pb-[max(1rem,env(safe-area-inset-bottom))] text-[#204563]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5D9C8]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#204563] flex items-center justify-center text-white shadow-md">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#204563]">DTF Set Files</h3>
                  <p className="text-[11px] text-[#526A7B]">Navigation &amp; Tools</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-[#E8DDCA] text-[#204563] flex items-center justify-center hover:bg-[#E5D9C8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile Card (if signed in) */}
            {currentUser && (
              <div className="mt-3 p-3 bg-white border border-[#E5D9C8] rounded-2xl flex items-center space-x-3">
                <div
                  className="w-10 h-10 rounded-full bg-[#EF7F1A] text-[#204563] flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs"
                >
                  {currentUser.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-[#204563] truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-[#526A7B] truncate">{currentUser.companyName}</div>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-[#FCE8D5] text-[#204563] border border-[#fed4aa] inline-block mt-0.5">
                    {currentUser.plan}
                  </span>
                </div>
              </div>
            )}

            {/* Menu Items List */}
            <div className="mt-3 space-y-1">
              <button
                type="button"
                onClick={() => handleMobileNav('studio')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${isStudioActive
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-[#204563] hover:bg-[#E8DDCA]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-xs font-bold">Gang Sheet Studio</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => handleMobileNav('home')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${activeTab === 'home'
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-[#204563] hover:bg-[#E8DDCA]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <Home className="w-4 h-4" />
                  <span className="text-xs font-bold">Home (DTF &amp; UV-DTF Selector)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => handleMobileNav('tiff-export')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${activeTab === 'tiff-export'
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-slate-300 hover:bg-[#183750]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <FileStack className={`w-4 h-4 ${activeTab === 'tiff-export' ? 'text-[#204563]' : 'text-[#EF7F1A]'}`} />
                  <span className="text-xs">TIFF RIP Compositor (W1 + CMYK)</span>
                </div>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  RIP
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleMobileNav('gallery')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${activeTab === 'gallery'
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-slate-300 hover:bg-[#183750]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-xs">Asset Gallery &amp; Media Library</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => handleMobileNav('templates')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${activeTab === 'templates'
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-slate-300 hover:bg-[#183750]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <Copy className="w-4 h-4" />
                  <span className="text-xs">Gang Sheet Templates</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => handleMobileNav('history')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${activeTab === 'history'
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-slate-300 hover:bg-[#183750]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Production History &amp; Export Logs</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => handleMobileNav('settings')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${activeTab === 'settings'
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-slate-300 hover:bg-[#183750]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <Settings className="w-4 h-4" />
                  <span className="text-xs">Printer Hardware &amp; Profile Settings</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => handleMobileNav('landing')}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors ${activeTab === 'landing'
                    ? 'bg-[#EF7F1A] text-[#204563] font-black'
                    : 'text-slate-300 hover:bg-[#183750]'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs">Website Home / Landing Page</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
