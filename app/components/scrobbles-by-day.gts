import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import { formatDayLabel, groupScrobblesByDay } from '#utils/group-scrobbles-by-day.ts';
import ScrobbleArtwork from './scrobble-artwork.gts';

export interface ScrobblesByDaySignature {
  Args: {
    scrobbles: ScrobbleRecord[];
  };
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeStyle: 'short',
});

function formatTime(uts: number): string {
  return timeFormatter.format(new Date(uts * 1000));
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
              {{formatDayLabel group.date}}
            </th>
          </tr>
          {{#each group.scrobbles as |scrobble|}}
            <tr>
              <td>
                <ScrobbleArtwork @scrobble={{scrobble}} class="size-10" />
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
