import express from 'express';
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type {
  UserProfile, ChatMessage, TherapySession, CheckInRecord, DiaryEntry, TherapeuticActivity,
  SharedStory, StoryComment, CommunityCircle, CommunitySuggestion, InAppNotification,
  AiCheckInSuggestion, ModerationReport, AdminAnalytics, AccountStatus
} from '../../types';

dotenv.config();

export type RequestContext = { user: UserProfile | null };
export const requestContext = new AsyncLocalStorage<RequestContext>();
export const currentUser = new Proxy({} as UserProfile, {
  get(_target, property) {
    const user = requestContext.getStore()?.user;
    return user ? Reflect.get(user, property) : undefined;
  },
  set(_target, property, value) {
    const user = requestContext.getStore()?.user;
    if (!user) throw new Error('Cannot update a profile outside an authenticated request');
    return Reflect.set(user, property, value);
  },
  ownKeys() {
    return Reflect.ownKeys(requestContext.getStore()?.user || {});
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Object.getOwnPropertyDescriptor(requestContext.getStore()?.user || {}, property);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY || '';
export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ==========================================
// Persisted application state
// ==========================================

export const usersDatabase = new Map<string, UserProfile>();
export const userPasswords = new Map<string, string>();
export const authenticatedSessions = new Map<string, string>();
export const activityCompletions = new Map<string, Record<string, { count: number; lastCompleted: string }>>();
export const storyInteractions = new Map<string, Record<string, { supported: boolean; joined: boolean; notificationsEnabled: boolean }>>();
export const circleMemberships = new Map<string, string[]>();
export const communityPostSupporters = new Map<string, string[]>();

export let sessions: TherapySession[] = [];

export let checkIns: CheckInRecord[] = [];

export let diaryEntries: DiaryEntry[] = [];

export let therapeuticActivities: TherapeuticActivity[] = [
  {
    id: 'act_cbt_reframe',
    title: 'Cognitive Thought Record & Reframe',
    category: 'CBT_RESTRUCTURING',
    categoryLabel: 'Cognitive Restructuring',
    durationMinutes: 7,
    description: 'Catch an automatic negative thought, examine the concrete evidence, and construct a balanced perspective.',
    purpose: 'Helps interrupt cognitive spirals like catastrophizing, mind-reading, and emotional reasoning.',
    steps: [
      {
        title: 'Identify the Situation & Trigger',
        instruction: 'What event, interaction, or thought triggered an emotional shift?',
        prompt: 'Describe the concrete triggering event as if observed through a camera lens.',
        exerciseType: 'text',
      },
      {
        title: 'Catch the Automatic Thought',
        instruction: 'What was the exact phrase your mind immediately repeated to you?',
        prompt: 'e.g., "I ruined the whole project" or "They must think I am incompetent".',
        exerciseType: 'text',
      },
      {
        title: 'Examine Concrete Evidence',
        instruction: 'Look at factual reality objectively. What facts truly support this thought, and what facts clearly contradict it?',
        prompt: 'List evidence for and against without emotional filtering.',
        exerciseType: 'text',
      },
      {
        title: 'Craft a Compassionate, Balanced Alternative',
        instruction: 'How would you reframe this thought to a close friend in this exact situation?',
        prompt: 'Formulate a realistic, compassionate reframe statement you can breathe into.',
        exerciseType: 'reflection',
      },
    ],
  },
  {
    id: 'act_eft_couples',
    title: 'Couples Softened Startup Dialogue',
    category: 'EFT_COUPLES',
    categoryLabel: 'Couples Attunement (EFT)',
    durationMinutes: 10,
    forCouplesOnly: true,
    description: 'A structured exercise to present a vulnerable need to your partner without criticism or defensiveness.',
    purpose: 'Transforms conflict into an invitation for emotional intimacy using Gottman and EFT principles.',
    steps: [
      {
        title: 'Name Your Primary Emotion',
        instruction: 'Look beneath anger or frustration. Are you feeling lonely, scared, unappreciated, or overwhelmed?',
        prompt: 'Complete: "Underneath my frustration, what I was really feeling was..."',
        exerciseType: 'text',
      },
      {
        title: 'State the Specific Situation Neutrally',
        instruction: 'State what happened without using words like "always", "never", or questioning their character.',
        prompt: 'Complete: "When [specific event occurred]..."',
        exerciseType: 'text',
      },
      {
        title: 'State a Positive Attachment Need',
        instruction: 'Tell your partner what you would love them to DO, rather than what they did wrong.',
        prompt: 'Complete: "What would help me feel safe and connected with you right now is..."',
        exerciseType: 'text',
      },
      {
        title: 'Partner Attunement Check-In',
        instruction: 'Partner reflects back: "What I hear you saying is you need..." and offers reassurance.',
        prompt: 'Take turns reading your answers aloud and sharing a 30-second silent hug.',
        exerciseType: 'reflection',
      },
    ],
  },
  {
    id: 'act_breathing_478',
    title: '4-7-8 Parasympathetic Vagus Reset',
    category: 'MINDFULNESS',
    categoryLabel: 'Nervous System Regulation',
    durationMinutes: 5,
    description: 'A scientifically validated pacing sequence that signals your autonomic nervous system to down-regulate panic.',
    purpose: 'Soothes acute anxiety, lowers elevated heart rate, and centers somatic tension.',
    steps: [
      {
        title: 'Posture & Grounding',
        instruction: 'Sit comfortably with feet flat on the ground. Place one hand on your chest and one on your belly.',
        prompt: 'Feel the contact of your body on the seat beneath you.',
        exerciseType: 'reflection',
      },
      {
        title: 'The 4-7-8 Breathing Cycle',
        instruction: 'Inhale silently through your nose for 4 counts. Hold breath gently for 7 counts. Exhale completely through mouth with a whoosh for 8 counts.',
        exerciseType: 'breathing',
        timerSeconds: 120,
      },
      {
        title: 'Somatic Post-Check',
        instruction: 'Notice any change in tension in your jaw, shoulders, and solar plexus. How is your internal pulse?',
        prompt: 'Briefly note how your internal weather shifted.',
        exerciseType: 'text',
      },
    ],
  },
  {
    id: 'act_somatic_grounding',
    title: '5-4-3-2-1 Sensory Grounding',
    category: 'SOMATIC_GROUNDING',
    categoryLabel: 'Somatic Awareness',
    durationMinutes: 6,
    description: 'Engage your five external senses to pull conscious focus away from racing thoughts and back into the present moment.',
    purpose: 'Anchors your mind during episodes of dissociation, panic, or hyper-arousal.',
    steps: [
      {
        title: '5 Things You Can See',
        instruction: 'Look around your physical space. Notice 5 distinct objects, patterns, or colors.',
        prompt: 'Name 5 visual anchors in your room.',
        exerciseType: 'text',
      },
      {
        title: '4 Things You Can Physically Touch',
        instruction: 'Notice textures: your clothing, the smooth desk, the cool air on your skin.',
        prompt: 'Touch 4 distinct physical textures right now.',
        exerciseType: 'text',
      },
      {
        title: '3 Things You Can Hear',
        instruction: 'Listen carefully for distant traffic, a hum of appliances, or your own breath.',
        prompt: 'Identify 3 separate sounds in the ambient soundscape.',
        exerciseType: 'text',
      },
      {
        title: '2 Things You Can Smell & 1 You Can Taste',
        instruction: 'Notice scents in the room or on your wrist, and the taste in your mouth.',
        prompt: 'Ground into taste and scent sensations.',
        exerciseType: 'text',
      },
    ],
  },
];

export let sharedStories: SharedStory[] = [];

export let communitySuggestions: CommunitySuggestion[] = [];

export let inAppNotifications: InAppNotification[] = [];

export let communityCircles: CommunityCircle[] = [];

export let moderationReports: ModerationReport[] = [];

const dataFile = path.resolve(process.env.HAVEN_DATA_FILE || 'data/haven-data.json');

interface PersistedState {
  users: [string, UserProfile][];
  passwordHashes: [string, string][];
  authenticatedSessions: [string, string][];
  sessions: TherapySession[];
  checkIns: CheckInRecord[];
  diaryEntries: DiaryEntry[];
  activityCompletions: [string, Record<string, { count: number; lastCompleted: string }>][];
  storyInteractions: [string, Record<string, { supported: boolean; joined: boolean; notificationsEnabled: boolean }>][];
  circleMemberships: [string, string[]][];
  communityPostSupporters: [string, string[]][];
  sharedStories: SharedStory[];
  communitySuggestions: CommunitySuggestion[];
  inAppNotifications: InAppNotification[];
  communityCircles: CommunityCircle[];
  moderationReports: ModerationReport[];
}

function loadPersistedState(): void {
  if (!existsSync(dataFile)) return;

  const saved = JSON.parse(readFileSync(dataFile, 'utf8')) as PersistedState;
  for (const [id, user] of saved.users || []) usersDatabase.set(id, user);
  for (const [email, hash] of saved.passwordHashes || []) userPasswords.set(email, hash);
  for (const [sessionId, userId] of saved.authenticatedSessions || []) authenticatedSessions.set(sessionId, userId);
  sessions = saved.sessions || [];
  checkIns = saved.checkIns || [];
  diaryEntries = saved.diaryEntries || [];
  for (const [userId, completions] of saved.activityCompletions || []) activityCompletions.set(userId, completions);
  for (const [storyId, interactions] of saved.storyInteractions || []) storyInteractions.set(storyId, interactions);
  for (const [circleId, members] of saved.circleMemberships || []) circleMemberships.set(circleId, members);
  for (const [postId, supporters] of saved.communityPostSupporters || []) communityPostSupporters.set(postId, supporters);
  sharedStories = saved.sharedStories || [];
  communitySuggestions = saved.communitySuggestions || [];
  inAppNotifications = saved.inAppNotifications || [];
  communityCircles = saved.communityCircles || [];
  moderationReports = saved.moderationReports || [];
}

export function persistState(): void {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  const state: PersistedState = {
    users: Array.from(usersDatabase.entries()),
    passwordHashes: Array.from(userPasswords.entries()),
    authenticatedSessions: Array.from(authenticatedSessions.entries()),
    sessions,
    checkIns,
    diaryEntries,
    activityCompletions: Array.from(activityCompletions.entries()),
    storyInteractions: Array.from(storyInteractions.entries()),
    circleMemberships: Array.from(circleMemberships.entries()),
    communityPostSupporters: Array.from(communityPostSupporters.entries()),
    sharedStories,
    communitySuggestions,
    inAppNotifications,
    communityCircles,
    moderationReports,
  };
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
  renameSync(temporaryFile, dataFile);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== 64) return false;
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function setAuthCookie(res: express.Response, sessionId: string): void {
  res.setHeader(
    'Set-Cookie',
    `haven_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

export function readAuthCookie(req: express.Request): string | undefined {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)haven_session=([a-f0-9-]+)/i);
  return match?.[1];
}

loadPersistedState();

export function storyForUser(story: SharedStory, userId: string): Omit<SharedStory, 'authorUserId'> {
  const { authorUserId: _authorUserId, ...publicStory } = story;
  const interaction = storyInteractions.get(story.id)?.[userId];
  return {
    ...publicStory,
    userSupported: interaction?.supported || false,
    userJoined: interaction?.joined || false,
    notificationsEnabled: interaction?.notificationsEnabled || false,
  };
}
