import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import { Avatar } from 'ember-primitives';

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

function formatFallbackText(scrobble: ScrobbleRecord) {
  return (scrobble.album || scrobble.artist || '??').slice(0, 2);
}

<template>
  <div class="overflow-x-auto">
    <table class="table table-xs">
      <thead>
        <tr>
          <th></th>
          <th>Song</th>
          <th>Artist</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {{#each (groupScrobblesByDay @scrobbles) as |group|}}
          <tr class="bg-secondary text-secondary-content">
            <th colspan="4" scope="colgroup" class="font-semibold">
              {{group.dateLabel}}
            </th>
          </tr>
          {{#each group.scrobbles as |scrobble|}}
            <tr>
              <td>
                <Avatar
                  @src="{{scrobble.imageUrl}}"
                  class="w-10 h-10 flex items-center place-content-center overflow-hidden"
                  as |a|
                >
                  <a.Image alt={{scrobble.album}} class="w-full h-full" />
                  <a.Fallback>
                    {{formatFallbackText scrobble}}
                  </a.Fallback>
                </Avatar>
              </td>
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
