import { getSession, updateSession }  from '../infrastructure/supabase/sessions.repo';
import { uploadAudio }               from '../infrastructure/supabase/storage';
import { transcribeAudio }           from '../infrastructure/openai/transcription';
import { extractClinicalFacts }      from '../infrastructure/openai/clinicalExtraction';
import { generateSoap }              from '../infrastructure/openai/soapGeneration';
import { Session }                   from '../domain/session';
import { NotFoundError, ValidationError } from '../shared/errors';

export async function processSessionAudio(
  sessionId: string,
  userId: string,
  file: Express.Multer.File,
): Promise<Session> {
  // Ownership check outside try/catch — auth/not-found errors propagate normally.
  const existing = await getSession(sessionId, userId);
  if (!existing) throw new NotFoundError('Session not found');
  if (existing.status === 'processing' || existing.status === 'completed') {
    throw new ValidationError(`Session is already ${existing.status}`);
  }

  // One broad try/catch covers upload, status transitions, and all AI calls.
  // Any failure best-effort persists status=failed + error, then returns the failed session.
  try {
    const audioPath = await uploadAudio(file.buffer, file.mimetype, userId, sessionId, file.originalname);
    await updateSession(sessionId, userId, { status: 'uploaded', audio_path: audioPath });

    await updateSession(sessionId, userId, { status: 'processing' });

    const transcript    = await transcribeAudio(file.buffer, file.mimetype, file.originalname);
    const clinicalFacts = await extractClinicalFacts(transcript);
    const soapNote      = await generateSoap(clinicalFacts);

    return await updateSession(sessionId, userId, {
      status:         'completed',
      transcript,
      clinical_facts: clinicalFacts,
      soap_note:      soapNote,
      error:          null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown pipeline error';
    try {
      await updateSession(sessionId, userId, { status: 'failed', error: message });
    } catch {
      // best-effort — if this also fails, the original error still propagates
    }
    throw err;  // propagates to route → errorHandler → HTTP 500
  }
}
