import type { UserProfile } from '../../types';

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

export interface SafetyCheckResult {
  isSafe: boolean;
  isCrisis: boolean;
  isAbuse: boolean;
  reason?: string;
  responseMessage?: string;
}

export function evaluateSafetyGuardrails(text: string): SafetyCheckResult {
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
export function buildTherapySystemPrompt(mode: 'INDIVIDUAL' | 'COUPLE', user: UserProfile): string {
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

// ==========================================
