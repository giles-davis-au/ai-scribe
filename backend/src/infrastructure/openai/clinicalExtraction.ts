import { getOpenAIClient } from './client';
import { ClinicalFacts } from '../../domain/session';

const SYSTEM_PROMPT = `You are a clinical documentation assistant. Extract structured clinical facts from the medical encounter transcript provided by the user.

Return ONLY a JSON object with exactly these keys:
{
  "presentingComplaint": string or null,
  "symptoms": string[],
  "duration": string or null,
  "medications": string[],
  "allergies": string[],
  "medicalHistory": string[],
  "examFindings": string[],
  "assessment": string or null,
  "plan": string[],
  "followUp": string[],
  "redFlags": string[],
  "uncertainties": string[]
}

Rules:
- Extract only facts clearly stated in the transcript. Do not infer or hallucinate.
- Use null for missing scalar values and empty arrays for missing list values.
- Be concise and factual. Do not add narrative.`;

function toStringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function normaliseClinicalFacts(raw: unknown): ClinicalFacts {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Clinical extraction: model response is not a JSON object');
  }

  const r = raw as Record<string, unknown>;

  return {
    presentingComplaint: toStringOrNull(r['presentingComplaint']),
    symptoms:            toStringArray(r['symptoms']),
    duration:            toStringOrNull(r['duration']),
    medications:         toStringArray(r['medications']),
    allergies:           toStringArray(r['allergies']),
    medicalHistory:      toStringArray(r['medicalHistory']),
    examFindings:        toStringArray(r['examFindings']),
    assessment:          toStringOrNull(r['assessment']),
    plan:                toStringArray(r['plan']),
    followUp:            toStringArray(r['followUp']),
    redFlags:            toStringArray(r['redFlags']),
    uncertainties:       toStringArray(r['uncertainties']),
  };
}

export async function extractClinicalFacts(transcript: string): Promise<ClinicalFacts> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `Transcript:\n${transcript}` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Clinical extraction: empty response from model');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Clinical extraction: model returned non-JSON content');
  }

  return normaliseClinicalFacts(parsed);
}
