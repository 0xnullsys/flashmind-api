import { Router, Request, Response } from 'express';
import { supabase, addTrace } from '../db.js';
import { authMiddleware } from '../auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/flashcards - daftar kartu sendiri
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('kartu_belajar')
      .select('id, id_pengguna, judul, catatan, lampiran, sumber, dibuat_pada')
      .eq('id_pengguna', req.user!.id)
      .order('dibuat_pada', { ascending: false });

    if (error) throw error;

    const cards = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.id_pengguna,
      title: row.judul,
      notes: row.catatan,
      attachments: row.lampiran || [],
      source: row.sumber,
      createdAt: row.dibuat_pada,
    }));

    res.json({ cards });
  } catch (err) {
    console.error('Get flashcards error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// POST /api/flashcards - buat kartu
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, notes, attachments, source } = req.body;

    if (!title || !notes) {
      res.status(400).json({ error: 'Wajib diisi' });
      return;
    }

    // Validate attachments size (max 5 images, ~500KB total in base64)
    if (attachments && Array.isArray(attachments)) {
      if (attachments.length > 5) {
        res.status(400).json({ error: 'Maksimal 5 lampiran' });
        return;
      }
      const totalSize = attachments.reduce((sum: number, a: string) => sum + a.length, 0);
      if (totalSize > 500_000) {
        res.status(400).json({ error: 'Total ukuran lampiran terlalu besar' });
        return;
      }
    }

    const cardId = uuidv4();
    const { error: insertError } = await supabase
      .from('kartu_belajar')
      .insert({
        id: cardId,
        id_pengguna: req.user!.id,
        judul: title,
        catatan: notes,
        lampiran: attachments || [],
        sumber: source || 'manual',
      });

    if (insertError) throw insertError;

    await addTrace('pengunjung_berakun', req.user!.id, 'card_create', '/api/flashcards', { cardId });

    res.status(201).json({
      card: {
        id: cardId,
        userId: req.user!.id,
        title,
        notes,
        attachments: attachments || [],
        source: source || 'manual',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Create flashcard error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// DELETE /api/flashcards/:id - hapus kartu sendiri
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('kartu_belajar')
      .delete()
      .eq('id', req.params.id)
      .eq('id_pengguna', req.user!.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      res.status(404).json({ error: 'Kartu tidak ditemukan' });
      return;
    }

    await addTrace('pengunjung_berakun', req.user!.id, 'card_delete', `/api/flashcards/${req.params.id}`, { cardId: req.params.id });

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete flashcard error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

export default router;