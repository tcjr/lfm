import type { TOC } from '@ember/component/template-only';
import ScrobblesDateRangeSlider from '#components/scrobbles-date-range-slider.gts';
import ScrobblesTable from '#components/scrobbles-table.gts';
import type { ScrobbleSnapshot } from '#shared/types.ts';

interface ScrobblesIndexSignature {
  Args: {
    model: ScrobbleSnapshot;
  };
}

<template>
  <ScrobblesDateRangeSlider @scrobbles={{@model.scrobbles}} as |filtered isValid|>
    {{#if isValid}}
      {{#if filtered}}
        <ScrobblesTable @scrobbles={{filtered}} />
      {{else}}
        <p class="text-base-content/70">No scrobbles match this date range.</p>
      {{/if}}
    {{/if}}
  </ScrobblesDateRangeSlider>
</template> satisfies TOC<ScrobblesIndexSignature>;
