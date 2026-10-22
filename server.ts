import { startServer } from './src/server/app';

startServer().catch((error) => {
  console.error('Failed to start server:', error);
});
