import type { TOC } from '@ember/component/template-only';

export type ScrobbleView = 'grid' | 'by-day' | 'table';

export interface ScrobblesViewSelectSignature {
  Args: {
    value: ScrobbleView;
    onChange: (view: ScrobbleView) => void;
  };
}

function handleChange(onChange: (view: ScrobbleView) => void): (event: Event) => void {
  return (event: Event) => {
    onChange((event.target as HTMLSelectElement).value as ScrobbleView);
  };
}

const ScrobblesViewSelect: TOC<ScrobblesViewSelectSignature> = <template>
  <div class="mb-4">
    <label class="flex flex-col gap-1">
      <span class="label">View</span>
      <select class="select w-full sm:w-44" {{on "change" (handleChange @onChange)}}>
        <option value="grid" selected={{eq "grid" @value}}>Grid</option>
        <option value="by-day" selected={{eq "by-day" @value}}>By day</option>
        <option value="table" selected={{eq "table" @value}}>Table</option>
      </select>
    </label>
  </div>
</template>;

export default ScrobblesViewSelect;
