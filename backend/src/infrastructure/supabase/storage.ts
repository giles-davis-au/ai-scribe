import nodePath from 'path';
import { getSupabaseClient } from './client';

const MIME_TO_EXT: Record<string, string> = {
  'audio/webm':  'webm',
  'audio/mp4':   'mp4',
  'audio/mpeg':  'mp3',
  'audio/wav':   'wav',
  'audio/ogg':   'ogg',
  'audio/x-m4a': 'm4a',
  'audio/aac':   'aac',
};

// originalname is used as extension fallback when mimetype is generic (e.g. application/octet-stream)
// Returns the storage path on success. Throws on failure.
export async function uploadAudio(
  buffer: Buffer,
  mimetype: string,
  userId: string,
  sessionId: string,
  originalname: string,
): Promise<string> {
  const extFromMime = MIME_TO_EXT[mimetype];
  const extFromName = nodePath.extname(originalname).slice(1).toLowerCase() || undefined;
  const ext         = extFromMime ?? extFromName ?? 'audio';
  const storagePath = `users/${userId}/sessions/${sessionId}/original.${ext}`;
  const db          = getSupabaseClient();

  const { error } = await db.storage
    .from('audio')
    .upload(storagePath, buffer, { contentType: mimetype, upsert: true });

  if (error) throw new Error(`uploadAudio: ${error.message}`);
  return storagePath;
}
