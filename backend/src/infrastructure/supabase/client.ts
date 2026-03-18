import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../aws/secrets';

let _client: SupabaseClient | null = null;

// Service-role client: bypasses RLS, used only server-side.
// RLS still protects the DB if this client is ever misused,
// but all queries here explicitly filter by userId.
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const { supabaseUrl, supabaseServiceKey } = getConfig();
  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return _client;
}
