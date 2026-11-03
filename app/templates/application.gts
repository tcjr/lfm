import type { TOC } from '@ember/component/template-only';
import type { ScrobbleSnapshot } from '#shared/types.ts';

interface ApplicationSignature {
  Args: {
    model: ScrobbleSnapshot;
  };
}

<template>
  <p>Scrobbles: {{@model.count}}</p>

  {{outlet}}
</template> satisfies TOC<ApplicationSignature>;
