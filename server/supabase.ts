import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL || '';
// ponytail: prefer service_role key (bypasses RLS for backend trusted queries).
// Falls back to anon key if service_role not set (pre-RLS).
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL and SUPABASE_*_KEY must be set in environment');
}

// ponytail: don't throw at module load; create lazily so function can boot
// and return 500 on each request until env is set in Vercel project settings.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_*_KEY must be set in environment');
  }
  // ponytail: Vercel Node 20 lacks native WebSocket; pass `ws` as realtime transport
  _client = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: ws as any },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as any)[prop];
  },
});