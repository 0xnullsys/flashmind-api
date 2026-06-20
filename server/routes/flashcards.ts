import { Router, Request, Response } from 'express';
import { supabase, addTrace } from '../db.js';
import { authMiddleware } from '../auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/flashcards - daftar kartu sendiri
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    let data: any[] | null = null;
    let error: any = null;
    const res1 = await supabase
      .from('kartu_belajar')
      .select('id, id_pengguna, judul, catatan, lampiran, sumber, kategori, dibuat_pada')
      .eq('id_pengguna', req.user!.id)
      .order('dibuat_pada', { ascending: false });
    data = res1.data;
    error = res1.error;

    // ponytail: fall back if kategori column not yet added to DB
    if (error && error.code === '42703') {
      const res2 = await supabase
        .from('kartu_belajar')
        .select('id, id_pengguna, judul, catatan, lampiran, sumber, dibuat_pada')
        .eq('id_pengguna', req.user!.id)
        .order('dibuat_pada', { ascending: false });
      data = res2.data;
      error = res2.error;
    }

    if (error) throw error;

    const cards = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.id_pengguna,
      title: row.judul,
      notes: row.catatan,
      attachments: row.lampiran || [],
      source: row.sumber,
      category: row.kategori || null,
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
    const { title, notes, attachments, source, category } = req.body;

    if (!title || !notes) {
      res.status(400).json({ error: 'Wajib diisi' });
      return;
    }

    // Validate attachments (URLs or paths stored in DB; size check skipped for URLs)
    if (attachments && Array.isArray(attachments)) {
      if (attachments.length > 5) {
        res.status(400).json({ error: 'Maksimal 5 lampiran' });
        return;
      }
    }

    const cardId = uuidv4();
    const insertRow: Record<string, unknown> = {
      id: cardId,
      id_pengguna: req.user!.id,
      judul: title,
      catatan: notes,
      lampiran: attachments || [],
      sumber: source || 'manual',
    };
    // ponytail: include kategori only if column exists; Supabase will 400 otherwise
    if (category && typeof category === 'string' && category.trim()) {
      insertRow.kategori = category.trim();
    }

    let insertError: any = null;
    // ponytail: try with kategori first; if column missing (42703), fall back without it
    const { error: err1 } = await supabase
      .from('kartu_belajar')
      .insert(insertRow);
    insertError = err1;

    if (insertError && insertError.code === '42703' && insertRow.kategori) {
      console.warn('kategori column missing, falling back to insert without it');
      const { kategori, ...withoutKategori } = insertRow;
      const { error: err2 } = await supabase
        .from('kartu_belajar')
        .insert(withoutKategori);
      insertError = err2;
    }

    if (insertError) {
      console.error('Create flashcard insertError:', JSON.stringify(insertError));
      throw insertError;
    }

    await addTrace('pengunjung_berakun', req.user!.id, 'card_create', '/api/flashcards', { cardId, category: insertRow.kategori });

    res.status(201).json({
      card: {
        id: cardId,
        userId: req.user!.id,
        title,
        notes,
        attachments: attachments || [],
        source: source || 'manual',
        category: insertRow.kategori || null,
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