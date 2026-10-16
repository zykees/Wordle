import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseServerConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

export function getSupabaseServerClient() {
  if (!isSupabaseServerConfigured) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
    realtime: {
      // Prevents Node 20 exception in serverless functions where realtime websocket is not needed
      transport: class DummyWS {} as unknown as typeof WebSocket,
    },
  });
}
