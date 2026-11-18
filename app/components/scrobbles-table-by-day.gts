import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import { formatDayLabel, groupScrobblesByDay } from '#utils/group-scrobbles-by-day.ts';
import ScrobblesTable from './scrobbles-table.gts';

export interface ScrobblesTableByDaySignature {
  Args: {
    scrobbles: ScrobbleRecord[];
    showHeader?: boolean;
  };
}

const ScrobblesTableByDay: TOC<ScrobblesTableByDaySignature> = <template>
  <div class="space-y-6">
    {{#each (groupScrobblesByDay @scrobbles) as |group|}}
      <section>
        <h2 class="mb-3 bg-secondary px-2 py-1 text-secondary-content font-semibold">
          {{formatDayLabel group.date}}
        </h2>
        <ScrobblesTable
          @scrobbles={{group.scrobbles}}
          @showHeader={{@showHeader}}
          @timeOnly={{true}}
        />
      </section>
    {{/each}}
  </div>
</template>;

export default ScrobblesTableByDay;
