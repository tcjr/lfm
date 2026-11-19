import type { DatabaseSync } from 'node:sqlite';
import { describe, expect, test } from 'vitest';
import {
  enrichItunesArtwork,
  enrichLastfmTrackArtwork,
  lookupLastfmTrackArtwork,
  parseEnrichSources,
  type ItunesProgressEvent,
  type LastfmTrackClient,
  type LastfmTrackProgressEvent,
} from './artwork-enrich.ts';
import {
  getArtworkOverride,
  listArtworkOverrides,
  overrideMapKey,
  upsertArtworkOverride,
} from './artwork-overrides.ts';
import { LastfmError, type ParamValue } from './client.ts';
import { openDatabase } from './db.ts';
import { LASTFM_PLACEHOLDER_IMAGE_HASH } from './format.ts';
import {
  ItunesError,
  type ItunesSearchClient,
  type ItunesSearchParams,
  type ItunesSearchResponse,
} from './itunes.ts';
import type { LastfmImage, TrackInfoResponse } from '#shared/types.ts';

const PLACEHOLDER_URL = `https://lastfm-img.freetls.fastly.net/i/u/300x300/${LASTFM_PLACEHOLDER_IMAGE_HASH}.png`;
const VALID_A =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg';
const VALID_B =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg';
const MANUAL_URL = 'https://example.com/manual.jpg';

function makeImages(url: string): LastfmImage[] {
  return [
    { size: 'medium', '#text': url },
    { size: 'extralarge', '#text': url },
  ];
}

function seedScrobble(
  db: DatabaseSync,
  row: {
    user?: string;
    uts: number;
    artist: string;
    track: string;
    album?: string;
    trackMbid?: string;
    imageUrl?: string;
  },
): void {
  db.prepare(
    `INSERT INTO scrobbles (
      user, uts, artist, track, album,
      artist_mbid, track_mbid, album_mbid,
      loved, image_url, raw_json
    ) VALUES (?, ?, ?, ?, ?, '', ?, '', 0, ?, '{}')`,
  ).run(
    (row.user ?? 'alice').toLowerCase(),
    row.uts,
    row.artist,
    row.track,
    row.album ?? '',
    row.trackMbid ?? '',
    row.imageUrl ?? '',
  );
}

interface RecordedCall {
  method: string;
  params: Record<string, ParamValue>;
}

function createFakeClient(
  handler: (
    method: string,
    params: Record<string, ParamValue>,
  ) => TrackInfoResponse | Promise<TrackInfoResponse>,
): { client: LastfmTrackClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: LastfmTrackClient = {
    async call<T = unknown>(method: string, params: Record<string, ParamValue> = {}): Promise<T> {
      calls.push({ method, params });
      return (await handler(method, params)) as T;
    },
  };
  return { client, calls };
}

describe('parseEnrichSources', () => {
  test('defaults to all tiers in canonical order and normalizes comma-separated lists', () => {
    expect(parseEnrichSources()).toEqual(['self', 'lastfm-track', 'itunes']);
    expect(parseEnrichSources('self')).toEqual(['self']);
    expect(parseEnrichSources('lastfm-track')).toEqual(['lastfm-track']);
    expect(parseEnrichSources('itunes')).toEqual(['itunes']);
    expect(parseEnrichSources(' itunes , lastfm-track , self , self ')).toEqual([
      'self',
      'lastfm-track',
      'itunes',
    ]);

    expect(() => parseEnrichSources('caa')).toThrow(/invalid --source/i);
    expect(() => parseEnrichSources(' , ')).toThrow(/invalid --source/i);
  });
});

describe('lookupLastfmTrackArtwork', () => {
  test('queries (artist, track) with autocorrect=1 first and falls back to mbid on clean miss', async () => {
    const { client, calls } = createFakeClient((_method, params) => {
      if (params.artist === 'Found Artist') {
        return {
          track: {
            name: 'Corrected Track',
            artist: 'Corrected Artist',
            album: {
              artist: 'Corrected Artist',
              title: 'Album',
              mbid: '',
              url: '',
              image: makeImages(VALID_A),
            },
          },
        };
      }
      if (params.artist === 'Mbid Fallback') {
        throw new LastfmError(6, 'Track not found', 'track.getInfo');
      }
      if (params.mbid === 'mbid-123') {
        return {
          track: {
            name: 'Found By Mbid',
            artist: 'Mbid Fallback',
            image: makeImages(VALID_B),
          },
        };
      }
      return {
        track: {
          name: 'Placeholder Only',
          artist: 'No Art',
          album: {
            artist: 'No Art',
            title: 'No Art Album',
            mbid: '',
            url: '',
            image: makeImages(PLACEHOLDER_URL),
          },
        },
      };
    });

    // Direct match does NOT call mbid
    const direct = await lookupLastfmTrackArtwork(client, {
      artist: 'Found Artist',
      track: 'Track',
      trackMbid: 'unused-mbid',
    });
    expect(direct).toEqual({ imageUrl: VALID_A, matchedVia: 'artist-track' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.params).toMatchObject({
      artist: 'Found Artist',
      track: 'Track',
      autocorrect: 1,
    });

    // Error code 6 falls back to mbid
    const viaMbid = await lookupLastfmTrackArtwork(client, {
      artist: 'Mbid Fallback',
      track: 'Unknown Spelling',
      trackMbid: 'mbid-123',
    });
    expect(viaMbid).toEqual({ imageUrl: VALID_B, matchedVia: 'mbid' });
    expect(calls).toHaveLength(3);
    expect(calls[2]?.params).toMatchObject({ mbid: 'mbid-123', autocorrect: 1 });

    // Placeholder-only image counts as a clean miss
    const placeholder = await lookupLastfmTrackArtwork(client, {
      artist: 'No Art',
      track: 'Placeholder Only',
    });
    expect(placeholder).toEqual({});
  });
});

describe('enrichLastfmTrackArtwork', () => {
  test('targets only album-less scrobbles, preserves original key on autocorrect, and caches not_found', async () => {
    const db = openDatabase(':memory:');
    try {
      // Named-album scrobble missing artwork -> MUST be ignored by lastfm-track
      seedScrobble(db, {
        uts: 100,
        artist: 'Named Album Band',
        album: 'Some Compilation',
        track: 'Ignored Track',
        imageUrl: '',
      });

      // Album-less scrobble with misspelled artist -> autocorrected by Last.fm, stored under original spelling
      seedScrobble(db, {
        uts: 200,
        artist: 'Anders Osbourne',
        album: '',
        track: 'My Old Heart',
        imageUrl: '',
      });

      // Album-less scrobble with no cover art on Last.fm -> cached as not_found
      seedScrobble(db, {
        uts: 300,
        artist: 'AaronLikesSpaghetti',
        album: '',
        track: 'Live Bootleg',
        imageUrl: PLACEHOLDER_URL,
      });

      const { client, calls } = createFakeClient((_method, params) => {
        if (params.artist === 'Anders Osbourne') {
          return {
            track: {
              name: 'My Old Heart',
              artist: { name: 'Anders Osborne', mbid: '', url: '', image: [] },
              album: {
                artist: 'Anders Osborne',
                title: 'Peace',
                mbid: '',
                url: '',
                image: makeImages(VALID_A),
              },
            },
          };
        }
        throw new LastfmError(6, 'Track not found', 'track.getInfo');
      });

      const progress: LastfmTrackProgressEvent[] = [];
      const first = await enrichLastfmTrackArtwork(db, client, {
        nowSeconds: () => 1_700_000_000,
        onProgress: (event) => progress.push(event),
      });

      expect(first.queried).toBe(2);
      expect(first.inserted).toBe(1);
      expect(first.notFound).toBe(1);
      expect(first.errors).toBe(0);
      expect(progress).toHaveLength(2);
      expect(calls.map((c) => c.params.artist)).toEqual(['AaronLikesSpaghetti', 'Anders Osbourne']);

      // Stored under ORIGINAL scrobble artist ("Anders Osbourne"), not Last.fm's "Anders Osborne"
      expect(
        getArtworkOverride(db, { artist: 'Anders Osbourne', track: 'My Old Heart' }),
      ).toMatchObject({
        artist: 'Anders Osbourne',
        album: '',
        track: 'My Old Heart',
        imageUrl: VALID_A,
        source: 'lastfm-track',
        updatedAt: 1_700_000_000,
      });
      expect(
        getArtworkOverride(db, { artist: 'Anders Osborne', track: 'My Old Heart' }),
      ).toBeUndefined();

      // Clean miss is NOT cached as not_found by lastfm-track (deferred to final tier `itunes`)
      expect(
        getArtworkOverride(db, { artist: 'AaronLikesSpaghetti', track: 'Live Bootleg' }),
      ).toBeUndefined();

      // Named-album scrobble untouched
      expect(
        getArtworkOverride(db, { artist: 'Named Album Band', album: 'Some Compilation' }),
      ).toBeUndefined();

      // If final tier previously cached not_found, lastfm-track skips it unless retryNotFound is passed
      upsertArtworkOverride(db, {
        artist: 'AaronLikesSpaghetti',
        track: 'Live Bootleg',
        imageUrl: '',
        source: 'not_found',
      });

      // Second run skips both (1 existing, 1 not_found) with 0 API calls
      const second = await enrichLastfmTrackArtwork(db, client);
      expect(second.queried).toBe(0);
      expect(second.skippedExisting).toBe(1);
      expect(second.skippedNotFound).toBe(1);
      expect(calls).toHaveLength(2);

      // Re-run with retryNotFound queries ONLY the not_found entry
      const retried = await enrichLastfmTrackArtwork(db, client, { retryNotFound: true });
      expect(retried.queried).toBe(1);
      expect(retried.notFound).toBe(1);
      expect(retried.skippedExisting).toBe(1);
      expect(calls).toHaveLength(3);
    } finally {
      db.close();
    }
  });

  test('enforces manual protection, excludeKeys, and no-downgrade-to-not_found under --force', async () => {
    const db = openDatabase(':memory:');
    try {
      seedScrobble(db, { uts: 100, artist: 'ManualArt', album: '', track: 'T1', imageUrl: '' });
      seedScrobble(db, {
        uts: 200,
        artist: 'SelfJustHealed',
        album: '',
        track: 'T2',
        imageUrl: '',
      });
      seedScrobble(db, { uts: 300, artist: 'ExistingMiss', album: '', track: 'T3', imageUrl: '' });
      seedScrobble(db, {
        uts: 400,
        artist: 'ExistingUpdate',
        album: '',
        track: 'T4',
        imageUrl: '',
      });

      upsertArtworkOverride(db, {
        artist: 'ManualArt',
        track: 'T1',
        imageUrl: MANUAL_URL,
        source: 'manual',
      });
      upsertArtworkOverride(db, {
        artist: 'SelfJustHealed',
        track: 'T2',
        imageUrl: VALID_A,
        source: 'self',
      });
      upsertArtworkOverride(db, {
        artist: 'ExistingMiss',
        track: 'T3',
        imageUrl: VALID_A,
        source: 'self',
      });
      upsertArtworkOverride(db, {
        artist: 'ExistingUpdate',
        track: 'T4',
        imageUrl: VALID_A,
        source: 'lastfm-track',
      });

      const { client } = createFakeClient((_method, params) => {
        if (params.artist === 'ExistingUpdate') {
          return {
            track: {
              name: 'T4',
              artist: 'ExistingUpdate',
              album: {
                artist: 'ExistingUpdate',
                title: 'New',
                mbid: '',
                url: '',
                image: makeImages(VALID_B),
              },
            },
          };
        }
        throw new LastfmError(6, 'Track not found', 'track.getInfo');
      });

      const result = await enrichLastfmTrackArtwork(db, client, {
        force: true,
        excludeKeys: new Set([overrideMapKey('SelfJustHealed', '', 'T2')]),
      });

      expect(result.skippedManual).toBe(1);
      expect(result.skippedResolvedInRun).toBe(1);
      expect(result.queried).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.keptExisting).toBe(1);
      expect(result.notFound).toBe(0);

      // Manual untouched
      expect(getArtworkOverride(db, { artist: 'ManualArt', track: 'T1' })?.imageUrl).toBe(
        MANUAL_URL,
      );
      // ExistingMiss NOT downgraded to not_found
      expect(getArtworkOverride(db, { artist: 'ExistingMiss', track: 'T3' })).toMatchObject({
        imageUrl: VALID_A,
        source: 'self',
      });
      // ExistingUpdate updated to new Last.fm URL
      expect(getArtworkOverride(db, { artist: 'ExistingUpdate', track: 'T4' })).toMatchObject({
        imageUrl: VALID_B,
        source: 'lastfm-track',
      });
    } finally {
      db.close();
    }
  });

  test('orders queue by scrobble count then recency, respects --limit, and supports read-only --dry-run', async () => {
    const db = openDatabase(':memory:');
    try {
      // 2 plays (older) -> highest priority
      seedScrobble(db, { uts: 100, artist: 'MostPlayed', album: '', track: 'Hit', imageUrl: '' });
      seedScrobble(db, { uts: 150, artist: 'MostPlayed', album: '', track: 'Hit', imageUrl: '' });
      // 1 play (newer) -> second priority
      seedScrobble(db, { uts: 500, artist: 'Recent', album: '', track: 'New', imageUrl: '' });
      // 1 play (older) -> third priority (excluded by limit=2)
      seedScrobble(db, { uts: 200, artist: 'OldSingle', album: '', track: 'Old', imageUrl: '' });

      const { client, calls } = createFakeClient((_method, params) => ({
        track: {
          name: String(params.track),
          artist: String(params.artist),
          album: {
            artist: String(params.artist),
            title: 'Alb',
            mbid: '',
            url: '',
            image: makeImages(VALID_A),
          },
        },
      }));

      const dryResult = await enrichLastfmTrackArtwork(db, client, {
        limit: 2,
        dryRun: true,
      });

      expect(dryResult.totalEligible).toBe(3);
      expect(dryResult.queried).toBe(2);
      expect(dryResult.inserted).toBe(2);
      expect(calls.map((c) => c.params.artist)).toEqual(['MostPlayed', 'Recent']);
      // Dry run must not write anything to SQLite
      expect(listArtworkOverrides(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test('continues on transient errors without caching not_found, and aborts on fatal errors keeping incremental writes', async () => {
    const db = openDatabase(':memory:');
    try {
      seedScrobble(db, { uts: 400, artist: 'GoodFirst', album: '', track: 'T1', imageUrl: '' });
      seedScrobble(db, { uts: 300, artist: 'TransientErr', album: '', track: 'T2', imageUrl: '' });
      seedScrobble(db, { uts: 200, artist: 'GoodAfter', album: '', track: 'T3', imageUrl: '' });

      const { client } = createFakeClient((_method, params) => {
        if (params.artist === 'TransientErr') {
          throw new LastfmError(16, 'Temporarily unavailable', 'track.getInfo');
        }
        return {
          track: {
            name: String(params.track),
            artist: String(params.artist),
            album: {
              artist: String(params.artist),
              title: 'Alb',
              mbid: '',
              url: '',
              image: makeImages(VALID_A),
            },
          },
        };
      });

      const result = await enrichLastfmTrackArtwork(db, client);
      expect(result.inserted).toBe(2);
      expect(result.errors).toBe(1);
      expect(result.notFound).toBe(0);
      // Transient error was NOT cached as not_found
      expect(getArtworkOverride(db, { artist: 'TransientErr', track: 'T2' })).toBeUndefined();
      // Both surrounding tracks succeeded
      expect(getArtworkOverride(db, { artist: 'GoodFirst', track: 'T1' })?.imageUrl).toBe(VALID_A);
      expect(getArtworkOverride(db, { artist: 'GoodAfter', track: 'T3' })?.imageUrl).toBe(VALID_A);

      // Now test fatal error (29 Rate limit exceeded) aborts immediately while preserving prior write
      seedScrobble(db, {
        uts: 600,
        artist: 'SavedBeforeFatal',
        album: '',
        track: 'T4',
        imageUrl: '',
      });
      seedScrobble(db, { uts: 500, artist: 'TriggersFatal', album: '', track: 'T5', imageUrl: '' });

      const { client: fatalClient } = createFakeClient((_method, params) => {
        if (params.artist === 'TriggersFatal') {
          throw new LastfmError(29, 'Rate limit exceeded', 'track.getInfo');
        }
        return {
          track: {
            name: 'T4',
            artist: 'SavedBeforeFatal',
            album: {
              artist: 'SavedBeforeFatal',
              title: 'Alb',
              mbid: '',
              url: '',
              image: makeImages(VALID_B),
            },
          },
        };
      });

      await expect(enrichLastfmTrackArtwork(db, fatalClient)).rejects.toThrow(/\[29\]/);
      // Earlier item in the same run was persisted incrementally before the abort!
      expect(getArtworkOverride(db, { artist: 'SavedBeforeFatal', track: 'T4' })?.imageUrl).toBe(
        VALID_B,
      );
      expect(getArtworkOverride(db, { artist: 'TriggersFatal', track: 'T5' })).toBeUndefined();
    } finally {
      db.close();
    }
  });
});

function createFakeItunesClient(
  handler: (params: ItunesSearchParams) => ItunesSearchResponse | Promise<ItunesSearchResponse>,
): { client: ItunesSearchClient; calls: ItunesSearchParams[] } {
  const calls: ItunesSearchParams[] = [];
  const client: ItunesSearchClient = {
    async search(params: ItunesSearchParams): Promise<ItunesSearchResponse> {
      calls.push(params);
      return await handler(params);
    },
  };
  return { client, calls };
}

const ITUNES_100_A = 'https://is1-ssl.mzstatic.com/image/thumb/Music1/v4/11/22/33/100x100bb.jpg';
const ITUNES_600_A = 'https://is1-ssl.mzstatic.com/image/thumb/Music1/v4/11/22/33/600x600bb.jpg';
const ITUNES_100_B = 'https://is1-ssl.mzstatic.com/image/thumb/Music2/v4/44/55/66/100x100bb.jpg';
const ITUNES_600_B = 'https://is1-ssl.mzstatic.com/image/thumb/Music2/v4/44/55/66/600x600bb.jpg';

describe('enrichItunesArtwork', () => {
  test('enriches both named albums and album-less tracks, caches misses as not_found, and supports retryNotFound', async () => {
    const db = openDatabase(':memory:');
    try {
      // Named album (2 scrobbles -> highest priority)
      seedScrobble(db, {
        uts: 100,
        artist: 'Drive By Truckers',
        album: 'A Blessing and a Curse',
        track: 'Feb 14',
        imageUrl: PLACEHOLDER_URL,
      });
      seedScrobble(db, {
        uts: 150,
        artist: 'Drive By Truckers',
        album: 'A Blessing and a Curse',
        track: 'Gravitys Gone',
        imageUrl: '',
      });

      // Unresolved album-less track
      seedScrobble(db, {
        uts: 300,
        artist: 'Philanthrope',
        album: '',
        track: 'Atmospheres',
        imageUrl: '',
      });

      // Bootleg album with no strict match -> cached as not_found
      seedScrobble(db, {
        uts: 200,
        artist: 'Wussy',
        album: 'Private House Concert, Larchmont NY',
        track: 'Track 1',
        imageUrl: '',
      });

      const { client, calls } = createFakeItunesClient((params) => {
        if (params.entity === 'album' && params.term.includes('Drive By Truckers')) {
          return {
            resultCount: 1,
            results: [
              {
                artistName: 'Drive-By Truckers',
                collectionName: 'A Blessing and a Curse (Deluxe Edition)',
                artworkUrl100: ITUNES_100_A,
              },
            ],
          };
        }
        if (params.entity === 'song' && params.term.includes('Philanthrope')) {
          return {
            resultCount: 1,
            results: [
              {
                artistName: 'Philanthrope',
                collectionName: 'Atmospheres - Single',
                trackName: 'Atmospheres',
                artworkUrl100: ITUNES_100_B,
              },
            ],
          };
        }
        return {
          resultCount: 1,
          results: [
            {
              artistName: 'Wussy',
              collectionName: 'Funeral Dress',
              artworkUrl100: ITUNES_100_A,
            },
          ],
        };
      });

      const progress: ItunesProgressEvent[] = [];
      const first = await enrichItunesArtwork(db, client, {
        nowSeconds: () => 1_700_000_000,
        onProgress: (event) => progress.push(event),
      });

      expect(first.queried).toBe(3);
      expect(first.inserted).toBe(2);
      expect(first.notFound).toBe(1);
      expect(first.errors).toBe(0);
      expect(progress).toHaveLength(3);
      expect(calls.map((c) => c.entity)).toEqual(['album', 'song', 'album']);

      // Stored under original scrobble spelling with 600x600bb URL
      expect(
        getArtworkOverride(db, {
          artist: 'Drive By Truckers',
          album: 'A Blessing and a Curse',
        }),
      ).toMatchObject({
        artist: 'Drive By Truckers',
        album: 'A Blessing and a Curse',
        track: '',
        imageUrl: ITUNES_600_A,
        source: 'itunes',
        updatedAt: 1_700_000_000,
      });

      expect(
        getArtworkOverride(db, { artist: 'Philanthrope', track: 'Atmospheres' }),
      ).toMatchObject({
        artist: 'Philanthrope',
        album: '',
        track: 'Atmospheres',
        imageUrl: ITUNES_600_B,
        source: 'itunes',
      });

      // Bootleg cached as not_found
      expect(
        getArtworkOverride(db, {
          artist: 'Wussy',
          album: 'Private House Concert, Larchmont NY',
        }),
      ).toMatchObject({
        imageUrl: '',
        source: 'not_found',
      });

      // Second run skips all 3 (2 existing + 1 not_found) with 0 API calls
      const second = await enrichItunesArtwork(db, client);
      expect(second.queried).toBe(0);
      expect(second.skippedExisting).toBe(2);
      expect(second.skippedNotFound).toBe(1);
      expect(calls).toHaveLength(3);

      // retryNotFound re-queries ONLY the not_found entry
      const retried = await enrichItunesArtwork(db, client, { retryNotFound: true });
      expect(retried.queried).toBe(1);
      expect(retried.notFound).toBe(1);
      expect(calls).toHaveLength(4);
    } finally {
      db.close();
    }
  });

  test('respects excludeKeys, protects manual, never downgrades existing overrides under --force, and supports --limit / --dry-run', async () => {
    const db = openDatabase(':memory:');
    try {
      seedScrobble(db, { uts: 500, artist: 'ManualArt', album: 'M1', track: 'T1', imageUrl: '' });
      seedScrobble(db, {
        uts: 400,
        artist: 'ResolvedEarlier',
        album: '',
        track: 'T2',
        imageUrl: '',
      });
      seedScrobble(db, { uts: 300, artist: 'KeepMe', album: 'K1', track: 'T3', imageUrl: '' });
      seedScrobble(db, { uts: 200, artist: 'UpdateMe', album: 'U1', track: 'T4', imageUrl: '' });
      seedScrobble(db, {
        uts: 100,
        artist: 'ExtraOverLimit',
        album: 'E1',
        track: 'T5',
        imageUrl: '',
      });

      upsertArtworkOverride(db, {
        artist: 'ManualArt',
        album: 'M1',
        imageUrl: MANUAL_URL,
        source: 'manual',
      });
      upsertArtworkOverride(db, {
        artist: 'KeepMe',
        album: 'K1',
        imageUrl: VALID_A,
        source: 'self',
      });
      upsertArtworkOverride(db, {
        artist: 'UpdateMe',
        album: 'U1',
        imageUrl: VALID_A,
        source: 'itunes',
      });

      const { client } = createFakeItunesClient((params) => {
        if (params.term.includes('UpdateMe')) {
          return {
            resultCount: 1,
            results: [
              { artistName: 'UpdateMe', collectionName: 'U1', artworkUrl100: ITUNES_100_B },
            ],
          };
        }
        return { resultCount: 0, results: [] };
      });

      // Dry-run with limit=2 doesn't mutate DB
      const dry = await enrichItunesArtwork(db, client, {
        force: true,
        limit: 2,
        dryRun: true,
        excludeKeys: new Set([overrideMapKey('ResolvedEarlier', '', 'T2')]),
      });
      expect(dry.totalEligible).toBe(3);
      expect(dry.queried).toBe(2);
      expect(dry.keptExisting).toBe(1);
      expect(dry.updated).toBe(1);
      expect(getArtworkOverride(db, { artist: 'UpdateMe', album: 'U1' })?.imageUrl).toBe(VALID_A);

      // Actual run with limit=2
      const result = await enrichItunesArtwork(db, client, {
        force: true,
        limit: 2,
        excludeKeys: new Set([overrideMapKey('ResolvedEarlier', '', 'T2')]),
      });
      expect(result.skippedManual).toBe(1);
      expect(result.skippedResolvedInRun).toBe(1);
      expect(result.keptExisting).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.notFound).toBe(0);

      expect(getArtworkOverride(db, { artist: 'ManualArt', album: 'M1' })?.imageUrl).toBe(
        MANUAL_URL,
      );
      expect(getArtworkOverride(db, { artist: 'KeepMe', album: 'K1' })).toMatchObject({
        imageUrl: VALID_A,
        source: 'self',
      });
      expect(getArtworkOverride(db, { artist: 'UpdateMe', album: 'U1' })).toMatchObject({
        imageUrl: ITUNES_600_B,
        source: 'itunes',
      });
      expect(getArtworkOverride(db, { artist: 'ExtraOverLimit', album: 'E1' })).toBeUndefined();
    } finally {
      db.close();
    }
  });

  test('continues on transient errors without caching not_found, and aborts on 403/429 rate-limit keeping incremental writes', async () => {
    const db = openDatabase(':memory:');
    try {
      seedScrobble(db, { uts: 300, artist: 'FirstOk', album: 'Alb1', track: 'T1', imageUrl: '' });
      seedScrobble(db, { uts: 200, artist: 'BlipErr', album: 'Alb2', track: 'T2', imageUrl: '' });
      seedScrobble(db, { uts: 100, artist: 'LastOk', album: 'Alb3', track: 'T3', imageUrl: '' });

      const { client } = createFakeItunesClient((params) => {
        if (params.term.includes('BlipErr')) {
          throw new ItunesError(503, 'Service unavailable', false);
        }
        const artist = params.term.split(' ')[0]!;
        const album = params.term.split(' ')[1]!;
        return {
          resultCount: 1,
          results: [{ artistName: artist, collectionName: album, artworkUrl100: ITUNES_100_A }],
        };
      });

      const result = await enrichItunesArtwork(db, client);
      expect(result.inserted).toBe(2);
      expect(result.errors).toBe(1);
      expect(getArtworkOverride(db, { artist: 'BlipErr', album: 'Alb2' })).toBeUndefined();
      expect(getArtworkOverride(db, { artist: 'FirstOk', album: 'Alb1' })?.imageUrl).toBe(
        ITUNES_600_A,
      );
      expect(getArtworkOverride(db, { artist: 'LastOk', album: 'Alb3' })?.imageUrl).toBe(
        ITUNES_600_A,
      );

      // Fatal 403 rate-limit aborts while keeping incremental write before it
      seedScrobble(db, { uts: 500, artist: 'BeforeLimit', album: 'A4', track: 'T4', imageUrl: '' });
      seedScrobble(db, { uts: 400, artist: 'HitLimit', album: 'A5', track: 'T5', imageUrl: '' });

      const { client: limitedClient } = createFakeItunesClient((params) => {
        if (params.term.includes('HitLimit')) {
          throw new ItunesError(403, 'Forbidden: rate limited', true);
        }
        return {
          resultCount: 1,
          results: [
            { artistName: 'BeforeLimit', collectionName: 'A4', artworkUrl100: ITUNES_100_B },
          ],
        };
      });

      await expect(enrichItunesArtwork(db, limitedClient)).rejects.toThrow(/403|rate limited/i);
      expect(getArtworkOverride(db, { artist: 'BeforeLimit', album: 'A4' })?.imageUrl).toBe(
        ITUNES_600_B,
      );
      expect(getArtworkOverride(db, { artist: 'HitLimit', album: 'A5' })).toBeUndefined();
    } finally {
      db.close();
    }
  });
});
