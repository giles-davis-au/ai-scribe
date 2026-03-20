import { API_BASE_URL, API_TOKEN } from '../config';
import type { Session } from '../types';

const authHeader = { Authorization: `Bearer ${API_TOKEN}` };

// Derive a filename from the blob's MIME type so the backend can detect the format.
function audioFilename(blob: Blob): string {
  const ext = blob.type.split('/')[1]?.split(';')[0] ?? 'webm';
  return `recording.${ext}`;
}

export async function createSession(): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}/sessions`, {
    method:  'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`createSession failed: ${res.statusText}`);
  return res.json();
}

export async function uploadAudio(sessionId: string, blob: Blob): Promise<Session> {
  const form = new FormData();
  form.append('audio', blob, audioFilename(blob));

  // Do not set Content-Type — the browser sets it automatically with the multipart boundary.
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/audio`, {
    method:  'POST',
    headers: authHeader,
    body:    form,
  });
  if (!res.ok) throw new Error(`uploadAudio failed: ${res.statusText}`);
  return res.json();
}

export async function getSession(sessionId: string): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    headers: authHeader,
  });
  if (!res.ok) throw new Error(`getSession failed: ${res.statusText}`);
  return res.json();
}
