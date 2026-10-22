import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import * as store from '../models/store';
import type {
  UserProfile, ChatMessage, TherapySession, CheckInRecord, DiaryEntry, TherapeuticActivity,
  SharedStory, StoryComment, CommunityCircle, CommunitySuggestion, InAppNotification,
  AiCheckInSuggestion, ModerationReport, AdminAnalytics, AccountStatus
} from '../../types';
import { buildTherapySystemPrompt, evaluateSafetyGuardrails } from '../services/therapyService';

export function registerWellnessController(): express.Router {
  const router = express.Router();
  const {
    currentUser, requestContext, usersDatabase, userPasswords, authenticatedSessions,
    activityCompletions, storyInteractions, circleMemberships, communityPostSupporters,
    sessions, checkIns, diaryEntries, therapeuticActivities, sharedStories, communitySuggestions,
    inAppNotifications, communityCircles, moderationReports, ai, hashPassword, verifyPassword,
    setAuthCookie, readAuthCookie, storyForUser
  } = store;

  // 3. Daily Check-Ins & Wellness Analytics
  router.get('/api/check-ins', (req, res) => {
    res.json({ success: true, checkIns: checkIns.filter((checkIn) => checkIn.userId === currentUser.id) });
  });

  router.post('/api/check-ins', (req, res) => {
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
  router.post('/api/check-ins/ai-suggest', async (req, res) => {
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

  return router;
}
