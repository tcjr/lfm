import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { describe, expect, test } from 'vitest';
import {
  buildArtworkOverrideIndex,
  findMissingArtwork,
  getArtworkOverride,
  listArtworkOverrides,
  normalizeOverrideKey,
  removeArtworkOverride,
  removeArtworkOverrideByRowid,
  resolveScrobbleArtwork,
  selfHealArtworkOverrides,
  upsertArtworkOverride,
  validateArtworkImageUrl,
} from './artwork-overrides.ts';
import { exportSnapshot, openDatabase } from './db.ts';
import { LASTFM_PLACEHOLDER_IMAGE_HASH } from './format.ts';
import type { ScrobbleSnapshot } from '#shared/types.ts';

const PLACEHOLDER_URL = `https://lastfm-img.freetls.fastly.net/i/u/300x300/${LASTFM_PLACEHOLDER_IMAGE_HASH}.png`;
const VALID_A =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg';
const VALID_B =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg';
const MANUAL_URL = 'https://example.com/custom-cover.jpg';
const LOCAL_PATH = '/artwork/custom-cover.jpg';

function seedScrobble(
  db: DatabaseSync,
  row: {
    user?: string;
    uts: number;
    artist: string;
    track: string;
    album?: string;
    imageUrl?: string;
    loved?: number;
  },
): void {
  db.prepare(
    `INSERT INTO scrobbles (
      user, uts, artist, track, album,
      artist_mbid, track_mbid, album_mbid,
      loved, image_url, raw_json
    ) VALUES (?, ?, ?, ?, ?, '', '', '', ?, ?, '{}')`,
  ).run(
    (row.user ?? 'alice').toLowerCase(),
    row.uts,
    row.artist,
    row.track,
    row.album ?? '',
    row.loved ?? 0,
    row.imageUrl ?? '',
  );
}

describe('artwork override validation', () => {
  test('normalizeOverrideKey trims inputs and rejects artist-only or blank keys', () => {
    expect(
      normalizeOverrideKey({
        artist: '  Aphex Twin  ',
        album: '  Selected Ambient Works 85-92  ',
        track: '  ',
      }),
    ).toEqual({
      artist: 'Aphex Twin',
      album: 'Selected Ambient Works 85-92',
      track: '',
    });

    expect(() => normalizeOverrideKey({ artist: '   ', album: 'Album' })).toThrow(
      /non-empty artist/i,
    );
    expect(() => normalizeOverrideKey({ artist: 'Aphex Twin' })).toThrow(/artist-only/i);
    expect(() => normalizeOverrideKey({ artist: 'Aphex Twin', album: ' ', track: '' })).toThrow(
      /artist-only/i,
    );
  });

  test('validateArtworkImageUrl accepts http(s) URLs and root-relative paths and rejects placeholders', () => {
    expect(validateArtworkImageUrl(`  ${MANUAL_URL}  `)).toBe(MANUAL_URL);
    expect(validateArtworkImageUrl('http://example.com/art.png')).toBe(
      'http://example.com/art.png',
    );
    expect(validateArtworkImageUrl(` ${LOCAL_PATH} `)).toBe(LOCAL_PATH);
    expect(validateArtworkImageUrl('', { allowEmpty: true })).toBe('');

    expect(() => validateArtworkImageUrl('')).toThrow(/cannot be empty/i);
    expect(() => validateArtworkImageUrl(PLACEHOLDER_URL)).toThrow(/placeholder/i);
    expect(() => validateArtworkImageUrl('//cdn.example.com/art.jpg')).toThrow(/invalid local/i);
    expect(() => validateArtworkImageUrl('/')).toThrow(/invalid local/i);
    expect(() => validateArtworkImageUrl('ftp://example.com/art.jpg')).toThrow(/protocol/i);
    expect(() => validateArtworkImageUrl('not-a-url')).toThrow(/invalid artwork url/i);
  });
});

describe('artwork_overrides SQLite CRUD', () => {
  test('upserts, lists, filters by source, and removes case-insensitively', () => {
    const db = openDatabase(':memory:');
    try {
      upsertArtworkOverride(db, {
        artist: 'The White Stripes',
        album: 'White Blood Cells',
        imageUrl: MANUAL_URL,
        source: 'manual',
        updatedAt: 1_700_000_000,
      });

      // Case-insensitive lookup and upsert updates the same row and display casing
      expect(
        getArtworkOverride(db, {
          artist: 'the white stripes',
          album: 'WHITE BLOOD CELLS',
        })?.imageUrl,
      ).toBe(MANUAL_URL);

      upsertArtworkOverride(db, {
        artist: 'The White Stripes',
        album: 'White Blood Cells',
        imageUrl: LOCAL_PATH,
        source: 'manual',
        updatedAt: 1_700_000_100,
      });

      upsertArtworkOverride(db, {
        artist: 'Aphex Twin',
        track: 'Xtal',
        imageUrl: VALID_A,
        source: 'self',
        updatedAt: 1_700_000_200,
      });

      upsertArtworkOverride(db, {
        artist: 'Bootleg Band',
        album: 'Live 2005',
        imageUrl: '',
        source: 'not_found',
        updatedAt: 1_700_000_300,
      });

      const all = listArtworkOverrides(db);
      expect(all).toHaveLength(3);
      expect(all.every((item) => typeof item.rowid === 'number' && item.rowid > 0)).toBe(true);
      expect(listArtworkOverrides(db, { source: 'manual' })).toHaveLength(1);
      expect(listArtworkOverrides(db, { source: 'self' })).toHaveLength(1);
      expect(listArtworkOverrides(db, { source: 'not_found' })).toHaveLength(1);

      expect(
        removeArtworkOverride(db, {
          artist: 'THE WHITE STRIPES',
          album: 'white blood cells',
        }),
      ).toBe(true);
      expect(
        removeArtworkOverride(db, {
          artist: 'The White Stripes',
          album: 'White Blood Cells',
        }),
      ).toBe(false);
    } finally {
      db.close();
    }
  });

  test('rejects non-empty URL for source=not_found', () => {
    const db = openDatabase(':memory:');
    try {
      expect(() =>
        upsertArtworkOverride(db, {
          artist: 'Artist',
          album: 'Album',
          imageUrl: MANUAL_URL,
          source: 'not_found',
        }),
      ).toThrow(/not_found/i);
    } finally {
      db.close();
    }
  });

  test('removes overrides by rowid and validates rowid input', () => {
    const db = openDatabase(':memory:');
    try {
      const saved = upsertArtworkOverride(db, {
        artist: 'Aphex Twin',
        album: 'SAW 85-92',
        imageUrl: LOCAL_PATH,
        source: 'manual',
        updatedAt: 1_700_000_000,
      });

      expect(saved.rowid).toBeDefined();
      const rowid = saved.rowid!;

      expect(removeArtworkOverrideByRowid(db, rowid)).toEqual(saved);
      expect(removeArtworkOverrideByRowid(db, rowid)).toBeUndefined();
      expect(listArtworkOverrides(db)).toHaveLength(0);

      expect(() => removeArtworkOverrideByRowid(db, 0)).toThrow(/positive integer/i);
      expect(() => removeArtworkOverrideByRowid(db, -3)).toThrow(/positive integer/i);
      expect(() => removeArtworkOverrideByRowid(db, 1.5)).toThrow(/positive integer/i);
    } finally {
      db.close();
    }
  });
});

describe('resolveScrobbleArtwork precedence', () => {
  test('manual overrides beat valid Last.fm artwork and automated overrides', () => {
    const index = buildArtworkOverrideIndex([
      {
        artist: 'Artist A',
        album: 'Album A',
        track: '',
        imageUrl: MANUAL_URL,
        source: 'manual',
        updatedAt: 1,
      },
      {
        artist: 'Artist A',
        album: 'Album A',
        track: 'Track 1',
        imageUrl: VALID_B,
        source: 'self',
        updatedAt: 1,
      },
    ]);

    // Manual album override beats both automated exact override and valid Last.fm art
    expect(
      resolveScrobbleArtwork(
        { artist: 'artist a', album: 'album a', track: 'track 1', imageUrl: VALID_A },
        index,
      ),
    ).toEqual({
      imageUrl: MANUAL_URL,
      fromOverride: true,
      overrideSource: 'manual',
      clearedByManual: false,
    });
  });

  test('manual exact override beats manual album override, and manual --clear short-circuits', () => {
    const index = buildArtworkOverrideIndex([
      {
        artist: 'Artist A',
        album: 'Album A',
        track: '',
        imageUrl: MANUAL_URL,
        source: 'manual',
        updatedAt: 1,
      },
      {
        artist: 'Artist A',
        album: 'Album A',
        track: 'Bad Track',
        imageUrl: '',
        source: 'manual',
        updatedAt: 1,
      },
      {
        artist: 'Artist A',
        album: 'Album A',
        track: 'Special Track',
        imageUrl: LOCAL_PATH,
        source: 'manual',
        updatedAt: 1,
      },
    ]);

    expect(
      resolveScrobbleArtwork(
        { artist: 'Artist A', album: 'Album A', track: 'Bad Track', imageUrl: VALID_A },
        index,
      ),
    ).toEqual({
      imageUrl: undefined,
      fromOverride: true,
      overrideSource: 'manual',
      clearedByManual: true,
    });

    expect(
      resolveScrobbleArtwork(
        { artist: 'Artist A', album: 'Album A', track: 'Special Track', imageUrl: VALID_A },
        index,
      ),
    ).toEqual({
      imageUrl: LOCAL_PATH,
      fromOverride: true,
      overrideSource: 'manual',
      clearedByManual: false,
    });
  });

  test('valid Last.fm art beats automated overrides, while automated fills missing/placeholder art', () => {
    const index = buildArtworkOverrideIndex([
      {
        artist: 'Artist A',
        album: 'Album A',
        track: '',
        imageUrl: VALID_B,
        source: 'self',
        updatedAt: 1,
      },
      {
        artist: 'Artist B',
        album: 'Album B',
        track: '',
        imageUrl: '',
        source: 'not_found',
        updatedAt: 1,
      },
    ]);

    // Valid Last.fm image wins over automated override
    expect(
      resolveScrobbleArtwork(
        { artist: 'Artist A', album: 'Album A', track: 'Track 1', imageUrl: VALID_A },
        index,
      ),
    ).toEqual({
      imageUrl: VALID_A,
      fromOverride: false,
      clearedByManual: false,
    });

    // Placeholder falls through to automated override
    expect(
      resolveScrobbleArtwork(
        { artist: 'Artist A', album: 'Album A', track: 'Track 1', imageUrl: PLACEHOLDER_URL },
        index,
      ),
    ).toEqual({
      imageUrl: VALID_B,
      fromOverride: true,
      overrideSource: 'self',
      clearedByManual: false,
    });

    // not_found never overrides valid Last.fm artwork
    expect(
      resolveScrobbleArtwork(
        { artist: 'Artist B', album: 'Album B', track: 'Track 1', imageUrl: VALID_A },
        index,
      ),
    ).toEqual({
      imageUrl: VALID_A,
      fromOverride: false,
      clearedByManual: false,
    });
  });

  test('track-level (artist, "", track) overrides only match scrobbles with an empty album', () => {
    const index = buildArtworkOverrideIndex([
      {
        artist: 'Anders Osborne',
        album: '',
        track: 'Ho-Di-Ko-Di-Ya-La-Ma-La',
        imageUrl: VALID_A,
        source: 'manual',
        updatedAt: 1,
      },
    ]);

    // Empty album matches
    expect(
      resolveScrobbleArtwork(
        {
          artist: 'Anders Osborne',
          album: '',
          track: 'Ho-Di-Ko-Di-Ya-La-Ma-La',
          imageUrl: '',
        },
        index,
      ).imageUrl,
    ).toBe(VALID_A);

    // Named album does NOT cross-match (artist, '', track)
    expect(
      resolveScrobbleArtwork(
        {
          artist: 'Anders Osborne',
          album: 'Blues for a Barbecue',
          track: 'Ho-Di-Ko-Di-Ya-La-Ma-La',
          imageUrl: '',
        },
        index,
      ).imageUrl,
    ).toBeUndefined();
  });
});

describe('selfHealArtworkOverrides', () => {
  test('heals by (artist, album) and empty-album (artist, track) with frequency + recency tie-breaking', () => {
    const db = openDatabase(':memory:');
    try {
      // Album self-heal: 2 plays of VALID_A (older) vs 1 play of VALID_B (newer) -> VALID_A wins
      seedScrobble(db, {
        uts: 100,
        artist: 'Band',
        album: 'Record',
        track: 'T1',
        imageUrl: VALID_A,
      });
      seedScrobble(db, {
        uts: 110,
        artist: 'Band',
        album: 'Record',
        track: 'T2',
        imageUrl: VALID_A,
      });
      seedScrobble(db, {
        uts: 120,
        artist: 'Band',
        album: 'Record',
        track: 'T3',
        imageUrl: VALID_B,
      });
      seedScrobble(db, {
        uts: 130,
        artist: 'Band',
        album: 'Record',
        track: 'T4',
        imageUrl: PLACEHOLDER_URL,
      });

      // Empty-album track self-heal tie: 1 play of VALID_A (uts 200) vs 1 play of VALID_B (uts 300) -> VALID_B wins
      seedScrobble(db, {
        uts: 200,
        artist: 'Sam Cooke',
        album: 'Album One',
        track: 'A Change Is Gonna Come',
        imageUrl: VALID_A,
      });
      seedScrobble(db, {
        uts: 300,
        artist: 'Sam Cooke',
        album: 'Greatest Hits',
        track: 'A Change Is Gonna Come',
        imageUrl: VALID_B,
      });
      seedScrobble(db, {
        uts: 400,
        artist: 'Sam Cooke',
        album: '',
        track: 'A Change Is Gonna Come',
        imageUrl: '',
      });

      // Cross-album track must NOT heal a scrobble with a different named album
      seedScrobble(db, {
        uts: 500,
        artist: 'Anders Osborne',
        album: 'Ash Wednesday Blues',
        track: 'Ho-Di-Ko-Di-Ya-La-Ma-La',
        imageUrl: VALID_A,
      });
      seedScrobble(db, {
        uts: 510,
        artist: 'Anders Osborne',
        album: 'Blues for a Barbecue',
        track: 'Ho-Di-Ko-Di-Ya-La-Ma-La',
        imageUrl: '',
      });

      // Dry run does not write
      const dryResult = selfHealArtworkOverrides(db, { dryRun: true, nowSeconds: 1_700_000_000 });
      expect(dryResult.inserted).toBe(2);
      expect(dryResult.updated).toBe(0);
      expect(listArtworkOverrides(db)).toHaveLength(0);

      // Actual run writes both
      const result = selfHealArtworkOverrides(db, { nowSeconds: 1_700_000_000 });
      expect(result.inserted).toBe(2);
      expect(result.updated).toBe(0);

      expect(getArtworkOverride(db, { artist: 'Band', album: 'Record' })).toMatchObject({
        artist: 'Band',
        album: 'Record',
        track: '',
        imageUrl: VALID_A,
        source: 'self',
        updatedAt: 1_700_000_000,
      });
      expect(
        getArtworkOverride(db, { artist: 'Sam Cooke', track: 'A Change Is Gonna Come' }),
      ).toMatchObject({
        artist: 'Sam Cooke',
        album: '',
        track: 'A Change Is Gonna Come',
        imageUrl: VALID_B,
        source: 'self',
        updatedAt: 1_700_000_000,
      });
      expect(
        getArtworkOverride(db, { artist: 'Anders Osborne', album: 'Blues for a Barbecue' }),
      ).toBeUndefined();
    } finally {
      db.close();
    }
  });

  test('never overwrites manual overrides even with force, skips existing automated without force, and heals not_found', () => {
    const db = openDatabase(':memory:');
    try {
      seedScrobble(db, {
        uts: 100,
        artist: 'A',
        album: 'ManualAlb',
        track: 'T1',
        imageUrl: VALID_A,
      });
      seedScrobble(db, { uts: 101, artist: 'A', album: 'ManualAlb', track: 'T2', imageUrl: '' });

      seedScrobble(db, { uts: 200, artist: 'B', album: 'AutoAlb', track: 'T1', imageUrl: VALID_B });
      seedScrobble(db, { uts: 201, artist: 'B', album: 'AutoAlb', track: 'T2', imageUrl: '' });

      seedScrobble(db, {
        uts: 300,
        artist: 'C',
        album: 'NotFoundAlb',
        track: 'T1',
        imageUrl: VALID_A,
      });
      seedScrobble(db, { uts: 301, artist: 'C', album: 'NotFoundAlb', track: 'T2', imageUrl: '' });

      upsertArtworkOverride(db, {
        artist: 'A',
        album: 'ManualAlb',
        imageUrl: MANUAL_URL,
        source: 'manual',
        updatedAt: 1,
      });
      upsertArtworkOverride(db, {
        artist: 'B',
        album: 'AutoAlb',
        imageUrl: VALID_A,
        source: 'caa',
        updatedAt: 1,
      });
      upsertArtworkOverride(db, {
        artist: 'C',
        album: 'NotFoundAlb',
        imageUrl: '',
        source: 'not_found',
        updatedAt: 1,
      });

      const first = selfHealArtworkOverrides(db, { nowSeconds: 10 });
      expect(first.skippedManual).toBe(1);
      expect(first.skippedExisting).toBe(1);
      expect(first.updated).toBe(1); // NotFoundAlb healed
      expect(getArtworkOverride(db, { artist: 'A', album: 'ManualAlb' })?.imageUrl).toBe(
        MANUAL_URL,
      );
      expect(getArtworkOverride(db, { artist: 'B', album: 'AutoAlb' })?.imageUrl).toBe(VALID_A);
      expect(getArtworkOverride(db, { artist: 'C', album: 'NotFoundAlb' })?.imageUrl).toBe(VALID_A);

      // --force refreshes automated rows, but STILL protects manual
      const forced = selfHealArtworkOverrides(db, { force: true, nowSeconds: 20 });
      expect(forced.skippedManual).toBe(1);
      expect(forced.skippedExisting).toBe(0);
      expect(forced.updated).toBe(2);
      expect(getArtworkOverride(db, { artist: 'A', album: 'ManualAlb' })?.imageUrl).toBe(
        MANUAL_URL,
      );
      expect(getArtworkOverride(db, { artist: 'B', album: 'AutoAlb' })?.imageUrl).toBe(VALID_B);
      expect(getArtworkOverride(db, { artist: 'B', album: 'AutoAlb' })?.source).toBe('self');
    } finally {
      db.close();
    }
  });
});

describe('exportSnapshot & findMissingArtwork integration', () => {
  test('exportSnapshot applies overrides without mutating scrobbles and reports accurate counts', () => {
    const db = openDatabase(':memory:');
    const tempDir = mkdtempSync(join(tmpdir(), 'lfm-export-test-'));
    const exportPath = join(tempDir, 'scrobbles.json');

    try {
      // 1. Valid Last.fm image, no override
      seedScrobble(db, { uts: 100, artist: 'A1', album: 'Alb1', track: 'T1', imageUrl: VALID_A });
      // 2. Placeholder image, healed by self override
      seedScrobble(db, {
        uts: 200,
        artist: 'A2',
        album: 'Alb2',
        track: 'T2',
        imageUrl: PLACEHOLDER_URL,
      });
      // 3. Valid Last.fm image, suppressed by manual --clear
      seedScrobble(db, { uts: 300, artist: 'A3', album: 'Alb3', track: 'T3', imageUrl: VALID_A });
      // 4. Empty album, missing artwork
      seedScrobble(db, { uts: 400, artist: 'A4', album: '', track: 'T4', imageUrl: '' });
      // 5. Valid Last.fm image, overridden by manual URL
      seedScrobble(db, { uts: 500, artist: 'A5', album: 'Alb5', track: 'T5', imageUrl: VALID_A });

      upsertArtworkOverride(db, {
        artist: 'A2',
        album: 'Alb2',
        imageUrl: VALID_B,
        source: 'self',
      });
      upsertArtworkOverride(db, {
        artist: 'A3',
        album: 'Alb3',
        imageUrl: '',
        source: 'manual',
      });
      upsertArtworkOverride(db, {
        artist: 'A5',
        album: 'Alb5',
        imageUrl: LOCAL_PATH,
        source: 'manual',
      });

      const result = exportSnapshot(db, 'alice', exportPath);
      expect(result.count).toBe(5);
      expect(result.placeholdersReplaced).toBe(1);
      expect(result.overridesApplied).toBe(3);
      expect(result.missingArtwork).toBe(2); // T3 (cleared) + T4 (missing)

      const written = JSON.parse(readFileSync(exportPath, 'utf8')) as ScrobbleSnapshot;
      const byTrack = new Map(written.scrobbles.map((s) => [s.track, s]));
      expect(byTrack.get('T1')?.imageUrl).toBe(VALID_A);
      expect(byTrack.get('T2')?.imageUrl).toBe(VALID_B);
      expect(byTrack.get('T3')?.imageUrl).toBeUndefined();
      expect(byTrack.get('T4')?.imageUrl).toBeUndefined();
      expect(byTrack.get('T5')?.imageUrl).toBe(LOCAL_PATH);

      // Verify ScrobbleRecord has no unexpected provenance keys
      expect(Object.keys(byTrack.get('T5') ?? {}).sort()).toEqual([
        'album',
        'artist',
        'imageUrl',
        'loved',
        'track',
        'uts',
      ]);

      // Verify scrobbles table was not mutated
      const rawT2 = db.prepare(`SELECT image_url FROM scrobbles WHERE track = 'T2'`).get() as {
        image_url: string;
      };
      expect(rawT2.image_url).toBe(PLACEHOLDER_URL);

      // findMissingArtwork aligns with exportSnapshot missing count and supports filters
      const allMissing = findMissingArtwork(db, 'alice');
      expect(allMissing.totalScrobbles).toBe(2);
      expect(allMissing.totalGroups).toBe(2);

      const albumOnly = findMissingArtwork(db, 'alice', { filter: 'album-only' });
      expect(albumOnly.entries.map((e) => e.album)).toEqual(['Alb3']);

      const noAlbum = findMissingArtwork(db, 'alice', { filter: 'no-album' });
      expect(noAlbum.entries.map((e) => e.track)).toEqual(['T4']);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
