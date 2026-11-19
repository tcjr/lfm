import type { DatabaseSync } from 'node:sqlite';
import {
  buildArtworkOverrideIndex,
  listArtworkOverrides,
  overrideMapKey,
  upsertArtworkOverride,
  type ArtworkOverride,
} from './artwork-overrides.ts';
import { LastfmError, type LastfmClient } from './client.ts';
import { trackInfo, trackInfoByMbid } from './endpoints.ts';
import { bestImage, LASTFM_PLACEHOLDER_IMAGE_HASH } from './format.ts';

export const ENRICH_SOURCES = ['self', 'lastfm-track'] as const;

export type EnrichSource = (typeof ENRICH_SOURCES)[number];

/** Last.fm error codes that indicate an invalid/suspended key or rate limit (abort run). */
export const FATAL_LASTFM_ERROR_CODES = new Set([10, 26, 29]);

/** Last.fm error codes that indicate a clean track miss (safe to cache as `not_found`). */
export const CLEAN_MISS_LASTFM_ERROR_CODES = new Set([6]);

export type LastfmTrackClient = Pick<LastfmClient, 'call'>;

export interface LastfmTrackCandidate {
  artist: string;
  track: string;
  trackMbid: string;
  matchCount: number;
  lastScrobbledAt: number;
}

export type LastfmTrackOutcomeStatus =
  'inserted' | 'updated' | 'not-found' | 'kept-existing' | 'error';

export interface LastfmTrackOutcome {
  artist: string;
  track: string;
  matchCount: number;
  status: LastfmTrackOutcomeStatus;
  imageUrl?: string;
  matchedVia?: 'artist-track' | 'mbid';
  errorMessage?: string;
}

export interface LastfmTrackProgressEvent {
  index: number;
  total: number;
  outcome: LastfmTrackOutcome;
}

export interface EnrichLastfmTrackOptions {
  user?: string;
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
  retryNotFound?: boolean;
  excludeKeys?: ReadonlySet<string>;
  nowSeconds?: () => number;
  onProgress?: (event: LastfmTrackProgressEvent) => void;
}

export interface LastfmTrackEnrichResult {
  outcomes: LastfmTrackOutcome[];
  totalEligible: number;
  queried: number;
  inserted: number;
  updated: number;
  notFound: number;
  keptExisting: number;
  errors: number;
  skippedManual: number;
  skippedExisting: number;
  skippedNotFound: number;
  skippedResolvedInRun: number;
  dryRun: boolean;
}

interface MissingAlbumlessRow {
  uts: number;
  artist: string;
  track: string;
  track_mbid: string;
}

const VALID_ENRICH_SOURCES = new Set<string>(ENRICH_SOURCES);

export function parseEnrichSources(raw?: string): EnrichSource[] {
  if (!raw?.trim()) {
    return [...ENRICH_SOURCES];
  }

  const requested = new Set<EnrichSource>();
  for (const part of raw.split(',')) {
    const normalized = part.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (!VALID_ENRICH_SOURCES.has(normalized)) {
      throw new Error(
        `Invalid --source "${part.trim()}". Expected a comma-separated list of: ${ENRICH_SOURCES.join(', ')}.`,
      );
    }
    requested.add(normalized as EnrichSource);
  }

  if (requested.size === 0) {
    throw new Error(
      `Invalid --source "${raw}". Expected a comma-separated list of: ${ENRICH_SOURCES.join(', ')}.`,
    );
  }

  // Always run tiers in canonical priority order (e.g. `self` before `lastfm-track`).
  return ENRICH_SOURCES.filter((source) => requested.has(source));
}

function isFatalLastfmError(error: unknown): error is LastfmError {
  return error instanceof LastfmError && FATAL_LASTFM_ERROR_CODES.has(error.code);
}

function isCleanMissLastfmError(error: unknown): error is LastfmError {
  return error instanceof LastfmError && CLEAN_MISS_LASTFM_ERROR_CODES.has(error.code);
}

export async function lookupLastfmTrackArtwork(
  client: LastfmTrackClient,
  target: { artist: string; track: string; trackMbid?: string },
): Promise<{ imageUrl?: string; matchedVia?: 'artist-track' | 'mbid' }> {
  const typedClient = client as LastfmClient;

  try {
    const response = await trackInfo(typedClient, target.artist, target.track, { autocorrect: 1 });
    const imageUrl = bestImage(response.track?.album?.image) ?? bestImage(response.track?.image);
    if (imageUrl) {
      return { imageUrl, matchedVia: 'artist-track' };
    }
  } catch (error) {
    if (isFatalLastfmError(error) || !isCleanMissLastfmError(error)) {
      throw error;
    }
  }

  const mbid = target.trackMbid?.trim();
  if (mbid) {
    try {
      const response = await trackInfoByMbid(typedClient, mbid, { autocorrect: 1 });
      const imageUrl = bestImage(response.track?.album?.image) ?? bestImage(response.track?.image);
      if (imageUrl) {
        return { imageUrl, matchedVia: 'mbid' };
      }
    } catch (error) {
      if (isFatalLastfmError(error) || !isCleanMissLastfmError(error)) {
        throw error;
      }
    }
  }

  return {};
}

/**
 * Tier 2 automated enrichment: query Last.fm `track.getInfo` for album-less
 * scrobbles (`album = ''`) missing artwork.
 *
 * - Queries `(artist, track)` with `autocorrect=1` first, falling back to `track_mbid` on a clean miss.
 * - Always stores overrides under the scrobble's original `(artist, '', track)` key.
 * - Caches clean misses as `source = 'not_found'` (`image_url = ''`) unless an existing non-empty override exists.
 * - Persists each resolved row incrementally when `dryRun` is false.
 */
export async function enrichLastfmTrackArtwork(
  db: DatabaseSync,
  client: LastfmTrackClient,
  options: EnrichLastfmTrackOptions = {},
): Promise<LastfmTrackEnrichResult> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const retryNotFound = options.retryNotFound ?? false;
  const excludeKeys = options.excludeKeys;
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const placeholderPattern = `%${LASTFM_PLACEHOLDER_IMAGE_HASH}%`;

  const rows = (options.user
    ? db
        .prepare(
          `SELECT uts, artist, track, track_mbid
             FROM scrobbles
             WHERE user = ? AND album = '' AND (image_url = '' OR image_url LIKE ?)
             ORDER BY uts DESC`,
        )
        .all(options.user.toLowerCase(), placeholderPattern)
    : db
        .prepare(
          `SELECT uts, artist, track, track_mbid
             FROM scrobbles
             WHERE album = '' AND (image_url = '' OR image_url LIKE ?)
             ORDER BY uts DESC`,
        )
        .all(placeholderPattern)) as unknown as MissingAlbumlessRow[];

  const grouped = new Map<string, LastfmTrackCandidate>();
  for (const row of rows) {
    const artist = row.artist.trim();
    const track = row.track.trim();
    if (!artist || !track) {
      continue;
    }

    const key = overrideMapKey(artist, '', track);
    const existing = grouped.get(key);
    if (existing) {
      existing.matchCount++;
      if (row.uts > existing.lastScrobbledAt) {
        existing.lastScrobbledAt = row.uts;
      }
      if (!existing.trackMbid && row.track_mbid.trim()) {
        existing.trackMbid = row.track_mbid.trim();
      }
    } else {
      grouped.set(key, {
        artist,
        track,
        trackMbid: row.track_mbid.trim(),
        matchCount: 1,
        lastScrobbledAt: row.uts,
      });
    }
  }

  const orderedCandidates = [...grouped.values()].sort(
    (a, b) =>
      b.matchCount - a.matchCount ||
      b.lastScrobbledAt - a.lastScrobbledAt ||
      a.artist.localeCompare(b.artist) ||
      a.track.localeCompare(b.track),
  );

  const existingOverrides = buildArtworkOverrideIndex(listArtworkOverrides(db));
  const eligible: Array<{ candidate: LastfmTrackCandidate; existing?: ArtworkOverride }> = [];

  let skippedManual = 0;
  let skippedExisting = 0;
  let skippedNotFound = 0;
  let skippedResolvedInRun = 0;

  for (const candidate of orderedCandidates) {
    const key = overrideMapKey(candidate.artist, '', candidate.track);
    if (excludeKeys?.has(key)) {
      skippedResolvedInRun++;
      continue;
    }

    const existing = existingOverrides.get(key);
    if (existing?.source === 'manual') {
      skippedManual++;
      continue;
    }

    if (existing?.source === 'not_found') {
      if (!retryNotFound && !force) {
        skippedNotFound++;
        continue;
      }
      eligible.push({ candidate, existing });
      continue;
    }

    if (existing && existing.imageUrl !== '') {
      if (!force) {
        skippedExisting++;
        continue;
      }
      eligible.push({ candidate, existing });
      continue;
    }

    eligible.push({ candidate, existing });
  }

  const queue =
    options.limit !== undefined && options.limit > 0 ? eligible.slice(0, options.limit) : eligible;

  const outcomes: LastfmTrackOutcome[] = [];
  let inserted = 0;
  let updated = 0;
  let notFound = 0;
  let keptExisting = 0;
  let errors = 0;

  for (let i = 0; i < queue.length; i++) {
    const { candidate, existing } = queue[i]!;
    let outcome: LastfmTrackOutcome;

    try {
      const lookup = await lookupLastfmTrackArtwork(client, {
        artist: candidate.artist,
        track: candidate.track,
        trackMbid: candidate.trackMbid,
      });

      if (lookup.imageUrl) {
        const status: LastfmTrackOutcomeStatus = existing ? 'updated' : 'inserted';
        if (!dryRun) {
          upsertArtworkOverride(db, {
            artist: candidate.artist,
            album: '',
            track: candidate.track,
            imageUrl: lookup.imageUrl,
            source: 'lastfm-track',
            updatedAt: nowSeconds(),
          });
        }
        if (status === 'updated') {
          updated++;
        } else {
          inserted++;
        }
        outcome = {
          artist: candidate.artist,
          track: candidate.track,
          matchCount: candidate.matchCount,
          status,
          imageUrl: lookup.imageUrl,
          matchedVia: lookup.matchedVia,
        };
      } else if (existing && existing.imageUrl !== '') {
        // Never downgrade an existing non-empty override to `not_found`, even under `--force`.
        keptExisting++;
        outcome = {
          artist: candidate.artist,
          track: candidate.track,
          matchCount: candidate.matchCount,
          status: 'kept-existing',
          imageUrl: existing.imageUrl,
        };
      } else {
        if (!dryRun) {
          upsertArtworkOverride(db, {
            artist: candidate.artist,
            album: '',
            track: candidate.track,
            imageUrl: '',
            source: 'not_found',
            updatedAt: nowSeconds(),
          });
        }
        notFound++;
        outcome = {
          artist: candidate.artist,
          track: candidate.track,
          matchCount: candidate.matchCount,
          status: 'not-found',
        };
      }
    } catch (error) {
      if (isFatalLastfmError(error)) {
        throw error;
      }

      errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      outcome = {
        artist: candidate.artist,
        track: candidate.track,
        matchCount: candidate.matchCount,
        status: 'error',
        errorMessage,
      };
    }

    outcomes.push(outcome);
    options.onProgress?.({
      index: i + 1,
      total: queue.length,
      outcome,
    });
  }

  return {
    outcomes,
    totalEligible: eligible.length,
    queried: queue.length,
    inserted,
    updated,
    notFound,
    keptExisting,
    errors,
    skippedManual,
    skippedExisting,
    skippedNotFound,
    skippedResolvedInRun,
    dryRun,
  };
}
