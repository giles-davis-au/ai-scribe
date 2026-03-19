import { getSupabaseClient } from './client';
import { Session, SessionStatus, ClinicalFacts, SoapNote } from '../../domain/session';

// DB row shape (snake_case) — mapped to domain type (camelCase) in toSession()
interface SessionRow {
  id:              string;
  user_id:         string;
  status:          SessionStatus;
  audio_path:      string | null;
  transcript:      string | null;
  clinical_facts:  ClinicalFacts | null;
  soap_note:       SoapNote | null;
  error:           string | null;
  created_at:      string;
  updated_at:      string;
}

function toSession(row: SessionRow): Session {
  return {
    id:            row.id,
    userId:        row.user_id,
    status:        row.status,
    audioPath:     row.audio_path,
    transcript:    row.transcript,
    clinicalFacts: row.clinical_facts,
    soapNote:      row.soap_note,
    error:         row.error,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

export async function createSession(userId: string): Promise<Session> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('sessions')
    .insert({ user_id: userId })
    .select()
    .single<SessionRow>();

  if (error) throw new Error(`createSession: ${error.message}`);
  return toSession(data);
}

export async function listSessions(userId: string): Promise<Session[]> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('sessions')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<SessionRow[]>();

  if (error) throw new Error(`listSessions: ${error.message}`);
  return data.map(toSession);
}

export async function getSession(id: string, userId: string): Promise<Session | null> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('sessions')
    .select()
    .eq('id', id)
    .eq('user_id', userId)   // enforce ownership even with service role
    .single<SessionRow>();

  if (error?.code === 'PGRST116') return null; // not found
  if (error) throw new Error(`getSession: ${error.message}`);
  return toSession(data);
}

export interface SessionUpdate {
  status?:          SessionStatus;
  audio_path?:      string;
  transcript?:      string;
  clinical_facts?:  ClinicalFacts;
  soap_note?:       SoapNote;
  error?:           string | null;  // null clears a previous error
}

export async function updateSession(
  id: string,
  userId: string,
  patch: SessionUpdate,
): Promise<Session> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('sessions')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single<SessionRow>();

  if (error) throw new Error(`updateSession: ${error.message}`);
  return toSession(data);
}

export async function deleteSession(id: string, userId: string): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db
    .from('sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`deleteSession: ${error.message}`);
}
