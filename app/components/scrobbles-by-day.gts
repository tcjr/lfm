import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';

export interface ScrobblesByDaySignature {
  Args: {
    scrobbles: ScrobbleRecord[];
  };
}

interface ScrobbleDayGroup {
  key: string;
  dateLabel: string;
  scrobbles: ScrobbleRecord[];
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeStyle: 'short',
});

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function groupScrobblesByDay(scrobbles: ScrobbleRecord[]): ScrobbleDayGroup[] {
  const groups = new Map<string, ScrobbleDayGroup>();

  for (const scrobble of scrobbles) {
    const date = new Date(scrobble.uts * 1000);
    const key = dayKey(date);
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        dateLabel: dateFormatter.format(date),
        scrobbles: [],
      };
      groups.set(key, group);
    }

    group.scrobbles.push(scrobble);
  }

  return [...groups.values()];
}

function formatTime(uts: number): string {
  return timeFormatter.format(new Date(uts * 1000));
}

<template>
  <div class="overflow-x-auto">
    <table class="table table-xs">
      <thead>
        <tr>
          <th>Song</th>
          <th>Artist</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {{#each (groupScrobblesByDay @scrobbles) as |group|}}
          <tr class="bg-secondary text-secondary-content">
            <th colspan="3" scope="colgroup" class="font-semibold">
              {{group.dateLabel}}
            </th>
          </tr>
          {{#each group.scrobbles as |scrobble|}}
            <tr>
              <td>{{scrobble.track}}</td>
              <td>{{scrobble.artist}}</td>
              <td class="text-nowrap">{{formatTime scrobble.uts}}</td>
            </tr>
          {{/each}}
        {{/each}}
      </tbody>
    </table>
  </div>
</template> satisfies TOC<ScrobblesByDaySignature>;
