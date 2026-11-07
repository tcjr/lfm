import type { TOC } from '@ember/component/template-only';

export type ScrobbleView = 'by-day' | 'table';

export interface ScrobblesViewSelectSignature {
  Args: {
    value: ScrobbleView;
    onChange: (view: ScrobbleView) => void;
  };
}

function isByDay(view: ScrobbleView): boolean {
  return view === 'by-day';
}

function isTable(view: ScrobbleView): boolean {
  return view === 'table';
}

function handleChange(onChange: (view: ScrobbleView) => void): (event: Event) => void {
  return (event: Event) => {
    onChange((event.target as HTMLSelectElement).value as ScrobbleView);
  };
}

<template>
  <div class="mb-4">
    <label class="flex flex-col gap-1">
      <span class="label">View</span>
      <select class="select w-full sm:w-44" {{on "change" (handleChange @onChange)}}>
        <option value="by-day" selected={{isByDay @value}}>By day</option>
        <option value="table" selected={{isTable @value}}>Table</option>
      </select>
    </label>
  </div>
</template> satisfies TOC<ScrobblesViewSelectSignature>;
