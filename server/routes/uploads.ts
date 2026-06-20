import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authMiddleware } from '../auth.js';
import { rateLimit } from '../rateLimit.js';
import { addTrace } from '../db.js';

const router = Router();

// ponytail: in-memory upload; multer never writes to disk in serverless
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      cb(new Error('File harus gambar'));
      return;
    }
    cb(null, true);
  },
});

// ponytail: configure once at module load (env vars set by Vercel)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// POST /api/uploads - upload image to Cloudinary, return URL
router.post(
  '/',
  rateLimit('upload'),
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'File wajib diisi' });
        return;
      }

      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        res.status(503).json({ error: 'Cloudinary belum dikonfigurasi' });
        return;
      }

      // ponytail: stream buffer via data URI (works in serverless where no temp files)
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'flashmind',
        resource_type: 'image',
        // ponytail: f_auto+q_auto applied on upload via eager; subsequent URLs use it for free
        eager: [{ fetch_format: 'auto', quality: 'auto' }],
      });

      await addTrace('pengunjung_berakun', req.user!.id, 'image_upload', '/api/uploads', {
        publicId: result.public_id,
        bytes: result.bytes,
      });

      res.json({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Upload gagal' });
    }
  }
);

export default router;
