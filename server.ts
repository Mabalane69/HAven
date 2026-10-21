import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type {
  UserProfile,
  ChatMessage,
  TherapySession,
  CheckInRecord,
  DiaryEntry,
  TherapeuticActivity,
  SharedStory,
  StoryComment,
  CommunityCircle,
  CommunitySuggestion,
  InAppNotification,
  AiCheckInSuggestion,
  ModerationReport,
  AdminAnalytics,
  AccountStatus
} from './src/types';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

type RequestContext = { user: UserProfile | null };
const requestContext = new AsyncLocalStorage<RequestContext>();
const currentUser = new Proxy({} as UserProfile, {
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
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ==========================================
// In-Memory Database Storage & Seeding
// ==========================================

const usersDatabase = new Map<string, UserProfile>();
const userPasswords = new Map<string, string>();
const authenticatedSessions = new Map<string, string>();
const activityCompletions = new Map<string, Record<string, { count: number; lastCompleted: string }>>();
const storyInteractions = new Map<string, Record<string, { supported: boolean; joined: boolean; notificationsEnabled: boolean }>>();
const circleMemberships = new Map<string, string[]>();
const communityPostSupporters = new Map<string, string[]>();

let sessions: TherapySession[] = [];

let checkIns: CheckInRecord[] = [];

let diaryEntries: DiaryEntry[] = [];

let therapeuticActivities: TherapeuticActivity[] = [
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

let sharedStories: SharedStory[] = [];

let communitySuggestions: CommunitySuggestion[] = [];

let inAppNotifications: InAppNotification[] = [];

let communityCircles: CommunityCircle[] = [];

let moderationReports: ModerationReport[] = [];

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

function persistState(): void {
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

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== 64) return false;
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

function setAuthCookie(res: express.Response, sessionId: string): void {
  res.setHeader(
    'Set-Cookie',
    `haven_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

function readAuthCookie(req: express.Request): string | undefined {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)haven_session=([a-f0-9-]+)/i);
  return match?.[1];
}

loadPersistedState();

function storyForUser(story: SharedStory, userId: string): Omit<SharedStory, 'authorUserId'> {
  const { authorUserId: _authorUserId, ...publicStory } = story;
  const interaction = storyInteractions.get(story.id)?.[userId];
  return {
    ...publicStory,
    userSupported: interaction?.supported || false,
    userJoined: interaction?.joined || false,
    notificationsEnabled: interaction?.notificationsEnabled || false,
  };
}

app.use('/api', (req, res, next) => {
  res.on('finish', () => {
    try {
      persistState();
    } catch (error) {
      console.error('Failed to persist Haven data:', error);
    }
  });

  const publicAuthRoutes = ['/auth/signup', '/auth/login', '/auth/logout', '/auth/me'];
  const sessionId = readAuthCookie(req);
  const userId = sessionId ? authenticatedSessions.get(sessionId) : undefined;
  const user = userId ? usersDatabase.get(userId) || null : null;
  const isPublicRoute = publicAuthRoutes.includes(req.path);

  if (!isPublicRoute && (!user || user.status === 'BANNED' || user.status === 'SUSPENDED')) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }

  requestContext.run({ user }, () => next());
});

// ==========================================
// Therapeutic Safety & Crisis Classifier
// ==========================================

const CRISIS_KEYWORDS = [
  'kill myself',
  'commit suicide',
  'end my life',
  'want to die',
  'better off dead',
  'hang myself',
  'slit my wrist',
  'overdose',
  'no reason to live',
  'shooting myself',
  'harm myself',
  'hurt myself physically',
  'jump off a bridge',
];

const ABUSE_KEYWORDS = [
  'fuck you',
  'bitch',
  'die asshole',
  'shut up idiot',
  'kill you',
  'hate all of you',
  'sluts',
  'retard',
  'kys',
];

interface SafetyCheckResult {
  isSafe: boolean;
  isCrisis: boolean;
  isAbuse: boolean;
  reason?: string;
  responseMessage?: string;
}

function evaluateSafetyGuardrails(text: string): SafetyCheckResult {
  const normalized = text.toLowerCase();

  // 1. Check for immediate suicide / self-harm crisis
  for (const phrase of CRISIS_KEYWORDS) {
    if (normalized.includes(phrase)) {
      return {
        isSafe: false,
        isCrisis: true,
        isAbuse: false,
        reason: 'CRITICAL_SAFETY_ALERT: Severe crisis or self-harm ideation detected',
        responseMessage: `I hear how deeply you are hurting right now, and I want you to know you are not alone in this dark moment. 

However, because I am an AI therapeutic guide, I cannot replace immediate human emergency care or keep you physically safe. Please reach out right now to compassionate, certified people who are ready to support you:

• 🇺🇸 / 🇨🇦 United States & Canada: Call or text **988** (available 24/7, free & confidential)
• 🇬🇧 United Kingdom: Call **111** or contact Samaritans at **116 123**
• 🇦🇺 Australia: Call Lifeline at **13 11 14**
• 🇿🇦 South Africa: Call SADAG at **0800 567 567**
• 🌍 Global crisis directory: Text HOME to **741741** (Crisis Text Line) or visit **findahelpline.com**

Please take a slow, gentle breath and reach out to one of these services or someone you trust right now. Your life is profoundly valuable.`,
      };
    }
  }

  // 2. Check for abusive language / harassment
  for (const word of ABUSE_KEYWORDS) {
    if (normalized.includes(word)) {
      return {
        isSafe: false,
        isCrisis: false,
        isAbuse: true,
        reason: 'ABUSIVE_LANGUAGE_VIOLATION: Hostile, harassing, or threatening tone detected',
        responseMessage: `Haven is a trauma-informed sanctuary designed to provide safe, respectful, and therapeutic care. 

We cannot engage with hostile, abusive, or threatening language. If you are experiencing intense anger or emotional overwhelm, we can explore healthy ways to process that distress constructively, but interactions must remain respectful. Continued abusive behavior will result in account suspension or termination.`,
      };
    }
  }

  return { isSafe: true, isCrisis: false, isAbuse: false };
}

// Helper: Therapeutic Prompt Generation
function buildTherapySystemPrompt(mode: 'INDIVIDUAL' | 'COUPLE', user: UserProfile): string {
  const base = `You are "Harmony", a warm, deeply compassionate, culturally-inclusive, and trauma-informed AI therapeutic guide inside the Haven sanctuary.
Your practice integrates Cognitive Behavioral Therapy (CBT), Emotionally Focused Therapy (EFT), Dialectical Behavioral Therapy (DBT), and Mindfulness.

NON-NEGOTIABLE CLINICAL BOUNDARIES:
1. You are an AI companion and supportive therapeutic coach, NOT a medical doctor or prescribing psychiatrist. NEVER diagnose psychiatric conditions, promise cures, or suggest modifying medications.
2. Maintain warmth, presence, and zero judgment. Respect and honor all cultural contexts, gender identities, sexual orientations, and lived experiences.
3. Keep responses focused, validating, and conversational (around 2-3 short, thoughtful paragraphs or 80-160 words). Never dump generic bulleted checklists unless doing a specific interactive exercise.
4. Always prioritize emotional attunement before jumping into solutions. Validate the feeling first, identify the underlying need, and ask one gentle, opening question.`;

  if (mode === 'COUPLE') {
    return `${base}

SPECIAL COUPLES THERAPY DIRECTIVES (EFT & Gottman Method):
- You are mediating a dialogue between ${user.name} and their partner ${user.partnerName || 'their partner'}.
- Maintain ABSOLUTE NEUTRALITY. Never take sides, validate one person at the expense of the other, or assign blame.
- Deconstruct the "Four Horsemen": Criticism, Contempt, Defensiveness, and Stonewalling.
- Reframe reactive or accusatory statements ("You never listen to me", "You always ignore me") into vulnerable primary attachment needs ("I feel lonely and long to feel important to you").
- Encourage the partners to speak directly to one another with softened startups, rather than venting solely at the AI.`;
  }

  return `${base}

INDIVIDUAL THERAPY DIRECTIVES:
- Client: ${user.name} (pronouns: ${user.pronouns || 'they/them'}).
- Client cultural context: ${user.culturalContext || 'Inclusive background'}.
- Help identify unhelpful thinking styles (such as catastrophizing, black-and-white thinking, mind reading, emotional reasoning) without being condescending.
- Anchor reflections in somatic awareness (how their chest, stomach, or shoulders feel) and practical self-compassion.`;
}

// Fallback high-empathy generator if API key is not present or offline
function generateFallbackTherapyReply(userInput: string, mode: 'INDIVIDUAL' | 'COUPLE', user: UserProfile): string {
  const text = userInput.toLowerCase();

  if (mode === 'COUPLE') {
    if (text.includes('angry') || text.includes('argue') || text.includes('fight') || text.includes('frustrated')) {
      return `When conflict flares between two people who care about each other, it is often because both of your nervous systems feel unheard or unappreciated. 

Underneath this frustration, there is usually a tender attachment longing—a wish for closeness, reassurance, or safety. Let's take a slow breath together. Rather than asking who is right, what would happen if each of you shared what you are most afraid the other person isn't hearing?`;
    }
    return `Thank you for bringing this into our shared circle, ${user.name}. In Emotionally Focused Therapy, we recognize that every partner's withdrawal or reaction is an attempt to cope with emotional distress. 

${user.partnerName || 'Your partner'}, how does it feel to hear ${user.name}'s perspective here? And what small gesture of safety can you both offer each other right now?`;
  }

  // Individual
  if (text.includes('anxious') || text.includes('worry') || text.includes('panic') || text.includes('scared')) {
    return `I hear the tension in what you're holding, ${user.name}. Anxiety has a way of convincing our minds that the worst-case scenario is already unfolding. 

Let's pause right here and notice your body. Are your shoulders raised? Is your jaw clenched? Let them soften just five percent. What is one small, tangible fact in your immediate surroundings that reminds you that you are safe in this exact moment?`;
  }

  if (text.includes('sad') || text.includes('lonely') || text.includes('depressed') || text.includes('tired') || text.includes('heavy')) {
    return `It sounds like you're carrying a very heavy weight right now, ${user.name}. I want to honor how exhausting that can be, especially when you feel like you have to keep moving forward despite it. 

You don't need to put on a brave face here. What would it look like to give yourself permission to simply rest and feel whatever is present, without judging yourself for it?`;
  }

  return `Thank you for sharing that with me, ${user.name}. What you're experiencing is deeply human, and you deserve a space where every part of your experience is welcomed. 

When you reflect on this situation, what part of you feels most in need of understanding or gentle care today?`;
}

// ==========================================
// Express API Routes
// ==========================================

// 0. Authentication Routes (Sign-Up, Login, Logout, Session)
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, pronouns, culturalContext, coupleCode, partnerName } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedCoupleCode = typeof coupleCode === 'string' ? coupleCode.trim().toUpperCase() : '';

  if (!normalizedEmail || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  if (Array.from(usersDatabase.values()).some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
  }

  const partner = normalizedCoupleCode
    ? Array.from(usersDatabase.values()).find((user) => user.coupleCode?.toUpperCase() === normalizedCoupleCode)
    : undefined;
  if (normalizedCoupleCode && !partner) {
    return res.status(400).json({ error: 'That pairing code was not found. Check it and try again.' });
  }
  if (partner?.partnerConnected) {
    return res.status(409).json({ error: 'That account is already linked with a partner.' });
  }

  let inviteCode = `HAVEN-${randomBytes(3).toString('hex').toUpperCase()}`;
  while (Array.from(usersDatabase.values()).some((user) => user.coupleCode === inviteCode)) {
    inviteCode = `HAVEN-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
  const newId = `usr_${randomUUID()}`;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const newUser: UserProfile = {
    id: newId,
    name: name.trim(),
    email: normalizedEmail,
    pronouns: typeof pronouns === 'string' ? pronouns.trim() : '',
    culturalContext: typeof culturalContext === 'string' ? culturalContext.trim() : '',
    role: adminEmail && normalizedEmail === adminEmail ? 'ADMIN' : 'USER',
    status: 'ACTIVE',
    partnerName: partner?.name || (typeof partnerName === 'string' ? partnerName.trim() : ''),
    partnerUserId: partner?.id,
    partnerConnected: !!partner,
    coupleCode: inviteCode,
    reminderEnabled: true,
    reminderTime: '20:30',
    lastCheckIn: undefined,
  };

  usersDatabase.set(newId, newUser);
  if (partner) {
    partner.partnerName = newUser.name;
    partner.partnerUserId = newUser.id;
    partner.partnerConnected = true;
    usersDatabase.set(partner.id, partner);
  }
  userPasswords.set(normalizedEmail, hashPassword(password));
  const sessionId = randomUUID();
  authenticatedSessions.set(sessionId, newId);
  const context = requestContext.getStore();
  if (context) context.user = newUser;
  setAuthCookie(res, sessionId);

  res.json({ success: true, user: newUser });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const foundUser = Array.from(usersDatabase.values()).find((user) => user.email === normalizedEmail);

  if (!foundUser) {
    return res.status(401).json({ error: 'No account found with this email. Please check your credentials or sign up.' });
  }

  const expectedPassword = userPasswords.get(foundUser.email);
  if (!expectedPassword || typeof password !== 'string' || !verifyPassword(password, expectedPassword)) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  if (foundUser.status === 'BANNED' || foundUser.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'This account is currently restricted. Contact an administrator for help.' });
  }

  const sessionId = randomUUID();
  authenticatedSessions.set(sessionId, foundUser.id);
  const context = requestContext.getStore();
  if (context) context.user = foundUser;
  setAuthCookie(res, sessionId);
  res.json({ success: true, user: foundUser });
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = readAuthCookie(req);
  if (sessionId) authenticatedSessions.delete(sessionId);
  res.setHeader('Set-Cookie', 'haven_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = requestContext.getStore()?.user || null;
  res.json({ success: true, user });
});

// 1. User Profile & Preferences
app.get('/api/profile', (req, res) => {
  if (!currentUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ success: true, profile: currentUser });
});

app.put('/api/profile', (req, res) => {
  const { name, pronouns, culturalContext, reminderEnabled, reminderTime } = req.body;
  if (typeof name === 'string') currentUser.name = name.trim();
  if (typeof pronouns === 'string') currentUser.pronouns = pronouns.trim();
  if (typeof culturalContext === 'string') currentUser.culturalContext = culturalContext.trim();
  if (typeof reminderEnabled === 'boolean') currentUser.reminderEnabled = reminderEnabled;
  if (typeof reminderTime === 'string' && /^\d{2}:\d{2}$/.test(reminderTime)) currentUser.reminderTime = reminderTime;
  if (typeof name === 'string' && currentUser.partnerUserId) {
    const partner = usersDatabase.get(currentUser.partnerUserId);
    if (partner) {
      partner.partnerName = currentUser.name;
      usersDatabase.set(partner.id, partner);
    }
  }
  usersDatabase.set(currentUser.id, requestContext.getStore()!.user!);
  res.json({ success: true, profile: currentUser });
});

app.post('/api/profile/pair', (req, res) => {
  const coupleCode = typeof req.body.coupleCode === 'string' ? req.body.coupleCode.trim().toUpperCase() : '';
  if (!coupleCode) return res.status(400).json({ error: 'Enter your partner’s pairing code.' });
  if (currentUser.partnerConnected) return res.status(409).json({ error: 'This account is already linked to a partner.' });
  const partner = Array.from(usersDatabase.values()).find((user) => user.coupleCode?.toUpperCase() === coupleCode);
  if (!partner || partner.id === currentUser.id) return res.status(404).json({ error: 'That pairing code was not found.' });
  if (partner.partnerConnected) return res.status(409).json({ error: 'That account is already linked to a partner.' });

  const user = requestContext.getStore()!.user!;
  user.partnerName = partner.name;
  user.partnerUserId = partner.id;
  user.partnerConnected = true;
  partner.partnerName = user.name;
  partner.partnerUserId = user.id;
  partner.partnerConnected = true;
  usersDatabase.set(partner.id, partner);
  res.json({ success: true, profile: user });
});

app.get('/api/admin/users', (req, res) => {
  if (currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can view accounts.' });
  }
  const users = Array.from(usersDatabase.values()).map(({ id, name, email, role, status }) => ({
    id, name, email, role, status,
  }));
  res.json({ success: true, users });
});

app.put('/api/admin/users/:id/role', (req, res) => {
  if (currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can manage account roles.' });
  }
  const target = usersDatabase.get(req.params.id);
  const { role } = req.body;
  if (!target) return res.status(404).json({ error: 'Account not found.' });
  if (target.id === currentUser.id) {
    return res.status(400).json({ error: 'You cannot change your own administrator role.' });
  }
  if (role !== 'ADMIN' && role !== 'USER') {
    return res.status(400).json({ error: 'Role must be USER or ADMIN.' });
  }
  target.role = role;
  res.json({ success: true, user: { id: target.id, name: target.name, email: target.email, role: target.role, status: target.status } });
});

// 2. Therapy Sessions & Interactive Chat
app.get('/api/therapy/sessions', (req, res) => {
  res.json({
    success: true,
    sessions: sessions.filter(
      (session) => session.userId === currentUser.id || session.partnerUserId === currentUser.id
    ),
  });
});

app.post('/api/therapy/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    let mode = req.body.mode || 'INDIVIDUAL';

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message content is required.' });
    }
    if (mode !== 'INDIVIDUAL' && mode !== 'COUPLE') {
      return res.status(400).json({ error: 'Therapy mode must be INDIVIDUAL or COUPLE.' });
    }
    const existingSession = typeof sessionId === 'string'
      ? sessions.find((candidate) => candidate.id === sessionId)
      : undefined;
    if (existingSession) {
      if (existingSession.userId !== currentUser.id && existingSession.partnerUserId !== currentUser.id) {
        return res.status(403).json({ error: 'You do not have access to this therapy session.' });
      }
      mode = existingSession.mode;
    }
    if (mode === 'COUPLE' && (!currentUser.partnerConnected || !currentUser.partnerUserId)) {
      return res.status(403).json({ error: 'Link a partner account before starting a couples session.' });
    }

    // Safety guardrails pre-check
    const safety = evaluateSafetyGuardrails(message);

    // If flagged as abuse or critical crisis, log an AI report for the Admin Dashboard
    if (!safety.isSafe) {
      const newReport: ModerationReport = {
        id: `rep_${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userStatus: currentUser.status,
        reason: safety.reason || 'Guardrail Trigger',
        severity: safety.isCrisis ? 'CRITICAL' : 'MEDIUM',
        contextSnippet: 'Message content withheld. A safety guardrail detected a concern and the assistant provided an appropriate response.',
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      moderationReports.unshift(newReport);

      // If user was abusive and not yet warned, auto-warn
      if (safety.isAbuse && currentUser.status === 'ACTIVE') {
        currentUser.status = 'WARNED';
        currentUser.statusReason = 'System warning issued for aggressive or abusive language.';
        usersDatabase.set(currentUser.id, requestContext.getStore()!.user!);
      }

      // Return immediate safe crisis intervention or boundary enforcement
      const guardrailMessage: ChatMessage = {
        id: `msg_guard_${Date.now()}`,
        sessionId: typeof sessionId === 'string' ? sessionId : `ses_${randomUUID()}`,
        sender: 'AI',
        content: safety.responseMessage || 'Our safety guardrails intercepted this interaction.',
        timestamp: new Date().toISOString(),
        flagged: true,
        flagReason: safety.reason,
        sentiment: safety.isCrisis ? 'crisis' : 'distress',
      };

      return res.json({
        success: true,
        reply: guardrailMessage,
        flagged: true,
        isCrisis: safety.isCrisis,
        isAbuse: safety.isAbuse,
      });
    }

    // Normal safe message processing
    let session = sessions.find(
      (candidate) =>
        candidate.id === sessionId &&
        (candidate.userId === currentUser.id || candidate.partnerUserId === currentUser.id)
    );
    if (!session && sessionId && sessions.some((candidate) => candidate.id === sessionId)) {
      return res.status(403).json({ error: 'You do not have access to this therapy session.' });
    }
    if (!session) {
      session = {
        id: sessionId || `ses_${randomUUID()}`,
        mode: mode as 'INDIVIDUAL' | 'COUPLE',
        userId: currentUser.id,
        partnerUserId: mode === 'COUPLE' ? currentUser.partnerUserId : undefined,
        title: mode === 'COUPLE' ? 'Couples Attunement Session' : 'Individual Reflection & Growth',
        startedAt: new Date().toISOString(),
        messages: [{
          id: `msg_init_${randomUUID()}`,
          sessionId: sessionId || '',
          sender: 'AI',
          content: mode === 'COUPLE'
            ? `Welcome ${currentUser.name} and ${currentUser.partnerName || 'your partner'}. This is a shared, emotionally neutral space. What would you both like to bring to the conversation?`
            : `Hello ${currentUser.name}. Take a moment to settle in. What has been weighing on your mind today?`,
          timestamp: new Date().toISOString(),
          sentiment: 'positive',
        }],
      };
      session.messages[0].sessionId = session.id;
      sessions.unshift(session);
    }

    // Append user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sessionId: session.id,
      sender: session.userId === currentUser.id ? 'USER' : 'PARTNER',
      content: message,
      timestamp: new Date().toISOString(),
      sentiment: 'neutral',
    };
    session.messages.push(userMsg);

    // Call Gemini Model if configured
    let aiText = '';
    let sentiment: 'positive' | 'neutral' | 'distress' | 'crisis' = 'positive';

    if (ai) {
      try {
        const systemInstruction = buildTherapySystemPrompt(mode as 'INDIVIDUAL' | 'COUPLE', currentUser);
        
        // Take recent 6 messages for context
        const recentMessages = session.messages.slice(-6);
        const conversationHistory = recentMessages
          .map((m) => `${m.sender === 'AI' ? 'Harmony (Therapist)' : m.sender}: ${m.content}`)
          .join('\n\n');

        const prompt = `${conversationHistory}\n\nUser: ${message}\n\nHarmony (Therapist):`;

        const generatePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.65,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI response timeout')), 3500)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        aiText = response.text || '';
      } catch (err: any) {
        console.warn('Gemini API call timed out or failed, using high-empathy therapeutic fallback:', err.message);
        aiText = generateFallbackTherapyReply(message, mode as 'INDIVIDUAL' | 'COUPLE', currentUser);
      }
    } else {
      aiText = generateFallbackTherapyReply(message, mode as 'INDIVIDUAL' | 'COUPLE', currentUser);
    }

    if (!aiText) {
      aiText = generateFallbackTherapyReply(message, mode as 'INDIVIDUAL' | 'COUPLE', currentUser);
    }

    const aiMsg: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      sessionId: session.id,
      sender: 'AI',
      content: aiText,
      timestamp: new Date().toISOString(),
      sentiment,
    };
    session.messages.push(aiMsg);

    res.json({
      success: true,
      reply: aiMsg,
      session,
      flagged: false,
    });
  } catch (error: any) {
    console.error('Error in /api/therapy/chat:', error);
    res.status(500).json({ error: 'Therapy engine processing error' });
  }
});

// 3. Daily Check-Ins & Wellness Analytics
app.get('/api/check-ins', (req, res) => {
  res.json({ success: true, checkIns: checkIns.filter((checkIn) => checkIn.userId === currentUser.id) });
});

app.post('/api/check-ins', (req, res) => {
  const { score, moodLabel, feelings = [], stressLevel, sleepHours, gratitude = '', reflection = '' } = req.body;
  const numericScore = Number(score);
  const numericStress = Number(stressLevel);
  const numericSleep = Number(sleepHours);
  if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 10) {
    return res.status(400).json({ error: 'Mood score must be between 1 and 10.' });
  }
  if (!Number.isFinite(numericStress) || numericStress < 1 || numericStress > 5) {
    return res.status(400).json({ error: 'Stress level must be between 1 and 5.' });
  }
  if (!Number.isFinite(numericSleep) || numericSleep < 0 || numericSleep > 16) {
    return res.status(400).json({ error: 'Sleep hours must be between 0 and 16.' });
  }

  const newCheckIn: CheckInRecord = {
    id: `chk_${randomUUID()}`,
    userId: currentUser.id,
    date: new Date().toISOString(),
    score: numericScore,
    moodLabel: typeof moodLabel === 'string' && moodLabel.trim() ? moodLabel.trim() : 'Unlabeled',
    feelings: Array.isArray(feelings) ? feelings.filter((feeling: unknown): feeling is string => typeof feeling === 'string') : [],
    stressLevel: numericStress,
    sleepHours: numericSleep,
    gratitude: typeof gratitude === 'string' ? gratitude.trim() : '',
    reflection: typeof reflection === 'string' ? reflection.trim() : '',
  };

  checkIns.unshift(newCheckIn);
  currentUser.lastCheckIn = newCheckIn.date;
  usersDatabase.set(currentUser.id, requestContext.getStore()!.user!);

  res.json({ success: true, checkIn: newCheckIn });
});

// AI Check-In Assistant: Generates personalized check-in prompt and schedule suggestion
app.post('/api/check-ins/ai-suggest', async (req, res) => {
  try {
    const userCheckIns = checkIns.filter((checkIn) => checkIn.userId === currentUser.id);
    const recentScores = userCheckIns.slice(0, 5).map((c) => c.score);
    const avgRecent = recentScores.length
      ? (recentScores.reduce((a, b) => a + b, 0) / recentScores.length).toFixed(1)
      : 'No prior check-ins';
    const recentFeelings = Array.from(new Set(userCheckIns.slice(0, 3).flatMap((c) => c.feelings || [])));

    let suggestion: AiCheckInSuggestion;

    if (ai) {
      try {
        const prompt = `You are Harmony, a clinical AI therapist. Generate a personalized, highly empathetic daily check-in suggestion for a user.
User Name: ${currentUser.name}
Cultural Context: ${currentUser.culturalContext || 'General'}
Has Partner: ${currentUser.partnerConnected ? 'Yes, in relationship with ' + currentUser.partnerName : 'No, solo explorer'}
Recent Average Mood: ${avgRecent}/10
Recent Active Feelings: ${recentFeelings.join(', ') || 'None recorded'}
Current Time: ${new Date().toLocaleTimeString()}

Output JSON strictly in this format:
{
  "title": "A short poetic 3-5 word check-in title",
  "rationale": "One compassionate sentence explaining why this check-in fits their current energy",
  "suggestedScore": 7,
  "promptQuestion": "One deep, gentle reflection question tailored to their evening",
  "recommendedFeelings": ["Grounded", "Tender", "Reflective"],
  "suggestedTime": "21:15"
}`;

        const responsePromise = ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.7,
            responseMimeType: 'application/json',
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI suggestion timeout')), 3500)
        );

        const response: any = await Promise.race([responsePromise, timeoutPromise]);
        const parsed = JSON.parse(response.text || '{}');
        suggestion = {
          id: `sug_${Date.now()}`,
          title: parsed.title || 'Evening Emotional Wind-Down',
          rationale: parsed.rationale || 'Tailored to balance nervous system attunement and restful sleep.',
          suggestedScore: Number(parsed.suggestedScore) || 7,
          promptQuestion: parsed.promptQuestion || 'What expectation from today can you gently lay down before resting tonight?',
          recommendedFeelings: Array.isArray(parsed.recommendedFeelings) ? parsed.recommendedFeelings : ['Grounded', 'Reflective'],
          suggestedTime: parsed.suggestedTime || '21:15',
        };
      } catch (err: any) {
        console.warn('Gemini AI suggestion timed out or failed, using therapeutic preset:', err.message);
        suggestion = generateFallbackCheckInSuggestion(currentUser, avgRecent);
      }
    } else {
      suggestion = generateFallbackCheckInSuggestion(currentUser, avgRecent);
    }

    res.json({ success: true, suggestion });
  } catch (error: any) {
    console.error('Error generating AI check-in suggestion:', error);
    res.status(500).json({ error: 'Failed to generate AI check-in' });
  }
});

function generateFallbackCheckInSuggestion(user: UserProfile, avgMood: string): AiCheckInSuggestion {
  const isCouples = user.partnerConnected;
  const hasHistory = avgMood !== 'No prior check-ins';
  if (isCouples) {
    return {
      id: `sug_${Date.now()}`,
      title: 'Partner Attunement & Wind-Down',
      rationale: hasHistory
        ? `Based on your recent average mood (${avgMood}/10), take a moment to check in with each other.`
        : 'A gentle prompt to help you and your partner start a check-in together.',
      suggestedScore: 7,
      promptQuestion: `If you could ask ${user.partnerName || 'your partner'} for one tender moment of reassurance tonight without any problem-solving, what would it sound like?`,
      recommendedFeelings: ['Tender', 'Grounded', 'Hopeful'],
      suggestedTime: '21:15',
    };
  }

  return {
    id: `sug_${Date.now()}`,
    title: 'Solo Grounding & Inner Compassion',
    rationale: hasHistory
      ? `A gentle prompt to reflect on how you are feeling after your recent check-ins.`
      : 'A gentle starting point for noticing how you feel today.',
    suggestedScore: 7,
    promptQuestion: 'What is one kind boundary or permission you can gift your own body and mind right now?',
    recommendedFeelings: ['Grounded', 'Reflective', 'Peaceful'],
    suggestedTime: '20:45',
  };
}

// 4. Confidential Encrypted Diary
app.get('/api/diary', (req, res) => {
  // Returns client's diary entries. Admin NEVER has access to raw decrypted diaries.
  const userDiaries = diaryEntries.filter((d) => d.userId === currentUser.id);
  res.json({ success: true, entries: userDiaries });
});

app.post('/api/diary', (req, res) => {
  const { title, encryptedContent, previewSnippet, moodTag = 'Reflection', isPrivateLocked = false } = req.body;
  if (typeof encryptedContent !== 'string' || !encryptedContent.trim()) {
    return res.status(400).json({ error: 'Encrypted diary content is required.' });
  }
  if (typeof previewSnippet !== 'string') {
    return res.status(400).json({ error: 'Diary preview is required.' });
  }

  const newEntry: DiaryEntry = {
    id: `dry_${randomUUID()}`,
    userId: currentUser.id,
    title: typeof title === 'string' && title.trim() ? title.trim() : 'Untitled Reflection',
    encryptedContent,
    previewSnippet,
    moodTag,
    isEncrypted: true,
    isPrivateLocked: !!isPrivateLocked,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  diaryEntries.unshift(newEntry);
  res.json({ success: true, entry: newEntry });
});

app.delete('/api/diary/:id', (req, res) => {
  const { id } = req.params;
  diaryEntries = diaryEntries.filter((d) => !(d.id === id && d.userId === currentUser.id));
  res.json({ success: true });
});

// 5. Therapeutic Guided Activities
app.get('/api/activities', (req, res) => {
  const completions = activityCompletions.get(currentUser.id) || {};
  const activities = therapeuticActivities.map((activity) => ({
    ...activity,
    completedCount: completions[activity.id]?.count || 0,
    lastCompleted: completions[activity.id]?.lastCompleted,
  }));
  res.json({ success: true, activities });
});

app.post('/api/activities/:id/complete', (req, res) => {
  const { id } = req.params;
  const activity = therapeuticActivities.find((a) => a.id === id);
  if (!activity) return res.status(404).json({ error: 'Activity not found.' });
  const completions = activityCompletions.get(currentUser.id) || {};
  const lastCompleted = new Date().toISOString();
  completions[id] = { count: (completions[id]?.count || 0) + 1, lastCompleted };
  activityCompletions.set(currentUser.id, completions);
  res.json({ success: true, activity: { ...activity, ...completions[id] } });
});

// 6. Shared Problem Stories
app.get('/api/stories', (req, res) => {
  res.json({ success: true, stories: sharedStories.map((story) => storyForUser(story, currentUser.id)) });
});

app.post('/api/stories', (req, res) => {
  const {
    title,
    category,
    storyType = 'FIRST_DATE',
    locationOrVibe = '',
    authorAlias,
    authorContext,
    challenge,
    turningPoint,
    keyTakeaway,
    tags = [],
  } = req.body;
  if (![title, challenge, turningPoint, keyTakeaway].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'Title, challenge, turning point, and takeaway are required.' });
  }

  const newStory: SharedStory = {
    id: `st_${randomUUID()}`,
    authorUserId: currentUser.id,
    title,
    category: category || 'Community Stories',
    storyType,
    locationOrVibe,
    authorAlias: authorAlias || currentUser.name,
    authorContext: typeof authorContext === 'string' ? authorContext.trim() : '',
    tags: Array.isArray(tags) ? tags : ['First Dates'],
    challenge,
    turningPoint,
    keyTakeaway,
    supportCount: 0,
    userSupported: false,
    joinedCount: 0,
    userJoined: false,
    notificationsEnabled: false,
    comments: [],
    createdAt: new Date().toISOString(),
  };

  sharedStories.unshift(newStory);
  res.json({ success: true, story: storyForUser(newStory, currentUser.id) });
});

app.post('/api/stories/:id/support', (req, res) => {
  const { id } = req.params;
  const story = sharedStories.find((s) => s.id === id);
  if (!story) return res.status(404).json({ error: 'Story not found.' });
  const interactions = storyInteractions.get(id) || {};
  const interaction = interactions[currentUser.id] || { supported: false, joined: false, notificationsEnabled: false };
  interaction.supported = !interaction.supported;
  story.supportCount = Math.max(0, story.supportCount + (interaction.supported ? 1 : -1));
  interactions[currentUser.id] = interaction;
  storyInteractions.set(id, interactions);
  res.json({ success: true, story: storyForUser(story, currentUser.id) });
});

// Join / Participate in a Story discussion thread
app.post('/api/stories/:id/join', (req, res) => {
  const { id } = req.params;
  const story = sharedStories.find((s) => s.id === id);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  const interactions = storyInteractions.get(id) || {};
  const interaction = interactions[currentUser.id] || { supported: false, joined: false, notificationsEnabled: false };
  if (interaction.joined) {
    interaction.joined = false;
    interaction.notificationsEnabled = false;
    story.joinedCount = Math.max(0, (story.joinedCount || 0) - 1);
  } else {
    interaction.joined = true;
    story.joinedCount = (story.joinedCount || 0) + 1;
    interaction.notificationsEnabled = true;

    // Send a welcoming in-app notification
    inAppNotifications.unshift({
      id: `notif_${Date.now()}`,
      userId: currentUser.id,
      title: 'Joined Story Discussion',
      message: `You joined "${story.title}". You will receive notifications when new comments or date tips are shared.`,
      type: 'COMMENT',
      read: false,
      createdAt: new Date().toISOString(),
      linkTab: 'community',
    });
  }

  interactions[currentUser.id] = interaction;
  storyInteractions.set(id, interactions);
  res.json({ success: true, story: storyForUser(story, currentUser.id) });
});

// Add a comment to a Story
app.post('/api/stories/:id/comments', (req, res) => {
  const { id } = req.params;
  const { content, isAnonymous = false } = req.body;

  const safety = evaluateSafetyGuardrails(content);
  if (!safety.isSafe) {
    return res.status(400).json({ error: 'Comment violates community safety guidelines.' });
  }

  const story = sharedStories.find((s) => s.id === id);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  const newComment: StoryComment = {
    id: `scom_${Date.now()}`,
    storyId: id,
    authorName: isAnonymous ? 'Anonymous Peer' : currentUser.name,
    isAnonymous: !!isAnonymous,
    content,
    createdAt: new Date().toISOString(),
  };

  story.comments.push(newComment);

  const recipients = new Set(
    Object.entries(storyInteractions.get(id) || {})
      .filter(([, interaction]) => interaction.joined)
      .map(([userId]) => userId)
  );
  if (story.authorUserId) recipients.add(story.authorUserId);
  recipients.delete(currentUser.id);
  for (const userId of recipients) {
    inAppNotifications.unshift({
      id: `notif_${randomUUID()}`,
      userId,
      title: `💬 New Comment on "${story.title.substring(0, 30)}..."`,
      message: `${newComment.authorName} replied: "${content.substring(0, 60)}..."`,
      type: 'COMMENT',
      read: false,
      createdAt: new Date().toISOString(),
      linkTab: 'community',
    });
  }

  res.json({ success: true, comment: newComment, story: storyForUser(story, currentUser.id) });
});

// 7. Community Circles & Moderated Discussions
app.get('/api/communities', (req, res) => {
  const circles = communityCircles.map((circle) => {
    const members = circleMemberships.get(circle.id) || [];
    return {
      ...circle,
      memberCount: members.length,
      isJoined: members.includes(currentUser.id),
      posts: circle.posts.map((post) => ({
        ...post,
        userSupported: (communityPostSupporters.get(post.id) || []).includes(currentUser.id),
      })),
    };
  });
  res.json({ success: true, circles });
});

// Join / Leave a Community Circle
app.post('/api/communities/:circleId/join', (req, res) => {
  const { circleId } = req.params;
  const circle = communityCircles.find((c) => c.id === circleId);
  if (!circle) return res.status(404).json({ error: 'Circle not found' });

  const members = circleMemberships.get(circleId) || [];
  const memberIndex = members.indexOf(currentUser.id);
  if (memberIndex >= 0) {
    members.splice(memberIndex, 1);
  } else {
    members.push(currentUser.id);
    inAppNotifications.unshift({
      id: `notif_${Date.now()}`,
      userId: currentUser.id,
      title: `🌿 Welcome to ${circle.name}`,
      message: `You are now a member of ${circle.name}. Safe sharing and peer connection are always here.`,
      type: 'COMMUNITY',
      read: false,
      createdAt: new Date().toISOString(),
      linkTab: 'community',
    });
  }
  circleMemberships.set(circleId, members);

  res.json({ success: true, circle: { ...circle, memberCount: members.length, isJoined: members.includes(currentUser.id) } });
});

// Admin adds a new Community Topic / Circle
app.post('/api/communities/admin-create-circle', (req, res) => {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can create new community topics.' });
  }

  const { name, category, description, initialDiscussionPrompt } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: 'Name and description are required.' });
  }

  const newCircleId = `circle_${Date.now()}`;
  const newCircle: CommunityCircle = {
    id: newCircleId,
    name,
    category: category || 'Community Topic',
    description,
    memberCount: 0,
    isJoined: false,
    createdByAdmin: true,
    posts: initialDiscussionPrompt
      ? [
          {
            id: `cpost_${Date.now()}`,
            circleId: newCircleId,
            authorName: `${currentUser.name} (Admin)`,
            isAnonymous: false,
            title: `Welcome to ${name}: Opening Discussion`,
            content: initialDiscussionPrompt,
            tags: ['Moderator Kickoff', 'Safe Space'],
            createdAt: new Date().toISOString(),
            supports: 0,
            userSupported: false,
            comments: [],
          },
        ]
      : [],
  };

  communityCircles.unshift(newCircle);

  // Notify community of new topic
  inAppNotifications.unshift({
    id: `notif_${Date.now()}`,
    userId: currentUser.id,
    title: `✨ New Topic Added by Clinical Admin`,
    message: `"${name}" has been added to Community Circles. Tap to explore and participate!`,
    type: 'COMMUNITY',
    read: false,
    createdAt: new Date().toISOString(),
    linkTab: 'community',
  });

  res.json({ success: true, circle: newCircle });
});

// Users suggest a new Community to Admins
app.post('/api/communities/suggest', (req, res) => {
  const { name, category, description, proposedFirstDiscussion } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: 'Name and description are required.' });
  }

  const suggestion: CommunitySuggestion = {
    id: `sug_${Date.now()}`,
    userId: currentUser.id,
    userName: currentUser.name,
    name,
    category: category || 'Peer Support',
    description,
    proposedFirstDiscussion,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  communitySuggestions.unshift(suggestion);

  // Send confirmation notification
  inAppNotifications.unshift({
    id: `notif_${Date.now()}`,
    userId: currentUser.id,
    title: '💡 Community Proposal Received',
    message: `Thank you for suggesting "${name}". Our clinical administrators review suggestions weekly.`,
    type: 'COMMUNITY',
    read: false,
    createdAt: new Date().toISOString(),
    linkTab: 'community',
  });

  res.json({ success: true, suggestion });
});

// Admin reviews suggestions
app.get('/api/admin/community-suggestions', (req, res) => {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can view community suggestions.' });
  }
  res.json({ success: true, suggestions: communitySuggestions });
});

app.post('/api/admin/community-suggestions/:id/review', (req, res) => {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can review community suggestions.' });
  }

  const { id } = req.params;
  const { action, adminFeedback } = req.body; // 'APPROVE' | 'DECLINE'

  const suggestion = communitySuggestions.find((s) => s.id === id);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

  let createdCircle: CommunityCircle | null = null;

  if (action === 'APPROVE') {
    suggestion.status = 'APPROVED';
    suggestion.adminFeedback = adminFeedback || 'Approved and officially launched by clinical supervisor.';

    // Create live community circle
    const newCircleId = `circle_${Date.now()}`;
    createdCircle = {
      id: newCircleId,
      name: suggestion.name,
      category: suggestion.category,
      description: suggestion.description,
      memberCount: 0,
      isJoined: false,
      createdByAdmin: true,
      posts: suggestion.proposedFirstDiscussion
        ? [
            {
              id: `cpost_${Date.now()}`,
              circleId: newCircleId,
              authorName: `${suggestion.userName} (Community Founder)`,
              isAnonymous: false,
              title: `Inaugural Circle Conversation: ${suggestion.name}`,
              content: suggestion.proposedFirstDiscussion,
              tags: ['Community Proposed', 'Open Dialogue'],
              createdAt: new Date().toISOString(),
              supports: 0,
              userSupported: false,
              comments: [],
            },
          ]
        : [],
    };
    communityCircles.push(createdCircle);

    // Notify suggester
    inAppNotifications.unshift({
      id: `notif_${Date.now()}`,
      userId: suggestion.userId,
      title: '🎉 Your Community Suggestion was Approved!',
      message: `"${suggestion.name}" is now live in Community Circles for all members!`,
      type: 'COMMUNITY',
      read: false,
      createdAt: new Date().toISOString(),
      linkTab: 'community',
    });
  } else {
    suggestion.status = 'DECLINED';
    suggestion.adminFeedback = adminFeedback || 'Merged into existing circles or does not align with clinical boundaries.';
  }

  res.json({ success: true, suggestion, circle: createdCircle });
});

// In-App Notifications
app.get('/api/notifications', (req, res) => {
  const userNotifications = inAppNotifications.filter(
    (n) => n.userId === currentUser.id || n.userId === 'all'
  );
  res.json({ success: true, notifications: userNotifications });
});

app.post('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const notif = inAppNotifications.find((n) => n.id === id);
  if (notif) notif.read = true;
  res.json({ success: true });
});

app.post('/api/notifications/clear', (req, res) => {
  inAppNotifications = inAppNotifications.filter((n) => n.userId !== currentUser.id);
  res.json({ success: true });
});

app.post('/api/communities/:circleId/posts', (req, res) => {
  const { circleId } = req.params;
  const { title, content, isAnonymous = true, tags = [] } = req.body;

  // Run moderation check on community posts
  const safety = evaluateSafetyGuardrails(content + ' ' + title);
  if (!safety.isSafe) {
    // Flag for admin review
    moderationReports.unshift({
      id: `rep_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userStatus: currentUser.status,
      reason: `COMMUNITY_VIOLATION: ${safety.reason}`,
      severity: 'MEDIUM',
      contextSnippet: 'Post content withheld. Community safety guardrails flagged the submission for administrator review.',
      createdAt: new Date().toISOString(),
      resolved: false,
    });
    return res.status(400).json({
      error: 'Your post was not published because it triggered our community safety & respect guidelines.',
    });
  }

  const circle = communityCircles.find((c) => c.id === circleId);
  if (!circle) {
    return res.status(404).json({ error: 'Circle not found' });
  }

  const newPost = {
    id: `cpost_${Date.now()}`,
    circleId,
    authorName: isAnonymous ? 'Anonymous Member' : currentUser.name,
    isAnonymous: !!isAnonymous,
    title,
    content,
    tags: Array.isArray(tags) ? tags : ['Support'],
    createdAt: new Date().toISOString(),
    supports: 0,
    userSupported: false,
    comments: [],
  };

  circle.posts.unshift(newPost);
  res.json({ success: true, post: newPost });
});

app.post('/api/communities/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;
  const { content, isAnonymous = false } = req.body;

  const safety = evaluateSafetyGuardrails(content);
  if (!safety.isSafe) {
    return res.status(400).json({ error: 'Comment violates safety guidelines.' });
  }

  for (const circle of communityCircles) {
    const post = circle.posts.find((p) => p.id === postId);
    if (post) {
      const comment = {
        id: `ccom_${Date.now()}`,
        postId,
        authorName: isAnonymous ? 'Anonymous Peer' : currentUser.name,
        isAnonymous: !!isAnonymous,
        content,
        createdAt: new Date().toISOString(),
      };
      post.comments.push(comment);

      // Notification
      inAppNotifications.unshift({
        id: `notif_${Date.now()}`,
        userId: currentUser.id,
        title: `💬 New Reply in ${circle.name}`,
        message: `${comment.authorName} replied to "${post.title.substring(0, 30)}..."`,
        type: 'COMMENT',
        read: false,
        createdAt: new Date().toISOString(),
        linkTab: 'community',
      });

      return res.json({ success: true, comment });
    }
  }

  res.status(404).json({ error: 'Post not found' });
});

app.post('/api/communities/posts/:postId/support', (req, res) => {
  const { postId } = req.params;
  for (const circle of communityCircles) {
    const post = circle.posts.find((p) => p.id === postId);
    if (post) {
      const supporters = communityPostSupporters.get(postId) || [];
      const supporterIndex = supporters.indexOf(currentUser.id);
      if (supporterIndex >= 0) {
        supporters.splice(supporterIndex, 1);
      } else {
        supporters.push(currentUser.id);
      }
      communityPostSupporters.set(postId, supporters);
      post.supports = supporters.length;
      return res.json({ success: true, post: { ...post, userSupported: supporters.includes(currentUser.id) } });
    }
  }
  res.status(404).json({ error: 'Post not found' });
});

// 8. Admin Portal: Moderation, Abuse Reports, Analytics, Account Ban/Freeze
app.get('/api/admin/reports', (req, res) => {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can view safety reports.' });
  }
  res.json({ success: true, reports: moderationReports });
});

app.post('/api/admin/reports/:id/action', (req, res) => {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can execute moderation actions.' });
  }
  const { id } = req.params;
  const { action, reason } = req.body; // 'WARN', 'SUSPEND', 'BAN', 'RESOLVE', 'REINSTATE'

  const report = moderationReports.find((r) => r.id === id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const targetUser = usersDatabase.get(report.userId);

  if (action === 'BAN') {
    if (targetUser) {
      targetUser.status = 'BANNED';
      targetUser.statusReason = reason || 'Permanent ban due to severe platform abuse or terms breach.';
    }
    report.resolved = true;
    report.actionTaken = `User permanently banned by admin: ${targetUser?.statusReason}`;
  } else if (action === 'SUSPEND') {
    if (targetUser) {
      targetUser.status = 'SUSPENDED';
      targetUser.statusReason = reason || 'Account temporarily frozen pending compliance review.';
    }
    report.resolved = true;
    report.actionTaken = `Account locked/frozen: ${targetUser?.statusReason}`;
  } else if (action === 'WARN') {
    if (targetUser) {
      targetUser.status = 'WARNED';
      targetUser.statusReason = reason || 'Formal warning issued for abusive behavior.';
    }
    report.resolved = true;
    report.actionTaken = `Formal warning issued to user.`;
  } else if (action === 'REINSTATE') {
    if (targetUser) {
      targetUser.status = 'ACTIVE';
      targetUser.statusReason = undefined;
    }
    report.resolved = true;
    report.actionTaken = `User account restored to active status.`;
  } else if (action === 'RESOLVE') {
    report.resolved = true;
    report.actionTaken = 'Dismissed / Resolved without penalty after clinical review.';
  }

  res.json({ success: true, report, targetUser });
});

app.get('/api/admin/analytics', (req, res) => {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only administrators can view admin analytics.' });
  }
  const totalScores = checkIns.map((checkIn) => checkIn.score);
  const avgMood = totalScores.length ? (totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1) : '0';
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const memberUsers = Array.from(usersDatabase.values()).filter((user) => user.role === 'USER');
  const recentlyCheckedIn = new Set(
    checkIns.filter((checkIn) => Date.parse(checkIn.date) >= sevenDaysAgo).map((checkIn) => checkIn.userId)
  );
  const sentimentMessages = sessions.flatMap((session) => session.messages);
  const sentimentCount = (sentiment: NonNullable<ChatMessage['sentiment']>) =>
    sentimentMessages.filter((message) => message.sentiment === sentiment).length;

  const analytics: AdminAnalytics = {
    totalUsers: usersDatabase.size,
    activeCouples: memberUsers.filter(
      (user) => user.partnerConnected && user.partnerUserId && user.id.localeCompare(user.partnerUserId) < 0
    ).length,
    openReports: moderationReports.filter((r) => !r.resolved).length,
    averageMoodScore: parseFloat(avgMood),
    checkInCompletionRate: memberUsers.length
      ? Math.round((memberUsers.filter((user) => recentlyCheckedIn.has(user.id)).length / memberUsers.length) * 100)
      : 0,
    sentimentDistribution: {
      positive: sentimentCount('positive'),
      neutral: sentimentCount('neutral'),
      distress: sentimentCount('distress'),
      crisis: sentimentCount('crisis'),
    },
    topChallenges: Array.from(
      checkIns.flatMap((checkIn) => checkIn.feelings || []).reduce((counts, feeling) => {
        counts.set(feeling, (counts.get(feeling) || 0) + 1);
        return counts;
      }, new Map<string, number>())
    )
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4),
  };

  res.json({ success: true, analytics });
});

// ==========================================
// Vite Dev Middlewares or Production Static
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Haven Mental Health & Couples Sanctuary running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
