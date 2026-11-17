import { expect } from 'storybook/test';
import preview from '#storybook/preview.ts';
import ScrobblesGridByDay from './scrobbles-grid-by-day.gts';
import type { ScrobbleRecord } from '#shared/types.ts';

function localUts(year: number, month: number, day: number, hour: number): number {
  return Math.floor(new Date(year, month - 1, day, hour).getTime() / 1000);
}

const SAMPLE_SCROBBLES: ScrobbleRecord[] = [
  {
    uts: localUts(2026, 11, 10, 9),
    track: 'Older Track',
    artist: 'Older Artist',
    album: 'Older Album',
    loved: false,
  },
  {
    uts: localUts(2026, 11, 12, 8),
    track: 'Morning Track',
    artist: 'Morning Artist',
    album: 'Morning Album',
    loved: false,
  },
  {
    uts: localUts(2026, 11, 12, 21),
    track: 'Evening Track',
    artist: 'Evening Artist',
    album: 'Evening Album',
    loved: true,
  },
];

const meta = preview.meta({
  title: 'Components/ScrobblesGridByDay',
  component: ScrobblesGridByDay,
  args: {
    scrobbles: SAMPLE_SCROBBLES,
    overlay: 'always',
    lovedIndicator: 'always',
  },
});

export const Default = meta.story();

Default.test("renders a day header per group with that day's tiles", async ({ canvas }) => {
  const headings = canvas.getAllByRole('heading', { level: 2 });

  await expect(headings).toHaveLength(2);
  await expect(headings[0]).toHaveTextContent('Nov 12, 2026');
  await expect(headings[1]).toHaveTextContent('Nov 10, 2026');
  await expect(canvas.getAllByRole('article')).toHaveLength(3);
  await expect(canvas.getByText('Evening Track')).toBeInTheDocument();
});

Default.test('orders scrobbles newest first within a day', async ({ canvas }) => {
  const tracks = canvas
    .getAllByRole('article')
    .map((tile) => tile.querySelector('p')?.textContent?.trim());

  await expect(tracks).toEqual(['Evening Track', 'Morning Track', 'Older Track']);
});

export const ArtworkOnly = meta.story({
  args: {
    overlay: 'none',
    lovedIndicator: 'none',
  },
});

ArtworkOnly.test('forwards display mode args to each nested grid', async ({ canvas }) => {
  await expect(canvas.queryByText('Evening Track')).not.toBeInTheDocument();
  await expect(canvas.queryAllByLabelText('Loved track')).toHaveLength(0);
});
