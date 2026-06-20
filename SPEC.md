# FlashMind — SPEC

Tujuan: SPA pembelajaran kartu belajar. Catatan → kartu belajar. Ada uji coba tamu, pengguna berakun, dan admin via API key. AI utama dari Hugging Face Space `notes2anki`. Deploy ke Vercel.

---

## Stack (locked)

| Layer    | Pilihan                                                                 |
| -------- | ----------------------------------------------------------------------- |
| Frontend | Vite 5 + React 18 + TypeScript                                          |
| Backend  | Express 4 + TypeScript, Vercel serverless via `@vercel/node`            |
| DB       | PostgreSQL 16 (Neon)                                                    |
| AI       | Hugging Face Space `notes2anki` via `@gradio/client`; OpenAI opsional fallback |
| Auth     | JWT cookie `httpOnly`, `SameSite=Lax` + bcrypt                          |
| OAuth    | Google via `passport-google-oauth20` (opsional)                         |
| Deploy   | Vercel                                                                  |

---

## Scope MVP

### Tamu / uji coba
- Bisa buka landing.
- Bisa buat sesi tamu via `/api/auth/guest`.
- Bisa lihat demo flip card.
- Bisa preview AI via `/api/test`.
- **Tidak bisa menyimpan kartu** ke DB.

### Pengguna berakun
- Bisa daftar/login.
- Bisa buat, lihat, hapus kartu belajar.
- Bisa generate kartu AI lalu simpan.
- Bisa update profil/catatan pribadi.

### Admin
- Bisa lihat statistik via API key.
- Tidak ada login admin UI di MVP.
- API key dikirim sebagai header `X-Api-Key`.

---

## Repo layout

```
flashmind/
├── api/index.ts              # Vercel serverless entry; bodyParser false; export default app
├── server/                   # Express
│   ├── app.ts                # exported app; tidak ada app.listen()
│   ├── index.ts              # dev entry; listen(3001)
│   ├── db.ts                 # pg Pool + mapping kode ↔ DB
│   ├── auth.ts               # JWT, bcrypt, middleware
│   ├── rateLimit.ts          # in-memory token bucket per IP
│   ├── ai.ts                 # HF Space primary; OpenAI optional fallback
│   ├── schema.sql            # init DDL
│   └── routes/{auth,users,flashcards,test,v0}.ts
├── src/                      # React SPA
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/{Landing,Dashboard,Admin}.tsx
│   ├── components/{AuthDialog,Flashcard,FlashcardEditor,AICreate}.tsx
│   └── lib/{api,auth,id}.ts
├── vercel.json
├── package.json              # "type": "module"; "engines": { "node": "20.x" }
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
└── docker-compose.yml        # local postgres only
```

---

## Routes

| Path                                | Method | Auth          | DB Tujuan          | Tujuan                                  |
| ----------------------------------- | ------ | ------------- | ------------------ | --------------------------------------- |
| `/`                                 | GET    | none          | —                  | SPA shell                               |
| `/api/health`                       | GET    | none          | —                  | `{ok:true}`                            |
| `/api/auth/guest`                   | POST   | none          | `tamu_penguji`     | buat sesi tamu; catat IP                |
| `/api/auth/register`                | POST   | none          | `pengunjung_berakun` | daftar pengguna                     |
| `/api/auth/login`                   | POST   | none          | `pengunjung_berakun` | login email + kata sandi            |
| `/api/auth/google`                  | GET    | none          | `pengunjung_berakun` | mulai OAuth Google                  |
| `/api/auth/google/callback`         | GET    | none          | `pengunjung_berakun` | callback OAuth → upsert → cookie    |
| `/api/auth/logout`                  | POST   | any           | —                  | hapus cookie                            |
| `/api/users`                        | GET    | user          | `pengunjung_berakun` | profil sendiri                      |
| `/api/users`                        | PATCH  | user          | `pengunjung_berakun` | update profil/catatan               |
| `/api/flashcards`                   | GET    | user          | `kartu_belajar`    | daftar kartu sendiri                  |
| `/api/flashcards`                   | POST   | user          | `kartu_belajar`    | buat kartu                              |
| `/api/flashcards/:id`               | DELETE | user          | `kartu_belajar`    | hapus kartu sendiri                     |
| `/api/test`                         | POST   | user \| guest | —                  | preview kartu AI                        |
| `/api/v0/stats`                     | GET    | admin key     | semua tabel        | hitung statistik                        |
| `/api/v0/users`                     | GET    | admin key     | `pengunjung_berakun` | daftar pengguna                     |
| `/api/v0/guests`                    | GET    | admin key     | `tamu_penguji`     | daftar jejak tamu                       |
| `/api/v0/flashcards`                | GET    | admin key     | `kartu_belajar`    | daftar semua kartu                      |

Admin auth: header `X-Api-Key: <kunci_api>`.

---

## Skema Database

> Konvensi: nama kolom menggunakan Bahasa Indonesia. Kode program tetap pakai nama Inggris via mapping di `db.ts`.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tamu_penguji (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL,
  jejak JSONB DEFAULT '[]'::jsonb,
  dibuat_pada TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pengunjung_berakun (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_depan TEXT NOT NULL,
  nama_belakang TEXT NOT NULL,
  surel TEXT UNIQUE NOT NULL,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('male','female','other')),
  sandi_hash TEXT NOT NULL,
  catatan TEXT DEFAULT '',
  jejak JSONB DEFAULT '[]'::jsonb,
  dibuat_pada TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sudo_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_pengguna TEXT UNIQUE NOT NULL,
  sandi_hash TEXT NOT NULL,
  kunci_api TEXT UNIQUE NOT NULL,
  dibuat_pada TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE kartu_belajar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pengguna UUID NOT NULL REFERENCES pengunjung_berakun(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  catatan TEXT NOT NULL,
  lampiran TEXT[] DEFAULT '{}',
  sumber TEXT NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual','ai')),
  dibuat_pada TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX kartu_belajar_pengguna_idx ON kartu_belajar(id_pengguna);
```

### Kontrak `jejak`

Format JSON:

```json
{
  "acara": "test_ai",
  "rute": "/api/test",
  "pada": "2026-06-20T10:00:00.000Z",
  "meta": {}
}
```

Nilai `acara`:

| Role | Nilai `acara` |
| ---- | ------------- |
| tamu | `guest_created`, `test_ai`, `card_preview`, `error` |
| user | `register`, `login`, `profile_update`, `test_ai`, `card_create`, `card_delete`, `error` |

Batas: simpan maksimal 50 jejak terbaru per baris. `# ponytail: cap kecil; ganti tabel jejak terpisah kalau audit harus lengkap.`

### Mapping kode ↔ DB

| Field kode       | Kolom DB            |
| ---------------- | ------------------- |
| `ip`             | `ip_address`        |
| `firstName`      | `nama_depan`        |
| `lastName`       | `nama_belakang`     |
| `email`          | `surel`             |
| `passwordHash`   | `sandi_hash`        |
| `username`       | `nama_pengguna`     |
| `apiKey`         | `kunci_api`         |
| `userId`         | `id_pengguna`       |
| `title`          | `judul`             |
| `notes`          | `catatan`           |
| `attachments`    | `lampiran`          |
| `source`         | `sumber`            |
| `trace`          | `jejak`             |
| `createdAt`      | `dibuat_pada`       |

Attachments = data URL base64. Batas MVP: maksimal 5 gambar, total ±500KB. `# ponytail: ganti ke Vercel Blob/Supabase Storage kalau ukuran file penting.`

---

## AI contract

### Endpoint

`POST /api/test`

Body:

```json
{
  "catatan": "teks catatan panjang..."
}
```

Response:

```json
{
  "cards": [
    { "judul": "Front card", "catatan": "Back card" }
  ]
}
```

### Alur server

1. Terima `catatan`.
2. Panggil Hugging Face Space `notes2anki` via `@gradio/client`.
3. Normalisasi hasil ke array `{judul, catatan}`.
4. Jika `AI_PROVIDER=auto` dan HF gagal, fallback ke OpenAI `gpt-4o-mini` hanya jika `OPENAI_API_KEY` ada.
5. Return 422 jika hasil AI tidak bisa dinormalisasi.

### Rate limit

Token bucket sederhana per IP:

- `/api/test`: 20 request/menit.
- Route lain: 100 request/menit.

`# ponytail: in-memory reset saat cold start; ganti ke Redis/Upstash kalau perlu persisten.`

---

## Frontend

### Landing `/` — scroll page

1. **Hero**: FlashMind + tombol Masuk / Daftar.
2. **Nilai utama**: “Ubah catatan jadi kartu belajar”.
3. **Showcase**: demo flip card.
4. **Penelitian**: metode belajar dengan kartu efektif.
5. **CTA akhir**: Masuk / Daftar.

### Dialog auth

Toggle Masuk / Daftar.

- **Masuk**: surel + kata sandi + tombol Masuk + “Masuk dengan Google”.
- **Daftar**: nama depan, nama belakang, surel, jenis kelamin, kata sandi, konfirmasi kata sandi.

### Dashboard `/app`

- Grid kartu belajar milik pengguna.
- **+ Kartu Baru**: modal judul + catatan + lampiran multi-gambar.
- **✨ Buat dengan AI**: modal catatan → POST `/api/test` → preview → simpan pilihan.
- Klik kartu → flip: depan judul, belakang catatan + lampiran.
- Hapus saat hover/focus.

### Admin `/admin`

- Input API key → simpan di `localStorage`.
- Kirim header `X-Api-Key` ke `/api/v0/*`.
- Tampilkan:
  - total `pengunjung_berakun`
  - total `tamu_penguji`
  - total `kartu_belajar`
  - 10 jejak terbaru

### Responsive

Mobile-first. Breakpoint: `640 / 1024 / 1920 px`.

| Breakpoint | Layout |
| ---------- | ------ |
| <640       | satu kolom, dialog bottom-sheet |
| 640–1024   | grid 2 kolom |
| 1024–1920  | grid 3 kolom, dialog samping |
| >1920 (4K) | container max 1920px, tipografi fluid |

Aturan:
- `clamp(min, vw-based, max)` untuk tipografi.
- Hit target minimal 44px.
- Tidak ada horizontal scroll.

---

## Auth flow

- Cookie `fm_session` = JWT signed `{sub, role, iat, exp}`.
- `role`: `user` atau `guest`.
- Middleware Express mengisi `req.user` atau `req.guest`.
- Admin tidak pakai cookie; pakai `X-Api-Key`.

### Dev CORS

Karena Vite `localhost:5173` dan Express `localhost:3001`:

- Vite proxy `/api` → `http://localhost:3001`.
- Express CORS: `origin: 'http://localhost:5173'`, `credentials: true`.
- Fetch client: `credentials: 'include'`.

### Production

Vercel rewrite membuat frontend/backend satu domain, jadi cookie lintas origin tidak jadi masalah.

---

## Config env

| Var                       | Wajib | Tujuan |
| ------------------------- | ----- | ------ |
| `DATABASE_URL`            | ya    | koneksi PostgreSQL Neon |
| `SESSION_SECRET`          | ya    | tanda tangan JWT, 32+ karakter acak |
| `HF_SPACE_ID`             | ya untuk AI | id Space Hugging Face notes2anki |
| `OPENAI_API_KEY`          | tidak | fallback OpenAI jika `AI_PROVIDER=auto` |
| `AI_PROVIDER`             | tidak | `auto` default; bisa `hf` atau `openai` |
| `GOOGLE_CLIENT_ID`        | tidak | OAuth Google |
| `GOOGLE_CLIENT_SECRET`    | tidak | OAuth Google |
| `GOOGLE_CALLBACK_URL`     | tidak | OAuth Google |
| `ADMIN_USERNAME`          | tidak | seed admin jika `sudo_admin` kosong |
| `ADMIN_PASSWORD`          | tidak | seed admin jika `sudo_admin` kosong |
| `PORT`                    | tidak | dev server Express, default `3001` |

Jika `HF_SPACE_ID` kosong dan fallback OpenAI tidak aktif → `/api/test` return 503.

---

## Deploy

- Vercel project, framework preset **Other**.
- Build: `npm run build` → `vite build` → `dist/`.
- `api/index.ts` wajib:

```ts
export const config = { api: { bodyParser: false } };

import app from '../server/app';
export default app;
```

- `server/app.ts` tidak boleh `listen()` saat di-import.
- `package.json`:
  - `"type": "module"`
  - `"engines": { "node": "20.x" }`
- Dev:
  - `concurrently "vite --host 0.0.0.0" "tsx watch server/index.ts"`
  - Vite proxy `/api` → `http://localhost:3001`.

---

## Non-goals (ponytail)

- Verifikasi email.
- Reset kata sandi.
- Algoritma SRS/spaced repetition.
- Upload file server-side.
- i18n selain Bahasa Indonesia.
- Realtime/websocket.
- Pembayaran.
- Rate limit persisten.
- Guest menyimpan kartu.

---

## Bahasa Indonesia UI copy (locked)

Semua string UI ada di `src/lib/id.ts`. Tidak ada copy Inggris di UI.

| Key                         | Text |
| --------------------------- | ---- |
| `appName`                   | FlashMind |
| `tagline`                   | Alat bantu pembelajaran Anda |
| `hero.ctaLogin`             | Masuk untuk uji coba! |
| `hero.ctaRegister`          | Daftar untuk membuat akun baru |
| `hero.noteDifferent`        | masuk uji coba berbeda dengan memakai akun |
| `hero.scrollHint`           | scroll/swipe ke bawah untuk informasi lebih lanjut |
| `hero.howItHelps`           | Bagaimana FlashMind membantu? |
| `hero.howItHelpsBody`       | FlashMind mengubah catatan Anda dibentuk seperti kartu belajar. |
| `hero.research`             | Penelitian menunjukkan metode belajar ini sangat efektif. |
| `hero.ctaDontWait`          | Jangan tunggu lagi, segera |
| `auth.toggleLogin`          | Masuk |
| `auth.toggleRegister`       | Daftar |
| `auth.email`                | Surel |
| `auth.password`             | Kata sandi |
| `auth.passwordConfirm`      | Konfirmasi kata sandi |
| `auth.firstName`            | Nama Depan |
| `auth.lastName`             | Nama Belakang |
| `auth.gender`               | Jenis Kelamin |
| `auth.genderMale`           | Laki-laki |
| `auth.genderFemale`         | Perempuan |
| `auth.genderOther`          | Lainnya |
| `auth.submitLogin`          | Masuk |
| `auth.submitRegister`       | Daftar |
| `auth.google`               | Masuk dengan Google |
| `dashboard.title`           | Kartu Belajar Saya |
| `dashboard.empty`           | Belum ada kartu belajar |
| `dashboard.newManual`       | + Kartu Baru |
| `dashboard.aiGen`           | ✨ Buat dengan AI |
| `flashcard.front`           | Judul |
| `flashcard.back`            | Catatan |
| `flashcard.delete`          | Hapus |
| `flashcard.save`            | Simpan |
| `flashcard.close`           | Tutup |
| `ai.promptLabel`            | Catatan Anda |
| `ai.generate`               | Hasilkan |
| `ai.loading`                | Memuat… |
| `ai.noKey`                  | Fitur AI belum dikonfigurasi |
| `ai.failed`                 | AI gagal membuat kartu |
| `admin.title`               | Admin |
| `admin.keyPlaceholder`      | Kunci API admin |
| `admin.saveKey`             | Simpan kunci |
| `admin.clearKey`            | Hapus kunci |
| `admin.stats`               | Statistik |
| `admin.totalUsers`          | Total pengguna |
| `admin.totalGuests`         | Total tamu |
| `admin.totalCards`          | Total kartu |
| `admin.latestTraces`        | Jejak terbaru |
| `error.required`            | Wajib diisi |
| `error.emailInvalid`        | Format surel tidak valid |
| `error.passwordShort`       | Kata sandi minimal 8 karakter |
| `error.passwordMismatch`    | Kata sandi tidak cocok |
| `error.unauthorized`        | Tidak diizinkan |
| `error.network`             | Koneksi bermasalah |
| `error.serverError`         | Terjadi kesalahan server |
| `error.tooManyRequests`     | Terlalu banyak permintaan |
| `footer.credit`             | © FlashMind |

Gender disimpan di DB: `male` | `female` | `other`. UI menampilkan label Indonesia.

---

## Keputusan revisi

- `Supabase` diganti ke **Neon** agar lebih cocok untuk serverless Vercel.
- AI utama diganti ke **Hugging Face Space notes2anki**; OpenAI hanya fallback opsional.
- `/api/users?history=fetchall` dihapus; diganti `/api/flashcards` GET.
- Tamu bisa preview AI, tapi **tidak menyimpan kartu**.
- Tambah kontrak `jejak`, rate limit, CORS dev, `pgcrypto`, dan config Vercel serverless.

---

## Yang masih perlu diisi sebelum build

1. `HF_SPACE_ID` Space Hugging Face notes2anki.
2. `SESSION_SECRET`.
3. `DATABASE_URL` Neon.
4. `ADMIN_USERNAME` / `ADMIN_PASSWORD` untuk seed admin.
5. Google OAuth credentials jika fitur Google tetap dipakai.
