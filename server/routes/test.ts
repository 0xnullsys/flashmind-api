import { Router, Request, Response } from 'express';
import multer from 'multer';
import { optionalAuth, authMiddleware } from '../auth.js';
import { generateCards } from '../ai.js';
import { rateLimit } from '../rateLimit.js';
import { addTrace } from '../db.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      cb(new Error('File harus gambar'));
      return;
    }
    cb(null, true);
  },
});

// ponytail: multer.any() parses multipart; JSON body still works via express.json()
// Vercel serverless supports multer memory storage (no temp files)
router.post(
  '/',
  rateLimit('test'),
  upload.any(),
  async (req: Request, res: Response) => {
    try {
      // ponytail: accept both JSON body and multipart. Files forwarded to HF Space if present.
      const catatan = (req.body?.catatan as string) || '';
      const files = (req.files as Express.Multer.File[] | undefined) || [];

      if (!catatan && files.length === 0) {
        res.status(400).json({ error: 'Wajib diisi' });
        return;
      }

      // ponytail: forward text+files to HF Space via CF Worker proxy
      const cards = await generateCards(catatan, files);

      if (req.user) {
        await addTrace('pengunjung_berakun', req.user.id, 'test_ai', '/api/test', { cardCount: cards.length });
      } else if (req.guest) {
        await addTrace('tamu_penguji', req.guest.id, 'test_ai', '/api/test', { cardCount: cards.length });
      }

      res.json({ cards });
    } catch (err: any) {
      console.error('AI test error:', err);

      if (err.message?.includes('HF_SPACE_ID') || err.message?.includes('CF_PROXY_URL')) {
        res.status(503).json({ error: 'Fitur AI belum dikonfigurasi' });
        return;
      }

      if (err.message?.includes('tidak valid') || err.message?.includes('tidak dikenal')) {
        res.status(422).json({ error: 'AI gagal membuat kartu' });
        return;
      }

      res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
  }
);

export default router;