# Server architecture

The server is split into a small set of responsibilities:

- `app.ts` assembles Express, middleware, API controllers, and the Vite/static frontend.
- `controllers/` maps HTTP endpoints to application behavior, grouped by feature.
- `models/store.ts` owns the persisted application state and account/session storage.
- `middleware/authentication.ts` resolves authenticated users and persists state after API requests.
- `services/therapyService.ts` contains therapy-specific safety checks and prompt construction.
- `server.ts` is the process entry point.

The React components under `src/components/` remain the views and use `src/services/api.ts`
to communicate with these endpoints. Route paths and response shapes remain unchanged so
existing clients and saved data continue to work.
