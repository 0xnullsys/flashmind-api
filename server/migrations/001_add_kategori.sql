-- =============================================================
-- FlashMind DB Migration 001: tambah kolom kategori
-- =============================================================
-- Run di Supabase Dashboard → SQL Editor → New Query
-- Project: vmnqydpngerucpojhbwe
--
-- Fungsi:
--   - Tambah kolom `kategori` ke kartu_belajar untuk filter kartu
--     berdasarkan scope materi (Biologi, Matematika, dll).
--   - Index partial pada (id_pengguna, kategori) untuk filter cepat.
--
-- Idempotent: aman dijalankan berulang kali.
-- =============================================================

-- 1) Tambah kolom kategori (nullable, tidak ada default)
ALTER TABLE kartu_belajar
  ADD COLUMN IF NOT EXISTS kategori TEXT;

-- 2) Index untuk filter by kategori per user
--    Partial index: hanya baris dengan kategori, hemat ruang
CREATE INDEX IF NOT EXISTS kartu_belajar_kategori_idx
  ON kartu_belajar (id_pengguna, kategori)
  WHERE kategori IS NOT NULL;

-- 3) Verify (opsional, hapus jika tidak perlu)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'kartu_belajar'
--   AND column_name = 'kategori';
