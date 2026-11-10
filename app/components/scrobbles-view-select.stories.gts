import { expect, fn } from 'storybook/test';
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

Grid.test('selects the Grid option by default and lists all view options', async ({ canvas }) => {
  const select = canvas.getByRole('combobox', { name: 'View' });

  await expect(select).toHaveValue('grid');

  const options = canvas.getAllByRole('option');

  await expect(options.map((option) => option.textContent?.trim())).toEqual([
    'Grid',
    'By day',
    'Table',
  ]);
});

Grid.test(
  'calls onChange with the newly selected view mode',
  async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('combobox', { name: 'View' });

    await userEvent.selectOptions(select, 'by-day');
    await expect(args.onChange).toHaveBeenCalledWith('by-day');

    await userEvent.selectOptions(select, 'table');
    await expect(args.onChange).toHaveBeenCalledWith('table');
  },
);

export const ByDay = Grid.extend({
  args: {
    value: 'by-day',
  },
});

ByDay.test(
  'preselects the "By day" option and notifies onChange when switching back to Grid',
  async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('combobox', { name: 'View' });

    await expect(select).toHaveValue('by-day');

    await userEvent.selectOptions(select, 'grid');
    await expect(args.onChange).toHaveBeenCalledWith('grid');
  },
);

export const Table = Grid.extend({
  args: {
    value: 'table',
  },
});

Table.test('preselects the "Table" option', async ({ canvas }) => {
  const select = canvas.getByRole('combobox', { name: 'View' });

  await expect(select).toHaveValue('table');
});
