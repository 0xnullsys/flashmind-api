import { Router, Request, Response } from 'express';
import { supabase, addTrace } from '../db.js';
import { signToken, hashPassword, comparePassword } from '../auth.js';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit } from '../rateLimit.js';

const router = Router();

// POST /api/auth/guest - Buat sesi tamu
// ponytail: rate-limit + dedupe by IP within 60s to prevent spam clicks hammering the DB.
router.post('/guest', rateLimit('guest'), async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || '0.0.0.0';

    // Dedupe: reuse the most recent guest row from same IP created in last 60s.
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: existing } = await supabase
      .from('tamu_penguji')
      .select('id, jejak')
      .eq('ip_address', ip)
      .gte('dibuat_pada', cutoff)
      .order('dibuat_pada', { ascending: false })
      .limit(1)
      .maybeSingle();

    let guestId: string;
    if (existing) {
      guestId = existing.id;
    } else {
      guestId = uuidv4();
      const { error: insertError } = await supabase
        .from('tamu_penguji')
        .insert({
          id: guestId,
          ip_address: ip,
          jejak: [{
            acara: 'guest_created',
            rute: '/api/auth/guest',
            pada: new Date().toISOString(),
            meta: {},
          }],
        });

      if (insertError) throw insertError;
    }

    const token = signToken(guestId, 'guest');

    res.cookie('fm_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ ok: true, role: 'guest' });
  } catch (err) {
    console.error('Guest creation error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, gender, password } = req.body;

    if (!firstName || !lastName || !email || !gender || !password) {
      res.status(400).json({ error: 'Wajib diisi' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Kata sandi minimal 8 karakter' });
      return;
    }

    const validGenders = ['male', 'female', 'other'];
    if (!validGenders.includes(gender)) {
      res.status(400).json({ error: 'Jenis kelamin tidak valid' });
      return;
    }

    const { data: existing } = await supabase
      .from('pengunjung_berakun')
      .select('id')
      .eq('surel', email)
      .single();

    if (existing) {
      res.status(409).json({ error: 'Surel sudah terdaftar' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    const { error: insertError } = await supabase
      .from('pengunjung_berakun')
      .insert({
        id: userId,
        nama_depan: firstName,
        nama_belakang: lastName,
        surel: email,
        jenis_kelamin: gender,
        sandi_hash: passwordHash,
        jejak: [{
          acara: 'register',
          rute: '/api/auth/register',
          pada: new Date().toISOString(),
          meta: {},
        }],
      });

    if (insertError) throw insertError;

    const token = signToken(userId, 'user');

    res.cookie('fm_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      ok: true,
      user: { id: userId, firstName, lastName, email, gender, notes: '' },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Wajib diisi' });
      return;
    }

    const { data: user, error: selectError } = await supabase
      .from('pengunjung_berakun')
      .select('id, nama_depan, nama_belakang, surel, jenis_kelamin, sandi_hash, catatan')
      .eq('surel', email)
      .single();

    if (selectError || !user) {
      res.status(401).json({ error: 'Tidak diizinkan' });
      return;
    }

    const valid = await comparePassword(password, user.sandi_hash);
    if (!valid) {
      res.status(401).json({ error: 'Tidak diizinkan' });
      return;
    }

    await addTrace('pengunjung_berakun', user.id, 'login', '/api/auth/login');

    const token = signToken(user.id, 'user');

    res.cookie('fm_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      ok: true,
      user: {
        id: user.id,
        firstName: user.nama_depan,
        lastName: user.nama_belakang,
        email: user.surel,
        gender: user.jenis_kelamin,
        notes: user.catatan || '',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.cookie('fm_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
  res.json({ ok: true });
});

// GET /api/auth/config - public config for client UI
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    googleEnabled: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
  });
});

// GET /api/auth/google
router.get('/google', (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  // ponytail: prefer explicit env var; in production default to the deployed callback path
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/auth/google/callback` : 'http://localhost:3001/api/auth/google/callback');

  if (!clientId) {
    res.status(501).json({ error: 'Google OAuth tidak dikonfigurasi' });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) {
      res.status(400).json({ error: 'Kode tidak ada' });
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      res.status(501).json({ error: 'Google OAuth tidak dikonfigurasi' });
      return;
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; id_token?: string };
    if (!tokenData.access_token) {
      res.status(400).json({ error: 'Gagal mendapatkan token' });
      return;
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userResponse.json() as {
      id: string;
      email: string;
      given_name?: string;
      family_name?: string;
    };

    if (!googleUser.email) {
      res.status(400).json({ error: 'Gagal mendapatkan info pengguna' });
      return;
    }

    // Upsert user using Supabase
    const { data: existing } = await supabase
      .from('pengunjung_berakun')
      .select('id, nama_depan, nama_belakang')
      .eq('surel', googleUser.email)
      .single();

    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      userId = uuidv4();
      await supabase
        .from('pengunjung_berakun')
        .insert({
          id: userId,
          nama_depan: googleUser.given_name || 'Pengguna',
          nama_belakang: googleUser.family_name || '',
          surel: googleUser.email,
          jenis_kelamin: 'other',
          sandi_hash: '',
          jejak: [{
            acara: 'register',
            rute: '/api/auth/google/callback',
            pada: new Date().toISOString(),
            meta: { provider: 'google' },
          }],
        });
    }

    await addTrace('pengunjung_berakun', userId, 'login', '/api/auth/google/callback', { provider: 'google' });

    const token = signToken(userId, 'user');

    res.cookie('fm_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect to frontend
    res.redirect('/');
  } catch (err) {
    console.error('Google callback error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

export default router;