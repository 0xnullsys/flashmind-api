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
      // ponytail: accept both JSON body and multipart. Files uploaded from client or
      // referenced by Cloudinary URL; CF Worker forwards all to HF Space.
      const catatan = (req.body?.catatan as string) || '';
      const fileUrls = (req.body?.fileUrls as string[] | undefined) || [];
      const multipartFiles = (req.files as Express.Multer.File[] | undefined) || [];

      if (!catatan && multipartFiles.length === 0 && fileUrls.length === 0) {
        res.status(400).json({ error: 'Wajib diisi' });
        return;
      }

      // ponytail: hard cap 5 images; AI OCR + category detect degrade past that
      if (multipartFiles.length + fileUrls.length > 5) {
        res.status(400).json({ error: 'Maksimal 5 lampiran' });
        return;
      }

      // ponytail: download URLs into multer-style file objects so HF upload path stays uniform
      const downloadedFiles: Array<{ buffer: Buffer; mimetype: string; originalname: string }> = [];
      for (const url of fileUrls.slice(0, 5)) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const ab = await r.arrayBuffer();
          downloadedFiles.push({
            buffer: Buffer.from(ab),
            mimetype: r.headers.get('content-type') || 'image/jpeg',
            originalname: url.split('/').pop() || 'remote.jpg',
          });
        } catch (err) {
          console.error('Failed to download image URL:', url, err);
        }
      }

      const cards = await generateCards(catatan, [...multipartFiles, ...downloadedFiles]);

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