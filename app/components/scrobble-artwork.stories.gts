import type { TOC } from '@ember/component/template-only';
import { expect, waitFor } from 'storybook/test';
import preview from '#storybook/preview.ts';
import ScrobbleArtwork, { type ScrobbleArtworkSignature } from './scrobble-artwork.gts';
import ScrobblesTable from './scrobbles-table.gts';
import type { ScrobbleRecord } from '#shared/types.ts';
import { getArtworkFallbackPalette } from '#utils/artwork-fallback.ts';

const SAMPLE_ARTWORK_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#4f46e5"/><circle cx="60" cy="60" r="32" fill="#e0e7ff"/><circle cx="60" cy="60" r="8" fill="#4f46e5"/></svg>',
  );

const BASE_SCROBBLE: ScrobbleRecord = {
  uts: 1_793_717_660,
  track: 'You Gonna Make Me Love Somebody Else',
  artist: 'The Jones Girls',
  album: 'The Jones Girls',
  loved: false,
  imageUrl: SAMPLE_ARTWORK_DATA_URI,
};

const FALLBACK_GALLERY_SCROBBLES: ScrobbleRecord[] = [
  {
    uts: 1_793_717_660,
    track: 'Right Back to It (feat. MJ Lenderman)',
    artist: 'Waxahatchee',
    album: 'Tigers Blood',
    loved: true,
  },
  {
    uts: 1_793_717_500,
    track: '3 Sisters',
    artist: 'Waxahatchee',
    album: 'Tigers Blood',
    loved: false,
  },
  {
    uts: 1_793_717_238,
    track: "let's rock and roll",
    artist: 'Bobby Bare Jr.',
    album: 'From the End of Your Leash',
    loved: true,
  },
  {
    uts: 1_793_717_030,
    track: 'Bring It on Home to Me',
    artist: 'Jamie McLean Band',
    album: 'New Orleans Sessions',
    loved: false,
  },
  {
    uts: 1_793_716_450,
    track: 'So What',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    loved: true,
  },
  {
    uts: 1_793_716_177,
    track: 'Jóga',
    artist: 'Björk',
    album: 'Homogenic',
    loved: false,
  },
  {
    uts: 1_793_715_800,
    track: 'Unreleased Demo Track',
    artist: 'Jason Isbell',
    album: '',
    loved: false,
  },
  {
    uts: 1_793_715_000,
    track: '',
    artist: '',
    album: '',
    loved: false,
  },
];

const TABLE_SHOWCASE_SCROBBLES: ScrobbleRecord[] = [
  BASE_SCROBBLE,
  FALLBACK_GALLERY_SCROBBLES[0]!,
  FALLBACK_GALLERY_SCROBBLES[2]!,
  FALLBACK_GALLERY_SCROBBLES[4]!,
  FALLBACK_GALLERY_SCROBBLES[6]!,
];

const ScrobbleArtworkStory: TOC<ScrobbleArtworkSignature> = <template>
  <ScrobbleArtwork
    @scrobble={{@scrobble}}
    data-testid="scrobble-artwork"
    class="size-24 rounded-lg text-2xl"
  />
</template>;

const FallbackSizesStory: TOC<ScrobbleArtworkSignature> = <template>
  <div class="flex flex-wrap items-end gap-6">
    <div class="flex flex-col items-center gap-2">
      <ScrobbleArtwork
        @scrobble={{@scrobble}}
        data-testid="artwork-table"
        class="size-10 rounded-md"
      />
      <span class="text-xs text-base-content/70">Table (size-10)</span>
    </div>
    <div class="flex flex-col items-center gap-2">
      <ScrobbleArtwork
        @scrobble={{@scrobble}}
        data-testid="artwork-compact"
        class="size-16 rounded-lg"
      />
      <span class="text-xs text-base-content/70">Compact (size-16)</span>
    </div>
    <div class="flex flex-col items-center gap-2">
      <ScrobbleArtwork
        @scrobble={{@scrobble}}
        data-testid="artwork-medium"
        class="size-24 rounded-lg"
      />
      <span class="text-xs text-base-content/70">Medium (size-24)</span>
    </div>
    <div class="flex flex-col items-center gap-2">
      <ScrobbleArtwork
        @scrobble={{@scrobble}}
        data-testid="artwork-grid"
        class="size-52 rounded-xl"
      />
      <span class="text-xs text-base-content/70">Grid tile (size-52)</span>
    </div>
  </div>
</template>;

const FallbackPaletteGalleryStory: TOC<ScrobbleArtworkSignature> = <template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    {{#each FALLBACK_GALLERY_SCROBBLES as |item index|}}
      <div class="flex flex-col items-center gap-2 text-center">
        <ScrobbleArtwork
          @scrobble={{item}}
          data-testid="gallery-artwork-{{index}}"
          class="size-28 rounded-xl shadow-sm"
        />
        <div class="w-28">
          <p class="truncate text-xs font-medium">{{or item.album item.artist "Unknown"}}</p>
          <p class="truncate text-[11px] text-base-content/65">{{or item.artist "No metadata"}}</p>
        </div>
      </div>
    {{/each}}
  </div>
</template>;

const TableThumbnailContextStory: TOC<ScrobbleArtworkSignature> = <template>
  <ScrobblesTable @scrobbles={{TABLE_SHOWCASE_SCROBBLES}} />
</template>;

const meta = preview.meta({
  title: 'Components/ScrobbleArtwork',
  component: ScrobbleArtwork,
  args: {
    scrobble: BASE_SCROBBLE,
  },
  render: () => ScrobbleArtworkStory,
});

export const LoadedImage = meta.story();

LoadedImage.test(
  'renders the album cover image with the album title as alt text once loaded',
  async ({ canvas }) => {
    const img = await canvas.findByRole('img', { name: 'The Jones Girls' });

    await expect(img).toHaveAttribute('src', SAMPLE_ARTWORK_DATA_URI);

    const container = canvas.getByTestId('scrobble-artwork');

    await expect(container).not.toHaveAttribute('data-loading');
    await expect(container).not.toHaveAttribute('data-error');
    await expect(container).not.toHaveAttribute('data-fallback-palette');
  },
);

export const LoadedImageWithoutAlbum = meta.story({
  args: {
    scrobble: {
      ...BASE_SCROBBLE,
      album: '',
    },
  },
});

LoadedImageWithoutAlbum.test(
  'uses "Unknown Album" as alt text when album is empty',
  async ({ canvas }) => {
    const img = await canvas.findByRole('img', { name: 'Unknown Album' });

    await expect(img).toHaveAttribute('src', SAMPLE_ARTWORK_DATA_URI);
  },
);

export const AlbumInitialsFallback = meta.story({
  args: {
    scrobble: {
      uts: 1_793_716_177,
      track: 'Right Back to It (feat. MJ Lenderman)',
      artist: 'Waxahatchee',
      album: 'Tigers Blood',
      loved: true,
    },
  },
});

AlbumInitialsFallback.test(
  'renders smart album initials and deterministic palette when imageUrl is omitted',
  async ({ canvas }) => {
    const container = canvas.getByTestId('scrobble-artwork');
    const expectedPalette = getArtworkFallbackPalette({
      artist: 'Waxahatchee',
      album: 'Tigers Blood',
      track: 'Right Back to It (feat. MJ Lenderman)',
    });

    await expect(canvas.getByText('TB')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(container).not.toHaveAttribute('data-loading');
    await expect(container).not.toHaveAttribute('data-error');
    await expect(container).toHaveAttribute('data-fallback-palette', expectedPalette.id);
  },
);

export const ArtistInitialsFallback = meta.story({
  args: {
    scrobble: {
      uts: 1_793_715_800,
      track: 'Unreleased Demo Track',
      artist: 'Jason Isbell',
      album: '',
      loved: false,
    },
  },
});

ArtistInitialsFallback.test(
  'falls back to smart artist initials when both imageUrl and album are empty',
  async ({ canvas }) => {
    await expect(canvas.getByText('JI')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
);

export const SingleWordFallback = meta.story({
  args: {
    scrobble: {
      uts: 1_793_715_400,
      track: 'Jóga',
      artist: 'Björk',
      album: 'Homogenic',
      loved: true,
    },
  },
});

SingleWordFallback.test(
  'uses the first two letters for single-word album titles',
  async ({ canvas }) => {
    await expect(canvas.getByText('HO')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
);

export const UnknownInitialsFallback = meta.story({
  args: {
    scrobble: {
      uts: 1_793_715_000,
      track: 'Mystery Track',
      artist: '',
      album: '',
      loved: false,
    },
  },
});

UnknownInitialsFallback.test(
  'falls back to "??" when imageUrl, album, and artist are all empty',
  async ({ canvas }) => {
    await expect(canvas.getByText('??')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
);

export const BrokenImageUrl = meta.story({
  args: {
    scrobble: {
      ...BASE_SCROBBLE,
      album: 'Broken Cover Album',
      imageUrl: 'data:image/png;base64,invalid-image-bytes',
    },
  },
});

BrokenImageUrl.test(
  'renders fallback initials and sets data-error when the image URL fails to load',
  async ({ canvas }) => {
    const container = canvas.getByTestId('scrobble-artwork');

    await waitFor(async () => {
      await expect(container).toHaveAttribute('data-error');
    });

    await expect(container).not.toHaveAttribute('data-loading');
    await expect(container).toHaveAttribute('data-fallback-palette');
    await expect(canvas.getByText('BC')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
);

export const FallbackSizes = meta.story({
  args: {
    scrobble: FALLBACK_GALLERY_SCROBBLES[0]!,
  },
  render: () => FallbackSizesStory,
});

FallbackSizes.test('renders fallback cleanly across table and grid sizes', async ({ canvas }) => {
  await expect(canvas.getByTestId('artwork-table')).toBeInTheDocument();
  await expect(canvas.getByTestId('artwork-compact')).toBeInTheDocument();
  await expect(canvas.getByTestId('artwork-medium')).toBeInTheDocument();
  await expect(canvas.getByTestId('artwork-grid')).toBeInTheDocument();
  await expect(canvas.getAllByText('TB')).toHaveLength(4);
});

export const FallbackPaletteGallery = meta.story({
  render: () => FallbackPaletteGalleryStory,
});

FallbackPaletteGallery.test(
  'assigns matching palettes for tracks on the same album and neutral slate when metadata is blank',
  async ({ canvas }) => {
    const firstAlbumTrack = canvas.getByTestId('gallery-artwork-0');
    const secondAlbumTrack = canvas.getByTestId('gallery-artwork-1');
    const blankScrobble = canvas.getByTestId('gallery-artwork-7');

    await expect(firstAlbumTrack.getAttribute('data-fallback-palette')).toBe(
      secondAlbumTrack.getAttribute('data-fallback-palette'),
    );
    await expect(blankScrobble).toHaveAttribute('data-fallback-palette', 'slate');
    await expect(canvas.getByText('KB')).toBeInTheDocument();
    await expect(canvas.getByText('HO')).toBeInTheDocument();
    await expect(canvas.getByText('??')).toBeInTheDocument();
  },
);

export const TableThumbnailContext = meta.story({
  render: () => TableThumbnailContextStory,
});

TableThumbnailContext.test(
  'renders table-sized fallback thumbnails alongside real artwork',
  async ({ canvas }) => {
    await expect(await canvas.findByRole('img', { name: 'The Jones Girls' })).toBeInTheDocument();
    await expect(canvas.getByText('TB')).toBeInTheDocument();
    await expect(canvas.getByText('FE')).toBeInTheDocument();
    await expect(canvas.getByText('KB')).toBeInTheDocument();
    await expect(canvas.getByText('JI')).toBeInTheDocument();
  },
);
