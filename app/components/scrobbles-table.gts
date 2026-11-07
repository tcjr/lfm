import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import { Avatar } from 'ember-primitives';

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

function formatFallbackText(scrobble: ScrobbleRecord) {
  return (scrobble.album || scrobble.artist || '??').slice(0, 2);
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
            <td>{{formatUts scrobble.uts}}</td>
          </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</template> satisfies TOC<ScrobblesTableSignature>;
