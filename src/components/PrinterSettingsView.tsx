import React, { useState, useEffect } from 'react';
import {
  Settings,
  Printer,
  Sliders,
  CheckCircle2,
  RotateCcw,
  Save,
  Layers,
  Cpu,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Lock,
  ShieldCheck,
  LogOut,
  Key,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Calendar,
  BadgeCheck,
  ChevronRight
} from 'lucide-react';
import { SheetSettings, Unit } from '../types';
import { UserProfile } from '../types/auth';
import { updateUserProfile, changeUserPassword } from '../utils/auth';

interface PrinterSettingsViewProps {
  currentSettings: SheetSettings;
  onSaveSettings: (updated: Partial<SheetSettings>) => void;
  onBackToStudio: () => void;
  onNotification: (msg: string) => void;
  currentUser?: UserProfile | null;
  onUpdateCurrentUser?: (updated: UserProfile) => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onLogout?: () => void;
}

export const PrinterSettingsView: React.FC<PrinterSettingsViewProps> = ({
  currentSettings,
  onSaveSettings,
  onBackToStudio,
  onNotification,
  currentUser = null,
  onUpdateCurrentUser,
  onOpenAuth,
  onLogout
}) => {
  // Top-level Navigation: 'profile' (User Information) vs 'hardware' (Printer & RIP Config)
  const [activeTab, setActiveTab] = useState<'profile' | 'hardware'>('profile');

  // ================= USER & SHOP PROFILE STATE =================
  const [name, setName] = useState<string>(currentUser?.name || '');
  const [email, setEmail] = useState<string>(currentUser?.email || '');
  const [phone, setPhone] = useState<string>(currentUser?.phone || '+91 98200 12345');
  const [companyName, setCompanyName] = useState<string>(currentUser?.companyName || '');
  const [gstin, setGstin] = useState<string>(currentUser?.gstin || '27AAAAA0000A1Z5');
  const [address, setAddress] = useState<string>(currentUser?.address || 'Industrial Estate, Phase II');
  const [city, setCity] = useState<string>(currentUser?.city || 'Mumbai');
  const [stateName, setStateName] = useState<string>(currentUser?.state || 'Maharashtra');
  const [country, setCountry] = useState<string>(currentUser?.country || 'India');
  const [printerModel, setPrinterModel] = useState<string>(
    currentUser?.printerModel || '24" Dual Epson i3200 (Hoson)'
  );
  const [role, setRole] = useState<'operator' | 'admin' | 'shop_owner'>(
    currentUser?.role || 'shop_owner'
  );

  // Password Update State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Keep state in sync if currentUser changes
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '+91 98200 12345');
      setCompanyName(currentUser.companyName || '');
      setGstin(currentUser.gstin || '27AAAAA0000A1Z5');
      setAddress(currentUser.address || 'Industrial Estate, Phase II');
      setCity(currentUser.city || 'Mumbai');
      setStateName(currentUser.state || 'Maharashtra');
      setCountry(currentUser.country || 'India');
      setPrinterModel(currentUser.printerModel || '24" Dual Epson i3200 (Hoson)');
      setRole(currentUser.role || 'shop_owner');
    }
  }, [currentUser]);

  // ================= HARDWARE & RIP PRESETS STATE =================
  const [filmWidth, setFilmWidth] = useState<number>(currentSettings.filmWidth || 22);
  const [fixedLength, setFixedLength] = useState<number>(currentSettings.fixedLength || 60);
  const [unit, setUnit] = useState<Unit>(currentSettings.unit || 'inch');
  const [spacing, setSpacing] = useState<number>(currentSettings.spacing || 0.3);
  const [margin, setMargin] = useState<number>(currentSettings.margin || 0.25);
  const [nestingAlgorithm, setNestingAlgorithm] = useState<'box' | 'true-shape'>(
    (currentSettings.nestingAlgorithm as any) || 'box'
  );
  const [allowRotation, setAllowRotation] = useState<boolean>(currentSettings.allowItemRotation ?? true);

  // RIP settings
  const [ripEngine, setRipEngine] = useState<string>('maintop');
  const [whiteChannel, setWhiteChannel] = useState<string>('W1');
  const [varnishChannel, setVarnishChannel] = useState<string>('W2');
  const [colorMode, setColorMode] = useState<'cmyk' | 'rgb'>('cmyk');
  const [defaultDpi, setDefaultDpi] = useState<number>(300);

  // Save User & Shop Profile Information
  const handleSaveProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    const res = updateUserProfile({
      name: name.trim() || currentUser.name,
      email: email.trim() || currentUser.email,
      phone: phone.trim(),
      companyName: companyName.trim() || currentUser.companyName,
      gstin: gstin.trim().toUpperCase(),
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      country: country.trim(),
      printerModel: printerModel.trim(),
      role
    });

    if (res.success && res.user) {
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(res.user);
      }
      onNotification('Account profile and print shop details updated successfully');
    } else {
      onNotification(res.error || 'Failed to update user profile');
    }
  };

  // Change Password
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword || !newPassword) {
      setPasswordStatus({ type: 'error', text: 'Please fill in both current and new password.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'New passwords do not match. Please verify.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    const res = changeUserPassword(currentPassword, newPassword);
    if (res.success) {
      setPasswordStatus({ type: 'success', text: 'Workstation password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotification('Password updated successfully');
    } else {
      setPasswordStatus({ type: 'error', text: res.error || 'Failed to update password.' });
    }
  };

  // Save Printer Hardware Preferences
  const handleSaveHardware = () => {
    const clampedW = Math.min(24, Math.max(1, filmWidth));
    const clampedH = Math.min(100, Math.max(1, fixedLength));

    onSaveSettings({
      filmWidth: clampedW,
      filmWidthMm: clampedW * 25.4,
      fixedLength: clampedH,
      fixedLengthMm: clampedH * 25.4,
      unit,
      spacing,
      spacingMm: spacing * 25.4,
      margin,
      marginMm: margin * 25.4,
      nestingAlgorithm,
      allowItemRotation: allowRotation,
      exportDpi: defaultDpi
    });

    try {
      localStorage.setItem(
        'dtf_printer_preferences',
        JSON.stringify({
          filmWidth: clampedW,
          fixedLength: clampedH,
          unit,
          spacing,
          margin,
          nestingAlgorithm,
          allowRotation,
          ripEngine,
          whiteChannel,
          varnishChannel,
          colorMode,
          defaultDpi
        })
      );
    } catch {}

    onNotification('Saved printer hardware profile & RIP preferences');
    onBackToStudio();
  };

  const handleResetDefaults = () => {
    setFilmWidth(22);
    setFixedLength(60);
    setUnit('inch');
    setSpacing(0.3);
    setMargin(0.25);
    setNestingAlgorithm('box');
    setAllowRotation(false);
    setRipEngine('maintop');
    setWhiteChannel('W1');
    setVarnishChannel('W2');
    setColorMode('cmyk');
    setDefaultDpi(300);
    onNotification('Reset hardware settings to factory defaults (22" × 60", 300 DPI, Maintop W1)');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F3EBDD] text-[#204563] overflow-hidden font-sans select-none">
      {/* ================= TOP CONSOLE HEADER ================= */}
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

          {/* Segmented Tab Navigation: User Info vs Hardware Config */}
          <div className="flex items-center bg-[#FAF7F1] p-1 rounded-xl border border-[#E5D9C8]">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-xs font-black'
                  : 'text-[#526A7B] hover:text-[#204563]'
              }`}
            >
              <User className={`w-3.5 h-3.5 ${activeTab === 'profile' ? 'text-[#204563]' : 'text-[#526A7B]'}`} />
              <span>User &amp; Shop Account</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hardware')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'hardware'
                  ? 'bg-[#EF7F1A] text-[#204563] shadow-xs font-black'
                  : 'text-[#526A7B] hover:text-[#204563]'
              }`}
            >
              <Printer className={`w-3.5 h-3.5 ${activeTab === 'hardware' ? 'text-[#204563]' : 'text-[#526A7B]'}`} />
              <span>Printer &amp; RIP Hardware</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {activeTab === 'profile' ? (
            <button
              type="button"
              onClick={() => handleSaveProfile()}
              className="h-9 px-4 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs rounded-xl shadow-md shadow-orange-500/25 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#204563]" />
              <span>Save Account Info</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="h-9 px-3.5 bg-white hover:bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Standards</span>
              </button>

              <button
                type="button"
                onClick={handleSaveHardware}
                className="h-9 px-4 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs rounded-xl shadow-md shadow-orange-500/25 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#204563]" />
                <span>Save Preferences</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================= TAB 1: USER & SHOP PROFILE ================= */}
      {activeTab === 'profile' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-36 sm:pb-6 max-w-4xl mx-auto w-full space-y-6">
          {/* Guest Warning if not logged in */}
          {!currentUser ? (
            <div className="bg-[#FAF7F1] border border-[#E5D9C8] rounded-3xl p-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FCE8D5] text-[#EF7F1A] flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#204563]">Guest Workstation Session</h3>
                  <p className="text-xs text-[#526A7B] mt-0.5">
                    Sign in or register your print shop to sync user settings, GST tax invoices, and printer presets across workstations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth('login')}
                className="px-4 py-2 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] text-xs font-black rounded-xl shadow-md shadow-orange-500/25 cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          ) : (
            <>
              {/* Operator Identity Banner Card */}
              <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center space-x-4">
                  <div
                    className="w-16 h-16 rounded-2xl bg-[#204563] text-[#EF7F1A] flex items-center justify-center font-black text-xl shadow-lg shadow-[#204563]/25 border-2 border-[#183750]"
                  >
                    {currentUser.initials}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <h2 className="text-lg font-black text-[#204563]">{currentUser.name}</h2>
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FCE8D5] text-[#204563] border border-[#EF7F1A]/30">
                        <BadgeCheck className="w-3 h-3 text-[#EF7F1A]" />
                        <span>{currentUser.plan}</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-[#526A7B]">
                      <span className="flex items-center space-x-1">
                        <Mail className="w-3.5 h-3.5 text-[#526A7B]" />
                        <span>{currentUser.email}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Building2 className="w-3.5 h-3.5 text-[#526A7B]" />
                        <span>{currentUser.companyName}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Account Badges / Status */}
                <div className="flex items-center space-x-2 text-xs font-semibold">
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active License</span>
                  </div>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
                      title="Sign Out of Workstation"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Form 1: Personal / Operator Information */}
              <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs space-y-5">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5D9C8]">
                  <div className="w-8 h-8 rounded-xl bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-[#204563]">Personal &amp; Operator Information</h3>
                    <p className="text-xs text-[#526A7B]">Contact details and role configuration for your DTF workstation profile.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">Full Name</label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-[#526A7B] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ninad Pawar"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">Email Address (Login ID)</label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-[#526A7B] absolute left-3 top-3" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="operator@printworks.com"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">Phone / WhatsApp Number</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-[#526A7B] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98200 12345"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">Operator Role &amp; Permissions</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                    >
                      <option value="shop_owner">Shop Owner / Managing Director</option>
                      <option value="operator">Prepress Operator (Gang Sheet &amp; RIP)</option>
                      <option value="admin">Production Lead / Factory Admin</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Form 2: Print Shop & Business Details (Tax/GST Billing) */}
              <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs space-y-5">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5D9C8]">
                  <div className="w-8 h-8 rounded-xl bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-[#204563]">Print Shop &amp; Business Tax Information</h3>
                    <p className="text-xs text-[#526A7B]">Used for commercial invoice generation, GST tax compliance, and order receipts.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">Print Shop / Company Name</label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 text-[#526A7B] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Apex DTF Printworks"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-[#204563]">
                      <span>GSTIN / Tax Identification Number</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                        Tax Verified
                      </span>
                    </div>
                    <div className="relative">
                      <FileText className="w-3.5 h-3.5 text-[#526A7B] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        placeholder="27AAAAA0000A1Z5"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold font-mono text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">Shop Physical Address</label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-[#526A7B] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Plot 42, Industrial Area, Sector 5"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">City &amp; State</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City (e.g. Mumbai)"
                        className="w-full px-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                      <input
                        type="text"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="State (e.g. Maharashtra)"
                        className="w-full px-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#204563]">Primary Printer Hardware</label>
                    <div className="relative">
                      <Printer className="w-3.5 h-3.5 text-[#526A7B] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={printerModel}
                        onChange={(e) => setPrinterModel(e.target.value)}
                        placeholder="e.g. 24 Dual Epson i3200 (Hoson)"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSaveProfile()}
                    className="px-5 py-2.5 bg-[#EF7F1A] hover:bg-[#d96e12] text-[#204563] font-black text-xs rounded-xl shadow-md shadow-orange-500/25 flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5 text-[#204563]" />
                    <span>Save Shop &amp; Profile Details</span>
                  </button>
                </div>
              </div>

              {/* Form 3: Subscription & Commercial Quotas */}
              <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs space-y-4">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5D9C8]">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-[#204563]">Commercial Plan &amp; License Quota</h3>
                    <p className="text-xs text-[#526A7B]">Current tier features, roll limits, and multi-channel RIP licenses.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-[#FAF7F1] border border-[#E5D9C8] space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#526A7B]">Current Plan</div>
                    <div className="text-base font-black text-[#204563]">{currentUser.plan}</div>
                    <div className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1 pt-1">
                      <Check className="w-3 h-3" />
                      <span>Commercial License Active</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF7F1] border border-[#E5D9C8] space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#526A7B]">Max Roll Bounds</div>
                    <div className="text-base font-black text-[#204563]">22" x 100" Rolls</div>
                    <div className="text-[11px] text-[#526A7B] font-medium pt-1">True-Shape Cavity Nesting</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF7F1] border border-[#E5D9C8] space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#526A7B]">TIFF RIP Export</div>
                    <div className="text-base font-black text-[#204563]">Photometric 5 (300 DPI)</div>
                    <div className="text-[11px] text-[#EF7F1A] font-medium pt-1">W1 Choke + W2 Varnish</div>
                  </div>
                </div>
              </div>

              {/* Form 4: Security & Workstation Credentials */}
              <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs space-y-5">
                <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5D9C8]">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-[#204563]">Workstation Security &amp; Password</h3>
                    <p className="text-xs text-[#526A7B]">Update operator login password and maintain encrypted workstation access.</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {passwordStatus && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center space-x-2 ${
                        passwordStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {passwordStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>{passwordStatus.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#204563]">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#204563]">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#204563]">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-3 py-2 bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#204563] hover:bg-[#183750] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= TAB 2: PRINTER & RIP HARDWARE ================= */}
      {activeTab === 'hardware' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-36 sm:pb-6 max-w-4xl mx-auto w-full space-y-6">
          {/* Section 1: Film Roll & Hardware Geometry */}
          <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs space-y-5">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5D9C8]">
              <div className="w-8 h-8 rounded-xl bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#204563]">Film Roll &amp; Dimension Bounds</h3>
                <p className="text-xs text-[#526A7B]">Configures maximum allowable printing dimensions for your DTF printer roll.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Film Width */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-[#204563]">
                  <span>Default Roll Width</span>
                  <span className="text-[10px] text-[#204563] bg-[#FAF7F1] px-2 py-0.5 rounded border border-[#E5D9C8] font-mono">
                    Max: 22.2 inches
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {[11, 22, 22.2].map((presetW) => (
                    <button
                      key={presetW}
                      type="button"
                      onClick={() => setFilmWidth(presetW)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        filmWidth === presetW
                          ? 'bg-[#EF7F1A] border-[#EF7F1A] text-[#204563] font-black shadow-2xs'
                          : 'bg-[#FAF7F1] text-[#204563] border-[#E5D9C8] hover:bg-[#E8DDCA]'
                      }`}
                    >
                      {presetW}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Sheet Length */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-[#204563]">
                  <span>Default Sheet Length</span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                    Max: 100 inches
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {[24, 36, 60, 100].map((presetL) => (
                    <button
                      key={presetL}
                      type="button"
                      onClick={() => setFixedLength(presetL)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        fixedLength === presetL
                          ? 'bg-[#EF7F1A] border-[#EF7F1A] text-[#204563] font-black shadow-2xs'
                          : 'bg-[#FAF7F1] text-[#204563] border-[#E5D9C8] hover:bg-[#E8DDCA]'
                      }`}
                    >
                      {presetL}"{presetL === 100 ? ' (Max)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Auto-Nesting & Spacing Defaults */}
          <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs space-y-5">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5D9C8]">
              <div className="w-8 h-8 rounded-xl bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#204563]">Auto-Nesting &amp; Spacing Tolerances</h3>
                <p className="text-xs text-[#526A7B]">Defines safety clearance between designs to prevent cutter blade and scissor overlap.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#204563]">Inter-Artwork Spacing (Inches)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="2.0"
                  value={spacing}
                  onChange={(e) => setSpacing(parseFloat(e.target.value) || 0.3)}
                  className="w-full bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-3 py-2 text-xs font-bold font-mono text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#204563]">Edge Film Margin (Inches)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="2.0"
                  value={margin}
                  onChange={(e) => setMargin(parseFloat(e.target.value) || 0.25)}
                  className="w-full bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-3 py-2 text-xs font-bold font-mono text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-[#204563] mb-2">Default Auto-Nesting Engine</label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setNestingAlgorithm('box')}
                  className="p-3.5 rounded-2xl border text-left transition-all cursor-pointer bg-[#FCE8D5] border-[#EF7F1A] text-[#204563] ring-2 ring-[#EF7F1A]/20"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs">Rectangular Box Packing</span>
                    <span className="text-[10px] font-black text-[#204563] bg-[#EF7F1A] px-2 py-0.5 rounded-full">
                      ✓ Active
                    </span>
                  </div>
                  <p className="text-[11px] text-[#526A7B]">
                    Fast linear guillotine-cut layout. Simple to slice with scissors.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: RIP Software & Spot Color Mappings */}
          <div className="bg-white rounded-3xl border border-[#E5D9C8] p-6 shadow-xs space-y-5">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5D9C8]">
              <div className="w-8 h-8 rounded-xl bg-[#FAF7F1] text-[#204563] border border-[#E5D9C8] flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#204563]">RIP Software &amp; Spot Color Mappings</h3>
                <p className="text-xs text-[#526A7B]">Presets for Maintop, Hosonsoft, RIIN, Flexi/PhotoPrint, and Wasatch rasterizers.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#204563]">Target RIP Engine</label>
                <select
                  value={ripEngine}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRipEngine(val);
                    if (val === 'maintop' || val === 'riin' || val === 'hosonsoft') setWhiteChannel('W1');
                    else if (val === 'printfactory') setWhiteChannel('White');
                    else if (val === 'flexi') setWhiteChannel('Spot_White');
                  }}
                  className="w-full bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-3 py-2 text-xs font-bold text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                >
                  <option value="maintop">Maintop (W1)</option>
                  <option value="hosonsoft">Hosonsoft (W1)</option>
                  <option value="riin">RIIN (W1)</option>
                  <option value="flexi">Flexi / PhotoPrint (Spot_White)</option>
                  <option value="printfactory">PrintFactory (White)</option>
                  <option value="wasatch">Wasatch SoftRIP (Spot1)</option>
                  <option value="other">Custom RIP</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#204563]">White Spot Channel Name</label>
                <input
                  type="text"
                  value={whiteChannel}
                  onChange={(e) => setWhiteChannel(e.target.value)}
                  className="w-full bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-3 py-2 text-xs font-bold font-mono text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#204563]">UV Varnish Spot Channel</label>
                <input
                  type="text"
                  value={varnishChannel}
                  onChange={(e) => setVarnishChannel(e.target.value)}
                  className="w-full bg-[#FAF7F1] border border-[#E5D9C8] rounded-xl px-3 py-2 text-xs font-bold font-mono text-[#204563] focus:outline-none focus:ring-2 focus:ring-[#EF7F1A]/20 focus:border-[#EF7F1A]"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
