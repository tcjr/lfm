import type { DatabaseSync } from 'node:sqlite';
import { isPlaceholderImageUrl, LASTFM_PLACEHOLDER_IMAGE_HASH } from './format.ts';

export const ARTWORK_OVERRIDE_SOURCES = [
  'manual',
  'self',
  'lastfm-track',
  'caa',
  'itunes',
  'not_found',
] as const;

export type ArtworkOverrideSource = (typeof ARTWORK_OVERRIDE_SOURCES)[number];

export const ARTWORK_OVERRIDES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS artwork_overrides (
    artist TEXT NOT NULL COLLATE NOCASE,
    album TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
    track TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
    image_url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (artist, album, track)
  );
`;

export interface ArtworkOverrideKey {
  artist: string;
  album?: string;
  track?: string;
}

export interface NormalizedArtworkOverrideKey {
  artist: string;
  album: string;
  track: string;
}

export interface ArtworkOverride {
  artist: string;
  album: string;
  track: string;
  imageUrl: string;
  source: ArtworkOverrideSource;
  updatedAt: number;
}

export interface UpsertArtworkOverrideInput extends ArtworkOverrideKey {
  imageUrl: string;
  source?: ArtworkOverrideSource;
  updatedAt?: number;
}

export interface ResolvedArtwork {
  imageUrl?: string;
  fromOverride: boolean;
  overrideSource?: ArtworkOverrideSource;
  clearedByManual: boolean;
}

export interface MissingArtworkEntry {
  artist: string;
  album: string;
  track: string;
  scrobbleCount: number;
  lastScrobbledAt: number;
}

export interface MissingArtworkReport {
  entries: MissingArtworkEntry[];
  totalGroups: number;
  totalScrobbles: number;
}

export interface SelfHealCandidate {
  artist: string;
  album: string;
  track: string;
  imageUrl: string;
  matchCount: number;
  action: 'insert' | 'update' | 'skip-existing' | 'skip-manual';
  existingSource?: ArtworkOverrideSource;
}

export interface SelfHealResult {
  candidates: SelfHealCandidate[];
  inserted: number;
  updated: number;
  skippedManual: number;
  skippedExisting: number;
  dryRun: boolean;
}

interface ArtworkOverrideRow {
  artist: string;
  album: string;
  track: string;
  image_url: string;
  source: string;
  updated_at: number;
}

interface ScrobbleArtworkRow {
  uts: number;
  artist: string;
  album: string;
  track: string;
  image_url: string;
}

const VALID_SOURCES = new Set<string>(ARTWORK_OVERRIDE_SOURCES);

export function isArtworkOverrideSource(value: string): value is ArtworkOverrideSource {
  return VALID_SOURCES.has(value);
}

export function normalizeOverrideKey(key: ArtworkOverrideKey): NormalizedArtworkOverrideKey {
  const artist = key.artist.trim();
  const album = (key.album ?? '').trim();
  const track = (key.track ?? '').trim();

  if (!artist) {
    throw new Error('Override requires a non-empty artist.');
  }
  if (!album && !track) {
    throw new Error('Artist-only overrides are not allowed; provide at least --album or --track.');
  }

  return { artist, album, track };
}

export function validateArtworkImageUrl(
  imageUrl: string,
  options: { allowEmpty?: boolean } = {},
): string {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    if (options.allowEmpty) {
      return '';
    }
    throw new Error('Image URL cannot be empty (use --clear to explicitly suppress artwork).');
  }

  if (isPlaceholderImageUrl(trimmed)) {
    throw new Error('Image URL cannot be Last.fm’s generic star placeholder.');
  }

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.length === 1) {
      throw new Error(
        `Invalid local artwork path "${imageUrl}". Use a root-relative path like "/artwork/cover.jpg".`,
      );
    }
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid artwork URL "${imageUrl}". Expected an http(s):// URL or a root-relative /path.`,
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      `Unsupported artwork URL protocol "${parsed.protocol}". Expected http:, https:, or a root-relative /path.`,
    );
  }

  return trimmed;
}

function normalizeLookupPart(value: string): string {
  return value.trim().toLowerCase();
}

export function overrideMapKey(artist: string, album: string, track: string): string {
  return `${normalizeLookupPart(artist)}\0${normalizeLookupPart(album)}\0${normalizeLookupPart(track)}`;
}

function pairMapKey(first: string, second: string): string {
  return `${normalizeLookupPart(first)}\0${normalizeLookupPart(second)}`;
}

function toArtworkOverride(row: ArtworkOverrideRow): ArtworkOverride {
  const source: ArtworkOverrideSource = isArtworkOverrideSource(row.source) ? row.source : 'manual';
  return {
    artist: row.artist,
    album: row.album,
    track: row.track,
    imageUrl: row.image_url,
    source,
    updatedAt: Number(row.updated_at),
  };
}

export function buildArtworkOverrideIndex(
  overrides: ArtworkOverride[],
): Map<string, ArtworkOverride> {
  const index = new Map<string, ArtworkOverride>();
  for (const override of overrides) {
    index.set(overrideMapKey(override.artist, override.album, override.track), override);
  }
  return index;
}

export function listArtworkOverrides(
  db: DatabaseSync,
  options: { source?: ArtworkOverrideSource } = {},
): ArtworkOverride[] {
  const rows = (options.source
    ? db
        .prepare(
          `SELECT artist, album, track, image_url, source, updated_at
             FROM artwork_overrides
             WHERE source = ?
             ORDER BY artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, track COLLATE NOCASE ASC`,
        )
        .all(options.source)
    : db
        .prepare(
          `SELECT artist, album, track, image_url, source, updated_at
             FROM artwork_overrides
             ORDER BY artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, track COLLATE NOCASE ASC`,
        )
        .all()) as unknown as ArtworkOverrideRow[];

  return rows.map(toArtworkOverride);
}

export function getArtworkOverride(
  db: DatabaseSync,
  key: ArtworkOverrideKey,
): ArtworkOverride | undefined {
  const normalized = normalizeOverrideKey(key);
  const row = db
    .prepare(
      `SELECT artist, album, track, image_url, source, updated_at
       FROM artwork_overrides
       WHERE artist = ? AND album = ? AND track = ?`,
    )
    .get(normalized.artist, normalized.album, normalized.track) as unknown as
    ArtworkOverrideRow | undefined;

  return row ? toArtworkOverride(row) : undefined;
}

export function upsertArtworkOverride(
  db: DatabaseSync,
  input: UpsertArtworkOverrideInput,
): ArtworkOverride {
  const key = normalizeOverrideKey(input);
  const source = input.source ?? 'manual';
  if (!isArtworkOverrideSource(source)) {
    throw new Error(`Invalid override source "${String(source)}".`);
  }

  let imageUrl: string;
  if (source === 'not_found') {
    if (input.imageUrl.trim() !== '') {
      throw new Error('Overrides with source "not_found" must have an empty image URL.');
    }
    imageUrl = '';
  } else {
    imageUrl = validateArtworkImageUrl(input.imageUrl, { allowEmpty: source === 'manual' });
  }

  const updatedAt = input.updatedAt ?? Math.floor(Date.now() / 1000);

  db.prepare(
    `INSERT INTO artwork_overrides (artist, album, track, image_url, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (artist, album, track) DO UPDATE SET
       artist = excluded.artist,
       album = excluded.album,
       track = excluded.track,
       image_url = excluded.image_url,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  ).run(key.artist, key.album, key.track, imageUrl, source, updatedAt);

  return {
    artist: key.artist,
    album: key.album,
    track: key.track,
    imageUrl,
    source,
    updatedAt,
  };
}

export function removeArtworkOverride(db: DatabaseSync, key: ArtworkOverrideKey): boolean {
  const normalized = normalizeOverrideKey(key);
  const result = db
    .prepare(
      `DELETE FROM artwork_overrides
       WHERE artist = ? AND album = ? AND track = ?`,
    )
    .run(normalized.artist, normalized.album, normalized.track);

  return Number(result.changes) > 0;
}

/**
 * Resolve artwork for a single scrobble using split precedence:
 * 1. `manual` override (most specific first; empty `imageUrl` short-circuits to `undefined`).
 * 2. Valid non-placeholder `scrobbles.image_url`.
 * 3. Automated non-`not_found` override with a usable URL (most specific first).
 *
 * Track-level `(artist, '', track)` overrides only match scrobbles with an empty album.
 */
export function resolveScrobbleArtwork(
  scrobble: { artist: string; album: string; track: string; imageUrl: string },
  overrides: Map<string, ArtworkOverride>,
): ResolvedArtwork {
  const artist = scrobble.artist.trim();
  const album = scrobble.album.trim();
  const track = scrobble.track.trim();

  const candidateKeys = album
    ? [overrideMapKey(artist, album, track), overrideMapKey(artist, album, '')]
    : [overrideMapKey(artist, '', track)];

  for (const key of candidateKeys) {
    const match = overrides.get(key);
    if (match?.source === 'manual') {
      if (!match.imageUrl) {
        return {
          imageUrl: undefined,
          fromOverride: true,
          overrideSource: 'manual',
          clearedByManual: true,
        };
      }
      return {
        imageUrl: match.imageUrl,
        fromOverride: true,
        overrideSource: 'manual',
        clearedByManual: false,
      };
    }
  }

  const scrobbleImageUrl = scrobble.imageUrl.trim();
  if (scrobbleImageUrl && !isPlaceholderImageUrl(scrobbleImageUrl)) {
    return {
      imageUrl: scrobbleImageUrl,
      fromOverride: false,
      clearedByManual: false,
    };
  }

  for (const key of candidateKeys) {
    const match = overrides.get(key);
    if (
      match &&
      match.source !== 'manual' &&
      match.source !== 'not_found' &&
      match.imageUrl &&
      !isPlaceholderImageUrl(match.imageUrl)
    ) {
      return {
        imageUrl: match.imageUrl,
        fromOverride: true,
        overrideSource: match.source,
        clearedByManual: false,
      };
    }
  }

  return {
    imageUrl: undefined,
    fromOverride: false,
    clearedByManual: false,
  };
}

export function findMissingArtwork(
  db: DatabaseSync,
  user: string,
  options: { filter?: 'all' | 'album-only' | 'no-album'; limit?: number } = {},
): MissingArtworkReport {
  const filter = options.filter ?? 'all';
  const normalizedUser = user.toLowerCase();
  const overrides = buildArtworkOverrideIndex(listArtworkOverrides(db));

  const rows = db
    .prepare(
      `SELECT uts, artist, album, track, image_url
       FROM scrobbles
       WHERE user = ?
       ORDER BY uts DESC`,
    )
    .all(normalizedUser) as unknown as ScrobbleArtworkRow[];

  const groups = new Map<string, MissingArtworkEntry>();
  let totalScrobbles = 0;

  for (const row of rows) {
    const resolved = resolveScrobbleArtwork(
      {
        artist: row.artist,
        album: row.album,
        track: row.track,
        imageUrl: row.image_url,
      },
      overrides,
    );

    if (resolved.imageUrl) {
      continue;
    }

    const album = row.album.trim();
    if (filter === 'album-only' && !album) {
      continue;
    }
    if (filter === 'no-album' && album) {
      continue;
    }

    const artist = row.artist.trim();
    const track = album ? '' : row.track.trim();
    const key = overrideMapKey(artist, album, track);

    totalScrobbles++;
    const existing = groups.get(key);
    if (existing) {
      existing.scrobbleCount++;
      if (row.uts > existing.lastScrobbledAt) {
        existing.lastScrobbledAt = row.uts;
      }
    } else {
      groups.set(key, {
        artist,
        album,
        track,
        scrobbleCount: 1,
        lastScrobbledAt: row.uts,
      });
    }
  }

  const allEntries = [...groups.values()].sort(
    (a, b) =>
      b.scrobbleCount - a.scrobbleCount ||
      b.lastScrobbledAt - a.lastScrobbledAt ||
      a.artist.localeCompare(b.artist) ||
      a.album.localeCompare(b.album) ||
      a.track.localeCompare(b.track),
  );

  const entries =
    options.limit !== undefined && options.limit > 0
      ? allEntries.slice(0, options.limit)
      : allEntries;

  return {
    entries,
    totalGroups: allEntries.length,
    totalScrobbles,
  };
}

interface ImageVote {
  count: number;
  maxUts: number;
}

function recordImageVote(
  bucket: Map<string, Map<string, ImageVote>>,
  key: string,
  imageUrl: string,
  uts: number,
): void {
  let votes = bucket.get(key);
  if (!votes) {
    votes = new Map<string, ImageVote>();
    bucket.set(key, votes);
  }
  const current = votes.get(imageUrl);
  if (current) {
    current.count++;
    if (uts > current.maxUts) {
      current.maxUts = uts;
    }
  } else {
    votes.set(imageUrl, { count: 1, maxUts: uts });
  }
}

function pickBestImageVote(votes: Map<string, ImageVote> | undefined): string | undefined {
  if (!votes || votes.size === 0) {
    return undefined;
  }

  let bestUrl: string | undefined;
  let bestCount = -1;
  let bestMaxUts = -1;

  for (const [url, vote] of votes) {
    if (
      vote.count > bestCount ||
      (vote.count === bestCount && vote.maxUts > bestMaxUts) ||
      (vote.count === bestCount &&
        vote.maxUts === bestMaxUts &&
        bestUrl !== undefined &&
        url < bestUrl)
    ) {
      bestUrl = url;
      bestCount = vote.count;
      bestMaxUts = vote.maxUts;
    }
  }

  return bestUrl;
}

/**
 * Tier 1 automated enrichment: heal missing/placeholder scrobbles using valid
 * artwork already stored on other `scrobbles` rows in SQLite (0 network calls).
 *
 * - Scrobbles with `album != ''` match donor scrobbles by `(artist, album)` and write `(artist, album, '')`.
 * - Scrobbles with `album == ''` match donor scrobbles by `(artist, track)` and write `(artist, '', track)`.
 * - Existing `manual` overrides are never overwritten, even when `force: true`.
 */
export function selfHealArtworkOverrides(
  db: DatabaseSync,
  options: { user?: string; dryRun?: boolean; force?: boolean; nowSeconds?: number } = {},
): SelfHealResult {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const placeholderPattern = `%${LASTFM_PLACEHOLDER_IMAGE_HASH}%`;

  const validRows = db
    .prepare(
      `SELECT uts, artist, album, track, image_url
       FROM scrobbles
       WHERE image_url != '' AND image_url NOT LIKE ?`,
    )
    .all(placeholderPattern) as unknown as ScrobbleArtworkRow[];

  const albumVotes = new Map<string, Map<string, ImageVote>>();
  const trackVotes = new Map<string, Map<string, ImageVote>>();

  for (const row of validRows) {
    const artist = row.artist.trim();
    const album = row.album.trim();
    const track = row.track.trim();
    const imageUrl = row.image_url.trim();
    if (!artist || !imageUrl || isPlaceholderImageUrl(imageUrl)) {
      continue;
    }
    if (album) {
      recordImageVote(albumVotes, pairMapKey(artist, album), imageUrl, row.uts);
    }
    if (track) {
      recordImageVote(trackVotes, pairMapKey(artist, track), imageUrl, row.uts);
    }
  }

  const missingRows = (options.user
    ? db
        .prepare(
          `SELECT uts, artist, album, track, image_url
             FROM scrobbles
             WHERE user = ? AND (image_url = '' OR image_url LIKE ?)
             ORDER BY uts DESC`,
        )
        .all(options.user.toLowerCase(), placeholderPattern)
    : db
        .prepare(
          `SELECT uts, artist, album, track, image_url
             FROM scrobbles
             WHERE image_url = '' OR image_url LIKE ?
             ORDER BY uts DESC`,
        )
        .all(placeholderPattern)) as unknown as ScrobbleArtworkRow[];

  const targets = new Map<
    string,
    { artist: string; album: string; track: string; matchCount: number }
  >();

  for (const row of missingRows) {
    const artist = row.artist.trim();
    const album = row.album.trim();
    const track = row.track.trim();
    if (!artist || (!album && !track)) {
      continue;
    }

    const targetAlbum = album;
    const targetTrack = album ? '' : track;
    const key = overrideMapKey(artist, targetAlbum, targetTrack);
    const existingTarget = targets.get(key);
    if (existingTarget) {
      existingTarget.matchCount++;
    } else {
      targets.set(key, {
        artist,
        album: targetAlbum,
        track: targetTrack,
        matchCount: 1,
      });
    }
  }

  const existingOverrides = buildArtworkOverrideIndex(listArtworkOverrides(db));
  const candidates: SelfHealCandidate[] = [];
  let inserted = 0;
  let updated = 0;
  let skippedManual = 0;
  let skippedExisting = 0;

  for (const [key, target] of targets) {
    const bestUrl = target.album
      ? pickBestImageVote(albumVotes.get(pairMapKey(target.artist, target.album)))
      : pickBestImageVote(trackVotes.get(pairMapKey(target.artist, target.track)));

    if (!bestUrl) {
      continue;
    }

    const existing = existingOverrides.get(key);
    if (existing?.source === 'manual') {
      skippedManual++;
      candidates.push({
        ...target,
        imageUrl: bestUrl,
        action: 'skip-manual',
        existingSource: existing.source,
      });
      continue;
    }

    if (existing && existing.imageUrl !== '' && !force) {
      skippedExisting++;
      candidates.push({
        ...target,
        imageUrl: bestUrl,
        action: 'skip-existing',
        existingSource: existing.source,
      });
      continue;
    }

    const action = existing ? 'update' : 'insert';
    if (action === 'update') {
      updated++;
    } else {
      inserted++;
    }

    candidates.push({
      ...target,
      imageUrl: bestUrl,
      action,
      ...(existing ? { existingSource: existing.source } : {}),
    });
  }

  candidates.sort(
    (a, b) =>
      b.matchCount - a.matchCount ||
      a.artist.localeCompare(b.artist) ||
      a.album.localeCompare(b.album) ||
      a.track.localeCompare(b.track),
  );

  if (!dryRun && (inserted > 0 || updated > 0)) {
    const stmt = db.prepare(
      `INSERT INTO artwork_overrides (artist, album, track, image_url, source, updated_at)
       VALUES (?, ?, ?, ?, 'self', ?)
       ON CONFLICT (artist, album, track) DO UPDATE SET
         artist = excluded.artist,
         album = excluded.album,
         track = excluded.track,
         image_url = excluded.image_url,
         source = 'self',
         updated_at = excluded.updated_at`,
    );

    db.exec('BEGIN');
    try {
      for (const candidate of candidates) {
        if (candidate.action === 'insert' || candidate.action === 'update') {
          stmt.run(
            candidate.artist,
            candidate.album,
            candidate.track,
            candidate.imageUrl,
            nowSeconds,
          );
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return {
    candidates,
    inserted,
    updated,
    skippedManual,
    skippedExisting,
    dryRun,
  };
}
