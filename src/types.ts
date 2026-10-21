export type TherapyMode = 'INDIVIDUAL' | 'COUPLE';

export type AccountStatus = 'ACTIVE' | 'WARNED' | 'SUSPENDED' | 'BANNED';

export type Role = 'USER' | 'ADMIN';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  pronouns: string;
  culturalContext: string;
  role: Role;
  status: AccountStatus;
  statusReason?: string;
  partnerName?: string;
  partnerConnected: boolean;
  coupleCode?: string;
  reminderEnabled: boolean;
  reminderTime: string; // e.g. "20:00"
  lastCheckIn?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'USER' | 'PARTNER' | 'AI' | 'SYSTEM';
  content: string;
  timestamp: string;
  audioPlaying?: boolean;
  flagged?: boolean;
  flagReason?: string;
  sentiment?: 'positive' | 'neutral' | 'distress' | 'crisis';
}

export interface TherapySession {
  id: string;
  mode: TherapyMode;
  userId: string;
  title: string;
  startedAt: string;
  summary?: string;
  sentimentScore?: number;
  messages: ChatMessage[];
}

export interface CheckInRecord {
  id: string;
  userId: string;
  date: string;
  score: number; // 1 to 10
  moodLabel: string;
  feelings: string[];
  stressLevel: number; // 1 to 5
  sleepHours: number;
  gratitude: string;
  reflection: string;
}

export interface DiaryEntry {
  id: string;
  userId: string;
  title: string;
  encryptedContent: string; // Base64 encrypted ciphertext
  previewSnippet: string; // Decrypted client-side or masked
  moodTag: string;
  isEncrypted: boolean;
  isPrivateLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityStep {
  title: string;
  instruction: string;
  prompt?: string;
  exerciseType?: 'text' | 'breathing' | 'timer' | 'reflection' | 'multiple_choice';
  timerSeconds?: number;
}

export interface TherapeuticActivity {
  id: string;
  title: string;
  category: 'CBT_RESTRUCTURING' | 'MINDFULNESS' | 'EFT_COUPLES' | 'SOMATIC_GROUNDING' | 'EMOTIONAL_REGULATION';
  categoryLabel: string;
  durationMinutes: number;
  forCouplesOnly?: boolean;
  description: string;
  purpose: string;
  steps: ActivityStep[];
  completedCount?: number;
  lastCompleted?: string;
}

export interface StoryComment {
  id: string;
  storyId: string;
  authorName: string;
  isAnonymous: boolean;
  content: string;
  createdAt: string;
}

export interface SharedStory {
  id: string;
  title: string;
  category: string;
  storyType?: 'FIRST_DATE' | 'SOLO_DATE' | 'COUPLES_OUTING' | 'HEALING_JOURNEY';
  authorAlias: string;
  authorContext: string; // e.g., "First date after 2 years solo · Coffee & bookshop stroll"
  tags: string[];
  challenge: string;
  turningPoint: string;
  keyTakeaway: string;
  locationOrVibe?: string; // e.g. "Sunset picnic & open-ended conversation cards"
  supportCount: number;
  userSupported?: boolean;
  joinedCount: number;
  userJoined?: boolean;
  notificationsEnabled?: boolean;
  comments: StoryComment[];
  createdAt: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorName: string;
  isAnonymous: boolean;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  circleId: string;
  authorName: string;
  isAnonymous: boolean;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  supports: number;
  userSupported?: boolean;
  comments: CommunityComment[];
}

export interface CommunityCircle {
  id: string;
  name: string;
  category: string;
  description: string;
  memberCount: number;
  isJoined?: boolean;
  createdByAdmin?: boolean;
  posts: CommunityPost[];
}

export interface CommunitySuggestion {
  id: string;
  userId: string;
  userName: string;
  name: string;
  category: string;
  description: string;
  proposedFirstDiscussion?: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  adminFeedback?: string;
  createdAt: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'COMMENT' | 'AI_CHECKIN' | 'COMMUNITY' | 'SYSTEM';
  read: boolean;
  createdAt: string;
  linkTab?: 'therapy' | 'checkin' | 'diary' | 'activities' | 'community' | 'admin';
}

export interface AiCheckInSuggestion {
  id: string;
  title: string;
  rationale: string;
  suggestedScore: number;
  promptQuestion: string;
  recommendedFeelings: string[];
  suggestedTime?: string;
}

export interface ModerationReport {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userStatus: AccountStatus;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  contextSnippet: string;
  createdAt: string;
  resolved: boolean;
  actionTaken?: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  activeCouples: number;
  openReports: number;
  averageMoodScore: number;
  checkInCompletionRate: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    distress: number;
    crisis: number;
  };
  topChallenges: { label: string; count: number }[];
}
