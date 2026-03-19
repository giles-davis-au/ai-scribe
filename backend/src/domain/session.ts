export type SessionStatus =
  | 'created'
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed';

export interface ClinicalFacts {
  presentingComplaint: string | null;
  symptoms:            string[];
  duration:            string | null;
  medications:         string[];
  allergies:           string[];
  medicalHistory:      string[];
  examFindings:        string[];
  assessment:          string | null;
  plan:                string[];
  followUp:            string[];
  redFlags:            string[];
  uncertainties:       string[];
}

export interface SoapNote {
  subjective: string;
  objective:  string;
  assessment: string;
  plan:       string;
}

export interface Session {
  id:             string;
  userId:         string;
  status:         SessionStatus;
  audioPath:      string | null;
  transcript:     string | null;
  clinicalFacts:  ClinicalFacts | null;
  soapNote:       SoapNote | null;
  error:          string | null;
  createdAt:      string;
  updatedAt:      string;
}
