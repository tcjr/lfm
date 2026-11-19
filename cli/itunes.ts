const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

export const DEFAULT_ITUNES_MIN_INTERVAL_MS = 4_000;
export const DEFAULT_ITUNES_COUNTRY = 'US';
export const DEFAULT_ITUNES_ARTWORK_SIZE = 600;

export class ItunesError extends Error {
  readonly status: number;
  readonly rateLimited: boolean;

  constructor(status: number, message: string, rateLimited = status === 403 || status === 429) {
    super(message);
    this.name = 'ItunesError';
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

export interface ItunesSearchResult {
  wrapperType?: string;
  collectionType?: string;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
}

export interface ItunesSearchResponse {
  resultCount: number;
  results: ItunesSearchResult[];
}

export interface ItunesSearchParams {
  term: string;
  entity: 'album' | 'song';
  limit?: number;
}

export interface ItunesSearchClient {
  search(params: ItunesSearchParams): Promise<ItunesSearchResponse>;
}

export interface ItunesClientOptions {
  country?: string;
  userAgent?: string;
  /** Apple's iTunes Search API allows roughly ~20 requests per minute. */
  minIntervalMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export class ItunesClient implements ItunesSearchClient {
  private readonly country: string;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  private lastRequestAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: ItunesClientOptions = {}) {
    this.country = options.country ?? DEFAULT_ITUNES_COUNTRY;
    this.userAgent = options.userAgent ?? 'lastfm-lab/0.1';
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_ITUNES_MIN_INTERVAL_MS;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async search(params: ItunesSearchParams): Promise<ItunesSearchResponse> {
    const query = new URLSearchParams({
      term: params.term,
      media: 'music',
      entity: params.entity,
      country: this.country,
      limit: String(params.limit ?? 10),
    });

    const url = `${ITUNES_SEARCH_URL}?${query.toString()}`;

    for (let attempt = 0; ; attempt++) {
      await this.throttle();

      const response = await this.fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': this.userAgent,
        },
      });

      const text = await response.text();

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < this.maxRetries) {
          const retryAfterSeconds = Number(response.headers.get('retry-after'));
          const retryDelayMs =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 && retryAfterSeconds <= 30
              ? retryAfterSeconds * 1000
              : 1000 * 2 ** attempt;
          await sleep(retryDelayMs);
          continue;
        }
        throw new ItunesError(
          response.status,
          `iTunes HTTP ${response.status}: ${text.slice(0, 300)}`,
          response.status === 403 || response.status === 429,
        );
      }

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`iTunes returned invalid JSON: ${text.slice(0, 300)}`);
      }

      if (
        typeof data !== 'object' ||
        data === null ||
        !Array.isArray((data as { results?: unknown }).results)
      ) {
        throw new Error(`iTunes returned unexpected payload: ${text.slice(0, 300)}`);
      }

      const parsed = data as ItunesSearchResponse;
      return {
        resultCount: Number(parsed.resultCount ?? parsed.results.length),
        results: parsed.results,
      };
    }
  }

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

/** Rewrite an iTunes thumbnail URL (e.g. `100x100bb.jpg`) to a higher square resolution (default `600x600bb`). */
export function upgradeItunesArtworkUrl(
  url: string | undefined,
  size = DEFAULT_ITUNES_ARTWORK_SIZE,
): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\/\d+x\d+bb(\.[a-z]+)$/i, `/${size}x${size}bb$1`);
}

/** Normalize music metadata text for strict comparison (case, diacritics, `&`/and, punctuation). */
export function normalizeMusicText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[&+]/g, ' and ')
    .replace(/['’ʼ`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function normalizeArtist(value: string): string {
  const normalized = normalizeMusicText(value);
  return normalized.startsWith('the ') && normalized.length > 4 ? normalized.slice(4) : normalized;
}

const EDITION_KEYWORDS_RE =
  /\b(deluxe|super deluxe|remaster(?:ed)?|expanded|bonus(?:\s+tracks?)?|anniversary|edition|version|from the vault|single|ep|explicit|clean|mono|stereo|reissue|complete|standard|digital|original\s+motion\s+picture\s+soundtrack)\b/i;

/** Strip standard trailing release/format suffixes (e.g. `- Single`, `(Remastered)`, `[Deluxe Edition]`). */
export function stripTitleEditionSuffixes(value: string): string {
  let current = value.trim();
  let previous = '';

  while (current !== previous) {
    previous = current;
    current = current.replace(/\s*[-–—]\s*(single|ep)\s*$/i, '').trim();

    const parenMatch = current.match(/\s*\(([^()]*)\)\s*$/);
    if (parenMatch && EDITION_KEYWORDS_RE.test(parenMatch[1] ?? '')) {
      current = current.slice(0, parenMatch.index).trim();
      continue;
    }

    const bracketMatch = current.match(/\s*\[([^\][]*)\]\s*$/);
    if (bracketMatch && EDITION_KEYWORDS_RE.test(bracketMatch[1] ?? '')) {
      current = current.slice(0, bracketMatch.index).trim();
    }
  }

  return current;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholeWords(haystack: string, needle: string): boolean {
  if (!haystack || !needle) {
    return false;
  }
  const re = new RegExp(`(?:^| )${escapeRegExp(needle)}(?: |$)`);
  return re.test(haystack);
}

export function titlesMatch(targetTitle: string, candidateTitle: string): boolean {
  const targetRaw = normalizeMusicText(targetTitle);
  const candRaw = normalizeMusicText(candidateTitle);
  if (!targetRaw || !candRaw) {
    return false;
  }
  if (targetRaw === candRaw) {
    return true;
  }

  const targetStripped = normalizeMusicText(stripTitleEditionSuffixes(targetTitle));
  const candStripped = normalizeMusicText(stripTitleEditionSuffixes(candidateTitle));
  return Boolean(targetStripped && candStripped && targetStripped === candStripped);
}

export function artistsMatch(
  targetArtist: string,
  candidateArtist: string,
  options: { allowVariousArtists?: boolean } = {},
): boolean {
  const target = normalizeArtist(targetArtist);
  const cand = normalizeArtist(candidateArtist);
  if (!target || !cand) {
    return false;
  }
  if (target === cand) {
    return true;
  }
  if (options.allowVariousArtists && cand === 'various artists') {
    return true;
  }
  return containsWholeWords(cand, target) || containsWholeWords(target, cand);
}

export interface ItunesMatch {
  imageUrl: string;
  matchedArtist: string;
  matchedTitle: string;
}

function isSpecificEnoughForVariousArtists(albumTitle: string): boolean {
  const stripped = normalizeMusicText(stripTitleEditionSuffixes(albumTitle));
  return stripped.length >= 8 || stripped.includes(' ');
}

/**
 * Pick the best strict-matching iTunes search result for a missing album or album-less track.
 * Returns `undefined` if no result passes strict normalized artist + title validation.
 */
export function pickBestItunesMatch(
  results: ItunesSearchResult[],
  target: { artist: string; album: string; track: string },
): ItunesMatch | undefined {
  const isAlbumLookup = target.album.trim() !== '';
  const targetTitle = isAlbumLookup ? target.album : target.track;
  const targetArtistNorm = normalizeArtist(target.artist);

  if (!targetArtistNorm || !targetTitle.trim()) {
    return undefined;
  }

  const candidates = results
    .map((result) => {
      const candidateArtist = result.artistName?.trim() ?? '';
      const candidateTitle =
        (isAlbumLookup ? result.collectionName : result.trackName)?.trim() ?? '';
      const imageUrl = upgradeItunesArtworkUrl(result.artworkUrl100 ?? result.artworkUrl60);
      return { candidateArtist, candidateTitle, imageUrl };
    })
    .filter(
      (item): item is { candidateArtist: string; candidateTitle: string; imageUrl: string } =>
        Boolean(item.candidateArtist && item.candidateTitle && item.imageUrl) &&
        titlesMatch(targetTitle, item.candidateTitle),
    );

  if (candidates.length === 0) {
    return undefined;
  }

  // Pass 1: exact normalized artist match
  const exactArtist = candidates.find(
    (item) => normalizeArtist(item.candidateArtist) === targetArtistNorm,
  );
  if (exactArtist) {
    return {
      imageUrl: exactArtist.imageUrl,
      matchedArtist: exactArtist.candidateArtist,
      matchedTitle: exactArtist.candidateTitle,
    };
  }

  // Pass 2: collaborative / orchestra credit match (whole-word containment)
  const collabArtist = candidates.find((item) =>
    artistsMatch(target.artist, item.candidateArtist, { allowVariousArtists: false }),
  );
  if (collabArtist) {
    return {
      imageUrl: collabArtist.imageUrl,
      matchedArtist: collabArtist.candidateArtist,
      matchedTitle: collabArtist.candidateTitle,
    };
  }

  // Pass 3 (albums only): "Various Artists" compilation with sufficiently specific exact album title
  if (isAlbumLookup && isSpecificEnoughForVariousArtists(target.album)) {
    const compilation = candidates.find((item) =>
      artistsMatch(target.artist, item.candidateArtist, { allowVariousArtists: true }),
    );
    if (compilation) {
      return {
        imageUrl: compilation.imageUrl,
        matchedArtist: compilation.candidateArtist,
        matchedTitle: compilation.candidateTitle,
      };
    }
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
