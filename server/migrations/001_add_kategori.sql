-- Tambah kolom kategori ke kartu_belajar
-- Run di Supabase SQL Editor

ALTER TABLE kartu_belajar
ADD COLUMN IF NOT EXISTS kategori TEXT;

CREATE INDEX IF NOT EXISTS kartu_belajar_kategori_idx
  ON kartu_belajar(id_pengguna, kategori)
  WHERE kategori IS NOT NULL;
