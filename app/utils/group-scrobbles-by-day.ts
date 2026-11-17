import type { ScrobbleRecord } from '#shared/types.ts';

export interface ScrobbleDayGroup {
  key: string;
  date: Date;
  scrobbles: ScrobbleRecord[];
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
});

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDayLabel(date: Date): string {
  return dateFormatter.format(date);
}

export function groupScrobblesByDay(scrobbles: ScrobbleRecord[]): ScrobbleDayGroup[] {
  const groups = new Map<string, ScrobbleDayGroup>();

  for (const scrobble of scrobbles) {
    const date = new Date(scrobble.uts * 1000);
    const key = dayKey(date);
    let group = groups.get(key);

    if (!group) {
      group = { key, date, scrobbles: [] };
      groups.set(key, group);
    }

    group.scrobbles.push(scrobble);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));

  for (const group of sortedGroups) {
    // Array#sort is stable, so scrobbles sharing a timestamp keep their input order.
    group.scrobbles.sort((a, b) => b.uts - a.uts);
  }

  return sortedGroups;
}
