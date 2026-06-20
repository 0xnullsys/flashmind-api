import { Router, Request, Response } from 'express';
import { supabase, addTrace } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /api/users - profil sendiri
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('pengunjung_berakun')
      .select('id, nama_depan, nama_belakang, surel, jenis_kelamin, catatan, dibuat_pada')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        firstName: user.nama_depan,
        lastName: user.nama_belakang,
        email: user.surel,
        gender: user.jenis_kelamin,
        notes: user.catatan || '',
        createdAt: user.dibuat_pada,
      },
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// PATCH /api/users - update profil/catatan
router.patch('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, notes } = req.body;
    const updates: Record<string, unknown> = {};

    if (firstName !== undefined) updates.nama_depan = firstName;
    if (lastName !== undefined) updates.nama_belakang = lastName;
    if (notes !== undefined) updates.catatan = notes;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'Tidak ada data untuk diupdate' });
      return;
    }

    const { error: updateError } = await supabase
      .from('pengunjung_berakun')
      .update(updates)
      .eq('id', req.user!.id);

    if (updateError) throw updateError;

    await addTrace('pengunjung_berakun', req.user!.id, 'profile_update', '/api/users', { updates: Object.keys(updates) });

    res.json({ ok: true });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

export default router;