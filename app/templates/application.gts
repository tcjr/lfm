import type { TOC } from '@ember/component/template-only';
import ScrobblesTable from '#components/scrobbles-table.gts';
import type { ScrobbleSnapshot } from '#shared/types.ts';

interface ApplicationSignature {
  Args: {
    model: ScrobbleSnapshot;
  };
}

<template>
  <p>Scrobbles: {{@model.count}}</p>

  <ScrobblesTable @scrobbles={{@model.scrobbles}} />

  {{outlet}}
</template> satisfies TOC<ApplicationSignature>;
