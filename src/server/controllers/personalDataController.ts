import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import * as store from '../models/store';
import type {
  UserProfile, ChatMessage, TherapySession, CheckInRecord, DiaryEntry, TherapeuticActivity,
  SharedStory, StoryComment, CommunityCircle, CommunitySuggestion, InAppNotification,
  AiCheckInSuggestion, ModerationReport, AdminAnalytics, AccountStatus
} from '../../types';
import { buildTherapySystemPrompt, evaluateSafetyGuardrails } from '../services/therapyService';

export function registerPersonalDataController(): express.Router {
  const router = express.Router();
  const {
    currentUser, requestContext, usersDatabase, userPasswords, authenticatedSessions,
    activityCompletions, storyInteractions, circleMemberships, communityPostSupporters,
    sessions, checkIns, diaryEntries, therapeuticActivities, sharedStories, communitySuggestions,
    inAppNotifications, communityCircles, moderationReports, ai, hashPassword, verifyPassword,
    setAuthCookie, readAuthCookie, storyForUser
  } = store;

  // 4. Confidential Encrypted Diary
  router.get('/api/diary', (req, res) => {
    // Returns client's diary entries. Admin NEVER has access to raw decrypted diaries.
    const userDiaries = diaryEntries.filter((d) => d.userId === currentUser.id);
    res.json({ success: true, entries: userDiaries });
  });

  router.post('/api/diary', (req, res) => {
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

  router.delete('/api/diary/:id', (req, res) => {
    const { id } = req.params;
    diaryEntries.splice(0, diaryEntries.length, ...diaryEntries.filter((d) => !(d.id === id && d.userId === currentUser.id)));
    res.json({ success: true });
  });

  // 5. Therapeutic Guided Activities
  router.get('/api/activities', (req, res) => {
    const completions = activityCompletions.get(currentUser.id) || {};
    const activities = therapeuticActivities.map((activity) => ({
      ...activity,
      completedCount: completions[activity.id]?.count || 0,
      lastCompleted: completions[activity.id]?.lastCompleted,
    }));
    res.json({ success: true, activities });
  });

  router.post('/api/activities/:id/complete', (req, res) => {
    const { id } = req.params;
    const activity = therapeuticActivities.find((a) => a.id === id);
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });
    const completions = activityCompletions.get(currentUser.id) || {};
    const lastCompleted = new Date().toISOString();
    completions[id] = { count: (completions[id]?.count || 0) + 1, lastCompleted };
    activityCompletions.set(currentUser.id, completions);
    res.json({ success: true, activity: { ...activity, ...completions[id] } });
  });

  return router;
}
