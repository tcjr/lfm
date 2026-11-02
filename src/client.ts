import { createHash } from "node:crypto";

const API_ROOT = "https://ws.audioscrobbler.com/2.0/";
const AUTH_URL = "https://www.last.fm/api/auth/";

export class LastfmError extends Error {
  readonly code: number;
  readonly method: string;

  constructor(code: number, message: string, method: string) {
    super(`[${code}] ${message} (${method})`);
    this.name = "LastfmError";
    this.code = code;
    this.method = method;
  }
}

export type ParamValue = string | number | boolean | null | undefined;

export interface LastfmClientOptions {
  apiKey: string;
  /** Required for signed methods (auth, scrobbling, loving tracks, ...). */
  apiSecret?: string;
  /** Defaults to LASTFM_SESSION_KEY when using `createClient()`. */
  sessionKey?: string;
  userAgent?: string;
  /** Last.fm allows roughly 5 requests per second. */
  minIntervalMs?: number;
  maxRetries?: number;
}

export interface Session {
  name: string;
  key: string;
  subscriber: number;
}

export interface CallOptions {
  /** Sign the request with api_sig. Requires `apiSecret`. */
  signed?: boolean;
}

/**
 * A tiny typed wrapper around https://ws.audioscrobbler.com/2.0/.
 *
 * The generic `call()` method works with any Last.fm method, which makes it
 * easy to try things out before adding a typed helper.
 */
export class LastfmClient {
  readonly apiKey: string;

  private readonly apiSecret?: string;
  private sessionKey?: string;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;

  private lastRequestAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: LastfmClientOptions) {
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.sessionKey = options.sessionKey;
    this.userAgent = options.userAgent ?? "lastfm-lab/0.1";
    this.minIntervalMs = options.minIntervalMs ?? 200;
    this.maxRetries = options.maxRetries ?? 2;
  }

  setSessionKey(sessionKey: string): void {
    this.sessionKey = sessionKey;
  }

  async call<T = unknown>(
    method: string,
    params: Record<string, ParamValue> = {},
    options: CallOptions = {},
  ): Promise<T> {
    const query = new URLSearchParams({
      method,
      api_key: this.apiKey,
      format: "json",
    });

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        query.set(key, String(value));
      }
    }

    if (options.signed) {
      if (!this.apiSecret) {
        throw new Error(`"${method}" is a signed method, but no API secret was configured.`);
      }
      if (this.sessionKey) {
        query.set("sk", this.sessionKey);
      }
      query.set("api_sig", this.signature(query));
    }

    const data = await this.request(`${API_ROOT}?${query.toString()}`, method);
    return data as T;
  }

  /** Get a request token for the desktop/browser auth flow. */
  async getToken(): Promise<string> {
    const response = await this.call<{ token: string }>("auth.getToken", {}, { signed: true });
    return response.token;
  }

  /** Build the URL the user visits to authorize the token. */
  getAuthUrl(token: string, callbackUrl?: string): string {
    const url = new URL(AUTH_URL);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("token", token);
    if (callbackUrl) {
      url.searchParams.set("cb", callbackUrl);
    }
    return url.toString();
  }

  /** Exchange an authorized token for a session key. */
  async getSession(token: string): Promise<Session> {
    const response = await this.call<{ session: Session }>(
      "auth.getSession",
      { token },
      { signed: true },
    );
    this.sessionKey = response.session.key;
    return response.session;
  }

  private signature(params: URLSearchParams): string {
    if (!this.apiSecret) {
      throw new Error("Cannot sign a request without an API secret.");
    }

    const keys = [...params.keys()]
      .filter((key) => key !== "format" && key !== "callback" && key !== "api_sig")
      .sort();

    const raw = keys.map((key) => `${key}${params.get(key) ?? ""}`).join("");
    return createHash("md5").update(raw + this.apiSecret).digest("hex");
  }

  private async request(url: string, method: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent,
        },
      });

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }

      if (isLastfmErrorBody(data)) {
        throw new LastfmError(data.error, data.message, method);
      }

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < this.maxRetries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new Error(`Last.fm HTTP ${response.status} for ${method}: ${text.slice(0, 300)}`);
      }

      if (data === undefined) {
        throw new Error(`Last.fm returned invalid JSON for ${method}: ${text.slice(0, 300)}`);
      }

      return data;
    }
  }

  /** Serialize requests and keep them under Last.fm's rate limit. */
  private async throttle(): Promise<void> {
    const turn = this.queue.then(async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) {
        await sleep(wait);
      }
      this.lastRequestAt = Date.now();
    });

    this.queue = turn.catch(() => {});
    await turn;
  }
}

function isLastfmErrorBody(value: unknown): value is { error: number; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "number" &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
