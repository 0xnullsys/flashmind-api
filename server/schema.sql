-- FlashMind Supabase Schema
-- Execute this in Supabase SQL Editor

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