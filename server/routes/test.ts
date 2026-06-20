import { Router, Request, Response } from 'express';
import { optionalAuth, authMiddleware } from '../auth.js';
import { generateCards } from '../ai.js';
import { rateLimit } from '../rateLimit.js';
import { addTrace } from '../db.js';

const router = Router();

// POST /api/test - preview kartu AI
router.post('/', rateLimit('test'), optionalAuth, async (req: Request, res: Response) => {
  try {
    const { catatan } = req.body;
    if (!catatan) {
      res.status(400).json({ error: 'Wajib diisi' });
      return;
    }

    const cards = await generateCards(catatan);

    // Add trace for users
    if (req.user) {
      await addTrace('pengunjung_berakun', req.user.id, 'test_ai', '/api/test', { cardCount: cards.length });
    } else if (req.guest) {
      await addTrace('tamu_penguji', req.guest.id, 'test_ai', '/api/test', { cardCount: cards.length });
    }

    res.json({ cards });
  } catch (err: any) {
    console.error('AI test error:', err);

    if (err.message?.includes('HF_SPACE_ID tidak dikonfigurasi') || err.message?.includes('AI tidak tersedia')) {
      res.status(503).json({ error: 'Fitur AI belum dikonfigurasi' });
      return;
    }

    if (err.message?.includes('tidak valid') || err.message?.includes('tidak dikenal')) {
      res.status(422).json({ error: 'AI gagal membuat kartu' });
      return;
    }

    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

export default router;