import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import * as store from '../models/store';
import type {
  UserProfile, ChatMessage, TherapySession, CheckInRecord, DiaryEntry, TherapeuticActivity,
  SharedStory, StoryComment, CommunityCircle, CommunitySuggestion, InAppNotification,
  AiCheckInSuggestion, ModerationReport, AdminAnalytics, AccountStatus
} from '../../types';
import { buildTherapySystemPrompt, evaluateSafetyGuardrails } from '../services/therapyService';

export function registerAdminController(): express.Router {
  const router = express.Router();
  const {
    currentUser, requestContext, usersDatabase, userPasswords, authenticatedSessions,
    activityCompletions, storyInteractions, circleMemberships, communityPostSupporters,
    sessions, checkIns, diaryEntries, therapeuticActivities, sharedStories, communitySuggestions,
    inAppNotifications, communityCircles, moderationReports, ai, hashPassword, verifyPassword,
    setAuthCookie, readAuthCookie, storyForUser
  } = store;

  // 8. Admin Portal: Moderation, Abuse Reports, Analytics, Account Ban/Freeze
  router.get('/api/admin/reports', (req, res) => {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: Only administrators can view safety reports.' });
    }
    res.json({ success: true, reports: moderationReports });
  });

  router.post('/api/admin/reports/:id/action', (req, res) => {
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

  router.get('/api/admin/analytics', (req, res) => {
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

  return router;
}
