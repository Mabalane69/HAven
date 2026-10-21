import React, { useState } from 'react';
import { X, User, Heart, Bell, Shield, Check, Globe } from 'lucide-react';
import type { UserProfile } from '../types';
import { api } from '../services/api';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdate,
}) => {
  const [name, setName] = useState<string>(user.name);
  const [pronouns, setPronouns] = useState<string>(user.pronouns || 'they/them');
  const [culturalContext, setCulturalContext] = useState<string>(user.culturalContext || '');
  const [partnerCode, setPartnerCode] = useState<string>('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(user.reminderEnabled);
  const [reminderTime, setReminderTime] = useState<string>(user.reminderTime || '20:30');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await api.updateProfile({
        name,
        pronouns,
        culturalContext,
        reminderEnabled,
        reminderTime,
      });

      onUserUpdate(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Update profile error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePair = async () => {
    setIsPairing(true);
    setPairingError(null);
    try {
      const updated = await api.pairWithPartner(partnerCode);
      onUserUpdate(updated);
      setPartnerCode('');
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : 'Unable to link partner.');
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-stone-100 text-stone-700 rounded-xl">
              <User className="w-5 h-5 text-teal-800" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 font-serif">
                Therapeutic Profile & Preferences
              </h3>
              <p className="text-xs text-stone-500">
                Personalize cultural context, partner attunement, and security.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-teal-700" />
            <span>Profile and cultural context updated successfully.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Identity & Pronouns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-stone-700 uppercase tracking-wider block mb-1">
                Your Preferred Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 uppercase tracking-wider block mb-1">
                Pronouns
              </label>
              <input
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="e.g., they/them, she/her, he/him, ze/hir"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900"
              />
            </div>
          </div>

          {/* Cultural Context & Inclusive Therapy Background */}
          <div>
            <label className="font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Globe className="w-3.5 h-3.5 text-teal-700" />
              <span>Cultural & Lived Experience Context</span>
            </label>
            <p className="text-[11px] text-stone-400 mb-1.5">
              Haven personalizes guidance to honor your family structure, cultural heritage, neurodiversity, or gender journey.
            </p>
            <textarea
              rows={2}
              value={culturalContext}
              onChange={(e) => setCulturalContext(e.target.value)}
              placeholder="e.g., First-generation family dynamics, high sensitivity to criticism, balancing communal obligations with personal autonomy..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 resize-none"
            />
          </div>

          {/* Couples Pairing Section */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                <Heart className="w-4 h-4 text-teal-700" />
                <span>{user.partnerConnected ? `Linked with ${user.partnerName}` : 'Couples Link'}</span>
              </div>
              <span className="text-[11px] text-stone-500">{user.partnerConnected ? 'Connected' : 'Not connected'}</span>
            </div>
            <div className="space-y-1">
              <label className="text-stone-600 block">Your invite code</label>
              <input
                type="text"
                readOnly
                value={user.coupleCode || 'Unavailable'}
                className="w-full px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-lg text-xs font-mono text-stone-700"
              />
            </div>
            {!user.partnerConnected && (
              <div>
                <label className="text-stone-600 block mb-1">Partner's invite code</label>
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value)}
                  placeholder="HAVEN-XXXXXX"
                  className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono text-stone-900"
                />
                {pairingError && <p className="mt-1 text-[11px] text-rose-700">{pairingError}</p>}
                <button
                  type="button"
                  onClick={handlePair}
                  disabled={isPairing || !partnerCode.trim()}
                  className="mt-2 px-3 py-1.5 bg-teal-800 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  {isPairing ? 'Linking...' : 'Link partner'}
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-teal-800 text-white rounded-lg font-medium hover:bg-teal-900 shadow-xs"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
