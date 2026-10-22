import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import * as store from '../models/store';
import type {
  UserProfile, ChatMessage, TherapySession, CheckInRecord, DiaryEntry, TherapeuticActivity,
  SharedStory, StoryComment, CommunityCircle, CommunitySuggestion, InAppNotification,
  AiCheckInSuggestion, ModerationReport, AdminAnalytics, AccountStatus
} from '../../types';
import { buildTherapySystemPrompt, evaluateSafetyGuardrails } from '../services/therapyService';

export function registerTherapyController(): express.Router {
  const router = express.Router();
  const {
    currentUser, requestContext, usersDatabase, userPasswords, authenticatedSessions,
    activityCompletions, storyInteractions, circleMemberships, communityPostSupporters,
    sessions, checkIns, diaryEntries, therapeuticActivities, sharedStories, communitySuggestions,
    inAppNotifications, communityCircles, moderationReports, ai, hashPassword, verifyPassword,
    setAuthCookie, readAuthCookie, storyForUser
  } = store;

  // 2. Therapy Sessions & Interactive Chat
  router.get('/api/therapy/sessions', (req, res) => {
    res.json({
      success: true,
      sessions: sessions.filter(
        (session) => session.userId === currentUser.id || session.partnerUserId === currentUser.id
      ),
    });
  });

  router.post('/api/therapy/chat', async (req, res) => {
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

      if (!ai) {
        return res.status(503).json({
          error: 'AI chat is not configured. Add a valid GEMINI_API_KEY to .env and restart the server.',
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
      }

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        sessionId: session.id,
        sender: session.userId === currentUser.id ? 'USER' : 'PARTNER',
        content: message,
        timestamp: new Date().toISOString(),
        sentiment: 'neutral',
      };

      const history = session.messages.slice(-12).map((priorMessage) => ({
        role: priorMessage.sender === 'AI' ? 'model' as const : 'user' as const,
        parts: [{
          text: priorMessage.sender === 'AI'
            ? priorMessage.content
            : `${priorMessage.sender === 'USER' ? currentUser.name : currentUser.partnerName || 'Partner'}: ${priorMessage.content}`,
        }],
      }));
      history.push({
        role: 'user',
        parts: [{
          text: `${userMsg.sender === 'USER' ? currentUser.name : currentUser.partnerName || 'Partner'}: ${message}`,
        }],
      });

      let aiText: string;
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: history,
          config: {
            systemInstruction: `${buildTherapySystemPrompt(mode as 'INDIVIDUAL' | 'COUPLE', currentUser)}

  CONVERSATION REQUIREMENTS:
  - Read and respond directly to the latest message, using relevant details from the conversation history.
  - Do not repeat your opening or ask the same question again if it has already been answered.
  - If the user answers a previous question, acknowledge that answer and build on it.
  - Ask at most one focused follow-up question, and only when it helps move this conversation forward.`,
            temperature: 0.65,
            maxOutputTokens: 512,
          },
        });
        aiText = response.text?.trim() || '';
      } catch (error) {
        console.error('Gemini therapy response failed:', error);
        return res.status(502).json({
          error: 'The AI could not complete its reply. Your message was not saved; please try again.',
        });
      }

      if (!aiText) {
        return res.status(502).json({
          error: 'The AI returned an empty reply. Your message was not saved; please try again.',
        });
      }

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        sessionId: session.id,
        sender: 'AI',
        content: aiText,
        timestamp: new Date().toISOString(),
        sentiment: 'positive',
      };
      session.messages.push(userMsg);
      session.messages.push(aiMsg);
      if (!sessions.includes(session)) sessions.unshift(session);

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

  return router;
}
