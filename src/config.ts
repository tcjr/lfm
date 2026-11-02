import { existsSync } from "node:fs";
import { LastfmClient } from "./client.ts";

const ENV_FILE = ".env";

export interface LastfmConfig {
  apiKey: string;
  apiSecret?: string;
  sessionKey?: string;
  user?: string;
}

/** Load `.env` if present. Existing environment variables win. */
export function loadEnv(): void {
  if (!existsSync(ENV_FILE)) {
    return;
  }

  try {
    process.loadEnvFile(ENV_FILE);
  } catch (error) {
    console.warn(`Could not load ${ENV_FILE}:`, error);
  }
}

export function getConfig(): LastfmConfig {
  loadEnv();

  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      [
        "Missing LASTFM_API_KEY.",
        "",
        "  1. Create an API account: https://www.last.fm/api/account/create",
        "  2. cp .env.example .env",
        "  3. Put your key in .env",
      ].join("\n"),
    );
    process.exit(1);
  }

  return {
    apiKey,
    apiSecret: process.env.LASTFM_API_SECRET?.trim() || undefined,
    sessionKey: process.env.LASTFM_SESSION_KEY?.trim() || undefined,
    user: process.env.LASTFM_USER?.trim() || undefined,
  };
}

export function createClient(): LastfmClient {
  const config = getConfig();
  return new LastfmClient({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    sessionKey: config.sessionKey,
  });
}
