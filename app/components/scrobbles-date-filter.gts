import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import type { ScrobbleRecord } from '#shared/types.ts';
import { daysAgo, filterScrobblesByDateRange, isValidDateRange } from '#utils/filter-scrobbles.ts';

export interface ScrobblesDateFilterSignature {
  Args: {
    scrobbles: ScrobbleRecord[];
  };
  Blocks: {
    default: [filtered: ScrobbleRecord[], isValid: boolean];
  };
}

export default class ScrobblesDateFilter extends Component<ScrobblesDateFilterSignature> {
  @tracked from = daysAgo(30);
  @tracked to = daysAgo(0);

  get isValid(): boolean {
    return isValidDateRange(this.from, this.to);
  }

  get filtered(): ScrobbleRecord[] {
    if (!this.isValid) return [];

    return filterScrobblesByDateRange(this.args.scrobbles, this.from, this.to);
  }

  setFrom = (event: Event): void => {
    this.from = (event.target as HTMLInputElement).value;
  };

  setTo = (event: Event): void => {
    this.to = (event.target as HTMLInputElement).value;
  };

  last30 = (): void => {
    this.from = daysAgo(30);
    this.to = daysAgo(0);
  };

  last60 = (): void => {
    this.from = daysAgo(60);
    this.to = daysAgo(0);
  };

  clear = (): void => {
    this.from = '';
    this.to = '';
  };

  <template>
    <div class="mb-4 flex flex-col gap-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label class="flex flex-col gap-1">
          <span class="label">From</span>
          <input
            type="date"
            class="input w-full sm:w-44"
            value={{this.from}}
            max={{if this.to this.to}}
            {{on "input" this.setFrom}}
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class="label">To</span>
          <input
            type="date"
            class="input w-full sm:w-44"
            value={{this.to}}
            min={{if this.from this.from}}
            {{on "input" this.setTo}}
          />
        </label>

        <div class="flex flex-wrap gap-2">
          {{!-- <button type="button" class="btn btn-sm" {{on "click" this.last30}}>Last 30 days</button>
          <button type="button" class="btn btn-sm" {{on "click" this.last60}}>Last 60 days</button> --}}
          <button
            class="btn btn-sm btn-ghost"
            {{on "click" this.clear}}
            type="button"
          >Clear</button>
        </div>
      </div>

      {{#unless this.isValid}}
        <p class="text-error text-sm" role="alert">End date must be on or after start date.</p>
      {{/unless}}

      <p class="text-base-content/70 text-sm">
        Showing
        {{this.filtered.length}}
        of
        {{@scrobbles.length}}
        scrobbles
      </p>
    </div>

    {{yield this.filtered this.isValid}}
  </template>
}
