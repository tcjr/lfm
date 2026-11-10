import { expect } from 'storybook/test';
import preview from '#storybook/preview.ts';
import ScrobblesGrid from './scrobbles-grid.gts';
import type { ScrobbleRecord } from '#shared/types.ts';

const SAMPLE_SCROBBLES: ScrobbleRecord[] = [
  {
    uts: 1_793_717_660,
    track: 'You Gonna Make Me Love Somebody Else',
    artist: 'The Jones Girls',
    album: 'The Jones Girls',
    loved: false,
    imageUrl:
      'https://lastfm-img.freetls.fastly.net/i/u/300x300/9101443fb4bf436bafa08f03e7768650.jpg',
  },
  {
    uts: 1_793_717_238,
    track: "let's rock and roll",
    artist: 'Bobby Bare Jr.',
    album: 'From the End of Your Leash',
    loved: true,
    imageUrl:
      'https://lastfm-img.freetls.fastly.net/i/u/300x300/f27c337880b2c0e4ef2288fd6446a313.png',
  },
  {
    uts: 1_793_717_030,
    track: 'Bring It on Home to Me (feat. Marc Broussard)',
    artist: 'Jamie McLean Band',
    album: 'New Orleans Sessions',
    loved: false,
    imageUrl:
      'https://lastfm-img.freetls.fastly.net/i/u/300x300/a46cc90f58312e299075c510aa523c38.jpg',
  },
  {
    uts: 1_793_716_450,
    track: 'Time/Breathe Reprise',
    artist: 'Greensky Bluegrass',
    album: 'All Access, Vol. 1',
    loved: true,
    imageUrl:
      'https://lastfm-img.freetls.fastly.net/i/u/300x300/d3406f1e4a70520d0c0fb88faadc532e.jpg',
  },
  {
    uts: 1_793_716_177,
    track: 'Right Back to It (feat. MJ Lenderman)',
    artist: 'Waxahatchee',
    album: 'Tigers Blood',
    loved: true,
  },
  {
    uts: 1_793_715_800,
    track: 'Unreleased Demo Track',
    artist: 'Jason Isbell',
    album: '',
    loved: false,
  },
];

const FALLBACK_ONLY_SCROBBLES: ScrobbleRecord[] = SAMPLE_SCROBBLES.map((scrobble) => ({
  uts: scrobble.uts,
  track: scrobble.track,
  artist: scrobble.artist,
  album: scrobble.album,
  loved: scrobble.loved,
}));

const meta = preview.meta({
  title: 'Components/ScrobblesGrid',
  component: ScrobblesGrid,
  args: {
    scrobbles: SAMPLE_SCROBBLES,
    overlay: 'always',
    lovedIndicator: 'always',
  },
});

export const Default = meta.story();

Default.test(
  'renders a tile for each scrobble with track metadata and loved badges',
  async ({ canvas }) => {
    const tiles = canvas.getAllByRole('article');

    await expect(tiles).toHaveLength(SAMPLE_SCROBBLES.length);
    await expect(canvas.getByText('You Gonna Make Me Love Somebody Else')).toBeInTheDocument();
    await expect(canvas.getByText('Bobby Bare Jr.')).toBeInTheDocument();
    await expect(canvas.getByText('All Access, Vol. 1')).toBeInTheDocument();

    const lovedBadges = canvas.getAllByLabelText('Loved track');

    await expect(lovedBadges).toHaveLength(3);
  },
);

Default.test('allows keyboard tabbing across scrobble tiles', async ({ canvas, userEvent }) => {
  const tiles = canvas.getAllByRole('article');

  await userEvent.tab();
  await expect(tiles[0]).toHaveFocus();

  await userEvent.tab();
  await expect(tiles[1]).toHaveFocus();
});

export const HoverOverlay = meta.story({
  args: {
    overlay: 'hover',
    lovedIndicator: 'hover',
  },
  play: async ({ canvas, userEvent }) => {
    const tiles = canvas.getAllByRole('article');

    if (tiles[1]) {
      await userEvent.hover(tiles[1]);
    }

    await expect(canvas.getByText("let's rock and roll")).toBeInTheDocument();
    await expect(canvas.getByText('From the End of Your Leash')).toBeInTheDocument();
  },
});

export const ArtworkOnly = meta.story({
  args: {
    overlay: 'none',
    lovedIndicator: 'none',
  },
});

ArtworkOnly.test(
  'omits metadata overlays and loved badges when display modes are "none"',
  async ({ canvas }) => {
    const tiles = canvas.getAllByRole('article');

    await expect(tiles).toHaveLength(SAMPLE_SCROBBLES.length);
    await expect(
      canvas.queryByText('You Gonna Make Me Love Somebody Else'),
    ).not.toBeInTheDocument();
    await expect(canvas.queryAllByLabelText('Loved track')).toHaveLength(0);
  },
);

export const FallbackInitials = meta.story({
  args: {
    scrobbles: FALLBACK_ONLY_SCROBBLES,
  },
});

FallbackInitials.test(
  'displays album or artist initials when artwork is unavailable',
  async ({ canvas }) => {
    // Album initials (first 2 characters of album name)
    await expect(canvas.getByText('Th')).toBeInTheDocument();
    await expect(canvas.getByText('Fr')).toBeInTheDocument();
    await expect(canvas.getByText('Ne')).toBeInTheDocument();
    await expect(canvas.getByText('Al')).toBeInTheDocument();
    await expect(canvas.getByText('Ti')).toBeInTheDocument();

    // Falls back to artist initials when album is empty
    await expect(canvas.getByText('Ja')).toBeInTheDocument();
  },
);
