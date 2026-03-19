import OpenAI from 'openai';
import { getConfig } from '../aws/secrets';

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  _client = new OpenAI({ apiKey: getConfig().openaiApiKey, timeout: 60_000 });
  return _client;
}
