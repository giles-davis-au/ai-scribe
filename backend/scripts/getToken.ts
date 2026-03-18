import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url      = process.env['SUPABASE_URL'];
const anonKey  = process.env['SUPABASE_ANON_KEY'];
const email    = process.env['TEST_USER_EMAIL'];
const password = process.env['TEST_USER_PASSWORD'];

if (!url || !anonKey || !email || !password) {
  console.error('Required: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD');
  process.exit(1);
}

async function main() {
  const supabase = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: email!, password: password! });

  if (error || !data.session) {
    console.error('Login failed:', error?.message ?? 'no session returned');
    process.exit(1);
  }

  console.log(data.session.access_token);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
