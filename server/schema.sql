-- =============================================================
-- FlashMind Supabase Schema (master)
-- =============================================================
-- Run ONCE di Supabase Dashboard → SQL Editor → New Query
-- Project: vmnqydpngerucpojhbwe
--
-- Berisi:
--   1. Schema master (tables, indexes)
--   2. Migration 001: tambah kolom kategori
--   3. Migration 002: enable Row Level Security
--
-- Idempotent: aman dijalankan berulang kali.
-- =============================================================

-- =====================================================
-- 1. SCHEMA MASTER
-- =====================================================

-- Enable pgcrypto for gen_random_uuid()
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
  kategori TEXT,
  dibuat_pada TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX kartu_belajar_pengguna_idx ON kartu_belajar(id_pengguna);
CREATE INDEX kartu_belajar_kategori_idx ON kartu_belajar(id_pengguna, kategori) WHERE kategori IS NOT NULL;

-- =====================================================
-- 2. MIGRATION 001: tambah kolom kategori
-- =====================================================
-- Fungsi: tambah kolom `kategori` ke kartu_belajar untuk
-- filter kartu berdasarkan scope materi (Biologi, MTK, dll).
-- Index partial pada (id_pengguna, kategori) untuk filter cepat.

ALTER TABLE kartu_belajar
  ADD COLUMN IF NOT EXISTS kategori TEXT;

CREATE INDEX IF NOT EXISTS kartu_belajar_kategori_idx
  ON kartu_belajar (id_pengguna, kategori)
  WHERE kategori IS NOT NULL;

-- =====================================================
-- 3. MIGRATION 002: enable Row Level Security (RLS)
-- =====================================================
-- Strategy: defense-in-depth, no arsitektur change.
-- - service_role (backend pakai) → full access via policy
-- - anon/authenticated → zero access (RLS default-deny)
-- Backend pakai SUPABASE_SERVICE_ROLE_KEY dari Vercel env.

ALTER TABLE tamu_penguji ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengunjung_berakun ENABLE ROW LEVEL SECURITY;
ALTER TABLE sudo_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE kartu_belajar ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent re-run)
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tamu_penguji','pengunjung_berakun','sudo_admin','kartu_belajar'])
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- service_role policies: full access
CREATE POLICY service_role_all_tamu ON tamu_penguji
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_user ON pengunjung_berakun
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_admin ON sudo_admin
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_card ON kartu_belajar
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- VERIFY (uncomment untuk test)
-- =====================================================
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public'
--   AND tablename IN ('tamu_penguji','pengunjung_berakun','sudo_admin','kartu_belajar');
-- Expected: rowsecurity = true for all 4
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'kartu_belajar' AND column_name = 'kategori';
-- Expected: kategori | text
