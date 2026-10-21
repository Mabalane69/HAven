import type {
  UserProfile,
  ChatMessage,
  TherapySession,
  CheckInRecord,
  DiaryEntry,
  TherapeuticActivity,
  SharedStory,
  CommunityCircle,
  ModerationReport,
  AdminAnalytics,
} from '../types';

export const api = {
  // Authentication
  async signup(params: {
    name: string;
    email: string;
    password: string;
    pronouns?: string;
    culturalContext?: string;
    coupleCode?: string;
    partnerName?: string;
    role?: 'USER' | 'ADMIN';
  }): Promise<UserProfile> {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    return data.user;
  },

  async login(params: { email: string; password: string }): Promise<UserProfile> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data.user;
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  async getMe(): Promise<UserProfile | null> {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  // Profile
  async getProfile(): Promise<UserProfile> {
    const res = await fetch('/api/profile');
    const data = await res.json();
    return data.profile;
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return data.profile;
  },

  async switchRole(): Promise<UserProfile> {
    const res = await fetch('/api/profile/switch-role', { method: 'POST' });
    const data = await res.json();
    return data.profile;
  },

  // Therapy
  async getSessions(): Promise<TherapySession[]> {
    const res = await fetch('/api/therapy/sessions');
    const data = await res.json();
    return data.sessions;
  },

  async sendMessage(params: {
    sessionId?: string;
    mode: 'INDIVIDUAL' | 'COUPLE';
    message: string;
    sender?: 'USER' | 'PARTNER';
  }): Promise<{ reply: ChatMessage; session?: TherapySession; flagged?: boolean; isCrisis?: boolean; isAbuse?: boolean }> {
    const res = await fetch('/api/therapy/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  // Check-ins
  async getCheckIns(): Promise<CheckInRecord[]> {
    const res = await fetch('/api/check-ins');
    const data = await res.json();
    return data.checkIns;
  },

  async submitCheckIn(checkIn: Partial<CheckInRecord>): Promise<CheckInRecord> {
    const res = await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkIn),
    });
    const data = await res.json();
    return data.checkIn;
  },

  // Diary
  async getDiaries(): Promise<DiaryEntry[]> {
    const res = await fetch('/api/diary');
    const data = await res.json();
    return data.entries;
  },

  async saveDiary(entry: {
    title: string;
    encryptedContent: string;
    previewSnippet: string;
    moodTag: string;
    isPrivateLocked: boolean;
  }): Promise<DiaryEntry> {
    const res = await fetch('/api/diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    return data.entry;
  },

  async deleteDiary(id: string): Promise<boolean> {
    const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },

  // Activities
  async getActivities(): Promise<TherapeuticActivity[]> {
    const res = await fetch('/api/activities');
    const data = await res.json();
    return data.activities;
  },

  async completeActivity(id: string): Promise<TherapeuticActivity> {
    const res = await fetch(`/api/activities/${id}/complete`, { method: 'POST' });
    const data = await res.json();
    return data.activity;
  },

  // AI Check-Ins
  async getAiCheckInSuggestion(): Promise<{
    id: string;
    title: string;
    rationale: string;
    suggestedScore: number;
    promptQuestion: string;
    recommendedFeelings: string[];
    suggestedTime: string;
  }> {
    const res = await fetch('/api/check-ins/ai-suggest', { method: 'POST' });
    const data = await res.json();
    return data.suggestion;
  },

  // Stories
  async getStories(): Promise<SharedStory[]> {
    const res = await fetch('/api/stories');
    const data = await res.json();
    return data.stories;
  },

  async submitStory(story: Partial<SharedStory>): Promise<SharedStory> {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(story),
    });
    const data = await res.json();
    return data.story;
  },

  async toggleStorySupport(id: string): Promise<SharedStory> {
    const res = await fetch(`/api/stories/${id}/support`, { method: 'POST' });
    const data = await res.json();
    return data.story;
  },

  async joinStory(id: string): Promise<SharedStory> {
    const res = await fetch(`/api/stories/${id}/join`, { method: 'POST' });
    const data = await res.json();
    return data.story;
  },

  async addStoryComment(
    storyId: string,
    comment: { content: string; isAnonymous?: boolean }
  ): Promise<{ comment: any; story: SharedStory }> {
    const res = await fetch(`/api/stories/${storyId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    return res.json();
  },

  // Communities
  async getCommunities(): Promise<CommunityCircle[]> {
    const res = await fetch('/api/communities');
    const data = await res.json();
    return data.circles;
  },

  async joinCommunity(circleId: string): Promise<CommunityCircle> {
    const res = await fetch(`/api/communities/${circleId}/join`, { method: 'POST' });
    const data = await res.json();
    return data.circle;
  },

  async adminCreateCircle(params: {
    name: string;
    category: string;
    description: string;
    initialDiscussionPrompt?: string;
  }): Promise<CommunityCircle> {
    const res = await fetch('/api/communities/admin-create-circle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create community topic');
    return data.circle;
  },

  async suggestCommunity(params: {
    name: string;
    category: string;
    description: string;
    proposedFirstDiscussion?: string;
  }): Promise<any> {
    const res = await fetch('/api/communities/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit suggestion');
    return data.suggestion;
  },

  async getCommunitySuggestions(): Promise<any[]> {
    const res = await fetch('/api/admin/community-suggestions');
    const data = await res.json();
    return data.suggestions || [];
  },

  async reviewCommunitySuggestion(
    id: string,
    action: 'APPROVE' | 'DECLINE',
    adminFeedback?: string
  ): Promise<{ suggestion: any; circle?: CommunityCircle }> {
    const res = await fetch(`/api/admin/community-suggestions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminFeedback }),
    });
    return res.json();
  },

  async createPost(circleId: string, post: { title: string; content: string; isAnonymous: boolean; tags: string[] }) {
    const res = await fetch(`/api/communities/${circleId}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    });
    return res.json();
  },

  async addComment(postId: string, comment: { content: string; isAnonymous: boolean }) {
    const res = await fetch(`/api/communities/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    return res.json();
  },

  async togglePostSupport(postId: string) {
    const res = await fetch(`/api/communities/posts/${postId}/support`, { method: 'POST' });
    return res.json();
  },

  // Notifications
  async getNotifications(): Promise<any[]> {
    const res = await fetch('/api/notifications');
    const data = await res.json();
    return data.notifications || [];
  },

  async markNotificationRead(id: string): Promise<void> {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  },

  async clearNotifications(): Promise<void> {
    await fetch('/api/notifications/clear', { method: 'POST' });
  },

  // Admin
  async getAdminReports(): Promise<ModerationReport[]> {
    const res = await fetch('/api/admin/reports');
    const data = await res.json();
    return data.reports;
  },

  async takeAdminAction(reportId: string, action: 'WARN' | 'SUSPEND' | 'BAN' | 'RESOLVE' | 'REINSTATE', reason?: string) {
    const res = await fetch(`/api/admin/reports/${reportId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    return res.json();
  },

  async getAdminAnalytics(): Promise<AdminAnalytics> {
    const res = await fetch('/api/admin/analytics');
    const data = await res.json();
    return data.analytics;
  },

  async simulateAdminAlert(type: 'CRISIS' | 'ABUSE'): Promise<ModerationReport> {
    const res = await fetch('/api/admin/simulate-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    return data.report;
  },
};
