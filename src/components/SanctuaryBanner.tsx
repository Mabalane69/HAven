import React from 'react';
import {
  MessageCircle,
  Calendar,
  Sparkles,
  Users,
  Heart,
  ArrowRight,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface SanctuaryBannerProps {
  user: UserProfile | null;
  onNavigate: (tab: 'therapy' | 'checkin' | 'diary' | 'activities' | 'community') => void;
  openAuthModal: () => void;
}

export const SanctuaryBanner: React.FC<SanctuaryBannerProps> = ({
  user,
  onNavigate,
  openAuthModal,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user ? user.name.split(' ')[0] : 'friend';

  return (
    <div className="bg-gradient-to-b from-[#F5F0E8] to-[#FAF7F2] border-b border-[#EAE3D9] py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Warm Greeting Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C86D51]">
              <Compass className="w-3.5 h-3.5" />
              <span>Sanctuary Space</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#2A2421]">
              {getGreeting()}, {displayName}.
            </h1>
            <p className="text-xs sm:text-sm text-[#6B5E57] max-w-xl leading-relaxed">
              Drop your shoulders and unclench your jaw. You have entered a safe, non-judgmental space where your feelings and relationships are met with deep care.
            </p>
          </div>

          {!user && (
            <div className="p-4 bg-white border border-[#EAE3D9] rounded-2xl shadow-xs space-y-2 shrink-0">
              <div className="text-xs font-semibold text-[#2A2421]">
                Save your confidential journey
              </div>
              <div className="text-[11px] text-stone-500">
                Create an account or sign in to track personal and couples progress.
              </div>
              <button
                onClick={openAuthModal}
                className="w-full py-2 bg-[#C86D51] text-white rounded-xl text-xs font-semibold hover:bg-[#B75C42] active:scale-[0.98] transition-all"
              >
                Sign In / Register
              </button>
            </div>
          )}
        </div>

        {/* 4 Calling Exploration Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Card 1: Therapy */}
          <button
            onClick={() => onNavigate('therapy')}
            className="text-left p-4 bg-white/90 hover:bg-white border border-[#EAE3D9] hover:border-[#C86D51] rounded-2xl shadow-xs transition-all touch-press group flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#3A6B5C] flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#2A2421] group-hover:text-[#C86D51] transition-colors">
                  Conversational Therapy
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                  Speak or type with Harmony. Individual CBT & Emotionally Focused couples dialogue.
                </p>
              </div>
            </div>
            <div className="pt-3 text-[11px] font-semibold text-[#C86D51] flex items-center gap-1 mt-2">
              <span>Open Sanctuary</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Card 2: Check-In */}
          <button
            onClick={() => onNavigate('checkin')}
            className="text-left p-4 bg-white/90 hover:bg-white border border-[#EAE3D9] hover:border-[#C86D51] rounded-2xl shadow-xs transition-all touch-press group flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#2A2421] group-hover:text-[#C86D51] transition-colors">
                  Daily Check-In & Trends
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                  Log your internal climate and view your visual weekly Recharts mood trajectory.
                </p>
              </div>
            </div>
            <div className="pt-3 text-[11px] font-semibold text-[#C86D51] flex items-center gap-1 mt-2">
              <span>Log Feelings</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Card 3: Exercises */}
          <button
            onClick={() => onNavigate('activities')}
            className="text-left p-4 bg-white/90 hover:bg-white border border-[#EAE3D9] hover:border-[#C86D51] rounded-2xl shadow-xs transition-all touch-press group flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#C86D51] flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#2A2421] group-hover:text-[#C86D51] transition-colors">
                  Vagus Breathing & CBT
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                  Guided 4-7-8 somatic pacing, couples softened startups, and sensory grounding.
                </p>
              </div>
            </div>
            <div className="pt-3 text-[11px] font-semibold text-[#C86D51] flex items-center gap-1 mt-2">
              <span>Begin Practice</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Card 4: Community */}
          <button
            onClick={() => onNavigate('community')}
            className="text-left p-4 bg-white/90 hover:bg-white border border-[#EAE3D9] hover:border-[#C86D51] rounded-2xl shadow-xs transition-all touch-press group flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-stone-100 text-[#4A3E39] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#2A2421] group-hover:text-[#C86D51] transition-colors">
                  Stories & Safe Circles
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                  Read anonymous breakthrough stories and find peer solidarity in safe circles.
                </p>
              </div>
            </div>
            <div className="pt-3 text-[11px] font-semibold text-[#C86D51] flex items-center gap-1 mt-2">
              <span>Explore Circles</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
