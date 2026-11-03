import type { TOC } from '@ember/component/template-only';
import ScrobblesDateFilter from '#components/scrobbles-date-filter.gts';
import ScrobblesTable from '#components/scrobbles-table.gts';
import type { ScrobbleSnapshot } from '#shared/types.ts';

interface ApplicationSignature {
  Args: {
    model: ScrobbleSnapshot;
  };
}

<template>
  <ScrobblesDateFilter @scrobbles={{@model.scrobbles}} as |filtered isValid|>
    {{#if isValid}}
      {{#if filtered}}
        <ScrobblesTable @scrobbles={{filtered}} />
      {{else}}
        <p class="text-base-content/70">No scrobbles match this date range.</p>
      {{/if}}
    {{/if}}
  </ScrobblesDateFilter>

  {{outlet}}
</template> satisfies TOC<ApplicationSignature>;
