import { Router, Request, Response } from 'express';
import { supabase } from '../db.js';
import { adminAuth } from '../auth.js';

const router = Router();

// GET /api/v0/stats
router.get('/stats', adminAuth, async (_req: Request, res: Response) => {
  try {
    const { count: userCount, error: userErr } = await supabase
      .from('pengunjung_berakun')
      .select('*', { count: 'exact', head: true });

    const { count: guestCount, error: guestErr } = await supabase
      .from('tamu_penguji')
      .select('*', { count: 'exact', head: true });

    const { count: cardCount, error: cardErr } = await supabase
      .from('kartu_belajar')
      .select('*', { count: 'exact', head: true });

    // Get latest users with traces for latest traces
    const { data: userTraces } = await supabase
      .from('pengunjung_berakun')
      .select('id, jejak, dibuat_pada')
      .not('jejak', 'eq', '[]')
      .order('dibuat_pada', { ascending: false })
      .limit(5);

    const { data: guestTraces } = await supabase
      .from('tamu_penguji')
      .select('id, jejak, dibuat_pada')
      .not('jejak', 'eq', '[]')
      .order('dibuat_pada', { ascending: false })
      .limit(5);

    // Extract latest traces from each row
    const latestTraces: Array<{ tabel: string; acara: string; rute: string; pada: string; meta: Record<string, unknown> }> = [];
    for (const row of (userTraces || [])) {
      const jejak = row.jejak as any[];
      if (jejak && jejak.length > 0) {
        const last = jejak[jejak.length - 1];
        latestTraces.push({
          tabel: 'pengunjung_berakun',
          acara: last.acara || '',
          rute: last.rute || '',
          pada: last.pada || row.dibuat_pada,
          meta: last.meta || {},
        });
      }
    }
    for (const row of (guestTraces || [])) {
      const jejak = row.jejak as any[];
      if (jejak && jejak.length > 0) {
        const last = jejak[jejak.length - 1];
        latestTraces.push({
          tabel: 'tamu_penguji',
          acara: last.acara || '',
          rute: last.rute || '',
          pada: last.pada || row.dibuat_pada,
          meta: last.meta || {},
        });
      }
    }

    // Sort by date descending and take top 10
    latestTraces.sort((a, b) => new Date(b.pada).getTime() - new Date(a.pada).getTime());

    res.json({
      stats: {
        totalUsers: userCount || 0,
        totalGuests: guestCount || 0,
        totalCards: cardCount || 0,
      },
      latestTraces: latestTraces.slice(0, 10),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// GET /api/v0/users
router.get('/users', adminAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('pengunjung_berakun')
      .select('id, nama_depan, nama_belakang, surel, jenis_kelamin, dibuat_pada')
      .order('dibuat_pada', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({
      users: (data || []).map((r: any) => ({
        id: r.id,
        firstName: r.nama_depan,
        lastName: r.nama_belakang,
        email: r.surel,
        gender: r.jenis_kelamin,
        createdAt: r.dibuat_pada,
      })),
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// GET /api/v0/guests
router.get('/guests', adminAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('tamu_penguji')
      .select('id, ip_address, dibuat_pada')
      .order('dibuat_pada', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({
      guests: (data || []).map((r: any) => ({
        id: r.id,
        ip: r.ip_address,
        createdAt: r.dibuat_pada,
      })),
    });
  } catch (err) {
    console.error('Admin guests error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// GET /api/v0/flashcards
router.get('/flashcards', adminAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('kartu_belajar')
      .select('id, id_pengguna, judul, catatan, sumber, dibuat_pada')
      .order('dibuat_pada', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Also fetch user names for each card
    const userIds = [...new Set((data || []).map((r: any) => r.id_pengguna))];
    const { data: users } = await supabase
      .from('pengunjung_berakun')
      .select('id, nama_depan, nama_belakang, surel')
      .in('id', userIds);

    const userMap: Record<string, any> = {};
    for (const u of (users || [])) {
      userMap[u.id] = u;
    }

    res.json({
      cards: (data || []).map((r: any) => ({
        id: r.id,
        userId: r.id_pengguna,
        title: r.judul,
        notes: r.catatan,
        source: r.sumber,
        createdAt: r.dibuat_pada,
        user: {
          firstName: userMap[r.id_pengguna]?.nama_depan || '',
          lastName: userMap[r.id_pengguna]?.nama_belakang || '',
          email: userMap[r.id_pengguna]?.surel || '',
        },
      })),
    });
  } catch (err) {
    console.error('Admin flashcards error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

export default router;