import { getSession as getSessionFromDb } from '../infrastructure/supabase/sessions.repo';
import { Session } from '../domain/session';
import { NotFoundError } from '../shared/errors';

export async function getSession(id: string, userId: string): Promise<Session> {
  const session = await getSessionFromDb(id, userId);
  if (!session) throw new NotFoundError('Session not found');
  return session;
}
