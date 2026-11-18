import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import ScrobblesGridByDay from '#components/scrobbles-grid-by-day.gts';
import ScrobblesTableByDay from '#components/scrobbles-table-by-day.gts';
import ScrobblesViewSelect, { type ScrobbleView } from '#components/scrobbles-view-select.gts';
import type { ScrobbleRecord } from '#shared/types.ts';

interface ScrobblesRecentSignature {
  Args: {
    model: ScrobbleRecord[];
  };
}

export default class ScrobblesRecent extends Component<ScrobblesRecentSignature> {
  @tracked view: ScrobbleView = 'table';

  setView = (view: ScrobbleView): void => {
    this.view = view;
  };

  <template>
    <ScrobblesViewSelect @value={{this.view}} @onChange={{this.setView}} />

    {{#if @model.length}}
      {{#if (eq this.view "grid")}}
        <ScrobblesGridByDay @scrobbles={{@model}} @overlay="always" @lovedIndicator="always" />
      {{else if (eq this.view "table")}}
        <ScrobblesTableByDay @scrobbles={{@model}} />
      {{/if}}
    {{else}}
      <p class="text-base-content/70">No scrobbles match this date range.</p>
    {{/if}}
  </template>
}
