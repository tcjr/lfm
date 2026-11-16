import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import ScrobbleArtwork from './scrobble-artwork.gts';

export interface ScrobblesTableSignature {
  Args: {
    scrobbles: ScrobbleRecord[];
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatUts(uts: number): string {
  return dateFormatter.format(new Date(uts * 1000));
}

<template>
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th></th>
          <th>Song</th>
          <th>Artist</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {{#each @scrobbles as |scrobble|}}
          <tr>
            <td>
              <ScrobbleArtwork @scrobble={{scrobble}} class="size-10" />
            </td>
            <td>{{scrobble.track}}</td>
            <td>{{scrobble.artist}}</td>
            <td>{{formatUts scrobble.uts}}</td>
          </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</template> satisfies TOC<ScrobblesTableSignature>;
