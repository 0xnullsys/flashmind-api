import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { supabase } from './supabase.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production-32chars!';

export interface SessionPayload {
  sub: string;
  role: 'user' | 'guest';
  iat: number;
  exp: number;
}

export function signToken(sub: string, role: 'user' | 'guest'): string {
  return jwt.sign(
    { sub, role, iat: Math.floor(Date.now() / 1000) },
    SESSION_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SESSION_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: 'user' };
      guest?: { id: string; role: 'guest' };
      admin?: { id: string; role: 'admin' };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.fm_session;
  if (!token) {
    res.status(401).json({ error: 'Tidak diizinkan' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ error: 'Tidak diizinkan' });
    return;
  }

  req.user = { id: payload.sub, role: 'user' };
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.fm_session;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      if (payload.role === 'user') {
        req.user = { id: payload.sub, role: 'user' };
      } else {
        req.guest = { id: payload.sub, role: 'guest' };
      }
    }
  }
  next();
}

export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({ error: 'Tidak diizinkan' });
    return;
  }

  const { data } = await supabase
    .from('sudo_admin')
    .select('id')
    .eq('kunci_api', apiKey)
    .single();

  if (!data) {
    res.status(401).json({ error: 'Tidak diizinkan' });
    return;
  }

  req.admin = { id: data.id, role: 'admin' };
  next();
}