import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import * as store from '../models/store';
import type {
  UserProfile, ChatMessage, TherapySession, CheckInRecord, DiaryEntry, TherapeuticActivity,
  SharedStory, StoryComment, CommunityCircle, CommunitySuggestion, InAppNotification,
  AiCheckInSuggestion, ModerationReport, AdminAnalytics, AccountStatus
} from '../../types';
import { buildTherapySystemPrompt, evaluateSafetyGuardrails } from '../services/therapyService';

export function registerCommunityController(): express.Router {
  const router = express.Router();
  const {
    currentUser, requestContext, usersDatabase, userPasswords, authenticatedSessions,
    activityCompletions, storyInteractions, circleMemberships, communityPostSupporters,
    sessions, checkIns, diaryEntries, therapeuticActivities, sharedStories, communitySuggestions,
    inAppNotifications, communityCircles, moderationReports, ai, hashPassword, verifyPassword,
    setAuthCookie, readAuthCookie, storyForUser
  } = store;

  // 6. Shared Problem Stories
  router.get('/api/stories', (req, res) => {
    res.json({ success: true, stories: sharedStories.map((story) => storyForUser(story, currentUser.id)) });
  });

  router.post('/api/stories', (req, res) => {
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

  router.post('/api/stories/:id/support', (req, res) => {
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
  router.post('/api/stories/:id/join', (req, res) => {
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
  router.post('/api/stories/:id/comments', (req, res) => {
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
  router.get('/api/communities', (req, res) => {
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
  router.post('/api/communities/:circleId/join', (req, res) => {
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
  router.post('/api/communities/admin-create-circle', (req, res) => {
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
  router.post('/api/communities/suggest', (req, res) => {
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
  router.get('/api/admin/community-suggestions', (req, res) => {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: Only administrators can view community suggestions.' });
    }
    res.json({ success: true, suggestions: communitySuggestions });
  });

  router.post('/api/admin/community-suggestions/:id/review', (req, res) => {
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
  router.get('/api/notifications', (req, res) => {
    const userNotifications = inAppNotifications.filter(
      (n) => n.userId === currentUser.id || n.userId === 'all'
    );
    res.json({ success: true, notifications: userNotifications });
  });

  router.post('/api/notifications/:id/read', (req, res) => {
    const { id } = req.params;
    const notif = inAppNotifications.find((n) => n.id === id);
    if (notif) notif.read = true;
    res.json({ success: true });
  });

  router.post('/api/notifications/clear', (req, res) => {
    inAppNotifications.splice(0, inAppNotifications.length, ...inAppNotifications.filter((n) => n.userId !== currentUser.id));
    res.json({ success: true });
  });

  router.post('/api/communities/:circleId/posts', (req, res) => {
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

  router.post('/api/communities/posts/:postId/comments', (req, res) => {
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

  router.post('/api/communities/posts/:postId/support', (req, res) => {
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

  return router;
}
