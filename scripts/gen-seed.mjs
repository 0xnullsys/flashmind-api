#!/usr/bin/env node
// Generate Supabase SQL seed from test/flashmind_data_fake-cleaned.csv
// Run output in Supabase SQL Editor.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') {}
      else cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).filter(r => r.some(c => c.trim())).map(r => {
    const obj = {};
    header.forEach((h, i) => obj[h] = (r[i] || '').trim());
    return obj;
  });
}

function esc(s) {
  return s.replace(/'/g, "''");
}

const csvText = readFileSync('test/flashmind_data_fake-cleaned.csv', 'utf8');
const rows = parseCSV(csvText);

const N = parseInt(process.argv[2] || '5', 10);
const sample = rows.slice(0, N);

const genderMap = {
  'laki-laki': 'male',
  'perempuan': 'female',
};

const inserts = [];
inserts.push('-- Seed users + cards from test/flashmind_data_fake-cleaned.csv');
inserts.push('-- Run in Supabase SQL Editor. Idempotent via ON CONFLICT.');
inserts.push('');
inserts.push('CREATE TEMP TABLE _tmp_ids (id uuid);');
inserts.push('');

let cardCount = 0;

for (const row of sample) {
  const email = row.email;
  if (!email) continue;
  const nama_depan = esc(row.nama_depan);
  const nama_belakang = esc(row.nama_belakang);
  const jenis_kelamin = genderMap[row.jenis_kelamin] || 'other';
  const notes = row.notes || '';
  // Test-only password hash (NOT real bcrypt). Real bcrypt needed for actual login.
  const passwordHash = '$2b$10$' + createHash('sha256').update(email + 'password123').digest('base64').slice(0, 53);

  inserts.push(`INSERT INTO pengunjung_berakun (nama_depan, nama_belakang, surel, jenis_kelamin, sandi_hash, catatan, jejak)`);
  inserts.push(`VALUES ('${nama_depan}', '${nama_belakang}', '${esc(email)}', '${jenis_kelamin}', '${passwordHash}', '', '[]'::jsonb)`);
  inserts.push(`ON CONFLICT (surel) DO UPDATE SET sandi_hash = EXCLUDED.sandi_hash`);
  inserts.push(`RETURNING id INTO _tmp_ids;`);
  inserts.push('');

  if (notes.length >= 20) {
    const title = esc(notes.split('\n')[0].slice(0, 200));
    const body = esc(notes.slice(0, 5000));
    inserts.push(`INSERT INTO kartu_belajar (id_pengguna, judul, catatan, lampiran, sumber)`);
    inserts.push(`SELECT id, '${title}', '${body}', '{}', 'manual' FROM _tmp_ids LIMIT 1;`);
    inserts.push('');
    cardCount++;
  }
}

inserts.push('DROP TABLE _tmp_ids;');

mkdirSync('scripts', { recursive: true });
writeFileSync('scripts/seed.sql', inserts.join('\n'));
console.log(`Wrote scripts/seed.sql (${sample.length} users, ${cardCount} cards)`);
console.log('Run in Supabase SQL Editor to seed the database.');