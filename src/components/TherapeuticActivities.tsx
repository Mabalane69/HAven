import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Play,
  RotateCcw,
  Users,
  Compass,
  Wind,
  Heart,
  Brain,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import type { TherapeuticActivity, UserProfile } from '../types';
import { api } from '../services/api';

interface TherapeuticActivitiesProps {
  user: UserProfile;
}

export const TherapeuticActivities: React.FC<TherapeuticActivitiesProps> = ({ user }) => {
  const [activities, setActivities] = useState<TherapeuticActivity[]>([]);
  const [activeActivity, setActiveActivity] = useState<TherapeuticActivity | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState<boolean>(false);

  // 4-7-8 Breathing interactive states
  const [breathingPhase, setBreathingPhase] = useState<'INHALE' | 'HOLD' | 'EXHALE' | 'READY'>('READY');
  const [breathTimer, setBreathTimer] = useState<number>(4);
  const [breathCyclesLeft, setBreathCyclesLeft] = useState<number>(4);
  const [isBreathingActive, setIsBreathingActive] = useState<boolean>(false);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const data = await api.getActivities();
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
  };

  // Breathing loop logic
  useEffect(() => {
    let interval: any = null;
    if (isBreathingActive) {
      interval = setInterval(() => {
        setBreathTimer((prev) => {
          if (prev > 1) {
            return prev - 1;
          } else {
            // Transition phase
            if (breathingPhase === 'INHALE') {
              setBreathingPhase('HOLD');
              return 7;
            } else if (breathingPhase === 'HOLD') {
              setBreathingPhase('EXHALE');
              return 8;
            } else if (breathingPhase === 'EXHALE') {
              if (breathCyclesLeft > 1) {
                setBreathCyclesLeft((c) => c - 1);
                setBreathingPhase('INHALE');
                return 4;
              } else {
                setIsBreathingActive(false);
                setBreathingPhase('READY');
                return 4;
              }
            } else {
              setBreathingPhase('INHALE');
              return 4;
            }
          }
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBreathingActive, breathingPhase, breathCyclesLeft]);

  const startBreathing = () => {
    setIsBreathingActive(true);
    setBreathingPhase('INHALE');
    setBreathTimer(4);
    setBreathCyclesLeft(4);
  };

  const stopBreathing = () => {
    setIsBreathingActive(false);
    setBreathingPhase('READY');
    setBreathTimer(4);
  };

  const openActivity = (activity: TherapeuticActivity) => {
    setActiveActivity(activity);
    setActiveStepIndex(0);
    setUserAnswers({});
    setIsCompletedModalOpen(false);
    stopBreathing();
  };

  const handleNextStep = async () => {
    if (!activeActivity) return;

    if (activeStepIndex < activeActivity.steps.length - 1) {
      setActiveStepIndex(activeStepIndex + 1);
    } else {
      // Mark as completed
      try {
        const updated = await api.completeActivity(activeActivity.id);
        setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setIsCompletedModalOpen(true);
      } catch (err) {
        console.error('Activity complete error:', err);
      }
    }
  };

  const handlePrevStep = () => {
    if (activeStepIndex > 0) {
      setActiveStepIndex(activeStepIndex - 1);
    }
  };

  const currentStep = activeActivity?.steps[activeStepIndex];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h2 className="text-xl font-bold text-stone-900 font-serif">
          Curated Therapeutic Exercises & Skill Building
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Evidence-based cognitive restructuring, Emotionally Focused couples exercises, and autonomic nervous system regulation.
        </p>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {activities.map((act) => {
          const isCouples = act.forCouplesOnly;

          return (
            <div
              key={act.id}
              className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    {act.categoryLabel}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-stone-400">
                    <span>{act.durationMinutes} min</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-stone-900 font-serif leading-snug">
                    {act.title}
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                    {act.description}
                  </p>
                </div>

                {isCouples && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 p-2 rounded-lg">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Designed for you & partner</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-between mt-4">
                <span className="text-[11px] text-stone-400 font-mono">
                  Completed {act.completedCount || 0}x
                </span>

                <button
                  onClick={() => openActivity(act)}
                  className="px-3.5 py-1.5 bg-teal-800 text-white rounded-lg text-xs font-medium hover:bg-teal-900 transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>Begin</span>
                  <Play className="w-3 h-3 fill-current" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Step-by-Step Exercise Modal */}
      {activeActivity && currentStep && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-stone-50 border-b border-stone-200 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-800">
                  {activeActivity.categoryLabel} · Step {activeStepIndex + 1} of {activeActivity.steps.length}
                </span>
                <h3 className="text-lg font-bold text-stone-900 font-serif mt-0.5">
                  {activeActivity.title}
                </h3>
              </div>

              <button
                onClick={() => setActiveActivity(null)}
                className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Step Title & Instruction */}
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-stone-900">
                  {currentStep.title}
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {currentStep.instruction}
                </p>
              </div>

              {/* Special View: 4-7-8 Breathing Circle */}
              {currentStep.exerciseType === 'breathing' ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-6">
                  {/* Visual pulsating breathing circle */}
                  <div
                    className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-1000 border-4 ${
                      breathingPhase === 'INHALE'
                        ? 'scale-110 bg-teal-50 border-teal-600 shadow-xl'
                        : breathingPhase === 'HOLD'
                        ? 'scale-110 bg-amber-50 border-amber-500 shadow-md'
                        : breathingPhase === 'EXHALE'
                        ? 'scale-90 bg-stone-100 border-stone-400'
                        : 'scale-100 bg-stone-50 border-stone-300'
                    }`}
                  >
                    <span className="text-xs uppercase tracking-widest font-semibold text-stone-500">
                      {breathingPhase === 'READY' ? 'Get Ready' : breathingPhase}
                    </span>
                    <span className="text-4xl font-bold font-serif tabular-nums text-stone-900 mt-1">
                      {breathTimer}s
                    </span>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-xs text-stone-500">
                      {breathingPhase === 'INHALE' && 'Inhale deeply and gently through the nose...'}
                      {breathingPhase === 'HOLD' && 'Hold gently. Allow oxygen to saturate your cells...'}
                      {breathingPhase === 'EXHALE' && 'Exhale completely through mouth with a soft whoosh...'}
                      {breathingPhase === 'READY' && 'Press start to begin the 4-cycle vagus reset.'}
                    </p>

                    <div className="pt-2">
                      {isBreathingActive ? (
                        <button
                          onClick={stopBreathing}
                          className="px-4 py-2 bg-stone-200 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-300"
                        >
                          Pause Breathing
                        </button>
                      ) : (
                        <button
                          onClick={startBreathing}
                          className="px-5 py-2.5 bg-teal-800 text-white rounded-lg text-xs font-semibold hover:bg-teal-900 shadow-xs"
                        >
                          Start 4-7-8 Breathing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Text reflection or response input */
                <div className="space-y-2">
                  {currentStep.prompt && (
                    <label className="text-xs font-medium text-stone-700">
                      {currentStep.prompt}
                    </label>
                  )}
                  <textarea
                    rows={4}
                    value={userAnswers[activeStepIndex] || ''}
                    onChange={(e) =>
                      setUserAnswers({ ...userAnswers, [activeStepIndex]: e.target.value })
                    }
                    placeholder="Reflect and type your response here..."
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 resize-y"
                  />
                </div>
              )}
            </div>

            {/* Modal Navigation Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              <button
                onClick={handlePrevStep}
                disabled={activeStepIndex === 0}
                className="px-4 py-2 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                onClick={handleNextStep}
                className="px-5 py-2 text-xs font-semibold text-white bg-teal-800 rounded-lg hover:bg-teal-900 flex items-center gap-1.5 shadow-xs"
              >
                <span>{activeStepIndex === activeActivity.steps.length - 1 ? 'Complete Exercise' : 'Next Step'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Celebration Modal */}
      {isCompletedModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 p-8 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 bg-teal-50 text-teal-800 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-stone-900 font-serif">Exercise Completed</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                You took intentional time to regulate your nervous system and expand your emotional toolkit. This consistency strengthens your inner foundation.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setIsCompletedModalOpen(false);
                  setActiveActivity(null);
                }}
                className="w-full py-2.5 bg-teal-800 text-white rounded-xl text-xs font-semibold hover:bg-teal-900 transition-colors"
              >
                Return to Exercises
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
