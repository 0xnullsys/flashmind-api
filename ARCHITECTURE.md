# Architecture

> Deep dive into FlashMind's system architecture, design decisions, and trade-offs.

## Overview

FlashMind is a **multi-tier application** with these layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                          │
│  ├─ Vite dev server / Vercel static asset CDN                 │
│  ├─ React Router (SPA routing)                                │
│  ├─ AuthContext (JWT session state)                           │
│  ├─ WebRTC camera (camera capture)                            │
│  └─ Fetch API client (with credentials)                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS (JWT cookie)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel Serverless (Express.js)                               │
│  ├─ index.ts (Vercel function entry, all routes)              │
│  ├─ Cookie-based JWT auth (httpOnly, SameSite=lax)           │
│  ├─ Rate limiting (token bucket per IP)                       │
│  ├─ Supabase client (service_role, bypasses RLS)             │
│  ├─ Cloudinary SDK (image upload)                             │
│  └─ HF Space proxy (via Cloudflare Worker)                    │
└─────────────────────────────────────────────────────────────┘
       │                    │                        │
       │                    │                        │
       ▼                    ▼                        ▼
┌──────────────┐   ┌─────────────────┐   ┌─────────────────────┐
│  Supabase    │   │  Cloudinary       │   │  Cloudflare Worker   │
│  Postgres    │   │  (image storage)  │   │  → HF Space          │
│  + RLS       │   │  URLs in DB       │   │  (EasyOCR + Q/A)     │
└──────────────┘   └─────────────────┘   └─────────────────────┘
```

## Component Hierarchy

```
<BrowserRouter>
  <AuthProvider>                          // JWT cookie → React state
    <DevBanner />                          // dev builds only
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={
        <ProtectedRoute>
          <Dashboard>
            <DashboardSidebar />            // category nav
            <CategorySection>              // per-category group
              <Flashcard />                 // single card with flip
            </CategorySection>
            <FlashcardEditor />            // + Kartu Baru dialog
            <CameraCaptureModal />         // sub-dialog for camera
            <EditCardModal />              // edit existing card
            <AICreate />                   // (legacy, removed)
            <AuthDialog />                 // register/login
          </Dashboard>
        </ProtectedRoute>
      } />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

## Data Flow Examples

### 1. Create Card Flow

```
User pastes notes + clicks "Hasilkan Kartu"
  ↓
FlashcardEditor.handleGenerate()
  ├─ text: "Mitosis adalah..."
  ├─ files: [optional images]
  ↓
testAI(notes, fileUrls)
  ├─ if files: uploadImage(file) for each → Cloudinary URLs
  ├─ POST /api/test { catatan, fileUrls }
  ↓
Vercel Express /api/test
  ├─ rateLimit('test')
  ├─ if fileUrls: download → convert to multipart files
  ├─ generateCards(notes, files) → server/ai.ts
  │   ├─ POST CF_PROXY_URL/v1/cards (multipart)
  │   ↓
  │   Cloudflare Worker proxy
  │   ├─ POST HF_SPACE/v1/cards (multipart)
  │   ↓
  │   Hugging Face Space
  │   ├─ if files: EasyOCR.extract_text(image) for each
  │   ├─ combined_text = notes + extracted_text
  │   ├─ heuristic_qa_extractor(combined_text) → [(q, a), ...]
  │   └─ return [{question, answer}, ...]
  │   ↓
  │   CF Worker → Vercel → frontend
  ├─ map {question, answer} → {judul, catatan}
  ├─ detectCategory() for each card
  └─ return [{judul, catatan, category}, ...]
  ↓
FlashcardEditor.setGeneratedCards(cards)
  ↓
User selects cards + clicks "💾 Simpan N Kartu"
  ↓
handleSaveAll()
  ├─ validate char limits
  ├─ for each selected: createFlashcard({title, notes, category, source: 'ai'})
  │   └─ POST /api/flashcards
  ↓
Vercel Express /api/flashcards
  ├─ authMiddleware (verify JWT cookie)
  ├─ validate char limits (120 front / 500 back)
  ├─ INSERT INTO kartu_belajar (with kategori column fallback)
  └─ return { card }
  ↓
loadCards() → refresh dashboard
```

### 2. Camera Capture Flow

```
User clicks "📷 Ambil foto"
  ↓
FlashcardEditor: setShowCameraModal(true)
  ↓
CameraCaptureModal mounts
  ├─ useEffect: getUserMedia({video: {facingMode: 'environment'}})
  │   ↓ OS prompts for camera permission
  │   ↓ User allows
  ├─ stream → videoRef.current.srcObject
  ├─ video.play()
  └─ status = 'ready'
  ↓
Live preview shown in full-size modal
  ↓
User clicks shutter button (CSS-only icon, no text)
  ↓
handleCapture()
  ├─ canvas.width = video.videoWidth
  ├─ canvas.getContext('2d').drawImage(video)
  ├─ canvas.toBlob('image/jpeg', 0.92)
  ├─ new File([blob], `capture-${Date.now()}.jpg`)
  └─ onCapture(file) → adds to FlashcardEditor files list
  └─ onClose() → modal closes, stream stopped
```

### 3. Google OAuth Flow

```
User clicks "Masuk dengan Google"
  ↓
<a href="/api/auth/google">
  ↓
GET /api/auth/google
  ├─ Generate OAuth URL (client_id, redirect_uri, scope)
  ├─ Set state cookie for CSRF
  └─ 302 → https://accounts.google.com/o/oauth2/v2/auth?...
  ↓
User authorizes on Google
  ↓
GET /api/auth/google/callback?code=...&state=...
  ├─ Exchange code for tokens (POST https://oauth2.googleapis.com/token)
  ├─ Get user profile (GET https://www.googleapis.com/oauth2/v2/userinfo)
  ├─ Upsert user in pengunjung_berakun
  ├─ signToken(userId, 'user')
  ├─ Set-Cookie fm_session (httpOnly, SameSite=lax, 7 days)
  └─ 302 → /app (React Router SPA routing)
  ↓
Browser navigates to /app
  ├─ ProtectedRoute checks role → 'user'
  └─ Dashboard renders
```

## Design Decisions

### Why Vite instead of Create React App or Next.js?

| Option | Pros | Cons |
|--------|------|------|
| **Vite** ✅ | Fast HMR, simple config, native ESM, single build output | No SSR (but we don't need it) |
| CRA | Familiar | Slow, deprecated, less flexible |
| Next.js | SSR/SSG, file-based routing | Overkill for SPA + serverless backend, slower dev |

FlashMind is **SPA-first** — no SEO requirement for authenticated pages, and the Vercel function handles API separately. Vite gives us fast iteration without Next.js complexity.

### Why Cloudflare Worker proxy to HF Space?

Vercel serverless functions have **egress restrictions** to certain external services. Hugging Face Spaces was timing out from Vercel. Cloudflare Workers have **no such restrictions** and have free egress.

```
Before:
  Vercel ──X──> HF Space (blocked / timeout)

After:
  Vercel ──> Cloudflare Worker ──> HF Space (works)
```

### Why Cloudinary URLs instead of base64 in DB?

| Storage | Pros | Cons |
|---------|------|------|
| **Base64 in DB** ✅ | Simple | DB bloat (avg 500KB per image), slow queries, expensive |
| **Cloudinary URLs** ✅ (chosen) | Fast queries, CDN-served, free tier 25GB, image optimization | Vendor lock-in (mitigated: URLs work without Cloudinary account) |

Base64 images made the dashboard slow and exceeded Supabase row size limits. Cloudinary URLs are CDN-cached, auto-optimized (`f_auto`, `q_auto`), and the DB stays lean.

### Why JWT cookie sessions instead of localStorage?

| Method | Pros | Cons |
|--------|------|------|
| **localStorage** | Simple JS | Vulnerable to XSS attacks |
| **JWT cookie (httpOnly)** ✅ (chosen) | Not accessible via JS (XSS-safe), works with SSR | CSRF risk (mitigated: SameSite=lax + backend origin check) |

JWT in `httpOnly` cookie cannot be stolen by malicious scripts, only sent automatically by browser.

### Why server_role_key vs anon key for backend?

Supabase has **Row Level Security (RLS)** that filters by `auth.uid()`. Our backend uses `service_role` which **bypasses RLS** because:
- We do auth ourselves (JWT cookies)
- We need cross-user queries (admin endpoints)
- We can verify ownership in code (`eq('id_pengguna', req.user.id)`)

`anon` key would be restricted to RLS policies, which we don't fully use yet. Future enhancement: write RLS policies that check a JWT custom claim for `user_id`.

### Why 2 build variants (prod + dev)?

Different environments need different features:

| Feature | Production | Development |
|---------|-----------|-------------|
| Source maps | ❌ (smaller bundle) | ✅ (easier debugging) |
| Dev banner | ❌ (cleaner UX) | ✅ (visible mode indicator) |
| Debug logging | ❌ (silent) | ✅ (verbose) |
| Analytics | ✅ (track usage) | ❌ (avoid noise) |

Implemented via `VITE_*` env vars + Vite `--mode` flag.

## Trade-offs

### Pros
- ✅ Fast SPA with Vite
- ✅ AI-powered flashcard generation
- ✅ iOS Camera-style UX (no file picker)
- ✅ Auto-categorization
- ✅ Cloudinary-backed image storage
- ✅ Mobile-first responsive design
- ✅ Comprehensive test coverage

### Cons
- ❌ No SSR (no SEO for public pages — but Landing has minimal SEO)
- ❌ Vercel egress to HF blocked (mitigated via CF Worker)
- ❌ OCR limited for handwriting (EasyOCR)
- ❌ No offline mode (requires connection for AI)
- ❌ Single language (Indonesian) UI

### Future Enhancements
1. **Real-time sync** with Supabase Realtime (cards update across tabs)
2. **PWA + offline** with Service Worker + IndexedDB
3. **Spaced repetition algorithm** (SM-2, FSRS) for card review
4. **Multi-language** UI (English, etc.)
5. **Better handwriting OCR** (TrOCR, HierText)
6. **Card sharing** between users
7. **Deck export** to Anki (.apkg) or CSV
