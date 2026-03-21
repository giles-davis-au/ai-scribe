import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../aws/secrets';

let _serviceUserId: string | null = null;

export async function initServiceAccount(): Promise<void> {
  const { supabaseUrl, supabaseAnonKey, serviceAccountEmail, serviceAccountPassword } = getConfig();

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: serviceAccountEmail,
    password: serviceAccountPassword,
  });

  if (error || !data.user) {
    throw new Error(`Service account sign-in failed: ${error?.message}`);
  }

  _serviceUserId = data.user.id;
  console.log('[service-account] signed in successfully');
}

export function getServiceUserId(): string {
  if (!_serviceUserId) throw new Error('Service account not initialised — call initServiceAccount() at startup');
  return _serviceUserId;
}
