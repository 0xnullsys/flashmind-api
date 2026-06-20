import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { supabase } from './supabase.js';
import { hashPassword } from './auth.js';
import { v4 as uuidv4 } from 'uuid';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import flashcardRoutes from './routes/flashcards.js';
import testRoutes from './routes/test.js';
import v0Routes from './routes/v0.js';

const app = express();

// CORS for dev
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : false
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/test', testRoutes);
app.use('/api/v0', v0Routes);

// Seed admin if configured and DB is empty
async function seedAdmin() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) return;

    const { data: existing } = await supabase
      .from('sudo_admin')
      .select('id')
      .limit(1)
      .single();

    if (existing) return;

    const passwordHash = await hashPassword(adminPassword);
    const apiKey = uuidv4().replace(/-/g, '');

    const { error: insertError } = await supabase
      .from('sudo_admin')
      .insert({
        nama_pengguna: adminUsername,
        sandi_hash: passwordHash,
        kunci_api: apiKey,
      });

    if (insertError) throw insertError;

    console.log(`Admin seeded: username=${adminUsername}, apiKey=${apiKey}`);
  } catch (err) {
    // Table might not exist yet, ignore
    console.error('Admin seed error (ignored):', err);
  }
}

seedAdmin();

export default app;