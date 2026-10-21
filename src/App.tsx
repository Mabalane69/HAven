import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Calendar,
  BookOpen,
  Sparkles,
  Users,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { TopNav } from './components/TopNav';
import { SanctuaryBanner } from './components/SanctuaryBanner';
import { TherapyRoom } from './components/TherapyRoom';
import { CheckInsAndAnalytics } from './components/CheckInsAndAnalytics';
import { ConfidentialDiary } from './components/ConfidentialDiary';
import { TherapeuticActivities } from './components/TherapeuticActivities';
import { StoriesAndCommunities } from './components/StoriesAndCommunities';
import { AdminPortal } from './components/AdminPortal';
import { CrisisModal } from './components/CrisisModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AuthModal } from './components/AuthModal';
import type { UserProfile } from './types';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'therapy' | 'checkin' | 'diary' | 'activities' | 'community' | 'admin'
  >('therapy');

  const [user, setUser] = useState<UserProfile | null>(null);

  const [unreadReportsCount, setUnreadReportsCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isCrisisModalOpen, setIsCrisisModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const currentUser = await api.getMe();
      if (currentUser) {
        setUser(currentUser);
        if (currentUser.role === 'ADMIN') {
          try {
            const reportsData = await api.getAdminReports();
            const pending = reportsData.filter((r) => !r.resolved).length;
            setUnreadReportsCount(pending);
          } catch {
            // Non-admin or fetch skipped
          }
        }
      }

      if (currentUser) {
        const notifs = await api.getNotifications();
        setNotifications(notifs);
      }
    } catch (err) {
      console.warn('Initial session check error:', err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleClearNotifications = async () => {
    await api.clearNotifications();
    setNotifications([]);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    if (activeTab === 'admin') {
      setActiveTab('therapy');
    }
  };

  const handleAuthSuccess = async (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    if (authenticatedUser.role === 'ADMIN') {
      try {
        const reportsData = await api.getAdminReports();
        const pending = reportsData.filter((r) => !r.resolved).length;
        setUnreadReportsCount(pending);
      } catch {
        // Ignored
      }
    } else if (activeTab === 'admin') {
      setActiveTab('therapy');
    }

    const notifs = await api.getNotifications();
    setNotifications(notifs);
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2A2421] font-sans selection:bg-[#EBDDD4] selection:text-[#2A2421]">
      {/* Top Navigation Bar: Clean 3-zone desktop contract */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openCrisisModal={() => setIsCrisisModalOpen(true)}
        openProfileModal={() => setIsProfileModalOpen(true)}
        openAuthModal={(mode) => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        currentUser={user}
        unreadReportsCount={unreadReportsCount}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onClearNotifications={handleClearNotifications}
      />

      {/* Warm Ambient Sanctuary Welcome & Discovery Banner */}
      <SanctuaryBanner
        user={user}
        onNavigate={(tab) => setActiveTab(tab)}
        openAuthModal={() => {
          setAuthModalMode('login');
          setIsAuthModalOpen(true);
        }}
      />

      {/* Main Content Viewport — Extra bottom padding for phones and tablets */}
      <main className="flex-1 pb-24 lg:pb-12">
        {!user ? (
          <section className="max-w-xl mx-auto px-4 py-20 text-center space-y-5">
            <h1 className="text-3xl font-bold font-serif text-[#2A2421]">A space that starts with you</h1>
            <p className="text-sm text-[#6B5E57] leading-relaxed">
              Create an account or sign in to keep your check-ins, reflections, and sessions private and available when you return.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  setAuthModalMode('signup');
                  setIsAuthModalOpen(true);
                }}
                className="px-5 py-2.5 bg-[#C86D51] text-white rounded-xl text-sm font-semibold hover:bg-[#B75C42] transition-colors"
              >
                Create account
              </button>
              <button
                onClick={() => {
                  setAuthModalMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="px-5 py-2.5 bg-white border border-[#E8DFD5] text-[#2A2421] rounded-xl text-sm font-semibold hover:bg-stone-50 transition-colors"
              >
                Sign in
              </button>
            </div>
          </section>
        ) : (
          <>
        {activeTab === 'therapy' && (
          <TherapyRoom
            user={user}
            openCrisisModal={() => setIsCrisisModalOpen(true)}
          />
        )}

        {activeTab === 'checkin' && (
          <CheckInsAndAnalytics
            user={user}
            onUserUpdate={(updated) => setUser(updated)}
          />
        )}

        {activeTab === 'diary' && (
          <ConfidentialDiary user={user} />
        )}

        {activeTab === 'activities' && (
          <TherapeuticActivities user={user} />
        )}

        {activeTab === 'community' && (
          <StoriesAndCommunities user={user} />
        )}

        {/* Admin Safety View — Strictly restricted to Administrators */}
        {activeTab === 'admin' && (
          <>
            {isAdmin ? (
              <AdminPortal currentUser={user} onUserUpdate={(updated) => setUser(updated)} />
            ) : (
              <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
                <div className="w-14 h-14 bg-rose-50 text-rose-700 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-serif text-[#2A2421]">
                    Restricted Clinical Administration Area
                  </h3>
                  <p className="text-xs text-[#6B5E57] max-w-md mx-auto leading-relaxed">
                    Admin Safety, AI incident oversight, and abuse suspension are reserved exclusively for authorized platform administrators and clinical supervisors.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setAuthModalMode('login');
                      setIsAuthModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-[#C86D51] text-white rounded-xl text-xs font-semibold hover:bg-[#B75C42] transition-colors shadow-xs"
                  >
                    Sign In with Administrator Account
                  </button>
                </div>
              </div>
            )}
          </>
        )}
          </>
        )}
      </main>

      {/* CROSS-PLATFORM BOTTOM NAVIGATION: For Phones & Tablets (< 1024px / lg:hidden) */}
      {/* Thumb-zone ergonomics, touch hitboxes >= 48px, haptic active feedback */}
      <nav
        aria-label="Mobile and Tablet Primary Navigation"
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#EAE3D9] grid ${
          isAdmin ? 'grid-cols-6' : 'grid-cols-5'
        } h-16 px-1`}
      >
        <button
          onClick={() => setActiveTab('therapy')}
          className={`flex flex-col items-center justify-center min-h-[48px] touch-press transition-colors ${
            activeTab === 'therapy'
              ? 'text-[#C86D51] font-bold'
              : 'text-[#6B5E57] hover:text-[#2A2421]'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Therapy</span>
        </button>

        <button
          onClick={() => setActiveTab('checkin')}
          className={`flex flex-col items-center justify-center min-h-[48px] touch-press transition-colors ${
            activeTab === 'checkin'
              ? 'text-[#C86D51] font-bold'
              : 'text-[#6B5E57] hover:text-[#2A2421]'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Check-In</span>
        </button>

        <button
          onClick={() => setActiveTab('diary')}
          className={`flex flex-col items-center justify-center min-h-[48px] touch-press transition-colors ${
            activeTab === 'diary'
              ? 'text-[#C86D51] font-bold'
              : 'text-[#6B5E57] hover:text-[#2A2421]'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Diary</span>
        </button>

        <button
          onClick={() => setActiveTab('activities')}
          className={`flex flex-col items-center justify-center min-h-[48px] touch-press transition-colors ${
            activeTab === 'activities'
              ? 'text-[#C86D51] font-bold'
              : 'text-[#6B5E57] hover:text-[#2A2421]'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Exercises</span>
        </button>

        <button
          onClick={() => setActiveTab('community')}
          className={`flex flex-col items-center justify-center min-h-[48px] touch-press transition-colors ${
            activeTab === 'community'
              ? 'text-[#C86D51] font-bold'
              : 'text-[#6B5E57] hover:text-[#2A2421]'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Community</span>
        </button>

        {/* Admin Safety icon on phone/tablet: STRICTLY ONLY FOR ADMINS */}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center min-h-[48px] touch-press transition-colors ${
              activeTab === 'admin'
                ? 'text-rose-800 font-bold'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <div className="relative">
              <ShieldAlert className="w-5 h-5" />
              {unreadReportsCount > 0 && (
                <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-rose-600 text-white font-mono text-[9px] flex items-center justify-center">
                  {unreadReportsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Admin</span>
          </button>
        )}
      </nav>

      {/* Authentication Modal (Sign-In & Sign-Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* Crisis Support Modal */}
      <CrisisModal
        isOpen={isCrisisModalOpen}
        onClose={() => setIsCrisisModalOpen(false)}
      />

      {/* User Profile & Preferences Modal */}
      {user && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onUserUpdate={(updated) => setUser(updated)}
        />
      )}
    </div>
  );
}
