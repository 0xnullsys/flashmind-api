-- Migration 003: tambah kolom terakhir_dipelajari
-- Track kapan terakhir kali kartu dipelajari (flip)
-- NULL = belum pernah dipelajari (muncul paling atas untuk review)

ALTER TABLE kartu_belajar
  ADD COLUMN IF NOT EXISTS terakhir_dipelajari TIMESTAMPTZ;

-- Index untuk sorting "oldest studied first" (review queue)
-- NULLS FIRST: kartu yang belum dipelajari muncul duluan
CREATE INDEX IF NOT EXISTS kartu_belajar_review_idx
  ON kartu_belajar (id_pengguna, terakhir_dipelajari NULLS FIRST, dibuat_pada ASC);
