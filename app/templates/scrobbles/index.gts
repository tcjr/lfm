import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import ScrobblesByDay from '#components/scrobbles-by-day.gts';
import ScrobblesDateRangeSlider from '#components/scrobbles-date-range-slider.gts';
import ScrobblesGrid from '#components/scrobbles-grid.gts';
import ScrobblesTable from '#components/scrobbles-table.gts';
import ScrobblesViewSelect, { type ScrobbleView } from '#components/scrobbles-view-select.gts';
import type { ScrobbleSnapshot } from '#shared/types.ts';

interface ScrobblesIndexSignature {
  Args: {
    model: ScrobbleSnapshot;
  };
}

export default class ScrobblesIndex extends Component<ScrobblesIndexSignature> {
  @tracked view: ScrobbleView = 'grid';

  setView = (view: ScrobbleView): void => {
    this.view = view;
  };

  <template>
    <ScrobblesViewSelect @value={{this.view}} @onChange={{this.setView}} />

    <ScrobblesDateRangeSlider @scrobbles={{@model.scrobbles}} as |filtered isValid|>
      {{#if isValid}}
        {{#if filtered}}
          {{#if (eq this.view "grid")}}
            <ScrobblesGrid @scrobbles={{filtered}} @overlay="hover" />
          {{else if (eq this.view "table")}}
            <ScrobblesTable @scrobbles={{filtered}} />
          {{else if (eq this.view "by-day")}}
            <ScrobblesByDay @scrobbles={{filtered}} />
          {{/if}}
        {{else}}
          <p class="text-base-content/70">No scrobbles match this date range.</p>
        {{/if}}
      {{/if}}
    </ScrobblesDateRangeSlider>
  </template>
}
