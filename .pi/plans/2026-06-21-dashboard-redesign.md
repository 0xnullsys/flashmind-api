# Plan: Dashboard Redesign + Last-Studied Tracking

## Goal

Redesign Dashboard with:
1. **Sticky-feel kategori bar** at top (actually NOT sticky per user, but visible at top)
2. **Toggle-like kategori** with limit + swipe for overflow
3. **Search input** for kategori filter
4. **Responsive limit**: 5 on mobile, more on tablet/desktop/4K
5. **Vertical timeline** of cards (chronological by last-studied)
6. **Timestamp** above each card (last studied, or "Belum dipelajari" if null)
7. **Sort**: oldest studied first (review-then-learn logic)

## Constraints

- No `position: sticky` (user explicitly said no)
- Schema migration needed for `last_studied_at` column
- Existing cards get `last_studied_at = NULL` (appear first as "never studied")

## Approach

### Backend

**Migration 003** (`migrations/003_add_last_studied.sql`):
```sql
ALTER TABLE kartu_belajar
  ADD COLUMN IF NOT EXISTS terakhir_dipelajari TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS kartu_belajar_review_idx
  ON kartu_belajar (id_pengguna, terakhir_dipelajari NULLS FIRST);
```

**API endpoint** `POST /api/flashcards/:id/studied`:
- Auth: user or guest
- Update `terakhir_dipelajari = now()`
- Returns updated card

**FlashCardData type** adds `terakhir_dipelajari: string | null`.

**GET /api/flashcards**:
- Already returns cards; just add new field
- Order: `terakhir_dipelajari ASC NULLS FIRST, dibuat_pada ASC` (oldest studied first, never-studied on top)

### Frontend

**Dashboard.tsx** redesign:
- Header (existing)
- New: **KategoriBar** (top, below header)
  - Search input
  - Toggle pills: "Semua", categories
  - Overflow: `<` `>` buttons or scroll snap
- Main: **Timeline**
  - Each card is a full-width or max-700px post
  - Timestamp above: "Dip pelajari 3 jam lalu" or "Belum dipelajari"
  - Sort by `terakhir_dipelajari` ASC

**Flashcard.tsx**:
- On flip, call `markStudied(card.id)` (fire-and-forget)
- Don't block UI

**Responsive kategori limit**:
- Mobile (<640px): limit 3
- Tablet (640-1024): limit 5
- Desktop (1024-1920): limit 7
- 4K (>1920): limit 10

**Swipe/toggle**:
- If more than limit, show ">" button
- Click advances through pages
- Or horizontal scroll-snap

## Files

| File | Action |
|---|---|
| `migrations/003_add_last_studied.sql` | NEW: schema migration |
| `server/schema.sql` | append migration 003 |
| `server/routes/flashcards.ts` | add `POST /:id/studied`, sort by studied |
| `src/lib/api.ts` | add `markStudied(id)`, update `FlashCardData` type |
| `src/components/KategoriBar.tsx` | NEW: search + toggle + overflow |
| `src/components/Flashcard.tsx` | call markStudied on flip |
| `src/pages/Dashboard.tsx` | use KategoriBar + Timeline |
| `src/styles.css` | new styles for KategoriBar + Timeline |

## Out of scope

- Notifications/reminders for due cards (future)
- Spaced repetition algorithm (SRS) — pure time-based sort for now
- Categories with icons/colors (already exists)
- Card swipe gestures on mobile (deferred)

## Verification

1. Run migration 003 on Supabase
2. Add `POST /:id/studied` endpoint, test with curl
3. Build UI: kategori bar, timeline, sort
4. Test on dev preview
5. Existing cards appear as "Belum dipelajari" first
