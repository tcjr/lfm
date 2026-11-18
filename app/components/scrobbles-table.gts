import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import ScrobbleArtwork from './scrobble-artwork.gts';

export interface ScrobblesTableSignature {
  Args: {
    scrobbles: ScrobbleRecord[];
    showHeader?: boolean;
    timeOnly?: boolean;
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeStyle: 'short',
});

function formatUts(uts: number, timeOnly = false): string {
  const date = new Date(uts * 1000);
  return timeOnly ? timeFormatter.format(date) : dateFormatter.format(date);
}

function resolveShowHeader(showHeader = true): boolean {
  return showHeader;
}

const ScrobblesTable: TOC<ScrobblesTableSignature> = <template>
  <div class="overflow-x-auto">
    <table class="table">
      {{#if (resolveShowHeader @showHeader)}}
        <thead>
          <tr>
            <th></th>
            <th>Song</th>
            <th>Artist</th>
            <th>{{if @timeOnly "Time" "Date"}}</th>
          </tr>
        </thead>
      {{/if}}
      <tbody>
        {{#each @scrobbles as |scrobble|}}
          <tr>
            <td>
              <ScrobbleArtwork @scrobble={{scrobble}} class="size-10" />
            </td>
            <td>{{scrobble.track}}</td>
            <td>{{scrobble.artist}}</td>
            <td class="text-nowrap">{{formatUts scrobble.uts @timeOnly}}</td>
          </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</template>;

export default ScrobblesTable;
