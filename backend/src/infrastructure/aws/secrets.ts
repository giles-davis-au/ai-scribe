import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

export interface Config {
  supabaseUrl: string;
  supabaseServiceKey: string;
  supabaseAnonKey: string;
  openaiApiKey: string;
  serviceAccountEmail: string;
  serviceAccountPassword: string;
  apiKey: string;
  port: number;
}

// In development, read from .env.
// In production (App Runner), read from AWS Secrets Manager.
async function loadFromSecretsManager(
  secretName: string,
): Promise<Record<string, string>> {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "ap-southeast-2",
  });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName }),
  );
  if (!response.SecretString)
    throw new Error(`Secret ${secretName} has no string value`);
  return JSON.parse(response.SecretString) as Record<string, string>;
}

function loadFromEnv(): Record<string, string> {
  return process.env as Record<string, string>;
}

function buildConfig(raw: Record<string, string>): Config {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_ANON_KEY",
    "OPENAI_API_KEY",
    "SERVICE_ACCOUNT_EMAIL",
    "SERVICE_ACCOUNT_PASSWORD",
    "API_KEY",
  ] as const;
  for (const key of required) {
    if (!raw[key]) throw new Error(`Missing required config: ${key}`);
  }
  return {
    supabaseUrl: raw["SUPABASE_URL"]!,
    supabaseServiceKey: raw["SUPABASE_SERVICE_KEY"]!,
    supabaseAnonKey: raw["SUPABASE_ANON_KEY"]!,
    openaiApiKey: raw["OPENAI_API_KEY"]!,
    serviceAccountEmail: raw["SERVICE_ACCOUNT_EMAIL"]!,
    serviceAccountPassword: raw["SERVICE_ACCOUNT_PASSWORD"]!,
    apiKey: raw["API_KEY"]!,
    port: parseInt(raw["PORT"] ?? "3000", 10),
  };
}

let _config: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (_config) return _config;

  const secretName = process.env["AWS_SECRET_NAME"];
  const raw = secretName
    ? await loadFromSecretsManager(secretName)
    : loadFromEnv();

  _config = buildConfig(raw);
  return _config;
}

export function getConfig(): Config {
  if (!_config)
    throw new Error("Config not loaded — call loadConfig() at startup");
  return _config;
}
