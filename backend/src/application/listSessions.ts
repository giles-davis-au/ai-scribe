import { listSessions as listSessionsFromDb } from '../infrastructure/supabase/sessions.repo';
import { Session } from '../domain/session';

export async function listSessions(userId: string): Promise<Session[]> {
  return listSessionsFromDb(userId);
}
