import { supabase } from './supabase.js';

// Mapping kode ↔ DB
export const mapFields: Record<string, string> = {
  ip: 'ip_address',
  firstName: 'nama_depan',
  lastName: 'nama_belakang',
  email: 'surel',
  passwordHash: 'sandi_hash',
  username: 'nama_pengguna',
  apiKey: 'kunci_api',
  userId: 'id_pengguna',
  title: 'judul',
  notes: 'catatan',
  attachments: 'lampiran',
  source: 'sumber',
  trace: 'jejak',
  createdAt: 'dibuat_pada',
};

export function toDb<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = mapFields[key] || key;
    result[dbKey] = value;
  }
  return result;
}

export function fromDb<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const reverseMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapFields)) {
    reverseMap[v] = k;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const codeKey = reverseMap[key] || key;
    result[codeKey] = value;
  }
  return result;
}

export interface Guest {
  id: string;
  ip: string;
  trace: unknown[];
  created_at: string;
}

export interface UserRow {
  id: string;
  nama_depan: string;
  nama_belakang: string;
  surel: string;
  jenis_kelamin: string;
  sandi_hash: string;
  catatan: string;
  jejak: unknown[];
  dibuat_pada: string;
}

export interface FlashCardRow {
  id: string;
  id_pengguna: string;
  judul: string;
  catatan: string;
  lampiran: string[];
  sumber: string;
  dibuat_pada: string;
}

export interface AdminRow {
  id: string;
  nama_pengguna: string;
  sandi_hash: string;
  kunci_api: string;
  dibuat_pada: string;
}

export async function addTrace(table: string, id: string, event: string, route: string, meta: Record<string, unknown> = {}) {
  const traceEntry = {
    acara: event,
    rute: route,
    pada: new Date().toISOString(),
    meta,
  };

  // Fetch current trace, append, cap at 50
  const { data: row } = await supabase
    .from(table)
    .select('jejak')
    .eq('id', id)
    .single();

  let jejak = (row?.jejak as unknown[]) || [];
  jejak = [...jejak, traceEntry];
  if (jejak.length > 50) {
    jejak = jejak.slice(jejak.length - 50);
  }

  await supabase
    .from(table)
    .update({ jejak })
    .eq('id', id);
}

export { supabase };