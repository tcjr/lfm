import { describe, expect, test } from 'vitest';
import type { ScrobbleRecord } from '#shared/types.ts';
import { formatDayLabel, groupScrobblesByDay } from './group-scrobbles-by-day.ts';

function localUts(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return Math.floor(new Date(year, month - 1, day, hour, minute).getTime() / 1000);
}

function scrobble(uts: number, track: string): ScrobbleRecord {
  return { uts, track, artist: 'Artist', album: 'Album', loved: false };
}

describe('group-scrobbles-by-day utilities', () => {
  test('formatDayLabel formats a date with the medium en-US style', () => {
    expect(formatDayLabel(new Date(2026, 10, 10, 14, 0))).toBe('Nov 10, 2026');
  });

  test('returns no groups for an empty scrobble list', () => {
    expect(groupScrobblesByDay([])).toEqual([]);
  });

  test('groups by local calendar day, newest day and newest scrobble first', () => {
    const oldest = scrobble(localUts(2026, 11, 9, 9), 'Oldest day');
    const morning = scrobble(localUts(2026, 11, 12, 8), 'Morning');
    const middle = scrobble(localUts(2026, 11, 10, 15), 'Middle day');
    const evening = scrobble(localUts(2026, 11, 12, 21), 'Evening');

    const groups = groupScrobblesByDay([oldest, morning, middle, evening]);

    expect(groups.map((group) => group.key)).toEqual(['2026-11-12', '2026-11-10', '2026-11-09']);
    expect(
      groups.map((group) => group.scrobbles.map((groupScrobble) => groupScrobble.track)),
    ).toEqual([['Evening', 'Morning'], ['Middle day'], ['Oldest day']]);
    expect(groups[0]?.date.getTime()).toBe(new Date(morning.uts * 1000).getTime());
  });

  test('keeps input order for scrobbles with identical timestamps', () => {
    const uts = localUts(2026, 11, 10, 14);
    const first = scrobble(uts, 'First');
    const second = scrobble(uts, 'Second');

    const groups = groupScrobblesByDay([first, second]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.scrobbles).toEqual([first, second]);
  });
});
