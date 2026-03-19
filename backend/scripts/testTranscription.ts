import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI, { toFile } from 'openai';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/testTranscription.ts <path-to-audio-file>');
    process.exit(1);
  }

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY in environment');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  const buffer  = fs.readFileSync(absPath);
  const ext     = path.extname(absPath).slice(1) || 'audio';

  console.log('[testTranscription] file:  ', absPath);
  console.log('[testTranscription] bytes: ', buffer.length);
  console.log('[testTranscription] ext:   ', ext);

  const client = new OpenAI({ apiKey });
  const file   = await toFile(buffer, `recording.${ext}`);

  console.log('[testTranscription] sending to Whisper...');
  const result = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });

  console.log('[testTranscription] transcript:\n', result.text);
}

main().catch((err) => {
  console.error('[testTranscription] error:', err);
  process.exit(1);
});
