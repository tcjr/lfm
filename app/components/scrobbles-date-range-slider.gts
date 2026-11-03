import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { Slider } from 'ember-primitives';
import type { ScrobbleRecord } from '#shared/types.ts';
import { filterScrobblesByDateRange } from '#utils/filter-scrobbles.ts';

export interface ScrobblesDateRangeSliderSignature {
  Args: {
    scrobbles: ScrobbleRecord[];
  };
  Blocks: {
    default: [filtered: ScrobbleRecord[], isValid: boolean];
  };
}

const MS_PER_DAY = 86_400_000;
const DEFAULT_WINDOW_DAYS = 30;

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/**
 * Turn a local calendar date into an integer day number.
 *
 * We deliberately use UTC when constructing the day number so that DST and
 * timezone offsets cannot produce fractional days. The year/month/day are
 * still read from the local date, matching the filter's local-day semantics.
 */
function dayNumberFromDate(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

function dateFromDayNumber(dayNumber: number): Date {
  return new Date(dayNumber * MS_PER_DAY);
}

function dateInputValueFromDayNumber(dayNumber: number): string {
  const date = dateFromDayNumber(dayNumber);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function formatDayNumber(dayNumber: number): string {
  return dayFormatter.format(dateFromDayNumber(dayNumber));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface DayBounds {
  min: number;
  max: number;
}

export default class ScrobblesDateRangeSlider extends Component<ScrobblesDateRangeSliderSignature> {
  @tracked private selectedRange: [number, number] | null = null;

  /**
   * The slider spans the full range of the loaded scrobbles so both handles
   * can reach every record. With years of history this becomes a very long
   * track (one step per day), so a future version may want a zoom/coarser
   * granularity for large ranges.
   */
  get dayBounds(): DayBounds {
    if (this.args.scrobbles.length === 0) {
      const today = dayNumberFromDate(new Date());

      return { min: today - DEFAULT_WINDOW_DAYS, max: today };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const scrobble of this.args.scrobbles) {
      const day = dayNumberFromDate(new Date(scrobble.uts * 1000));

      if (day < min) min = day;
      if (day > max) max = day;
    }

    return { min, max };
  }

  get range(): [number, number] {
    const { min, max } = this.dayBounds;
    const selected = this.selectedRange;

    if (!selected) {
      return [Math.max(min, max - DEFAULT_WINDOW_DAYS), max];
    }

    return [clamp(selected[0], min, max), clamp(selected[1], min, max)];
  }

  get from(): string {
    return dateInputValueFromDayNumber(this.range[0]);
  }

  get to(): string {
    return dateInputValueFromDayNumber(this.range[1]);
  }

  get fromLabel(): string {
    return formatDayNumber(this.range[0]);
  }

  get toLabel(): string {
    return formatDayNumber(this.range[1]);
  }

  get minLabel(): string {
    return formatDayNumber(this.dayBounds.min);
  }

  get maxLabel(): string {
    return formatDayNumber(this.dayBounds.max);
  }

  get filtered(): ScrobbleRecord[] {
    return filterScrobblesByDateRange(this.args.scrobbles, this.from, this.to);
  }

  setRange = (value: number | number[]): void => {
    if (!Array.isArray(value)) {
      this.selectedRange = [value, value];
      return;
    }

    const [from, to] = value;
    if (from === undefined || to === undefined) return;

    this.selectedRange = [from, to];
  };

  reset = (): void => {
    const { min, max } = this.dayBounds;

    this.selectedRange = [min, max];
  };

  <template>
    <div class="mb-4 flex flex-col gap-3">
      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <span class="label">From</span>
            <span class="font-medium">{{this.fromLabel}}</span>
          </div>

          <div class="flex flex-col items-end gap-1">
            <span class="label">To</span>
            <span class="font-medium">{{this.toLabel}}</span>
          </div>
        </div>

        <Slider
          class="text-primary"
          @value={{this.range}}
          @min={{this.dayBounds.min}}
          @max={{this.dayBounds.max}}
          @step={{1}}
          @onValueChange={{this.setRange}}
          as |slider|
        >
          <slider.Track>
            <slider.Range />

            {{#each slider.thumbs as |thumb|}}
              <slider.Thumb @thumb={{thumb}} aria-label={{if thumb.index "To date" "From date"}} />
            {{/each}}
          </slider.Track>
        </Slider>

        <div class="text-base-content/60 flex justify-between text-xs">
          <span>{{this.minLabel}}</span>
          <span>{{this.maxLabel}}</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-sm btn-ghost"
            {{on "click" this.reset}}
            type="button"
          >Reset</button>
        </div>
      </div>

      <p class="text-base-content/70 text-sm">
        Showing
        {{this.filtered.length}}
        of
        {{@scrobbles.length}}
        scrobbles
      </p>
    </div>

    {{yield this.filtered true}}
  </template>
}
