import OpenAI from 'openai';
import { extractClinicalFacts } from './clinicalExtraction';
import { getOpenAIClient } from './client';
import type { ClinicalFacts } from '../../domain/session';

jest.mock('./client');

const mockGetOpenAIClient = getOpenAIClient as jest.MockedFunction<typeof getOpenAIClient>;
const mockCreate = jest.fn();

beforeEach(() => {
  mockGetOpenAIClient.mockReturnValue({
    chat: { completions: { create: mockCreate } },
  } as unknown as OpenAI);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockModelResponse(content: string | null) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content } }],
  });
}

const VALID_RESPONSE: ClinicalFacts = {
  presentingComplaint: 'Headache',
  symptoms:            ['nausea', 'photophobia'],
  duration:            '2 days',
  medications:         ['ibuprofen'],
  allergies:           ['penicillin'],
  medicalHistory:      ['hypertension'],
  examFindings:        ['alert', 'no focal deficits'],
  assessment:          'Migraine without aura',
  plan:                ['rest', 'hydration'],
  followUp:            ['review in 1 week'],
  redFlags:            [],
  uncertainties:       [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractClinicalFacts', () => {

  describe('OpenAI response validation', () => {
    it('throws when the model returns no content', async () => {
      mockModelResponse(null);

      await expect(extractClinicalFacts('some transcript'))
        .rejects.toThrow('Clinical extraction: empty response from model');
    });

    it('throws when the model returns an empty string', async () => {
      mockModelResponse('');

      await expect(extractClinicalFacts('some transcript'))
        .rejects.toThrow('Clinical extraction: empty response from model');
    });

    it('throws when choices array is empty', async () => {
      mockCreate.mockResolvedValue({ choices: [] });

      await expect(extractClinicalFacts('some transcript'))
        .rejects.toThrow('Clinical extraction: empty response from model');
    });

    it('throws when content is not valid JSON', async () => {
      mockModelResponse('here are the clinical facts: ...');

      await expect(extractClinicalFacts('some transcript'))
        .rejects.toThrow('Clinical extraction: model returned non-JSON content');
    });

    it('throws when model returns a JSON array instead of an object', async () => {
      mockModelResponse(JSON.stringify(['item1', 'item2']));

      await expect(extractClinicalFacts('some transcript'))
        .rejects.toThrow('Clinical extraction: model response is not a JSON object');
    });

    it('throws when model returns JSON null', async () => {
      mockModelResponse('null');

      await expect(extractClinicalFacts('some transcript'))
        .rejects.toThrow('Clinical extraction: model response is not a JSON object');
    });

    it('propagates errors thrown by the OpenAI client', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(extractClinicalFacts('some transcript'))
        .rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('happy path', () => {
    it('returns correctly structured ClinicalFacts from a well-formed response', async () => {
      mockModelResponse(JSON.stringify(VALID_RESPONSE));

      const result = await extractClinicalFacts('Patient presents with a two-day headache.');

      expect(result).toEqual(VALID_RESPONSE);
    });

    it('forwards the transcript as the user message content', async () => {
      mockModelResponse(JSON.stringify(VALID_RESPONSE));
      const transcript = 'Patient reports chest pain since this morning.';

      await extractClinicalFacts(transcript);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain(transcript);
    });

    it('requests json_object response format', async () => {
      mockModelResponse(JSON.stringify(VALID_RESPONSE));

      await extractClinicalFacts('transcript');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ response_format: { type: 'json_object' } }),
      );
    });
  });

  describe('field normalisation — scalar fields', () => {
    it('preserves string values for scalar fields', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, presentingComplaint: 'Chest pain', assessment: 'Angina' }));

      const result = await extractClinicalFacts('transcript');

      expect(result.presentingComplaint).toBe('Chest pain');
      expect(result.assessment).toBe('Angina');
    });

    it('coerces a numeric scalar to null', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, presentingComplaint: 42, duration: 2 }));

      const result = await extractClinicalFacts('transcript');

      expect(result.presentingComplaint).toBeNull();
      expect(result.duration).toBeNull();
    });

    it('coerces an object scalar to null', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, assessment: { value: 'migraine' } }));

      const result = await extractClinicalFacts('transcript');

      expect(result.assessment).toBeNull();
    });

    it('preserves null for missing scalar fields', async () => {
      const { presentingComplaint: _, duration: __, assessment: ___, ...rest } = VALID_RESPONSE;
      mockModelResponse(JSON.stringify(rest));

      const result = await extractClinicalFacts('transcript');

      expect(result.presentingComplaint).toBeNull();
      expect(result.duration).toBeNull();
      expect(result.assessment).toBeNull();
    });
  });

  describe('field normalisation — array fields', () => {
    it('preserves string arrays unchanged', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, symptoms: ['cough', 'fever'] }));

      const result = await extractClinicalFacts('transcript');

      expect(result.symptoms).toEqual(['cough', 'fever']);
    });

    it('returns an empty array when an array field is absent', async () => {
      const withoutSymptoms = { ...VALID_RESPONSE };
      delete (withoutSymptoms as Partial<ClinicalFacts>).symptoms;
      mockModelResponse(JSON.stringify(withoutSymptoms));

      const result = await extractClinicalFacts('transcript');

      expect(result.symptoms).toEqual([]);
    });

    it('returns an empty array when an array field is a plain string', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, medications: 'ibuprofen' }));

      const result = await extractClinicalFacts('transcript');

      expect(result.medications).toEqual([]);
    });

    it('returns an empty array when an array field is null', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, plan: null }));

      const result = await extractClinicalFacts('transcript');

      expect(result.plan).toEqual([]);
    });

    it('filters non-string items out of a mixed array', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, symptoms: ['nausea', 42, null, 'vomiting', true] }));

      const result = await extractClinicalFacts('transcript');

      expect(result.symptoms).toEqual(['nausea', 'vomiting']);
    });
  });

  describe('response shape edge cases', () => {
    it('ignores unexpected extra fields in the model response', async () => {
      mockModelResponse(JSON.stringify({ ...VALID_RESPONSE, unexpectedField: 'surprise' }));

      const result = await extractClinicalFacts('transcript');

      expect(result).not.toHaveProperty('unexpectedField');
    });

    it('returns all-null/empty-array facts when model returns an empty object', async () => {
      mockModelResponse(JSON.stringify({}));

      const result = await extractClinicalFacts('transcript');

      expect(result.presentingComplaint).toBeNull();
      expect(result.assessment).toBeNull();
      expect(result.duration).toBeNull();
      expect(result.symptoms).toEqual([]);
      expect(result.medications).toEqual([]);
      expect(result.plan).toEqual([]);
    });
  });
});
