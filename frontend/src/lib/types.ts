export interface SoapNote {
  subjective: string;
  objective:  string;
  assessment: string;
  plan:       string;
}

export interface Session {
  id:           string;
  status:       string;
  transcript:   string | null;
  soapNote:     SoapNote | null;
  error:        string | null;
}
