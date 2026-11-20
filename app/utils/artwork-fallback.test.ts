import { describe, expect, test } from 'vitest';
import {
  ARTWORK_FALLBACK_NEUTRAL_PALETTE,
  ARTWORK_FALLBACK_PALETTES,
  extractInitials,
  formatFallbackInitials,
  getArtworkFallbackPalette,
  hashString,
} from './artwork-fallback.ts';

describe('artwork-fallback utilities', () => {
  describe('extractInitials', () => {
    test('uses the first letters of the first two words', () => {
      expect(extractInitials('Tigers Blood')).toBe('TB');
      expect(extractInitials('Jason Isbell')).toBe('JI');
      expect(extractInitials('New Orleans Sessions')).toBe('NO');
      expect(extractInitials('All Access, Vol. 1')).toBe('AA');
    });

    test('skips common filler words when at least two content words remain', () => {
      expect(extractInitials('The Jones Girls')).toBe('JG');
      expect(extractInitials('From the End of Your Leash')).toBe('FE');
      expect(extractInitials('Kind of Blue')).toBe('KB');
      expect(extractInitials('Back to Black')).toBe('BB');
    });

    test('keeps filler words when skipping them would leave fewer than two words', () => {
      expect(extractInitials('The Cure')).toBe('TC');
      expect(extractInitials('In Rainbows')).toBe('IR');
      expect(extractInitials('Kid A')).toBe('KA');
    });

    test('handles single-word titles, contractions, numbers, Unicode, and punctuation', () => {
      expect(extractInitials('Waxahatchee')).toBe('WA');
      expect(extractInitials('Björk')).toBe('BJ');
      expect(extractInitials("Don't Stop")).toBe('DS');
      expect(extractInitials("let's rock and roll")).toBe('LR');
      expect(extractInitials('1989')).toBe('19');
      expect(extractInitials('X')).toBe('X');
      expect(extractInitials('()')).toBe('()');
      expect(extractInitials('   ')).toBe('??');
    });
  });

  describe('formatFallbackInitials', () => {
    test('prefers album over artist and falls back to "??" when both are empty', () => {
      expect(formatFallbackInitials({ album: 'Tigers Blood', artist: 'Waxahatchee' })).toBe('TB');
      expect(formatFallbackInitials({ album: '   ', artist: 'Jason Isbell' })).toBe('JI');
      expect(formatFallbackInitials({ album: '', artist: '' })).toBe('??');
    });
  });

  describe('getArtworkFallbackPalette', () => {
    test('returns a deterministic palette for the same artist and album regardless of track or casing', () => {
      const first = getArtworkFallbackPalette({
        artist: 'Waxahatchee',
        album: 'Tigers Blood',
        track: 'Right Back to It',
      });
      const second = getArtworkFallbackPalette({
        artist: '  waxahatchee ',
        album: 'TIGERS BLOOD',
        track: '3 Sisters',
      });

      expect(first).toEqual(second);
      expect(ARTWORK_FALLBACK_PALETTES).toContain(first);
    });

    test('falls back to artist + track when album is empty', () => {
      const palette = getArtworkFallbackPalette({
        artist: 'Jason Isbell',
        album: '',
        track: 'Unreleased Demo Track',
      });

      expect(ARTWORK_FALLBACK_PALETTES).toContain(palette);
      expect(palette).toEqual(
        getArtworkFallbackPalette({
          artist: 'Jason Isbell',
          album: '',
          track: 'Unreleased Demo Track',
        }),
      );
    });

    test('returns the neutral slate palette when artist, album, and track are all blank', () => {
      expect(getArtworkFallbackPalette({ artist: '', album: '', track: '' })).toEqual(
        ARTWORK_FALLBACK_NEUTRAL_PALETTE,
      );
      expect(getArtworkFallbackPalette({ artist: '  ', album: '\t', track: ' ' })).toEqual(
        ARTWORK_FALLBACK_NEUTRAL_PALETTE,
      );
    });

    test('spreads distinct albums across multiple palettes', () => {
      const albums = [
        { artist: 'The Jones Girls', album: 'The Jones Girls', track: 'Track 1' },
        { artist: 'Bobby Bare Jr.', album: 'From the End of Your Leash', track: 'Track 2' },
        { artist: 'Jamie McLean Band', album: 'New Orleans Sessions', track: 'Track 3' },
        { artist: 'Greensky Bluegrass', album: 'All Access, Vol. 1', track: 'Track 4' },
        { artist: 'Waxahatchee', album: 'Tigers Blood', track: 'Track 5' },
        { artist: 'Jason Isbell', album: '', track: 'Unreleased Demo Track' },
      ];

      const paletteIds = new Set(albums.map((scrobble) => getArtworkFallbackPalette(scrobble).id));

      expect(paletteIds.size).toBeGreaterThanOrEqual(4);
    });

    test('hashString produces stable unsigned 32-bit integers', () => {
      const hash = hashString('waxahatchee::tigers blood');

      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hashString('waxahatchee::tigers blood')).toBe(hash);
    });
  });
});
