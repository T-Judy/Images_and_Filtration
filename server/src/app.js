import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { MEDIA_ROOT, MEDIA_URL, CLIENT_DIST } from './config.js';
import effectsRouter from './routes/effects.js';

export function createApp() {
  const app = express();

  app.use(helmet()); // security headers

  // static
  app.use(MEDIA_URL.replace(/\/$/, ''), express.static(MEDIA_ROOT, { index: false }));

  app.use('/api/effects', effectsRouter);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // If `npm run build` has been run in /client, serve the React app too.
  // In development you use will want the Vite dev server instead, which should proxy /api and /media here.
  if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^\/(?!api\/|media\/).*/, (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  // Don't let the user know what internals went wrong on a 500 call
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
