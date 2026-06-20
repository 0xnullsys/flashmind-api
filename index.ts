export const config = {
  api: {
    bodyParser: false,
  },
};

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import authRoutes from './server/routes/auth.js';
import userRoutes from './server/routes/users.js';
import flashcardRoutes from './server/routes/flashcards.js';
import testRoutes from './server/routes/test.js';
import v0Routes from './server/routes/v0.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// API routes (full path because Vercel passes full URL to handler)
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/test', testRoutes);
app.use('/api/v0', v0Routes);

// Static files from Vite build (dist/)
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  // SPA fallback: serve index.html for non-API paths
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

export default app;