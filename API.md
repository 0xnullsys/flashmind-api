# API Reference

> Quick reference for HTTP API endpoints. For full TypeDoc-generated docs with TypeScript types, see [docs/api/index.html](docs/api/index.html).

## Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://flashmind-api.vercel.app/api` |
| Preview (Vercel auth-protected) | `https://<preview-id>-alif-fakhrurrozy-6516s-projects.vercel.app/api` |
| Local dev | `http://localhost:3001/api` |

## Authentication

All authenticated endpoints require a `fm_session` JWT cookie (httpOnly, SameSite=lax, 7-day expiry).

```http
Cookie: fm_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Endpoints

### Auth

#### `POST /api/auth/register`

Create new user account.

**Request body:**
```json
{
  "firstName": "Budi",
  "lastName": "Santoso",
  "email": "budi@example.com",
  "gender": "male",
  "password": "securepassword123"
}
```

**Response 201:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "email": "budi@example.com",
    "firstName": "Budi",
    "lastName": "Santoso"
  }
}
```

**Errors:**
- `400` — Missing fields or weak password
- `409` — Email already registered

#### `POST /api/auth/login`

Authenticate with email/password.

**Request body:**
```json
{
  "email": "budi@example.com",
  "password": "securepassword123"
}
```

**Response 200:**
```json
{ "ok": true, "user": { ... } }
```
Sets `Set-Cookie: fm_session=...`

**Errors:**
- `401` — Invalid credentials

#### `POST /api/auth/logout`

Clear session cookie.

**Response 200:** `{ "ok": true }`

#### `POST /api/auth/guest`

Create guest session (rate-limited: 5 per IP per 60s, deduped).

**Response 200:**
```json
{ "ok": true }
```
Sets `Set-Cookie: fm_session=...`

#### `GET /api/auth/google`

Initiate Google OAuth 2.0 flow. Redirects to Google.

#### `GET /api/auth/google/callback`

OAuth callback. Sets session cookie, redirects to `/app`.

#### `GET /api/auth/status`

Check current session role.

**Response 200:**
```json
{
  "role": "user",  // or "guest" or null
  "userId": "uuid"  // present if role = "user"
}
```

---

### Flashcards

#### `GET /api/flashcards`

List current user's cards.

**Auth:** Required (user)

**Response 200:**
```json
{
  "cards": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Apa definisi Mitosis?",
      "notes": "Mitosis adalah pembelahan sel...",
      "attachments": [],
      "source": "ai",  // or "manual"
      "category": "Biologi",
      "createdAt": "2026-06-21T02:26:40.350Z"
    }
  ]
}
```

#### `POST /api/flashcards`

Create new card.

**Auth:** Required (user)

**Request body:**
```json
{
  "title": "Apa definisi Mitosis?",
  "notes": "Mitosis adalah pembelahan sel yang menghasilkan dua sel anak identik.",
  "attachments": [],  // optional Cloudinary URLs
  "category": "Biologi",  // optional
  "source": "ai"  // or "manual"
}
```

**Validation:**
- `title` required, ≤120 characters
- `notes` required, ≤500 characters
- `attachments` optional, max 5

**Response 201:**
```json
{
  "card": {
    "id": "uuid",
    ...
  }
}
```

**Errors:**
- `400` — Validation failed (char limits, missing fields)
- `401` — Not authenticated

#### `PATCH /api/flashcards/:id`

Edit existing card (owner only).

**Auth:** Required (user)

**Request body** (any subset):
```json
{
  "title": "Updated title",
  "notes": "Updated notes",
  "category": "Fisika"
}
```

**Response 200:** `{ "card": { ... } }`

**Errors:**
- `400` — Char limits exceeded
- `404` — Card not found / not owned by user

#### `DELETE /api/flashcards/:id`

Delete card (owner only).

**Response 200:** `{ "ok": true }`

---

### AI Generation

#### `POST /api/test`

Preview AI flashcard generation (no save).

**Auth:** Optional (optionalAuth — guest OK)

**Request body:**
```json
{
  "catatan": "Mitosis adalah pembelahan sel yang menghasilkan dua sel anak identik. Fotosintesis mengubah cahaya matahari menjadi energi kimia.",
  "fileUrls": [  // optional, from Cloudinary upload
    "https://res.cloudinary.com/.../note1.jpg"
  ]
}
```

**Response 200:**
```json
{
  "cards": [
    {
      "judul": "Apa definisi Mitosis?",
      "catatan": "Mitosis adalah pembelahan sel...",
      "category": "Biologi"
    },
    {
      "judul": "Apa itu Fotosintesis?",
      "catatan": "Fotosintesis mengubah cahaya matahari...",
      "category": "Biologi"
    }
  ]
}
```

**Errors:**
- `400` — Empty input
- `503` — AI not configured
- `422` — AI couldn't generate cards from input

---

### File Upload

#### `POST /api/uploads`

Upload image to Cloudinary.

**Auth:** Required (user)

**Request:** `multipart/form-data` with `file` field (image/*, max 5 MB)

**Response 200:**
```json
{
  "url": "https://res.cloudinary.com/[REDACTED-cloudinary-cloud-name]/image/upload/v1234567890/flashmind/abc123.jpg",
  "publicId": "flashmind/abc123",
  "width": 1200,
  "height": 800,
  "bytes": 158080
}
```

**Errors:**
- `400` — No file or invalid type
- `401` — Not authenticated
- `503` — Cloudinary not configured

---

### User Profile

#### `GET /api/users`

Get current user profile.

**Auth:** Required (user)

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "budi@example.com",
    "firstName": "Budi",
    "lastName": "Santoso",
    "gender": "male",
    "notes": ""
  }
}
```

#### `PATCH /api/users`

Update profile.

**Auth:** Required (user)

**Request body** (any subset):
```json
{
  "firstName": "Budi Updated",
  "notes": "Additional info"
}
```

**Response 200:** `{ "ok": true }`

---

### Admin (requires `X-Api-Key` header)

#### `GET /api/v0/flashcards`

List all cards (admin only).

**Headers:** `X-Api-Key: <admin-key>`

**Response 200:**
```json
{
  "cards": [ ... ]
}
```

#### `GET /api/v0/users`

List all users.

#### `GET /api/v0/stats`

Admin dashboard stats.

**Response 200:**
```json
{
  "stats": {
    "totalUsers": 5,
    "totalCards": 12,
    "totalGuests": 23
  }
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/guest` | 5 per IP per 60s (with dedupe) |
| `POST /api/test` (AI) | 20 per IP per 60s |
| `POST /api/uploads` | 60 per IP per 60s |
| Other authenticated | 100 per IP per 60s |

Rate-limited requests return `429 Too Many Requests`.

---

## Error Format

All errors follow this format:

```json
{ "error": "Human-readable error message" }
```

HTTP status codes used:
- `400` — Validation error (missing fields, char limits)
- `401` — Not authenticated
- `403` — Forbidden (e.g., admin endpoint without API key)
- `404` — Resource not found
- `409` — Conflict (e.g., email already registered)
- `422` — AI couldn't generate valid output
- `429` — Rate limited
- `500` — Server error
- `503` — External service unavailable (AI, Cloudinary)

---

## Examples

### cURL

```bash
# Register
curl -X POST https://flashmind-api.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Budi","lastName":"S","email":"b@e.com","gender":"male","password":"test12345"}'

# Login (save cookie)
curl -X POST https://flashmind-api.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"b@e.com","password":"test12345"}' \
  -c cookies.txt

# Create card (authenticated)
curl -X POST https://flashmind-api.vercel.app/api/flashcards \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Test","notes":"Notes","category":"Biologi"}'

# AI generation (preview)
curl -X POST https://flashmind-api.vercel.app/api/test \
  -H "Content-Type: application/json" \
  -d '{"catatan":"Mitosis adalah pembelahan sel..."}'
```
