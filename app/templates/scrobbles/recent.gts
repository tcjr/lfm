import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import ScrobblesByDay from '#components/scrobbles-by-day.gts';
import ScrobblesTable from '#components/scrobbles-table.gts';
import ScrobblesViewSelect, { type ScrobbleView } from '#components/scrobbles-view-select.gts';
import type { ScrobbleRecord } from '#shared/types.ts';

interface ScrobblesRecentSignature {
  Args: {
    model: ScrobbleRecord[];
  };
}

export default class ScrobblesRecent extends Component<ScrobblesRecentSignature> {
  @tracked view: ScrobbleView = 'by-day';

  setView = (view: ScrobbleView): void => {
    this.view = view;
  };

  <template>
    <ScrobblesViewSelect @value={{this.view}} @onChange={{this.setView}} />

    {{#if @model.length}}
      {{#if (eq this.view "table")}}
        <ScrobblesTable @scrobbles={{@model}} />
      {{else if (eq this.view "by-day")}}
        <ScrobblesByDay @scrobbles={{@model}} />
      {{/if}}
    {{else}}
      <p class="text-base-content/70">No scrobbles match this date range.</p>
    {{/if}}
  </template>
}
