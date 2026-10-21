import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Heart,
  Globe,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Users,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [isLogin, setIsLogin] = useState<boolean>(initialMode === 'login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [pronouns, setPronouns] = useState<string>('they/them');
  const [culturalContext, setCulturalContext] = useState<string>('');
  const [isCouplesAccount, setIsCouplesAccount] = useState<boolean>(false);
  const [partnerName, setPartnerName] = useState<string>('');
  const [coupleCode, setCoupleCode] = useState<string>('');
  const [isAdminSignup, setIsAdminSignup] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isLogin) {
        const user = await api.login({ email, password });
        onAuthSuccess(user);
        onClose();
      } else {
        const user = await api.signup({
          name,
          email,
          password,
          pronouns,
          culturalContext,
          partnerName: isCouplesAccount ? partnerName : undefined,
          coupleCode: isCouplesAccount ? coupleCode : undefined,
          role: isAdminSignup ? 'ADMIN' : 'USER',
        });
        onAuthSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass = 'password123') => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await api.login({ email: demoEmail, password: demoPass });
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-[#FAF7F2] rounded-3xl shadow-2xl border border-[#EAE3D9] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Warm Aesthetic */}
        <div className="bg-[#F5F0E8] border-b border-[#EAE3D9] p-6 pb-5 flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#C86D51]">
              Sanctuary Portal
            </span>
            <h2 className="text-2xl font-bold font-serif text-[#2A2421]">
              {isLogin ? 'Welcome Back to Haven' : 'Begin Your Therapeutic Journey'}
            </h2>
            <p className="text-xs text-[#6B5E57] leading-relaxed">
              {isLogin
                ? 'Sign in to access your confidential sessions, journals, and exercises.'
                : 'Create your private sanctuary account with inclusive, culturally affirming care.'}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200/50 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Signup extra fields */}
            {!isLogin && (
              <>
                <div>
                  <label className="font-semibold text-[#4A3E39] block mb-1">
                    Your Name or Preferred Alias
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#EAE3D9] rounded-xl text-sm text-[#2A2421] placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#C86D51]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[#4A3E39] block mb-1">
                      Pronouns
                    </label>
                    <input
                      type="text"
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      placeholder="e.g. they/them, she/her, he/him"
                      className="w-full px-3 py-2 bg-white border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#4A3E39] block mb-1">
                      Therapy Focus
                    </label>
                    <select
                      value={isCouplesAccount ? 'couples' : 'individual'}
                      onChange={(e) => setIsCouplesAccount(e.target.value === 'couples')}
                      className="w-full px-3 py-2 bg-white border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    >
                      <option value="individual">Individual Growth</option>
                      <option value="couples">Couples Attunement</option>
                    </select>
                  </div>
                </div>

                {isCouplesAccount && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-900 text-xs">
                      <Heart className="w-3.5 h-3.5 text-amber-700" />
                      <span>Couples Attunement Details</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                        placeholder="Partner's Name (e.g. Jordan)"
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={coupleCode}
                        onChange={(e) => setCoupleCode(e.target.value)}
                        placeholder="Pairing Code (Optional)"
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-[#4A3E39] block mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#3A6B5C]" />
                    <span>Cultural & Lived Context (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={culturalContext}
                    onChange={(e) => setCulturalContext(e.target.value)}
                    placeholder="e.g. Multicultural family, high sensitivity, neurodivergent"
                    className="w-full px-3 py-2 bg-white border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="font-semibold text-[#4A3E39] block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#EAE3D9] rounded-xl text-sm text-[#2A2421] placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#C86D51]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="font-semibold text-[#4A3E39] block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#EAE3D9] rounded-xl text-sm text-[#2A2421] placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#C86D51]"
                />
              </div>
            </div>

            {/* Admin checkbox toggle during signup */}
            {!isLogin && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  id="adminSignup"
                  checked={isAdminSignup}
                  onChange={(e) => setIsAdminSignup(e.target.checked)}
                  className="w-4 h-4 accent-[#C86D51] rounded-sm cursor-pointer"
                />
                <label htmlFor="adminSignup" className="text-stone-700 cursor-pointer">
                  Register as Clinical Administrator (Grants Admin Safety Access)
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#C86D51] text-white rounded-xl font-medium text-sm hover:bg-[#B75C42] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Switch Mode */}
          <div className="text-center text-xs text-[#6B5E57] pt-1">
            {isLogin ? (
              <span>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setErrorMessage(null);
                  }}
                  className="font-semibold text-[#C86D51] hover:underline"
                >
                  Create your sanctuary account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setErrorMessage(null);
                  }}
                  className="font-semibold text-[#C86D51] hover:underline"
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>

          {/* Quick Demo Account Selector */}
          <div className="pt-4 border-t border-[#EAE3D9] space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 block text-center">
              Or Instant 1-Click Demo Login:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('alex.morgan@havenmind.org')}
                className="p-2.5 bg-white border border-[#EAE3D9] rounded-xl hover:border-[#C86D51] text-left transition-colors flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                  A
                </div>
                <div className="truncate">
                  <div className="font-semibold text-[#2A2421]">Alex Morgan</div>
                  <div className="text-[10px] text-stone-400">Client (User Role)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@havenmind.org', 'admin123')}
                className="p-2.5 bg-white border border-[#EAE3D9] rounded-xl hover:border-rose-400 text-left transition-colors flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs shrink-0">
                  E
                </div>
                <div className="truncate">
                  <div className="font-semibold text-[#2A2421]">Dr. Elena Vance</div>
                  <div className="text-[10px] text-rose-600 font-medium">Administrator Role</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
