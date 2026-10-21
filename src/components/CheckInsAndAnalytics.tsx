import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Bell,
  BellRing,
  TrendingUp,
  Moon,
  Zap,
  Heart,
  CheckCircle2,
  Clock,
  Sparkles,
  Smile,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { CheckInRecord, UserProfile } from '../types';
import { api } from '../services/api';

interface CheckInsAndAnalyticsProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

const FEELINGS_LIST = [
  'Grounded',
  'Overwhelmed',
  'Grateful',
  'Anxious',
  'Tender',
  'Exhausted',
  'Hopeful',
  'Disconnected',
  'Peaceful',
  'Irritable',
  'Empowered',
  'Lonely',
];

export const CheckInsAndAnalytics: React.FC<CheckInsAndAnalyticsProps> = ({ user, onUserUpdate }) => {
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [score, setScore] = useState<number>(5);
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [stressLevel, setStressLevel] = useState<number>(3);
  const [sleepHours, setSleepHours] = useState<number | ''>('');
  const [gratitude, setGratitude] = useState<string>('');
  const [reflection, setReflection] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);

  // Notification states
  const [reminderTime, setReminderTime] = useState<string>(user.reminderTime || '20:30');
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(user.reminderEnabled ?? true);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [notificationAlertSent, setNotificationAlertSent] = useState<string | null>(null);

  // Recharts interactive states
  const [chartRange, setChartRange] = useState<'7d' | '14d'>('7d');
  const [overlayMetric, setOverlayMetric] = useState<'none' | 'stress' | 'sleep'>('none');

  // AI Check-In Suggestion states
  const [aiSuggestion, setAiSuggestion] = useState<any | null>(null);
  const [isGeneratingAiSuggestion, setIsGeneratingAiSuggestion] = useState<boolean>(false);

  const handleRequestAiSuggestion = async () => {
    setIsGeneratingAiSuggestion(true);
    try {
      const sug = await api.getAiCheckInSuggestion();
      setAiSuggestion(sug);
    } catch (err) {
      console.error('Failed to get AI check-in suggestion:', err);
    } finally {
      setIsGeneratingAiSuggestion(false);
    }
  };

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.suggestedScore) setScore(aiSuggestion.suggestedScore);
    if (aiSuggestion.recommendedFeelings && aiSuggestion.recommendedFeelings.length) {
      setSelectedFeelings(aiSuggestion.recommendedFeelings);
    }
    if (aiSuggestion.promptQuestion) {
      setReflection(aiSuggestion.promptQuestion);
    }
  };

  const handleApplyAiReminderTime = async () => {
    if (!aiSuggestion?.suggestedTime) return;
    setReminderTime(aiSuggestion.suggestedTime);
    setReminderEnabled(true);
    try {
      const updated = await api.updateProfile({
        reminderTime: aiSuggestion.suggestedTime,
        reminderEnabled: true,
      });
      onUserUpdate(updated);
      setNotificationAlertSent(`AI suggested reminder schedule applied for ${aiSuggestion.suggestedTime}.`);
      setTimeout(() => setNotificationAlertSent(null), 3000);
    } catch (err) {
      console.error('Failed to update reminder settings:', err);
    }
  };

  useEffect(() => {
    loadCheckIns();
  }, []);

  const loadCheckIns = async () => {
    try {
      const data = await api.getCheckIns();
      setCheckIns(data);
    } catch (err) {
      console.error('Failed to load check-ins:', err);
    }
  };

  const getMoodDescriptor = (val: number): { label: string; color: string } => {
    if (val <= 2) return { label: 'Severe Distress / Stormy', color: 'text-rose-600' };
    if (val <= 4) return { label: 'Heavy & Anxious / Overcast', color: 'text-amber-600' };
    if (val <= 6) return { label: 'Neutral & Stretching / Moderate', color: 'text-stone-700' };
    if (val <= 8) return { label: 'Grounded & Peaceful / Clear', color: 'text-teal-700' };
    return { label: 'Deeply Connected & Joyful / Radiant', color: 'text-emerald-700' };
  };

  const toggleFeeling = (feeling: string) => {
    if (selectedFeelings.includes(feeling)) {
      setSelectedFeelings(selectedFeelings.filter((f) => f !== feeling));
    } else {
      setSelectedFeelings([...selectedFeelings, feeling]);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sleepHours === '') return;
    setIsSubmitting(true);
    setSubmissionSuccess(false);

    try {
      const descriptor = getMoodDescriptor(score);
      const newRecord = await api.submitCheckIn({
        score,
        moodLabel: descriptor.label,
        feelings: selectedFeelings,
        stressLevel,
        sleepHours: Number(sleepHours),
        gratitude,
        reflection,
      });

      setCheckIns([newRecord, ...checkIns]);
      setSubmissionSuccess(true);
      setGratitude('');
      setReflection('');

      // Play soft confirmation audio feedback
      playCalmBeep();

      setTimeout(() => setSubmissionSuccess(false), 4000);
    } catch (err) {
      console.error('Check-in error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Play a soft calm chime using Web Audio API
  const playCalmBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, ctx.currentTime); // 528Hz Solfeggio Love/Repair Frequency
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      // AudioContext may be restricted
    }
  };

  // Browser Push Notification Handling
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Browser notifications are not supported in your browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification('Haven Reminder Activated 🌿', {
          body: `You will receive a gentle check-in prompt daily at ${reminderTime}.`,
          icon: '/favicon.ico',
        });
      }
    } catch (err) {
      console.error('Notification permission error:', err);
    }
  };

  const handleSaveReminderSettings = async () => {
    try {
      const updated = await api.updateProfile({
        reminderEnabled,
        reminderTime,
      });
      onUserUpdate(updated);
      setNotificationAlertSent(`Reminder schedule saved for daily ${reminderTime}.`);
      setTimeout(() => setNotificationAlertSent(null), 3000);
    } catch (err) {
      console.error('Failed to update reminder settings:', err);
    }
  };

  const triggerTestReminder = () => {
    playCalmBeep();

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Haven Daily Check-In 🌿', {
        body: `Hi ${user.name}, how is your nervous system feeling right now? Take 30 seconds to reflect.`,
      });
    }

    setNotificationAlertSent('Test check-in notification & chime fired successfully!');
    setTimeout(() => setNotificationAlertSent(null), 4000);
  };

  // Analytics Calculations
  const averageMood =
    checkIns.length > 0
      ? (checkIns.reduce((acc, c) => acc + c.score, 0) / checkIns.length).toFixed(1)
      : '—';

  const averageSleep =
    checkIns.length > 0
      ? (checkIns.reduce((acc, c) => acc + c.sleepHours, 0) / checkIns.length).toFixed(1)
      : '—';

  const averageStress =
    checkIns.length > 0
      ? (checkIns.reduce((acc, c) => acc + c.stressLevel, 0) / checkIns.length).toFixed(1)
      : '—';

  const currentDescriptor = getMoodDescriptor(score);
  const weeklyCheckIns = checkIns.filter((checkIn) => {
    const age = Date.now() - new Date(checkIn.date).getTime();
    return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
  });
  const weeklyCheckInDays = new Set(
    weeklyCheckIns.map((checkIn) => new Date(checkIn.date).toLocaleDateString())
  ).size;
  const weeklyAdherence = Math.round((weeklyCheckInDays / 7) * 100);

  // Chronologically sorted entries for the Recharts visualization
  const chartData = useMemo(() => {
    const sorted = [...checkIns].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const rangeInDays = chartRange === '7d' ? 7 : 14;
    const cutoff = Date.now() - rangeInDays * 24 * 60 * 60 * 1000;
    const subset = sorted.filter((item) => new Date(item.date).getTime() >= cutoff);

    return subset.map((item) => {
      const d = new Date(item.date);
      return {
        id: item.id,
        dateStr: item.date,
        day: d.toLocaleDateString(undefined, { weekday: 'short' }),
        fullDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: item.score,
        moodLabel: item.moodLabel,
        feelings: item.feelings || [],
        sleepHours: item.sleepHours,
        stressLevel: item.stressLevel,
        reflection: item.reflection,
        gratitude: item.gratitude,
      };
    });
  }, [checkIns, chartRange]);

  // Comprehensive weekly metrics derived from the chart dataset
  const chartStats = useMemo(() => {
    if (!chartData.length) return null;
    const scores = chartData.map((d) => d.score);
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const first = scores[0];
    const last = scores[scores.length - 1];
    const diff = last - first;
    const bestDay = chartData.find((d) => d.score === max);
    const lowestDay = chartData.find((d) => d.score === min);

    return {
      average: avg,
      peakScore: max,
      peakDay: bestDay ? `${bestDay.day}` : '',
      lowScore: min,
      lowDay: lowestDay ? `${lowestDay.day}` : '',
      diff,
      trajectoryText:
        diff > 0
          ? `+${diff} pts upward momentum`
          : diff < 0
          ? `${diff} pts down from start`
          : 'Consistent baseline',
      trajectoryPositive: diff >= 0,
    };
  }, [chartData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Top Section: Daily Check-In Form & Reminders Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: The Check-in Form */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl shadow-xs p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-900 font-serif">Daily Emotional Check-In</h2>
              <p className="text-xs text-stone-500 mt-1">
                Name your state without judgment. Logging daily creates self-attunement and resilience.
              </p>
            </div>
            <div className="text-xs font-mono text-stone-400 tabular-nums">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>

          {/* AI Check-In Assistant & Suggester */}
          <div className="bg-gradient-to-br from-[#F5EFE6] to-[#FAF7F2] border border-[#E8DFD5] rounded-xl p-4.5 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#C86D51]/10 text-[#C86D51] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#2A2421] font-serif">
                    AI Check-In Suggester & Scheduler
                  </h4>
                  <p className="text-[11px] text-[#6B5E57] mt-0.5 leading-relaxed">
                    Get a check-in suggestion based on your recent entries, when available.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestAiSuggestion}
                disabled={isGeneratingAiSuggestion}
                className="px-3.5 py-2 bg-[#C86D51] hover:bg-[#B75C42] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-xs disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingAiSuggestion ? 'Harmonizing...' : 'Suggest Today’s Check-In'}</span>
              </button>
            </div>

            {aiSuggestion && (
              <div className="mt-2 pt-3 border-t border-[#E8DFD5] space-y-2.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-[#2A2421]">{aiSuggestion.title}</span>
                  <span className="text-[11px] font-mono text-[#C86D51] bg-[#C86D51]/10 px-2 py-0.5 rounded-full font-semibold">
                    Target Score: {aiSuggestion.suggestedScore}/10
                  </span>
                </div>
                <p className="text-[11px] text-[#6B5E57] italic">
                  "{aiSuggestion.rationale}"
                </p>
                <div className="p-3 bg-white/90 rounded-xl border border-[#E8DFD5] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#C86D51]">
                    Suggested Reflection Prompt
                  </div>
                  <div className="text-xs text-[#2A2421] font-medium font-serif leading-relaxed">
                    "{aiSuggestion.promptQuestion}"
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6B5E57]">
                    <span>Tags:</span>
                    {aiSuggestion.recommendedFeelings?.map((f: string) => (
                      <span key={f} className="px-2 py-0.5 bg-[#FAF7F2] border border-[#E8DFD5] rounded-md text-[10px] font-medium text-[#2A2421]">
                        {f}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {aiSuggestion.suggestedTime && (
                      <button
                        type="button"
                        onClick={handleApplyAiReminderTime}
                        className="px-2.5 py-1.5 bg-white border border-[#E8DFD5] hover:bg-stone-50 rounded-lg text-[11px] font-semibold text-[#2A2421] flex items-center gap-1 shadow-2xs"
                      >
                        <Clock className="w-3 h-3 text-[#C86D51]" />
                        <span>Schedule at {aiSuggestion.suggestedTime}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleApplyAiSuggestion}
                      className="px-3 py-1.5 bg-[#2A2421] text-white hover:bg-stone-800 rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3 h-3 text-teal-400" />
                      <span>Apply to Form</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleCheckInSubmit} className="space-y-6">
            {/* Mood Slider (1 - 10) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Internal Climate (1 to 10)
                </label>
                <span className={`text-xs font-bold ${currentDescriptor.color}`}>
                  Score {score}/10 · {currentDescriptor.label}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full accent-teal-800 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-stone-400 font-mono">
                <span>1 (Crisis / Overwhelmed)</span>
                <span>5 (Stretched)</span>
                <span>10 (Radiant / Safe)</span>
              </div>
            </div>

            {/* Feelings Tags Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                What feelings are active right now?
              </label>
              <div className="flex flex-wrap gap-2">
                {FEELINGS_LIST.map((feeling) => {
                  const isSelected = selectedFeelings.includes(feeling);
                  return (
                    <button
                      type="button"
                      key={feeling}
                      onClick={() => toggleFeeling(feeling)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-teal-800 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {feeling}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sleep & Stress Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Sleep Hours */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-indigo-700" />
                  Sleep Last Night (Hours)
                </label>
                <input
                  type="number"
                  min="0"
                  max="16"
                  step="0.5"
                  required
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900"
                />
              </div>

              {/* Stress Level (1-5) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Somatic Stress Level (1 = Serene, 5 = High)
                </label>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setStressLevel(lvl)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        stressLevel === lvl
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gratitude & Reflection Fields */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">
                  Micro-Gratitude (One moment of comfort or appreciation)
                </label>
                <input
                  type="text"
                  value={gratitude}
                  onChange={(e) => setGratitude(e.target.value)}
                  placeholder="e.g., A warm cup of coffee, a supportive text from someone you care about..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">
                  Mind & Body Reflection (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="What boundary or kindness did you need today?"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-teal-800 text-white rounded-xl font-medium text-sm hover:bg-teal-900 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Recording Check-In...' : 'Record Daily Check-In'}
            </button>
          </form>
        </div>

        {/* Right 1 Column: Notification & Check-in Reminders Schedule */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-teal-800" />
              <h3 className="text-base font-semibold text-stone-900 font-serif">
                Proactive Reminders
              </h3>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Haven sends gentle, quiet prompts at your preferred evening time so you never forget to breathe and decompress.
            </p>

            <div className="space-y-4 pt-2">
              {/* Daily Reminder Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-stone-800">Daily Check-In Alerts</div>
                  <div className="text-[11px] text-stone-400">Receive evening prompt</div>
                </div>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="w-4 h-4 accent-teal-800 rounded-sm cursor-pointer"
                />
              </div>

              {/* Time Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700">Scheduled Time</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono text-stone-900"
                />
              </div>

              {/* Browser Permission status */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Browser Push Status:</span>
                  <span className="font-semibold uppercase text-[11px] text-stone-700 font-mono">
                    {notificationPermission}
                  </span>
                </div>

                {notificationPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="w-full py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-colors"
                  >
                    Enable Browser Notifications
                  </button>
                )}
              </div>

              {/* Save & Test Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveReminderSettings}
                  className="w-full py-2 bg-teal-800 text-white rounded-lg text-xs font-medium hover:bg-teal-900 transition-colors"
                >
                  Save Reminder Schedule
                </button>

                <button
                  type="button"
                  onClick={triggerTestReminder}
                  className="w-full py-2 bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-stone-500" />
                  <span>Send Test Notification Now</span>
                </button>
              </div>

              {notificationAlertSent && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                  {notificationAlertSent}
                </div>
              )}
            </div>
          </div>

          {/* Quick Adherence Stat */}
          <div className="bg-teal-900 text-white rounded-2xl p-6 shadow-xs space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-teal-200 font-semibold">Consistency Score</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif tabular-nums">{weeklyAdherence}%</span>
              <span className="text-xs text-teal-200">Weekly Adherence</span>
            </div>
            <p className="text-xs text-teal-100/90 leading-relaxed">
              {weeklyCheckIns.length
                ? `You recorded ${weeklyCheckIns.length} check-in${weeklyCheckIns.length === 1 ? '' : 's'} in the last 7 days.`
                : 'Your check-in activity from the last 7 days will appear here.'}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard Section */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900 font-serif">Therapeutic Progress & Analytics</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Objective emotional trends tracked over your check-ins and sessions.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span>Avg Mood: <strong className="text-stone-900 font-mono tabular-nums">{checkIns.length ? `${averageMood}/10` : '—'}</strong></span>
            <span>·</span>
            <span>Avg Sleep: <strong className="text-stone-900 font-mono tabular-nums">{checkIns.length ? `${averageSleep}h` : '—'}</strong></span>
            <span>·</span>
            <span>Avg Stress: <strong className="text-stone-900 font-mono tabular-nums">{checkIns.length ? `${averageStress}/5` : '—'}</strong></span>
          </div>
        </div>

        {/* Weekly Mood Trend Visualizer with Recharts */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-teal-800" />
                <span>Weekly Mood Trajectory</span>
              </span>
              <p className="text-[11px] text-stone-500">
                Interactive Recharts curve tracking emotional state over daily check-ins
              </p>
            </div>

            {/* Range & Overlay Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Range Toggle */}
              <div className="flex items-center p-0.5 bg-stone-100 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setChartRange('7d')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    chartRange === '7d'
                      ? 'bg-white text-stone-900 shadow-xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Past 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setChartRange('14d')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    chartRange === '14d'
                      ? 'bg-white text-stone-900 shadow-xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Past 14 Days
                </button>
              </div>

              {/* Stress overlay toggle */}
              <button
                type="button"
                onClick={() => setOverlayMetric(overlayMetric === 'stress' ? 'none' : 'stress')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                  overlayMetric === 'stress'
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Zap className="w-3 h-3 text-amber-600" />
                <span>Stress Overlay</span>
              </button>

              {/* Sleep overlay toggle */}
              <button
                type="button"
                onClick={() => setOverlayMetric(overlayMetric === 'sleep' ? 'none' : 'sleep')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                  overlayMetric === 'sleep'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Moon className="w-3 h-3 text-indigo-600" />
                <span>Sleep Overlay</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {chartStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-stone-50/80 border border-stone-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                  Window Average
                </span>
                <div className="font-serif font-bold text-base text-stone-900 tabular-nums">
                  {chartStats.average} / 10
                </div>
                <div className="text-[10px] text-stone-500">Across {chartData.length} check-ins</div>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                  Peak State
                </span>
                <div className="font-serif font-bold text-base text-teal-800 tabular-nums">
                  Score {chartStats.peakScore}
                </div>
                <div className="text-[10px] text-stone-500">
                  {chartStats.peakDay ? `Observed on ${chartStats.peakDay}` : 'Highest check-in'}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                  Lowest Reading
                </span>
                <div className="font-serif font-bold text-base text-amber-700 tabular-nums">
                  Score {chartStats.lowScore}
                </div>
                <div className="text-[10px] text-stone-500">
                  {chartStats.lowDay ? `Noted on ${chartStats.lowDay}` : 'Lowest dip'}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                  Momentum
                </span>
                <div
                  className={`font-semibold flex items-center gap-1 text-xs mt-1 ${
                    chartStats.trajectoryPositive ? 'text-teal-700' : 'text-amber-700'
                  }`}
                >
                  {chartStats.trajectoryPositive ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  <span>{chartStats.trajectoryText}</span>
                </div>
                <div className="text-[10px] text-stone-400">vs start of window</div>
              </div>
            </div>
          )}

          {/* Recharts Canvas */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
            {chartData.length > 0 ? (
              <div className="space-y-3">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 16, right: 16, left: -20, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />

                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={{ stroke: '#e7e5e4' }}
                        tick={{ fill: '#78716c', fontSize: 11 }}
                        dy={6}
                      />

                      <YAxis
                        domain={[1, 10]}
                        ticks={[2, 4, 6, 8, 10]}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#a8a29e', fontSize: 11, fontFamily: 'monospace' }}
                      />

                      {/* Custom Tooltip */}
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-stone-900 text-stone-100 p-3.5 rounded-xl shadow-xl border border-stone-800 text-xs space-y-1.5 max-w-xs z-50">
                                <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-1.5">
                                  <div className="font-semibold text-white">
                                    {data.day}, {data.fullDate}
                                  </div>
                                  <div className="font-mono text-teal-300 font-bold px-1.5 py-0.5 bg-teal-950 rounded-sm border border-teal-800">
                                    {data.score} / 10
                                  </div>
                                </div>

                                <div className="text-teal-200 font-medium">
                                  {data.moodLabel}
                                </div>

                                {data.feelings && data.feelings.length > 0 && (
                                  <div className="text-[11px] text-stone-300">
                                    Feelings: {data.feelings.join(', ')}
                                  </div>
                                )}

                                <div className="flex items-center gap-3 text-[10px] text-stone-400 font-mono pt-1 border-t border-stone-800">
                                  <span>Sleep: {data.sleepHours}h</span>
                                  <span>·</span>
                                  <span>Stress: {data.stressLevel}/5</span>
                                </div>

                                {data.reflection && (
                                  <div className="text-[11px] text-stone-300 italic line-clamp-2 pt-0.5">
                                    "{data.reflection}"
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />

                      {/* Secondary stress line if toggled */}
                      {overlayMetric === 'stress' && (
                        <Line
                          type="monotone"
                          dataKey="stressLevel"
                          stroke="#d97706"
                          strokeWidth={2}
                          dot={{ r: 3.5, fill: '#d97706', stroke: '#fff', strokeWidth: 1.5 }}
                          name="Stress Level"
                        />
                      )}

                      {/* Secondary sleep line if toggled */}
                      {overlayMetric === 'sleep' && (
                        <Line
                          type="monotone"
                          dataKey="sleepHours"
                          stroke="#4f46e5"
                          strokeWidth={2}
                          dot={{ r: 3.5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 1.5 }}
                          name="Sleep Hours"
                        />
                      )}

                      {/* Primary Mood Score Area */}
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#0f766e"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#moodGradient)"
                        activeDot={{ r: 6, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                        dot={{ r: 4, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 1.5 }}
                        name="Mood Score"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-200">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-700" />
                      <span>Mood Curve (1-10)</span>
                    </span>
                    {overlayMetric === 'stress' && (
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                        <span>Somatic Stress (1-5)</span>
                      </span>
                    )}
                    {overlayMetric === 'sleep' && (
                      <span className="flex items-center gap-1.5 text-indigo-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <span>Sleep Hours</span>
                      </span>
                    )}
                  </div>

                  <span>Hover any data point for detailed reflections & metrics</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-500 text-center py-8">
                No check-in logs yet. Record your first check-in above to generate your trajectory chart.
              </div>
            )}
          </div>
        </div>

        {/* Past Check-In Logs List */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Past Check-In History
          </h3>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {checkIns.map((log) => (
              <div
                key={log.id}
                className="p-3.5 bg-stone-50/70 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900 font-mono tabular-nums">
                      Score: {log.score}/10
                    </span>
                    <span>·</span>
                    <span className="text-stone-600 font-medium">{log.moodLabel}</span>
                    <span>·</span>
                    <span className="text-stone-400">
                      {new Date(log.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {log.feelings && log.feelings.length > 0 && (
                    <div className="text-stone-500 text-[11px]">
                      Feelings: {log.feelings.join(', ')}
                    </div>
                  )}

                  {log.reflection && (
                    <div className="text-stone-600 text-[11px] italic">
                      "{log.reflection}"
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-stone-500 shrink-0 font-mono text-[11px]">
                  <span>Sleep: {log.sleepHours}h</span>
                  <span>Stress: {log.stressLevel}/5</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
