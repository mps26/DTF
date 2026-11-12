import React from 'react';
import {
  Layers,
  Home,
  LayoutGrid,
  Image as ImageIcon,
  Copy,
  Clock,
  Settings,
  FileStack
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
  return (
    <div className="w-16 bg-[#0a0d18] border-r border-[#1a2138] flex flex-col items-center justify-between py-3 flex-shrink-0 z-40 select-none">
      {/* Top: Brand Icon (Click to view Landing Page) */}
      <div className="flex flex-col items-center space-y-4">
        <button
          type="button"
          onClick={() => onTabChange('landing')}
          className={`w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 font-black cursor-pointer hover:scale-105 transition-all ${
            activeTab === 'landing' ? 'ring-2 ring-indigo-400' : ''
          }`}
          title="DTF Layout PRO Landing Page"
        >
          <Layers className="w-5 h-5 text-white" />
        </button>

        {/* Navigation Icons */}
        <div className="flex flex-col items-center space-y-2 pt-2">
          {/* Home (DTF / UVDTF Selector) */}
          <button
            onClick={() => onTabChange('home')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Home — Choose DTF or UVDTF"
          >
            <Home className="w-5 h-5" />
          </button>

          {/* Grid / Designs */}
          <button
            onClick={() => onTabChange('designs')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'designs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="My Designs"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          {/* TIFF Export - RIP Ready W1 & CMYK Channels */}
          <button
            onClick={() => onTabChange('tiff-export')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative cursor-pointer ${
              activeTab === 'tiff-export'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="TIFF Export - RIP Ready W1 & CMYK Channels"
          >
            <FileStack className="w-4 h-4" />
            <span className="text-[8px] font-black tracking-tight leading-none mt-0.5 scale-90">TIFF</span>
            {activeTab !== 'tiff-export' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Gallery / Images */}
          <button
            onClick={() => onTabChange('gallery')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'gallery'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Asset Gallery & Media Library"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Templates / Gang Sheets */}
          <button
            onClick={() => onTabChange('templates')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Gang Sheet Templates"
          >
            <Copy className="w-5 h-5" />
          </button>

          {/* History / Jobs */}
          <button
            onClick={() => onTabChange('history')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Production History & Export Logs"
          >
            <Clock className="w-5 h-5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => onTabChange('settings')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Printer Hardware & RIP Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom: User Avatar (Only shows registered/logged-in person) */}
      {currentUser ? (
        <button
          type="button"
          onClick={() => onTabChange('settings')}
          className={`w-10 h-10 rounded-full bg-gradient-to-tr ${
            currentUser.avatarColor || 'from-purple-500 to-indigo-600'
          } text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-indigo-400/40 hover:scale-105 transition-all cursor-pointer`}
          title={`${currentUser.name} (${currentUser.companyName}) - Settings`}
        >
          {currentUser.initials}
        </button>
      ) : (
        <div className="w-10 h-10" />
      )}
    </div>
  );
};

