import { fn } from 'storybook/test';
import preview from '#storybook/preview.ts';
import ScrobblesViewSelect from './scrobbles-view-select.gts';

const meta = preview.meta({
  title: 'Components/ScrobblesViewSelect',
  component: ScrobblesViewSelect,
  args: {
    value: 'grid',
    onChange: fn(),
  },
});

export const Grid = meta.story();

export const ByDay = Grid.extend({
  args: {
    value: 'by-day',
  },
});

export const Table = Grid.extend({
  args: {
    value: 'table',
  },
});
