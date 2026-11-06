import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Building2,
  Printer,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  Cpu
} from 'lucide-react';
import { UserProfile, LoginFormData, RegisterFormData } from '../types/auth';
import { loginUser, registerUser } from '../utils/auth';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  onNotification?: (msg: string, type?: 'info' | 'warning' | 'success') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  onNotification
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login form state
  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: true
  });

  // Register form state
  const [registerData, setRegisterData] = useState<RegisterFormData>({
    name: '',
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    printerModel: '24" Dual i3200 (Hoson)',
    termsAccepted: true
  });

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!loginData.email || !loginData.password) {
      setErrorMessage('Please fill in both your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginUser(loginData);
      if (result.success && result.user) {
        onSuccess(result.user);
        onNotification?.(`Welcome back, ${result.user.name}!`, 'success');
        onClose();
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please try again.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!registerData.name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!registerData.email.trim()) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (registerData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }
    if (!registerData.termsAccepted) {
      setErrorMessage('Please agree to the Print Shop Terms & Processing Conditions.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerUser(registerData);
      if (result.success && result.user) {
        onSuccess(result.user);
        onNotification?.(`Account created successfully! Welcome to DTF Layout PRO, ${result.user.name}.`, 'success');
        onClose();
      } else {
        setErrorMessage(result.error || 'Registration failed.');
      }
    } catch {
      setErrorMessage('An error occurred during account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickDemo = (email: string, pass: string) => {
    setLoginData({
      email,
      password: pass,
      rememberMe: true
    });
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl text-slate-800 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer z-10"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 shadow-md shadow-indigo-600/20 mb-3 text-white">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {mode === 'login' ? 'Print Shop Operator Login' : 'Create Print Shop Account'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {mode === 'login'
              ? 'Access your industrial gang sheet engine, RIP TIFF presets, and nest queues'
              : 'Deploy multi-channel DTF & UV-DTF gang nesting for high-speed print roll production'}
          </p>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mt-5 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Register New Shop
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="px-8 pb-8 pt-2">
          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-xs text-rose-800 animate-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    placeholder="operator@printworks.com"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setErrorMessage('For testing, you can use password123 or click one of the 1-click accounts below.')}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={loginData.rememberMe}
                    onChange={(e) => setLoginData({ ...loginData, rememberMe: e.target.checked })}
                    className="rounded bg-slate-100 border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-slate-600 text-xs">Remember this workstation</span>
                </label>

              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In & Open Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>


            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      placeholder="e.g. Ninad Pawar"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Shop / Brand Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={registerData.companyName}
                      onChange={(e) => setRegisterData({ ...registerData, companyName: e.target.value })}
                      placeholder="e.g. Apex Printworks"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Business Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="production@yourshop.com"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary DTF / UV-DTF Printer
                </label>
                <div className="relative">
                  <Printer className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={registerData.printerModel}
                    onChange={(e) => setRegisterData({ ...registerData, printerModel: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-hidden transition-all font-medium"
                  >
                    <option value='24" Dual Epson i3200 (Hoson / Maintop)'>24" Dual Epson i3200 (Hoson / Maintop)</option>
                    <option value='22" 4-Head High Volume Roll Line'>22" 4-Head High Volume Roll Line</option>
                    <option value='24" UV-DTF Varnish & White Decal Flatbed'>24" UV-DTF Varnish & White Decal Flatbed</option>
                    <option value='13" / A3+ Desktop Printer (XP600 / L1800)'>13" / A3+ Desktop Printer (XP600 / L1800)</option>
                    <option value='Roland / Mimaki / Mutoh Hybrid'>Roland / Mimaki / Mutoh Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      placeholder="Min 6 chars"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      placeholder="Repeat"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-start space-x-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={registerData.termsAccepted}
                  onChange={(e) => setRegisterData({ ...registerData, termsAccepted: e.target.checked })}
                  className="rounded mt-0.5 bg-slate-100 border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-slate-600 text-xs leading-tight">
                  I agree to the Gang Sheet Automation Service Terms, RIP TIFF Export standards, and Print Preflight rules.
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Production Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Account & Launch</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
