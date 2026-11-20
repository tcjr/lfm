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
  'displays smart album or artist initials with deterministic palettes when artwork is unavailable',
  async ({ canvas }) => {
    // Smart word initials for album names (skipping leading/filler words when 2+ content words remain)
    await expect(canvas.getByText('JG')).toBeInTheDocument();
    await expect(canvas.getByText('FE')).toBeInTheDocument();
    await expect(canvas.getByText('NO')).toBeInTheDocument();
    await expect(canvas.getByText('AA')).toBeInTheDocument();
    await expect(canvas.getByText('TB')).toBeInTheDocument();

    // Falls back to artist initials when album is empty
    await expect(canvas.getByText('JI')).toBeInTheDocument();

    const palettes = new Set(
      canvas
        .getAllByRole('article')
        .map((tile) =>
          tile.querySelector('[data-fallback-palette]')?.getAttribute('data-fallback-palette'),
        )
        .filter(Boolean),
    );

    await expect(palettes.size).toBeGreaterThanOrEqual(4);
  },
);

export const FallbackHoverOverlay = meta.story({
  args: {
    scrobbles: FALLBACK_ONLY_SCROBBLES,
    overlay: 'hover',
    lovedIndicator: 'hover',
  },
  play: async ({ canvas, userEvent }) => {
    const tiles = canvas.getAllByRole('article');

    if (tiles[4]) {
      await userEvent.hover(tiles[4]);
    }

    await expect(canvas.getByText('TB')).toBeInTheDocument();
    await expect(canvas.getByText('Tigers Blood')).toBeInTheDocument();
  },
});

export const FallbackArtworkOnly = meta.story({
  args: {
    scrobbles: FALLBACK_ONLY_SCROBBLES,
    overlay: 'none',
    lovedIndicator: 'none',
  },
});

FallbackArtworkOnly.test(
  'renders full-bleed fallback artwork tiles without overlays or loved badges',
  async ({ canvas }) => {
    await expect(canvas.getAllByRole('article')).toHaveLength(FALLBACK_ONLY_SCROBBLES.length);
    await expect(canvas.getByText('TB')).toBeInTheDocument();
    await expect(canvas.queryByText('Tigers Blood')).not.toBeInTheDocument();
    await expect(canvas.queryAllByLabelText('Loved track')).toHaveLength(0);
  },
);
