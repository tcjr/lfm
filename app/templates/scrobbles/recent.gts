import type { TOC } from '@ember/component/template-only';
import ScrobblesTable from '#components/scrobbles-table.gts';
import type { ScrobbleRecord } from '#shared/types.ts';

interface ScrobblesRecentSignature {
  Args: {
    model: ScrobbleRecord[];
  };
}

<template>
  {{#if @model.length}}
    <ScrobblesTable @scrobbles={{@model}} />
  {{else}}
    <p class="text-base-content/70">No scrobbles match this date range.</p>
  {{/if}}
</template> satisfies TOC<ScrobblesRecentSignature>;
