import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import * as store from '../models/store';
import type {
  UserProfile, ChatMessage, TherapySession, CheckInRecord, DiaryEntry, TherapeuticActivity,
  SharedStory, StoryComment, CommunityCircle, CommunitySuggestion, InAppNotification,
  AiCheckInSuggestion, ModerationReport, AdminAnalytics, AccountStatus
} from '../../types';
import { buildTherapySystemPrompt, evaluateSafetyGuardrails } from '../services/therapyService';

export function registerAuthController(): express.Router {
  const router = express.Router();
  const {
    currentUser, requestContext, usersDatabase, userPasswords, authenticatedSessions,
    activityCompletions, storyInteractions, circleMemberships, communityPostSupporters,
    sessions, checkIns, diaryEntries, therapeuticActivities, sharedStories, communitySuggestions,
    inAppNotifications, communityCircles, moderationReports, ai, hashPassword, verifyPassword,
    setAuthCookie, readAuthCookie, storyForUser
  } = store;

  // 0. Authentication Routes (Sign-Up, Login, Logout, Session)
  router.post('/api/auth/signup', (req, res) => {
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

  router.post('/api/auth/login', (req, res) => {
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

  router.post('/api/auth/logout', (req, res) => {
    const sessionId = readAuthCookie(req);
    if (sessionId) authenticatedSessions.delete(sessionId);
    res.setHeader('Set-Cookie', 'haven_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ success: true });
  });

  router.get('/api/auth/me', (req, res) => {
    const user = requestContext.getStore()?.user || null;
    res.json({ success: true, user });
  });

  // 1. User Profile & Preferences
  router.get('/api/profile', (req, res) => {
    if (!currentUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ success: true, profile: currentUser });
  });

  router.put('/api/profile', (req, res) => {
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

  router.post('/api/profile/pair', (req, res) => {
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

  router.get('/api/admin/users', (req, res) => {
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: Only administrators can view accounts.' });
    }
    const users = Array.from(usersDatabase.values()).map(({ id, name, email, role, status }) => ({
      id, name, email, role, status,
    }));
    res.json({ success: true, users });
  });

  router.put('/api/admin/users/:id/role', (req, res) => {
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

  return router;
}
