import React, { useState } from 'react';
import {
  LogOut,
  User as UserIcon,
  ShieldAlert,
  Bell,
  CheckCircle2,
  Trash2,
  Sparkles,
  MessageCircle,
  Users,
} from 'lucide-react';
import type { Role, AccountStatus, UserProfile, InAppNotification } from '../types';

interface TopNavProps {
  activeTab: 'therapy' | 'checkin' | 'diary' | 'activities' | 'community' | 'admin';
  setActiveTab: (tab: 'therapy' | 'checkin' | 'diary' | 'activities' | 'community' | 'admin') => void;
  openCrisisModal: () => void;
  openProfileModal: () => void;
  openAuthModal: (mode: 'login' | 'signup') => void;
  onLogout: () => void;
  currentUser: UserProfile | null;
  unreadReportsCount?: number;
  notifications?: InAppNotification[];
  onMarkNotificationRead?: (id: string) => void;
  onClearNotifications?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  openCrisisModal,
  openProfileModal,
  openAuthModal,
  onLogout,
  currentUser,
  unreadReportsCount = 0,
  notifications = [],
  onMarkNotificationRead,
  onClearNotifications,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const isAdmin = currentUser?.role === 'ADMIN';
  const unreadNotifs = notifications.filter((n) => !n.read);

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EAE3D9]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-4 sm:px-6 h-16">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('therapy')}
            className="text-2xl font-bold tracking-tight text-[#2A2421] font-serif whitespace-nowrap shrink-0 text-left hover:text-[#C86D51] transition-colors"
          >
            Haven
          </button>
        </div>

        {/* Zone 2: Navigation Links — Desktop (>= 1024px / lg). Phones & tablets use bottom navigation */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#6B5E57]">
          <button
            onClick={() => setActiveTab('therapy')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeTab === 'therapy'
                ? 'text-[#2A2421] border-[#C86D51] font-semibold'
                : 'border-transparent hover:text-[#2A2421] hover:border-[#D5CDC3]'
            }`}
          >
            Therapy Sanctuary
          </button>

          <button
            onClick={() => setActiveTab('checkin')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeTab === 'checkin'
                ? 'text-[#2A2421] border-[#C86D51] font-semibold'
                : 'border-transparent hover:text-[#2A2421] hover:border-[#D5CDC3]'
            }`}
          >
            Daily Check-In
          </button>

          <button
            onClick={() => setActiveTab('diary')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeTab === 'diary'
                ? 'text-[#2A2421] border-[#C86D51] font-semibold'
                : 'border-transparent hover:text-[#2A2421] hover:border-[#D5CDC3]'
            }`}
          >
            Confidential Diary
          </button>

          <button
            onClick={() => setActiveTab('activities')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeTab === 'activities'
                ? 'text-[#2A2421] border-[#C86D51] font-semibold'
                : 'border-transparent hover:text-[#2A2421] hover:border-[#D5CDC3]'
            }`}
          >
            Exercises
          </button>

          <button
            onClick={() => setActiveTab('community')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeTab === 'community'
                ? 'text-[#2A2421] border-[#C86D51] font-semibold'
                : 'border-transparent hover:text-[#2A2421] hover:border-[#D5CDC3]'
            }`}
          >
            Stories & Circles
          </button>

          {/* ADMIN SAFETY: STRICTLY ONLY VISIBLE TO ADMINISTRATORS */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                activeTab === 'admin'
                  ? 'text-rose-950 border-rose-700 font-semibold'
                  : 'border-transparent hover:text-rose-900 hover:border-rose-300'
              }`}
            >
              Admin Safety
              {unreadReportsCount > 0 && (
                <span className="ml-1.5 font-mono text-xs tabular-nums text-rose-600 font-bold">
                  ({unreadReportsCount})
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Zone 3: Actions (Notifications, Profile, Login/Logout, Crisis Button) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Notification Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              title="Notifications"
              className="p-2 text-[#6B5E57] hover:text-[#2A2421] hover:bg-[#F2ECE1] rounded-xl transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#C86D51] rounded-full border-2 border-[#FAF7F2]" />
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#EAE3D9] rounded-2xl shadow-xl p-4 z-50 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-[#EAE3D9] pb-2">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-[#C86D51]" />
                    <span className="text-xs font-bold text-[#2A2421] font-serif">
                      Sanctuary Notifications
                    </span>
                    {unreadNotifs.length > 0 && (
                      <span className="font-mono text-[10px] bg-[#C86D51]/10 text-[#C86D51] px-1.5 py-0.2 rounded-full font-bold">
                        {unreadNotifs.length} new
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && onClearNotifications && (
                    <button
                      onClick={onClearNotifications}
                      className="text-[10px] text-[#8C7E74] hover:text-[#2A2421] flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#8C7E74] text-center py-6 italic">
                      No notifications right now.
                    </p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (notif.linkTab) setActiveTab(notif.linkTab);
                          if (onMarkNotificationRead && !notif.read) onMarkNotificationRead(notif.id);
                          setIsNotifOpen(false);
                        }}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors space-y-1 ${
                          notif.read
                            ? 'bg-[#FAF7F2] border-[#EAE3D9] text-[#6B5E57]'
                            : 'bg-white border-[#C86D51]/40 text-[#2A2421] shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs font-serif text-[#2A2421]">
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-[#8C7E74]">
                            {new Date(notif.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {currentUser ? (
            <>
              {/* Profile Avatar / Trigger */}
              <button
                onClick={openProfileModal}
                title="Account Settings"
                className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl text-xs font-medium text-[#4A3E39] hover:bg-[#F2ECE1] transition-colors border border-transparent hover:border-[#EAE3D9]"
              >
                <div className="w-6 h-6 rounded-full bg-[#E8DFD5] text-[#4A3E39] flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {currentUser.name.split(' ')[0]}
                </span>
              </button>

              {/* Log out trigger */}
              <button
                onClick={onLogout}
                title="Sign out of Haven"
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-[#F2ECE1] rounded-xl transition-colors"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openAuthModal('login')}
                className="px-3 py-1.5 text-xs font-semibold text-[#4A3E39] hover:text-[#2A2421] rounded-lg transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C86D51] rounded-lg hover:bg-[#B75C42] transition-colors shadow-xs"
              >
                Sign Up
              </button>
            </div>
          )}

          {/* 988 Crisis Button */}
          <button
            onClick={openCrisisModal}
            className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200/80 rounded-xl hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0"
          >
            Crisis (988)
          </button>
        </div>
      </div>

      {/* Account Warning / Suspension notice if any */}
      {currentUser && currentUser.status !== 'ACTIVE' && (
        <div
          className={`py-1.5 px-4 text-xs text-center border-t ${
            currentUser.status === 'BANNED' || currentUser.status === 'SUSPENDED'
              ? 'bg-rose-100 border-rose-300 text-rose-900 font-semibold'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {currentUser.status === 'BANNED' && 'Account Banned: Access restricted due to platform policy violations.'}
          {currentUser.status === 'SUSPENDED' && 'Account Frozen: Your access is currently under administrative moderation review.'}
          {currentUser.status === 'WARNED' && 'Account Notice: Please review our respectful communication guidelines to preserve access.'}
        </div>
      )}
    </header>
  );
};
