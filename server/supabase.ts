import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment');
}

// ponytail: don't throw at module load; create lazily so function can boot
// and return 500 on each request until env is set in Vercel project settings.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment');
  }
  // ponytail: Vercel Node 20 lacks native WebSocket; pass `ws` so Supabase realtime works
  _client = createClient(supabaseUrl, supabaseKey, {
    global: { ws: /* @vite-ignore */ (globalThis as any).WebSocket ?? require('ws') },
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as any)[prop];
  },
});