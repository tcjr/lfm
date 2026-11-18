import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import ScrobblesDateRangeSlider from '#components/scrobbles-date-range-slider.gts';
import ScrobblesGridByDay from '#components/scrobbles-grid-by-day.gts';
import ScrobblesTable from '#components/scrobbles-table.gts';
import ScrobblesTableByDay from '#components/scrobbles-table-by-day.gts';
import ScrobblesViewSelect, { type ScrobbleView } from '#components/scrobbles-view-select.gts';
import type { ScrobbleSnapshot } from '#shared/types.ts';
import ScrobblesGrid from '#components/scrobbles-grid.gts';

interface ScrobblesIndexSignature {
  Args: {
    model: ScrobbleSnapshot;
  };
}

export default class ScrobblesIndex extends Component<ScrobblesIndexSignature> {
  @tracked view: ScrobbleView = 'grid';
  @tracked grouping: 'day' | 'none' = 'none';

  setView = (view: ScrobbleView): void => {
    this.view = view;
  };

  updateGrouping = (evt: Event) => {
    this.grouping = (evt.target as HTMLInputElement).checked ? 'day' : 'none';
  };

  <template>
    <ScrobblesViewSelect @value={{this.view}} @onChange={{this.setView}} />

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Group</legend>
      <label class="label">
        <input
          type="checkbox"
          checked={{eq this.grouping "day"}}
          class="checkbox"
          {{on "change" this.updateGrouping}}
        />
        By day
      </label>
    </fieldset>

    <ScrobblesDateRangeSlider @scrobbles={{@model.scrobbles}} as |filtered isValid|>
      {{#if isValid}}
        {{#if filtered}}
          {{#if (eq this.view "grid")}}
            {{#if (eq this.grouping "day")}}
              <ScrobblesGridByDay
                @scrobbles={{filtered}}
                @overlay="always"
                @lovedIndicator="hover"
              />
            {{else}}
              <ScrobblesGrid @scrobbles={{filtered}} @overlay="always" @lovedIndicator="hover" />
            {{/if}}
          {{else if (eq this.view "table")}}
            {{#if (eq this.grouping "day")}}
              <ScrobblesTableByDay @scrobbles={{filtered}} />
            {{else}}
              <ScrobblesTable @scrobbles={{filtered}} />
            {{/if}}
          {{/if}}
        {{else}}
          <p class="text-base-content/70">No scrobbles match this date range.</p>
        {{/if}}
      {{/if}}
    </ScrobblesDateRangeSlider>
  </template>
}
