import { getOpenAIClient } from './client';
import { ClinicalFacts, SoapNote } from '../../domain/session';

const SYSTEM_PROMPT = `You are a clinical documentation assistant. Write a structured SOAP note from the clinical facts provided by the user.

Return ONLY a JSON object with exactly these keys:
{
  "subjective": string,
  "objective": string,
  "assessment": string,
  "plan": string
}

Rules:
- Write in professional clinical language suitable for a medical record.
- Subjective: patient-reported symptoms, complaints, and history.
- Objective: examination findings and measurable observations.
- Assessment: clinical impression, diagnosis or differential.
- Plan: treatment, medications, referrals, and follow-up.
- Base the note only on the provided facts. Do not add speculative details.
- Each field must be a non-empty string.`;

function normaliseSoapNote(raw: unknown): SoapNote {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('SOAP generation: model response is not a JSON object');
  }

  const r = raw as Record<string, unknown>;
  const fields = ['subjective', 'objective', 'assessment', 'plan'] as const;

  for (const key of fields) {
    if (typeof r[key] !== 'string' || !(r[key] as string).trim()) {
      throw new Error(`SOAP generation: missing or empty field "${key}"`);
    }
  }

  return {
    subjective: (r['subjective'] as string).trim(),
    objective:  (r['objective']  as string).trim(),
    assessment: (r['assessment'] as string).trim(),
    plan:       (r['plan']       as string).trim(),
  };
}

export async function generateSoap(clinicalFacts: ClinicalFacts): Promise<SoapNote> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `Clinical facts:\n${JSON.stringify(clinicalFacts, null, 2)}` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('SOAP generation: empty response from model');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('SOAP generation: model returned non-JSON content');
  }

  return normaliseSoapNote(parsed);
}
