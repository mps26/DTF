import React, { useState, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ArtworkAsset,
  SheetSettings,
  Unit,
  LayoutResult,
  PrintType
} from './types';
import { VerticalNavStrip } from './components/VerticalNavStrip';
import { TopNavBar } from './components/TopNavBar';
import { LayoutSection } from './components/LayoutSection';
import { BottomToolbar } from './components/BottomToolbar';
import { EditModal } from './components/EditModal';
import { PreviewModal } from './components/PreviewModal';
import { PreflightModal } from './components/PreflightModal';
import { HowToUseModal } from './components/HowToUseModal';
import { TiffExportStudio } from './components/TiffExportStudio';
import { AssetGalleryView } from './components/AssetGalleryView';
import { TemplatesView } from './components/TemplatesView';
import { ProductionHistoryView } from './components/ProductionHistoryView';
import { PrinterSettingsView } from './components/PrinterSettingsView';
import {
  getSampleArtworkAssets,
  getSampleOmAsset
} from './utils/sampleData';
import { unitToMm, mmToUnit, calculateEffectiveDpi, getDpiStatus } from './utils/units';
import { packGangSheet } from './utils/packing';
import {
  loadImage,
  inspectAlphaTransparency,
  calculateAlphaBoundingBox,
  cropImageToBoundingBox,
  removeImageBackground
} from './utils/imageProcessing';
import { exportHighResolutionPng, exportSingleSheetPng, exportJobTicketJson } from './utils/exportRenderer';
import { Layers, Copy } from 'lucide-react';
import { UserProfile } from './types/auth';
import { getCurrentUser, logoutUser } from './utils/auth';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { HomeSelectorView } from './components/HomeSelectorView';
import {
  RollPreset,
  DTF_PRESETS,
  UVDTF_PRESETS,
  findPresetById,
  getSettingsUpdatesForPreset,
  hasLockedRollAccess
} from './utils/sheetPresets';

export const App: React.FC = () => {
  // Navigation active tab (Landing page by default or #studio)
  const [navTab, setNavTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#studio') {
      return 'studio';
    }
    return 'landing';
  });

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // START CLEAN: Do not add any demo files by default (Instruction 3)
  const [assets, setAssets] = useState<ArtworkAsset[]>([]);

  // Sheet Settings state
  const [settings, setSettings] = useState<SheetSettings>({
    printType: 'dtf',
    filmWidthPreset: 'dtf-22x100',
    filmWidth: 22,
    filmWidthMm: 22 * 25.4,
    unit: 'inch',
    spacing: mmToUnit(5, 'inch'),
    spacingMm: 5,
    margin: 0.2,
    marginMm: 0.2 * 25.4,
    lengthMode: 'auto',
    fixedLength: 39,
    fixedLengthMm: 39 * 25.4,
    exportDpi: 300,
    allowItemRotation: false,
    nestingAlgorithm: 'box',
    mode: 'multiple'
  });

  // Modal states
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<ArtworkAsset | null>(null);
  const [activeToolForEdit, setActiveToolForEdit] = useState<string>('upscaler');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isPreflightOpen, setIsPreflightOpen] = useState<boolean>(false);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type?: 'info' | 'warning' | 'success' } | null>(null);

  const showNotification = (msg: string, type: 'info' | 'warning' | 'success' = 'info') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    // Revert any locked preset back to default unlocked preset for the active print mode
    const activePreset = findPresetById(settings.filmWidthPreset);
    if (activePreset?.isLocked) {
      const fallback = (settings.printType || 'dtf') === 'uvdtf' ? UVDTF_PRESETS[0] : DTF_PRESETS[0];
      setSettings((prev) => ({ ...prev, ...getSettingsUpdatesForPreset(fallback) }));
    }
    setNavTab('landing');
    if (typeof window !== 'undefined' && window.location.hash) {
      window.location.hash = '';
    }
    showNotification('Signed out of production workstation.', 'info');
  };

  const handleLockedPresetClick = (preset: RollPreset) => {
    showNotification(
      `${preset.shortLabel} is locked. Only authorized email IDs have access to this option.`,
      'warning'
    );
    if (!currentUser) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
    }
  };

  const handleSelectPrintType = (printType: PrintType) => {
    const defaultPreset = printType === 'uvdtf' ? UVDTF_PRESETS[0] : DTF_PRESETS[0];
    setSettings((prev) => ({
      ...prev,
      ...getSettingsUpdatesForPreset(defaultPreset),
      unit: 'inch',
      spacing: mmToUnit(prev.spacingMm, 'inch'),
      margin: mmToUnit(prev.marginMm, 'inch')
    }));
    setNavTab('studio');
    showNotification(
      printType === 'uvdtf'
        ? 'UVDTF Gang Sheet Studio ready (A4, A3, Meter 22×39, 23×100)'
        : 'DTF Gang Sheet Studio ready (22×100 & 22.5×100)',
      'success'
    );
  };

  // Re-run packing algorithm whenever assets or layout settings change
  const layout: LayoutResult = useMemo(() => {
    return packGangSheet(assets, settings);
  }, [assets, settings]);

  // Unit switcher
  const handleUnitChange = useCallback((newUnit: Unit) => {
    if (settings.unit === newUnit) return;
    const newFilmWidth = mmToUnit(settings.filmWidthMm, newUnit);
    const newSpacing = mmToUnit(settings.spacingMm, newUnit);
    const newMargin = mmToUnit(settings.marginMm, newUnit);
    const newFixedLength = mmToUnit(settings.fixedLengthMm, newUnit);

    setSettings((prev) => ({
      ...prev,
      unit: newUnit,
      filmWidth: Math.round(newFilmWidth * 100) / 100,
      spacing: Math.round(newSpacing * 100) / 100,
      margin: Math.round(newMargin * 100) / 100,
      fixedLength: Math.round(newFixedLength * 100) / 100
    }));

    setAssets((prevAssets) =>
      prevAssets.map((asset) => ({
        ...asset,
        targetWidth: Math.round(mmToUnit(asset.targetWidthMm, newUnit) * 100) / 100,
        targetHeight: Math.round(mmToUnit(asset.targetHeightMm, newUnit) * 100) / 100
      }))
    );
  }, [settings.unit, settings.filmWidthMm, settings.spacingMm, settings.marginMm, settings.fixedLengthMm]);

  const handleUpdateSettings = (updates: Partial<SheetSettings>) => {
    // Enforce email-based lock check if switching to a locked preset
    if (updates.filmWidthPreset !== undefined) {
      const targetPreset = findPresetById(updates.filmWidthPreset);
      if (targetPreset?.isLocked && !hasLockedRollAccess(currentUser)) {
        handleLockedPresetClick(targetPreset);
        return;
      }
    }

    // Clamp maximum printing width to 24" (allows 11", 22", 22.5", 23")
    if (updates.filmWidth !== undefined) {
      updates.filmWidth = Math.min(24, Math.max(1, updates.filmWidth));
      updates.filmWidthMm = updates.filmWidth * 25.4;
    }
    if (updates.filmWidthMm !== undefined) {
      updates.filmWidthMm = Math.min(24 * 25.4, Math.max(25.4, updates.filmWidthMm));
    }

    // Evaluate height constraints from active preset or width
    const effPresetId = updates.filmWidthPreset ?? settings.filmWidthPreset;
    const effPreset = findPresetById(effPresetId);
    const effWidth = updates.filmWidth ?? settings.filmWidth;
    let minLen = effPreset ? effPreset.minLengthIn : (effWidth <= 11.1 ? 8 : (effWidth >= 21.9 ? 39 : 1));
    let maxLen = effPreset ? effPreset.maxLengthIn : (effWidth <= 11.1 ? 17 : 100);

    // If preset is fixed-length (e.g. UVDTF A4 11x8, A3 11x17, Meter 22x39), keep length fixed
    if (effPreset?.isFixedLength) {
      updates.lengthMode = 'fixed';
      updates.fixedLength = effPreset.defaultLengthIn;
      updates.fixedLengthMm = effPreset.defaultLengthIn * 25.4;
    }

    // When filmWidth changes and fixedLength was not explicitly provided, clamp existing fixedLength
    if (updates.filmWidth !== undefined && updates.fixedLength === undefined) {
      const curLen = settings.fixedLength || minLen;
      if (curLen < minLen) {
        updates.fixedLength = minLen;
        updates.fixedLengthMm = minLen * 25.4;
      } else if (curLen > maxLen) {
        updates.fixedLength = maxLen;
        updates.fixedLengthMm = maxLen * 25.4;
      }
    }

    if (updates.fixedLength !== undefined) {
      updates.fixedLength = Math.min(maxLen, Math.max(minLen, updates.fixedLength));
      updates.fixedLengthMm = updates.fixedLength * 25.4;
    }
    if (updates.fixedLengthMm !== undefined) {
      updates.fixedLengthMm = Math.min(maxLen * 25.4, Math.max(minLen * 25.4, updates.fixedLengthMm));
    }

    // Enforce minimum 5 mm spacing
    if (updates.spacingMm !== undefined) {
      const clampedSpacingMm = Math.max(5, updates.spacingMm);
      const effUnit = updates.unit ?? settings.unit;
      updates.spacingMm = clampedSpacingMm;
      updates.spacing = Math.round(mmToUnit(clampedSpacingMm, effUnit) * 1000) / 1000;
    }

    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleUpdateAsset = (id: string, updates: Partial<ArtworkAsset>) => {
    let autoExpandWidth: number | null = null;
    let autoExpandHeight: number | null = null;

    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== id) return asset;
        const updated = { ...asset, ...updates };

        // Lock Aspect Ratio is permanently enabled across the application
        updated.aspectLocked = true;
        const origW = asset.trimmedWidth || asset.originalWidth || 1;
        const origH = asset.trimmedHeight || asset.originalHeight || 1;
        const naturalRatio = (origW > 0 && origH > 0) ? (origW / origH) : 1;
        updated.lockedRatio = naturalRatio;

        const precision = settings.unit === 'meter' ? 4 : 2;
        const factor = Math.pow(10, precision);

        // User enters exact desired numbers in Width and Height independently.
        // Changing Width NEVER alters Height; changing Height NEVER alters Width.
        if (updates.targetWidth !== undefined) {
          const rawW = Math.max(0.01, updates.targetWidth);
          const clampedW = Math.round(rawW * factor) / factor;
          updated.targetWidth = clampedW;
          updated.targetWidthMm = unitToMm(clampedW, settings.unit);

          const targetWidthInches = updated.targetWidthMm / 25.4;
          const currentFilmWidthInches = settings.filmWidthMm / 25.4;
          if (targetWidthInches > currentFilmWidthInches) {
            autoExpandWidth = Math.min(22, targetWidthInches);
          }
        }

        if (updates.targetHeight !== undefined) {
          const rawH = Math.max(0.01, updates.targetHeight);
          const clampedH = Math.round(rawH * factor) / factor;
          updated.targetHeight = clampedH;
          updated.targetHeightMm = unitToMm(clampedH, settings.unit);

          const targetHeightInches = updated.targetHeightMm / 25.4;
          const currentFixedLengthInches = settings.fixedLengthMm / 25.4;
          if (settings.lengthMode === 'fixed' && targetHeightInches > currentFixedLengthInches) {
            autoExpandHeight = Math.min(100, targetHeightInches);
          }
        }

        const px = updated.trimmedWidth || updated.originalWidth;
        updated.effectiveDpi = calculateEffectiveDpi(px, updated.targetWidthMm);
        updated.dpiStatus = getDpiStatus(updated.effectiveDpi);

        return updated;
      })
    );

    setSelectedAssetForEdit((prev) => (prev && prev.id === id ? ({ ...prev, ...updates } as ArtworkAsset) : prev));

    if (autoExpandWidth !== null || autoExpandHeight !== null) {
      setSettings((s) => ({
        ...s,
        ...(autoExpandWidth !== null ? {
          filmWidth: autoExpandWidth,
          filmWidthMm: autoExpandWidth * 25.4,
          filmWidthPreset: autoExpandWidth === 22 ? '22' : autoExpandWidth.toString()
        } : {}),
        ...(autoExpandHeight !== null ? {
          fixedLength: autoExpandHeight,
          fixedLengthMm: autoExpandHeight * 25.4
        } : {})
      }));
    }
  };

  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    showNotification('Design removed from gang sheet');
  };

  // 1-Click Trim action for empty margins
  const handleTrimAsset = async (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset || !asset.cropBox) return;

    try {
      const img = await loadImage(asset.processedUrl || asset.originalUrl);
      const croppedUrl = await cropImageToBoundingBox(img, asset.cropBox);
      const croppedImg = await loadImage(croppedUrl);

      handleUpdateAsset(id, {
        processedUrl: croppedUrl,
        trimmedWidth: croppedImg.naturalWidth,
        trimmedHeight: croppedImg.naturalHeight,
        isTrimmed: true,
        cropBox: {
          ...asset.cropBox,
          emptyPercent: 0
        }
      });
      showNotification(`Trimmed empty margins from ${asset.filename}`);
    } catch (err) {
      console.error(err);
    }
  };

  // 1-Click Remove BG action
  const handleRemoveBgAsset = async (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    try {
      const img = await loadImage(asset.originalUrl);
      const transparentUrl = await removeImageBackground(img, { tolerance: 28 });
      const transparentImg = await loadImage(transparentUrl);
      const cropBox = await calculateAlphaBoundingBox(transparentImg, 8, 2);

      handleUpdateAsset(id, {
        processedUrl: transparentUrl,
        hasAlpha: true,
        isBgRemoved: true,
        cropBox
      });
      showNotification(`Background removed from ${asset.filename}`);
    } catch (err) {
      console.error(err);
    }
  };

  // File Upload Handling
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const newAssets: ArtworkAsset[] = [];

    for (const file of files) {
      try {
        const isJpeg = file.type.includes('jpeg') || file.type.includes('jpg');
        const fileType: ArtworkAsset['fileType'] = file.type.includes('png')
          ? 'png'
          : file.type.includes('webp')
          ? 'webp'
          : 'jpeg';

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const img = await loadImage(dataUrl);
        const { hasAlpha } = await inspectAlphaTransparency(img);

        let processedUrl = dataUrl;
        let isBgRemoved = false;

        // Auto background removal for JPG/JPEG or non-alpha images
        if (!hasAlpha && (isJpeg || !file.type.includes('png'))) {
          processedUrl = await removeImageBackground(img, { tolerance: 28 });
          isBgRemoved = true;
        }

        const processedImg = await loadImage(processedUrl);
        const cropBox = await calculateAlphaBoundingBox(processedImg, 8, 2);

        const defaultWidthInches = 2.18;
        const aspect = img.naturalHeight / img.naturalWidth;
        const defaultHeightInches = Math.round(defaultWidthInches * aspect * 100) / 100;

        const targetWMm = unitToMm(defaultWidthInches, 'inch');
        const targetHMm = unitToMm(defaultHeightInches, 'inch');

        const effectiveDpi = calculateEffectiveDpi(img.naturalWidth, targetWMm);
        const dpiStatus = getDpiStatus(effectiveDpi);

        const newAsset: ArtworkAsset = {
          id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          filename: file.name,
          fileType,
          fileSize: file.size,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          hasAlpha: hasAlpha || isBgRemoved,
          originalUrl: dataUrl,
          processedUrl,
          trimmedWidth: processedImg.naturalWidth,
          trimmedHeight: processedImg.naturalHeight,
          cropBox,
          isTrimmed: false,
          isBgRemoved,
          targetWidth: mmToUnit(targetWMm, settings.unit),
          targetHeight: mmToUnit(targetHMm, settings.unit),
          targetWidthMm: targetWMm,
          targetHeightMm: targetHMm,
          aspectLocked: true,
          lockedRatio: (img.naturalWidth > 0 && img.naturalHeight > 0) ? (img.naturalWidth / img.naturalHeight) : 1,
          copies: 1,
          allowRotation: false,
          effectiveDpi,
          dpiStatus,
          status: 'ready'
        };

        newAssets.push(newAsset);
      } catch (err) {
        console.error('Failed to parse uploaded image', err);
      }
    }

    if (newAssets.length > 0) {
      if (settings.mode === 'repeat') {
        setAssets([newAssets[0]]);
      } else {
        setAssets((prev) => [...prev, ...newAssets]);
      }
      showNotification(`Added ${newAssets.length} image(s) to gang sheet`);
    }
  };

  // Demo switchers (available via top bar buttons if user wants to test)
  const handleLoadMultiDemo = () => {
    setAssets(getSampleArtworkAssets());
    setSettings((s) => ({
      ...s,
      mode: 'multiple',
      filmWidthPreset: '11.5',
      filmWidth: 11.5,
      filmWidthMm: 11.5 * 25.4,
      unit: 'inch'
    }));
    showNotification('Loaded 4 reference demo designs');
  };

  const handleLoadRepeatDemo = () => {
    const om = getSampleOmAsset();
    om.copies = 50;
    setAssets([om]);
    setSettings((s) => ({
      ...s,
      mode: 'repeat',
      filmWidthPreset: '11.5',
      filmWidth: 11.5,
      filmWidthMm: 11.5 * 25.4,
      unit: 'meter'
    }));
    showNotification('Loaded Image 1: om.png repeated 50× (0.83 meters)');
  };

  const handleCreateLayout = () => {
    setAssets([]);
    showNotification('Created fresh blank gang sheet');
  };

  const toolNameMap: Record<string, string> = {
    'upscale': 'Image Upscaler',
    'color-tone': 'Color & Tone',
    'pixel-doctor': 'Pixel Doctor',
    'print-check': 'Print Check',
    'bg-remover': 'Background Remover',
    'remove-color': 'Remove/Replace Color',
    'crop-clean': 'Crop & Clean',
    'eraser': 'Eraser',
    'border-knockout': 'Border Knockout',
    'special-effects': 'Special Effects',
    'texture': 'Texture Effects',
    'halftone': 'Halftone Filter',
    'stroke-outline': 'Stroke / Outline',
    'text-number': 'Text & Number',
    'vectorize': 'Image Vectoriser',
    'recreate-ai': 'Recreate with AI'
  };

  // Tool Selection handler from Tools Sidebar / Palette / Top Navigation Bar
  const handleSelectTool = (toolId: string) => {
    if (toolId === 'tiff-export') {
      setNavTab('tiff-export');
      return;
    }
    if (toolId === 'guide') {
      setIsHowToUseOpen(true);
      return;
    }

    // Strictly enforce image upload requirement: NO random images, flash warning message instead
    if (assets.length === 0) {
      const toolLabel = toolNameMap[toolId] || toolId.replace('-', ' ');
      showNotification(`Please upload an image first to use ${toolLabel}`, 'warning');
      return;
    }

    if (toolId === 'print-check') {
      setIsPreflightOpen(true);
      return;
    }

    setActiveToolForEdit(toolId);
    const target = assets.find((a) => a.id === selectedAssetId) || assets[0];
    setSelectedAssetForEdit(target);
  };

  // Print-Ready Export Handlers
  const handleExportPng = async () => {
    if (layout.placements.length === 0) {
      showNotification('No placements to export');
      return;
    }
    const totalSheets = layout.sheets?.length || 1;
    setIsExporting(true);
    setExportProgress(5);
    setExportStatusText(totalSheets > 1 ? `Starting export of ${totalSheets} sheets...` : 'Starting export...');
    try {
      await exportHighResolutionPng(layout, settings, (prog, status) => {
        setExportProgress(prog);
        if (status) setExportStatusText(status);
      });
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.85 }
      });
      showNotification(
        totalSheets > 1
          ? `All ${totalSheets} sheets downloaded as separate files!`
          : 'Print-Ready Transparent PNG downloaded!'
      );
    } catch (err) {
      console.error(err);
      alert('Export failed.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatusText('');
    }
  };

  const handleExportPdf = () => {
    handleExportPng();
  };

  const handleExportSingleSheet = async (sheetIndex: number) => {
    if (layout.placements.length === 0) {
      showNotification('No placements to export');
      return;
    }
    setIsExporting(true);
    setExportProgress(10);
    setExportStatusText(`Preparing Sheet ${sheetIndex + 1}...`);
    try {
      await exportSingleSheetPng(layout, settings, sheetIndex, (prog, status) => {
        setExportProgress(prog);
        if (status) setExportStatusText(status);
      });
      confetti({
        particleCount: 65,
        spread: 55,
        origin: { y: 0.85 }
      });
      showNotification(`Sheet ${sheetIndex + 1} PNG downloaded (Print-Ready)!`);
    } catch (err) {
      console.error(err);
      alert('Export failed for this sheet.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatusText('');
    }
  };

  const handleExportJobTicket = () => {
    exportJobTicketJson(layout, settings);
    showNotification('Job Ticket JSON downloaded');
  };

  if (navTab === 'landing') {
    return (
      <div className="min-h-screen w-full flex flex-col bg-white text-slate-800 overflow-x-hidden font-sans selection:bg-indigo-600 selection:text-white">
        <LandingPage
          currentUser={currentUser}
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          onLaunchStudio={() => setNavTab('home')}
          onOpenTiffStudio={() => setNavTab('tiff-export')}
          onOpenTemplates={() => setNavTab('templates')}
          onOpenProfile={() => setNavTab('settings')}
        />

        {/* Global Toast Notification */}
        {notification && (
          <div
            className={`fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center space-x-2.5 border backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === 'warning'
                ? 'bg-[#1b1429]/95 border-amber-500/80 text-amber-100 shadow-amber-950/50'
                : 'bg-[#0e1324]/95 border-indigo-500/80 text-white shadow-indigo-950/50'
            }`}
          >
            {notification.type === 'warning' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"></span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
            )}
            <span className="tracking-wide">{notification.message}</span>
          </div>
        )}

        {/* Auth Modal */}
        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            initialMode={authModalMode}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={(user, mode) => {
              setCurrentUser(user);
              setIsAuthModalOpen(false);
              if (mode === 'register') {
                setNavTab('settings');
                showNotification(`Account created! Welcome to your shop profile, ${user.name}.`, 'success');
              } else {
                setNavTab('studio');
                showNotification(`Signed in as ${user.name} (${user.companyName})`, 'success');
              }
            }}
            onNotification={showNotification}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[#0c101d] text-slate-800 overflow-hidden font-sans">
      {/* 1. Very Left Dark Vertical Icon Nav Strip */}
      <VerticalNavStrip activeTab={navTab} onTabChange={setNavTab} currentUser={currentUser} />

      {/* 2. Main Center Work Area (Expanded to full width) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#eff2fc] relative">
        {/* Top Navigation Bar with the 4 Tool Categories */}
        <TopNavBar
          onSelectTool={handleSelectTool}
          onCreateLayout={handleCreateLayout}
          onLoadMultiDemo={handleLoadMultiDemo}
          onLoadRepeatDemo={handleLoadRepeatDemo}
          onOpenAudit={() => setIsPreflightOpen(true)}
          onOpenGuide={() => setIsHowToUseOpen(true)}
          currentUser={currentUser}
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          onGoToLanding={() => setNavTab('landing')}
          onOpenProfile={() => setNavTab('settings')}
        />

        {/* Flash Message Toast Notification */}
        {notification && (
          <div
            className={`fixed top-18 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center space-x-2.5 border backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === 'warning'
                ? 'bg-[#1b1429]/95 border-amber-500/80 text-amber-100 shadow-amber-950/50'
                : 'bg-[#0e1324]/95 border-indigo-500/80 text-white shadow-indigo-950/50'
            }`}
          >
            {notification.type === 'warning' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"></span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
            )}
            <span className="tracking-wide">{notification.message}</span>
          </div>
        )}

        {navTab === 'home' ? (
          <HomeSelectorView
            currentUser={currentUser}
            activePrintType={settings.printType || 'dtf'}
            onSelectPrintType={handleSelectPrintType}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setIsAuthModalOpen(true);
            }}
          />
        ) : navTab === 'tiff-export' ? (
          <TiffExportStudio
            currentAssets={assets}
            currentSettings={settings}
            currentLayout={layout}
            onBackToStudio={() => setNavTab('studio')}
            onNotification={showNotification}
          />
        ) : navTab === 'gallery' ? (
          <AssetGalleryView
            assets={assets}
            onAddFiles={handleFilesSelected}
            onUpdateAssetCopies={(id, copies) => handleUpdateAsset(id, { copies })}
            onEditAsset={(a) => {
              setSelectedAssetForEdit(a);
            }}
            onDeleteAsset={handleDeleteAsset}
            onBackToStudio={() => setNavTab('studio')}
            onNotification={showNotification}
            onSetFileSheet={(assetId) => {
              setSelectedAssetId(assetId);
              setNavTab('studio');
              showNotification('Switched to Sheet Preview — set dimensions in the left panel.');
            }}
          />
        ) : navTab === 'templates' ? (
          <TemplatesView
            currentSettings={settings}
            onApplyTemplate={(newSettings) => handleUpdateSettings(newSettings)}
            onBackToStudio={() => setNavTab('studio')}
            onNotification={showNotification}
          />
        ) : navTab === 'history' ? (
          <ProductionHistoryView
            currentSettings={settings}
            currentLayout={layout}
            onBackToStudio={() => setNavTab('studio')}
            onNotification={showNotification}
          />
        ) : navTab === 'settings' ? (
          <PrinterSettingsView
            currentSettings={settings}
            onSaveSettings={(newSettings) => handleUpdateSettings(newSettings)}
            onBackToStudio={() => setNavTab('studio')}
            onNotification={showNotification}
            currentUser={currentUser}
            onUpdateCurrentUser={(updated) => setCurrentUser(updated)}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
          />
        ) : (
          <>
            {/* Center Content Container: Viewport-constrained with fixed preview & independent left scrolling */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 sm:px-6 pt-2 pb-3">
              <div className="max-w-[1720px] w-full mx-auto flex-1 flex flex-col min-h-0 space-y-2">
                {/* Control Toolbar: Represented at TOP above "Create Your Gang Sheet" */}
                <div className="w-full flex-shrink-0 relative z-30">
                  <BottomToolbar
                    settings={settings}
                    layout={layout}
                    currentUser={currentUser}
                    onUpdateSettings={handleUpdateSettings}
                    onGenerateLayout={() => {
                      confetti({ particleCount: 60, spread: 60, origin: { y: 0.85 } });
                      showNotification('Layout optimized and generated!');
                    }}
                    onExportPng={handleExportPng}
                    onExportPdf={handleExportPdf}
                    onExportJobTicket={handleExportJobTicket}
                    onExportSingleSheet={handleExportSingleSheet}
                    onOpenPreviewModal={() => setIsPreviewModalOpen(true)}
                    onLockedPresetClick={handleLockedPresetClick}
                    onSwitchHome={() => setNavTab('home')}
                    isGenerating={isExporting}
                  />
                </div>

                {/* Header: "Create Your Gang Sheet" (Compact, flex-shrink-0) */}
                <div className="flex flex-col items-center justify-center text-center flex-shrink-0 pt-0 pb-0.5">
                  <h1 className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
                    Create Your <span className="text-indigo-600">Gang Sheet</span>
                  </h1>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium max-w-lg">
                    Upload your designs and generate optimized layouts for DTF printing
                  </p>

                  {/* Multiple Designs / Repeat One Design Pill Switch */}
                  <div className="inline-flex p-1 bg-white/90 backdrop-blur-md rounded-full shadow-xs border border-indigo-100 mt-1.5">
                    <button
                      onClick={() => handleUpdateSettings({ mode: 'multiple' })}
                      className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                        settings.mode === 'multiple'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Multiple designs</span>
                    </button>

                    <button
                      onClick={() => handleUpdateSettings({ mode: 'repeat' })}
                      className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                        settings.mode === 'repeat'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Repeat one design</span>
                    </button>
                  </div>
                </div>

                {/* Main Layout Section: Fixed height within viewport */}
                <div className="flex-1 min-h-0 w-full">
                  <LayoutSection
                    assets={assets}
                    settings={settings}
                    layout={layout}
                    selectedAssetId={selectedAssetId}
                    onSelectAsset={setSelectedAssetId}
                    onUpdateAsset={handleUpdateAsset}
                    onDeleteAsset={handleDeleteAsset}
                    onEditAsset={(a) => {
                      setActiveToolForEdit('crop-clean');
                      setSelectedAssetForEdit(a);
                    }}
                    onTrimAsset={handleTrimAsset}
                    onRemoveBgAsset={handleRemoveBgAsset}
                    onFilesSelected={handleFilesSelected}
                    onOpenGallery={handleLoadMultiDemo}
                    onUnitChange={handleUnitChange}
                    onUpdateSettings={handleUpdateSettings}
                    onNestingModeChange={(mode) => handleUpdateSettings({ nestingAlgorithm: mode })}
                    onOpenPreviewModal={() => setIsPreviewModalOpen(true)}
                    onExportSingleSheet={handleExportSingleSheet}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {selectedAssetForEdit && (
        <EditModal
          asset={selectedAssetForEdit}
          assets={assets}
          initialTool={activeToolForEdit}
          onClose={() => setSelectedAssetForEdit(null)}
          onSelectAsset={(a) => setSelectedAssetForEdit(a)}
          onSave={(updated) => {
            handleUpdateAsset(updated.id, updated);
            showNotification(`Updated ${updated.filename}`);
          }}
          onOpenAudit={() => {
            setSelectedAssetForEdit(null);
            setIsPreflightOpen(true);
          }}
          onOpenTiff={() => {
            setSelectedAssetForEdit(null);
            setNavTab('tiff-export');
          }}
        />
      )}

      {isPreviewModalOpen && (
        <PreviewModal
          layout={layout}
          settings={settings}
          onClose={() => setIsPreviewModalOpen(false)}
          onExportPng={handleExportPng}
          onExportSingleSheet={handleExportSingleSheet}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportStatusText={exportStatusText}
          onOptimize={() => {
            const activePreset = findPresetById(settings.filmWidthPreset);
            handleUpdateSettings({
              nestingAlgorithm: 'true-shape',
              allowItemRotation: true,
              ...(activePreset?.isFixedLength ? {} : { lengthMode: 'auto' })
            });
            showNotification('Optimized layout: True-Shape nesting applied with your spacing!');
          }}
        />
      )}

      {isPreflightOpen && (
        <PreflightModal
          assets={assets}
          settings={settings}
          layout={layout}
          onClose={() => setIsPreflightOpen(false)}
        />
      )}

      {isHowToUseOpen && (
        <HowToUseModal onClose={() => setIsHowToUseOpen(false)} />
      )}

      {/* Operator Authentication Modal */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(user, mode) => {
            setCurrentUser(user);
            setIsAuthModalOpen(false);
            if (mode === 'register') {
              setNavTab('settings');
              showNotification(`Account created! Welcome to your shop profile, ${user.name}.`, 'success');
            } else {
              showNotification(`Signed in as ${user.name} (${user.companyName})`, 'success');
            }
          }}
          onNotification={showNotification}
        />
      )}
    </div>
  );
};
