-- =============================================================
-- FlashMind DB Migration 002: enable Row Level Security (RLS)
-- =============================================================
-- Run ONLY ini di Supabase SQL Editor.
-- Tables sudah ada dari schema.sql master.
--
-- Strategy (Opsi A — defense-in-depth, no arsitektur change):
--   1. Enable RLS on all tables
--   2. Policies: full access for service_role (backend pakai ini)
--   3. anon/authenticated: zero access by default (RLS default-deny)
--   4. Backend pakai service_role → RLS bypass → query sama seperti sekarang
--
-- Rollback: ALTER TABLE xxx DISABLE ROW LEVEL SECURITY;
-- =============================================================

-- 1) Enable RLS (idempotent)
ALTER TABLE tamu_penguji ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengunjung_berakun ENABLE ROW LEVEL SECURITY;
ALTER TABLE sudo_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE kartu_belajar ENABLE ROW LEVEL SECURITY;

-- 2) Drop existing policies if any (safe re-run)
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

-- 3) service_role policies: full access
--    (service_role bypass RLS by default; eksplisit untuk dokumentasi)
CREATE POLICY service_role_all_tamu ON tamu_penguji
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_user ON pengunjung_berakun
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_admin ON sudo_admin
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_card ON kartu_belajar
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) anon/authenticated: zero access (RLS default-deny saat ENABLE tanpa policy untuk role ini)

-- 5) Verify (uncomment to test)
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public'
--   AND tablename IN ('tamu_penguji','pengunjung_berakun','sudo_admin','kartu_belajar');
-- Expected: rowsecurity = true for all 4
