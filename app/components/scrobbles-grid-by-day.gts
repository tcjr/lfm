import type { TOC } from '@ember/component/template-only';
import type { ScrobbleRecord } from '#shared/types.ts';
import { formatDayLabel, groupScrobblesByDay } from '#utils/group-scrobbles-by-day.ts';
import ScrobblesGrid, { type ScrobbleGridDisplayMode } from './scrobbles-grid.gts';

export interface ScrobblesGridByDaySignature {
  Args: {
    scrobbles: ScrobbleRecord[];
    overlay?: ScrobbleGridDisplayMode;
    lovedIndicator?: ScrobbleGridDisplayMode;
  };
}

const ScrobblesGridByDay: TOC<ScrobblesGridByDaySignature> = <template>
  <div class="space-y-6">
    {{#each (groupScrobblesByDay @scrobbles) as |group|}}
      <section>
        <h2 class="mb-3 bg-secondary px-2 py-1 text-secondary-content font-semibold">
          {{formatDayLabel group.date}}
        </h2>
        <ScrobblesGrid
          @scrobbles={{group.scrobbles}}
          @overlay={{@overlay}}
          @lovedIndicator={{@lovedIndicator}}
        />
      </section>
    {{/each}}
  </div>
</template>;

export default ScrobblesGridByDay;
