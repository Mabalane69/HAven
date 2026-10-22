import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { registerAdminController } from './controllers/adminController';
import { registerAuthController } from './controllers/authController';
import { registerCommunityController } from './controllers/communityController';
import { registerPersonalDataController } from './controllers/personalDataController';
import { registerTherapyController } from './controllers/therapyController';
import { registerWellnessController } from './controllers/wellnessController';
import { registerAuthenticationMiddleware } from './middleware/authentication';

export async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());
  registerAuthenticationMiddleware(app);
  app.use(registerAuthController());
  app.use(registerTherapyController());
  app.use(registerWellnessController());
  app.use(registerPersonalDataController());
  app.use(registerCommunityController());
  app.use(registerAdminController());

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Haven Mental Health & Couples Sanctuary running on http://0.0.0.0:${port}`);
  });
}
