import { createSession as createSessionInDb } from '../infrastructure/supabase/sessions.repo';
import { Session } from '../domain/session';

export async function createSession(userId: string): Promise<Session> {
  return createSessionInDb(userId);
}
