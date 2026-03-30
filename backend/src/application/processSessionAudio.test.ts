import { processSessionAudio } from './processSessionAudio';
import { getSession, updateSession } from '../infrastructure/supabase/sessions.repo';
import { uploadAudio } from '../infrastructure/supabase/storage';
import { transcribeAudio } from '../infrastructure/openai/transcription';
import { extractClinicalFacts } from '../infrastructure/openai/clinicalExtraction';
import { generateSoap } from '../infrastructure/openai/soapGeneration';
import { NotFoundError, ValidationError } from '../shared/errors';
import type { Session, ClinicalFacts, SoapNote } from '../domain/session';

jest.mock('../infrastructure/supabase/sessions.repo');
jest.mock('../infrastructure/supabase/storage');
jest.mock('../infrastructure/openai/transcription');
jest.mock('../infrastructure/openai/clinicalExtraction');
jest.mock('../infrastructure/openai/soapGeneration');

const mockGetSession          = getSession          as jest.MockedFunction<typeof getSession>;
const mockUpdateSession       = updateSession       as jest.MockedFunction<typeof updateSession>;
const mockUploadAudio         = uploadAudio         as jest.MockedFunction<typeof uploadAudio>;
const mockTranscribeAudio     = transcribeAudio     as jest.MockedFunction<typeof transcribeAudio>;
const mockExtractClinicalFacts = extractClinicalFacts as jest.MockedFunction<typeof extractClinicalFacts>;
const mockGenerateSoap        = generateSoap        as jest.MockedFunction<typeof generateSoap>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-123';
const USER_ID    = 'user-456';

const fakeFile = {
  buffer:       Buffer.from('audio data'),
  mimetype:     'audio/webm',
  originalname: 'recording.webm',
} as Express.Multer.File;

const fakeClinicalFacts: ClinicalFacts = {
  presentingComplaint: 'Headache',
  symptoms:            ['nausea'],
  duration:            '2 days',
  medications:         [],
  allergies:           [],
  medicalHistory:      [],
  examFindings:        [],
  assessment:          'Migraine',
  plan:                ['rest'],
  followUp:            [],
  redFlags:            [],
  uncertainties:       [],
};

const fakeSoapNote: SoapNote = {
  subjective: 'Patient reports headache',
  objective:  'Alert, no focal deficits',
  assessment: 'Migraine without aura',
  plan:       'Rest, hydration, ibuprofen PRN',
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id:            SESSION_ID,
    userId:        USER_ID,
    status:        'created',
    audioPath:     null,
    transcript:    null,
    clinicalFacts: null,
    soapNote:      null,
    error:         null,
    createdAt:     '2024-01-01T00:00:00Z',
    updatedAt:     '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processSessionAudio', () => {

  describe('pre-flight ownership and status guards', () => {
    it('throws NotFoundError when the session does not exist', async () => {
      mockGetSession.mockResolvedValue(null as unknown as Session);

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile))
        .rejects.toThrow(NotFoundError);

      expect(mockUploadAudio).not.toHaveBeenCalled();
    });

    it('throws ValidationError when session is already processing', async () => {
      mockGetSession.mockResolvedValue(makeSession({ status: 'processing' }));

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile))
        .rejects.toThrow(new ValidationError('Session is already processing'));

      expect(mockUploadAudio).not.toHaveBeenCalled();
    });

    it('throws ValidationError when session is already completed', async () => {
      mockGetSession.mockResolvedValue(makeSession({ status: 'completed' }));

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile))
        .rejects.toThrow(new ValidationError('Session is already completed'));

      expect(mockUploadAudio).not.toHaveBeenCalled();
    });

    it.each(['created', 'uploaded', 'failed'] as const)(
      'allows processing when session status is "%s"',
      async (status) => {
        mockGetSession.mockResolvedValue(makeSession({ status }));
        mockUploadAudio.mockResolvedValue('storage/path/audio.webm');
        mockUpdateSession.mockResolvedValue(makeSession({ status: 'completed' }));
        mockTranscribeAudio.mockResolvedValue('transcript text');
        mockExtractClinicalFacts.mockResolvedValue(fakeClinicalFacts);
        mockGenerateSoap.mockResolvedValue(fakeSoapNote);

        await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile)).resolves.toBeDefined();
      },
    );
  });

  describe('happy path', () => {
    const AUDIO_PATH  = 'users/user-456/sessions/session-123/original.webm';
    const TRANSCRIPT  = 'Patient presents with a two-day headache.';
    const completedSession = makeSession({ status: 'completed' });

    beforeEach(() => {
      mockGetSession.mockResolvedValue(makeSession());
      mockUploadAudio.mockResolvedValue(AUDIO_PATH);
      mockUpdateSession.mockResolvedValue(completedSession);
      mockTranscribeAudio.mockResolvedValue(TRANSCRIPT);
      mockExtractClinicalFacts.mockResolvedValue(fakeClinicalFacts);
      mockGenerateSoap.mockResolvedValue(fakeSoapNote);
    });

    it('uploads audio with the correct file fields', async () => {
      await processSessionAudio(SESSION_ID, USER_ID, fakeFile);

      expect(mockUploadAudio).toHaveBeenCalledWith(
        fakeFile.buffer,
        fakeFile.mimetype,
        USER_ID,
        SESSION_ID,
        fakeFile.originalname,
      );
    });

    it('transitions status to uploaded (with audio path) then to processing', async () => {
      await processSessionAudio(SESSION_ID, USER_ID, fakeFile);

      const calls = mockUpdateSession.mock.calls;
      expect(calls[0]).toEqual([SESSION_ID, USER_ID, { status: 'uploaded', audio_path: AUDIO_PATH }]);
      expect(calls[1]).toEqual([SESSION_ID, USER_ID, { status: 'processing' }]);
    });

    it('transcribes audio with the correct file fields', async () => {
      await processSessionAudio(SESSION_ID, USER_ID, fakeFile);

      expect(mockTranscribeAudio).toHaveBeenCalledWith(
        fakeFile.buffer,
        fakeFile.mimetype,
        fakeFile.originalname,
      );
    });

    it('passes the transcript to clinical extraction', async () => {
      await processSessionAudio(SESSION_ID, USER_ID, fakeFile);
      expect(mockExtractClinicalFacts).toHaveBeenCalledWith(TRANSCRIPT);
    });

    it('passes clinical facts to SOAP generation', async () => {
      await processSessionAudio(SESSION_ID, USER_ID, fakeFile);
      expect(mockGenerateSoap).toHaveBeenCalledWith(fakeClinicalFacts);
    });

    it('marks session completed with all pipeline outputs and clears error field', async () => {
      await processSessionAudio(SESSION_ID, USER_ID, fakeFile);

      const lastCall = mockUpdateSession.mock.calls.at(-1);
      expect(lastCall).toEqual([
        SESSION_ID,
        USER_ID,
        {
          status:         'completed',
          transcript:     TRANSCRIPT,
          clinical_facts: fakeClinicalFacts,
          soap_note:      fakeSoapNote,
          error:          null,
        },
      ]);
    });

    it('returns the updated session from the final updateSession call', async () => {
      const result = await processSessionAudio(SESSION_ID, USER_ID, fakeFile);
      expect(result).toBe(completedSession);
    });
  });

  describe('pipeline failure handling', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue(makeSession());
      mockUploadAudio.mockResolvedValue('storage/path/audio.webm');
      // First two updateSession calls (uploaded, processing) succeed; failure update also resolves
      mockUpdateSession.mockResolvedValue(makeSession({ status: 'failed' }));
    });

    it('marks session as failed when transcription throws', async () => {
      const transcriptionError = new Error('Whisper API unavailable');
      mockTranscribeAudio.mockRejectedValue(transcriptionError);

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile))
        .rejects.toThrow('Whisper API unavailable');

      const failedCall = mockUpdateSession.mock.calls.find(
        ([, , patch]) => patch.status === 'failed',
      );
      expect(failedCall).toBeDefined();
      expect(failedCall![2]).toMatchObject({ status: 'failed', error: 'Whisper API unavailable' });
    });

    it('marks session as failed when clinical extraction throws', async () => {
      mockTranscribeAudio.mockResolvedValue('some transcript');
      mockExtractClinicalFacts.mockRejectedValue(new Error('GPT-4o rate limit'));

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile))
        .rejects.toThrow('GPT-4o rate limit');

      const failedCall = mockUpdateSession.mock.calls.find(
        ([, , patch]) => patch.status === 'failed',
      );
      expect(failedCall![2]).toMatchObject({ status: 'failed', error: 'GPT-4o rate limit' });
    });

    it('marks session as failed when SOAP generation throws', async () => {
      mockTranscribeAudio.mockResolvedValue('transcript');
      mockExtractClinicalFacts.mockResolvedValue(fakeClinicalFacts);
      mockGenerateSoap.mockRejectedValue(new Error('SOAP generation failed'));

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile))
        .rejects.toThrow('SOAP generation failed');

      const failedCall = mockUpdateSession.mock.calls.find(
        ([, , patch]) => patch.status === 'failed',
      );
      expect(failedCall).toBeDefined();
    });

    it('uses "Unknown pipeline error" when a non-Error value is thrown', async () => {
      mockTranscribeAudio.mockRejectedValue('a plain string error');

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile)).rejects.toBe(
        'a plain string error',
      );

      const failedCall = mockUpdateSession.mock.calls.find(
        ([, , patch]) => patch.status === 'failed',
      );
      expect(failedCall![2]).toMatchObject({ error: 'Unknown pipeline error' });
    });

    it('re-throws the original pipeline error, not a secondary failure update error', async () => {
      const pipelineError = new Error('Primary pipeline failure');
      mockTranscribeAudio.mockRejectedValue(pipelineError);
      // Failure status update itself also fails
      mockUpdateSession
        .mockResolvedValueOnce(makeSession({ status: 'uploaded' }))  // uploaded
        .mockResolvedValueOnce(makeSession({ status: 'processing' })) // processing
        .mockRejectedValueOnce(new Error('DB write failed'));          // failed update

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile))
        .rejects.toThrow('Primary pipeline failure');
    });

    it('still attempts the failure status update even when an early pipeline step fails', async () => {
      mockTranscribeAudio.mockRejectedValue(new Error('network error'));

      await expect(processSessionAudio(SESSION_ID, USER_ID, fakeFile)).rejects.toThrow();

      const statusValues = mockUpdateSession.mock.calls.map(([, , patch]) => patch.status);
      expect(statusValues).toContain('failed');
    });
  });
});
