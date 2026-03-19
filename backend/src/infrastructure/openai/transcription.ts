import fs from 'fs';
import os from 'os';
import path from 'path';
import { getOpenAIClient } from './client';

// Use a temp file + ReadStream rather than toFile(buffer) — Node.js native fetch
// (undici) reliably streams ReadStream in a FormData body, whereas consuming a
// Buffer-backed File object can stall when called from within an HTTP server.
export async function transcribeAudio(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<string> {
  const MIME_TO_EXT: Record<string, string> = {
    'audio/webm':  'webm',
    'audio/mp4':   'mp4',
    'audio/mpeg':  'mp3',
    'audio/wav':   'wav',
    'audio/ogg':   'ogg',
    'audio/x-m4a': 'm4a',
    'audio/aac':   'aac',
  };

  const extFromMime = MIME_TO_EXT[mimetype];
  const extFromName = path.extname(originalname).slice(1).toLowerCase() || undefined;
  const ext         = extFromMime ?? extFromName ?? 'mp3';
  const tmpPath     = path.join(os.tmpdir(), `whisper-${Date.now()}.${ext}`);

  fs.writeFileSync(tmpPath, buffer);
  try {
    const client = getOpenAIClient();
    const result = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file:  fs.createReadStream(tmpPath),
    });
    return result.text;
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}
