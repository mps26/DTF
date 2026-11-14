import React, { useState, useEffect } from 'react';
import {
  Clock,
  FileStack,
  Download,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { SheetSettings, LayoutResult } from '../types';

interface HistoryJob {
  id: string;
  name: string;
  createdAt: string;
  widthIn: number;
  heightIn: number;
  totalCopies: number;
  wastePercent: number;
  exportFormat: 'TIFF_DTF' | 'TIFF_UVDTF' | 'PNG_300DPI';
  status: 'completed' | 'verified';
}

const DEFAULT_SAMPLE_JOBS: HistoryJob[] = [
  {
    id: 'JOB-9401',
    name: 'Om_Sacred_Art_Repeat_11Copies',
    createdAt: 'Today, 04:32 PM',
    widthIn: 22,
    heightIn: 48,
    totalCopies: 11,
    wastePercent: 8,
    exportFormat: 'TIFF_UVDTF',
    status: 'verified'
  },
  {
    id: 'JOB-8823',
    name: 'Summer_Apparel_Batch_A',
    createdAt: 'Yesterday, 02:15 PM',
    widthIn: 22,
    heightIn: 60,
    totalCopies: 24,
    wastePercent: 5,
    exportFormat: 'TIFF_DTF',
    status: 'completed'
  },
  {
    id: 'JOB-7210',
    name: 'Left_Chest_Pocket_Logos',
    createdAt: 'Nov 03, 11:20 AM',
    widthIn: 13,
    heightIn: 36,
    totalCopies: 32,
    wastePercent: 12,
    exportFormat: 'PNG_300DPI',
    status: 'completed'
  }
];

interface ProductionHistoryViewProps {
  currentSettings: SheetSettings;
  currentLayout: LayoutResult;
  onBackToStudio: () => void;
  onNotification: (msg: string) => void;
}

export const ProductionHistoryView: React.FC<ProductionHistoryViewProps> = ({
  currentSettings,
  currentLayout,
  onBackToStudio,
  onNotification
}) => {
  const [jobs, setJobs] = useState<HistoryJob[]>(() => {
    try {
      const saved = localStorage.getItem('dtf_production_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SAMPLE_JOBS;
  });

  const handleClearHistory = () => {
    if (confirm('Clear all production history entries?')) {
      setJobs([]);
      localStorage.removeItem('dtf_production_history');
      onNotification('Production history cleared');
    }
  };

  const handleDeleteJob = (id: string) => {
    const updated = jobs.filter((j) => j.id !== id);
    setJobs(updated);
    try {
      localStorage.setItem('dtf_production_history', JSON.stringify(updated));
    } catch {}
    onNotification('Removed history item');
  };

  const handleSaveCurrentJob = () => {
    const newJob: HistoryJob = {
      id: `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
      name: `GangSheet_${currentSettings.filmWidth}x${Math.round(currentLayout.usedLengthInches || 24)}in`,
      createdAt: 'Just now',
      widthIn: currentSettings.filmWidth,
      heightIn: Math.round((currentLayout.usedLengthInches || 24) * 10) / 10,
      totalCopies: currentLayout.totalCopies || 1,
      wastePercent: currentLayout.wastePercent || 0,
      exportFormat: 'TIFF_DTF',
      status: 'verified'
    };

    const updated = [newJob, ...jobs];
    setJobs(updated);
    try {
      localStorage.setItem('dtf_production_history', JSON.stringify(updated));
    } catch {}
    onNotification(`Logged current gang sheet to production history (${newJob.id})`);
  };

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
              <Clock className="w-4 h-4 text-[#EF7F1A]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm text-[#204563] tracking-tight uppercase">
                  Production History &amp; Export Log
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#FCE8D5] text-[#204563] border border-[#EF7F1A]/30 px-2 py-0.5 rounded-full">
                  {jobs.length} Logged Runs
                </span>
              </div>
              <div className="text-[11px] text-[#526A7B] font-medium">
                Detailed audit trail of generated RIP TIFFs, high-res gang sheets, and film consumption
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSaveCurrentJob}
            className="h-9 px-3.5 bg-[#FAF7F1] hover:bg-[#FCE8D5] text-[#204563] font-bold text-xs rounded-xl border border-[#E5D9C8] flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-[#EF7F1A]" />
            <span>Log Active Sheet to History</span>
          </button>

          {jobs.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="h-9 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Clear Log
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-36 sm:pb-6 space-y-6">
        {jobs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E5D9C8] p-12 text-center max-w-md mx-auto my-12 shadow-xs">
            <Clock className="w-12 h-12 text-[#526A7B]/40 mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#204563]">No Production History Yet</h3>
            <p className="text-xs text-[#526A7B] mt-1">
              Whenever you generate and download a gang sheet or TIFF export, it will be automatically logged here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#E5D9C8] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E5D9C8] flex items-center justify-between bg-[#FAF7F1]">
              <span className="font-extrabold text-xs text-[#204563] uppercase tracking-wider">
                Production Job Queue History
              </span>
              <span className="text-[11px] font-mono text-[#526A7B]">
                Sorted by most recent
              </span>
            </div>

            <div className="divide-y divide-[#E5D9C8]">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-[#FAF7F1]/60 transition-colors"
                >
                  {/* Left Column: Job Info */}
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#FAF7F1] border border-[#E5D9C8] text-[#204563] flex items-center justify-center font-black text-xs font-mono shadow-2xs flex-shrink-0">
                      {job.id.replace('JOB-', '')}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-[#204563] tracking-tight">
                          {job.name}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            job.exportFormat === 'TIFF_UVDTF'
                              ? 'bg-[#FCE8D5] text-[#204563] border-[#EF7F1A]/30'
                              : job.exportFormat === 'TIFF_DTF'
                              ? 'bg-[#FAF7F1] text-[#204563] border-[#E5D9C8]'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {job.exportFormat.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-[#526A7B] font-mono mt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-[#526A7B]" />
                          <span>{job.createdAt}</span>
                        </span>
                        <span>•</span>
                        <span>Dimensions: {job.widthIn}" × {job.heightIn}"</span>
                        <span>•</span>
                        <span>{job.totalCopies} Placed Copies</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-bold">{job.wastePercent}% Waste</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center space-x-2 self-end md:self-center">
                    <button
                      type="button"
                      onClick={onBackToStudio}
                      className="px-3.5 py-1.5 rounded-xl bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Open in Studio</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#204563]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job.id)}
                      className="w-8 h-8 rounded-xl bg-[#FAF7F1] hover:bg-rose-50 text-[#526A7B] hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer border border-[#E5D9C8]"
                      title="Delete log entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

