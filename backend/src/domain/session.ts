export type SessionStatus =
  | 'created'
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed';

export interface SoapNote {
  subjective: string;
  objective:  string;
  assessment: string;
  plan:       string;
}

export interface Session {
  id:         string;
  userId:     string;
  status:     SessionStatus;
  audioPath:  string | null;
  transcript: string | null;
  soapNote:   SoapNote | null;
  error:      string | null;
  createdAt:  string;
  updatedAt:  string;
}
