# FlashMind

Platform kartu belajar bertenaga AI. Ubah catatan Anda menjadi kartu tanya/jawab terstruktur.

> Butuh dokumentasi lengkap, arsitektur, dan panduan pengembangan? Pindah ke branch `dev`.

## Mulai Cepat

Butuh **Node.js 20+**.

```bash
# 1. Clone
git clone https://github.com/0xnullsys/flashmind-api.git
cd flashmind-api

# 2. Install
npm install

# 3. Konfigurasi
cp .env.example .env
# Isi .env dengan nilai Anda (Supabase URL/key, Cloudinary, token HF Space, dll.)
# Lihat komentar di .env.example untuk penjelasan setiap variabel.

# 4. Jalankan server development (frontend + API dengan hot reload)
npm run dev
```

Untuk build produksi (bundle frontend saja — backend berjalan sebagai Vercel serverless):

```bash
npm run build:prod   # output di dist/
```

## Yang Anda butuhkan di `.env`

Minimum agar bisa jalan:

| Var | Fungsi |
| --- | --- |
| `SUPABASE_URL` | URL proyek Supabase Anda |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase (hanya sisi server) |
| `SESSION_SECRET` | String random 32+ karakter untuk penandaan cookie |

Untuk fitur lengkap (kartu AI, upload gambar), lihat komentar di `.env.example`.

## Deployment

Repo ini di-deploy ke Vercel. Frontend di-build dari `index.html` + `src/`,
dan API berjalan sebagai satu fungsi serverless dari `index.ts`. Push ke `main`
dan Vercel akan build serta deploy otomatis jika sudah terhubung.

## Branch

- **`main`** — kode siap produksi. Yang Anda clone sekarang.
- **`dev`** — pengembangan aktif, termasuk skrip uji, fixture, dan dokumentasi lengkap.

## Lisensi

[MIT](./LICENSE) © 2026 0xnullsys@github
