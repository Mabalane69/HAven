import type { Express } from 'express';
import { authenticatedSessions, currentUser, persistState, readAuthCookie, requestContext, usersDatabase } from '../models/store';

export function registerAuthenticationMiddleware(app: Express): void {
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
}
