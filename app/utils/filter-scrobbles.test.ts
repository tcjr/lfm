import { describe, expect, test } from 'vitest';
import { daysAgo, filterScrobblesByDateRange, isValidDateRange } from './filter-scrobbles.ts';
import type { ScrobbleRecord } from '#shared/types.ts';

describe('filter-scrobbles utilities', () => {
  test('daysAgo returns YYYY-MM-DD offset from reference date', () => {
    const now = new Date(2026, 10, 16, 12, 0, 0); // Nov 16, 2026
    expect(daysAgo(0, now)).toBe('2026-11-16');
    expect(daysAgo(7, now)).toBe('2026-11-09');
  });

  test('isValidDateRange validates empty or ordered bounds', () => {
    expect(isValidDateRange('', '')).toBe(true);
    expect(isValidDateRange('2026-11-01', '')).toBe(true);
    expect(isValidDateRange('', '2026-11-16')).toBe(true);
    expect(isValidDateRange('2026-11-01', '2026-11-16')).toBe(true);
    expect(isValidDateRange('2026-11-16', '2026-11-01')).toBe(false);
  });

  test('filterScrobblesByDateRange filters inclusively by local calendar day', () => {
    const day1 = Math.floor(new Date(2026, 10, 10, 14, 0, 0).getTime() / 1000);
    const day2 = Math.floor(new Date(2026, 10, 12, 14, 0, 0).getTime() / 1000);
    const day3 = Math.floor(new Date(2026, 10, 15, 14, 0, 0).getTime() / 1000);

    const scrobbles: ScrobbleRecord[] = [
      { uts: day1, track: 'Track 1', artist: 'Artist 1', album: 'Album 1', loved: false },
      { uts: day2, track: 'Track 2', artist: 'Artist 2', album: 'Album 2', loved: true },
      { uts: day3, track: 'Track 3', artist: 'Artist 3', album: 'Album 3', loved: false },
    ];

    expect(filterScrobblesByDateRange(scrobbles, '2026-11-11', '2026-11-14')).toEqual([
      scrobbles[1],
    ]);
    expect(filterScrobblesByDateRange(scrobbles, '', '')).toHaveLength(3);
  });
});
