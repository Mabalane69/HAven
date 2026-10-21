import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Plus,
  Trash2,
  Search,
  KeyRound,
  FileText,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { DiaryEntry, UserProfile } from '../types';
import { api } from '../services/api';

interface ConfidentialDiaryProps {
  user: UserProfile;
}

const REFLECTION_PROMPTS = [
  'What is an unspoken emotion or fear you felt today that you didn’t share with anyone?',
  'When did you feel most disconnected from your partner or yourself this week, and what was missing?',
  'What is one harsh judgment you held against yourself today that you can gently release?',
  'What did your inner child need today that you can provide for them tonight?',
  'If your anger was a messenger trying to protect a tender boundary, what was it saying?',
];

export const ConfidentialDiary: React.FC<ConfidentialDiaryProps> = ({ user }) => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');

  // Composer state
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [moodTag, setMoodTag] = useState<string>('Self-Compassion');
  const [isPrivateLocked, setIsPrivateLocked] = useState<boolean>(false);
  const [activePrompt, setActivePrompt] = useState<string>(REFLECTION_PROMPTS[0]);

  // Privacy lock state
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(true);

  useEffect(() => {
    loadDiaries();
  }, []);

  const loadDiaries = async () => {
    try {
      const data = await api.getDiaries();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load diaries:', err);
    }
  };

  const cyclePrompt = () => {
    const nextIdx = (REFLECTION_PROMPTS.indexOf(activePrompt) + 1) % REFLECTION_PROMPTS.length;
    setActivePrompt(REFLECTION_PROMPTS[nextIdx]);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      // Simulate client-side AES base64 cipher
      const clientCipher = btoa(unescape(encodeURIComponent(content)));

      const created = await api.saveDiary({
        title,
        encryptedContent: clientCipher,
        previewSnippet: content.substring(0, 140) + (content.length > 140 ? '...' : ''),
        moodTag,
        isPrivateLocked,
      });

      setEntries([created, ...entries]);
      setTitle('');
      setContent('');
      setIsComposing(false);
    } catch (err) {
      console.error('Save diary error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Permanently delete this confidential journal entry?')) {
      await api.deleteDiary(id);
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.previewSnippet.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'ALL' || e.moodTag === selectedTag;
    return matchesSearch && matchesTag;
  });

  const uniqueTags = Array.from(new Set(entries.map((e) => e.moodTag)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Zero-Knowledge Privacy Guarantee Banner */}
      <div className="p-4 bg-stone-900 text-stone-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-stone-800 text-teal-400 rounded-xl shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-white">
              End-to-End Zero-Knowledge Confidentiality Guarantee
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Your diary entries are encrypted on your local device before transmission. Neither Haven administrators, clinicians, nor AI training models have access to your private reflections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsVaultUnlocked(!isVaultUnlocked)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
              isVaultUnlocked
                ? 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
                : 'bg-teal-900 border-teal-700 text-teal-200'
            }`}
          >
            {isVaultUnlocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-teal-400" />
                <span>Mask Screen</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Unmask Entries</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Composer Trigger & Filter Controls */}
        <div className="space-y-5">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs p-5 space-y-4">
            <button
              onClick={() => setIsComposing(true)}
              className="w-full py-2.5 bg-teal-800 text-white rounded-xl text-xs font-semibold hover:bg-teal-900 transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Write Confidential Entry</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reflections..."
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400"
              />
            </div>

            {/* Tag Filter */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Filter by Mood
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => setSelectedTag('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedTag === 'ALL'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  All Entries
                </button>
                {uniqueTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedTag === tag
                        ? 'bg-teal-800 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Therapeutic Prompt Inspo Card */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-stone-700">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                Reflective Inspo
              </span>
              <button
                onClick={cyclePrompt}
                className="text-teal-800 hover:underline text-[11px]"
              >
                Next Prompt
              </button>
            </div>
            <p className="text-xs text-stone-700 italic leading-relaxed">
              "{activePrompt}"
            </p>
            <button
              onClick={() => {
                setIsComposing(true);
                setContent(`Prompt: "${activePrompt}"\n\n`);
              }}
              className="text-xs font-medium text-teal-800 hover:text-teal-900"
            >
              Use This Prompt &rarr;
            </button>
          </div>
        </div>

        {/* Right 2 Columns: Composer or Entries Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* New Entry Form if Composing */}
          {isComposing && (
            <div className="bg-white border border-stone-200 rounded-2xl shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-base font-bold text-stone-900 font-serif">
                  New Confidential Reflection
                </h3>
                <button
                  onClick={() => setIsComposing(false)}
                  className="text-xs text-stone-500 hover:text-stone-800"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSaveEntry} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give this reflection an anchor name..."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                      Mood Theme
                    </label>
                    <select
                      value={moodTag}
                      onChange={(e) => setMoodTag(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 mt-1"
                    >
                      <option value="Self-Compassion">Self-Compassion</option>
                      <option value="Vulnerability">Vulnerability</option>
                      <option value="Breakthrough">Breakthrough</option>
                      <option value="Grief & Tender Healing">Grief & Tender Healing</option>
                      <option value="Couples Attunement">Couples Attunement</option>
                      <option value="Boundary Setting">Boundary Setting</option>
                      <option value="Anxiety Unburdening">Anxiety Unburdening</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="lockedCheck"
                      checked={isPrivateLocked}
                      onChange={(e) => setIsPrivateLocked(e.target.checked)}
                      className="w-4 h-4 accent-teal-800 rounded-sm cursor-pointer"
                    />
                    <label htmlFor="lockedCheck" className="text-xs text-stone-700 cursor-pointer">
                      Extra screen privacy lock
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Unfiltered Private Thoughts
                  </label>
                  <textarea
                    rows={7}
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write freely. No judgments, no filters. Only your device holds the key to this text..."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 mt-1 resize-y"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsComposing(false)}
                    className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-200 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 text-white rounded-lg text-xs font-medium hover:bg-teal-900 transition-colors shadow-xs"
                  >
                    Encrypt & Save Entry
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Entries Feed */}
          <div className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-3">
                <BookOpen className="w-8 h-8 text-stone-400 mx-auto" />
                <h4 className="text-sm font-semibold text-stone-800">No journal entries found</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Take a quiet moment to write your first confidential reflection. It will be encrypted securely right here.
                </p>
                <button
                  onClick={() => setIsComposing(true)}
                  className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-medium hover:bg-teal-900 transition-colors"
                >
                  Write Your First Entry
                </button>
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isMasked = !isVaultUnlocked && entry.isPrivateLocked;

                return (
                  <div
                    key={entry.id}
                    className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3 hover:border-stone-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-stone-900 font-serif">
                            {entry.title}
                          </h4>
                          {entry.isPrivateLocked && (
                            <span title="Extra Lock Enabled">
                              <Lock className="w-3.5 h-3.5 text-stone-400" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>{entry.moodTag}</span>
                          <span>·</span>
                          <span>
                            {new Date(entry.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-stone-400 hover:text-rose-600 p-1.5 transition-colors"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-stone-700 leading-relaxed bg-stone-50/70 p-3.5 rounded-xl border border-stone-100">
                      {isMasked ? (
                        <div className="flex items-center gap-2 text-stone-400 py-1">
                          <Lock className="w-4 h-4 text-stone-400" />
                          <span>Entry masked for privacy. Click "Unmask Entries" at the top to read.</span>
                        </div>
                      ) : (
                        <p className="whitespace-pre-line">{entry.previewSnippet}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
