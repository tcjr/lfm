import type { TOC } from '@ember/component/template-only';
import { expect, waitFor } from 'storybook/test';
import preview from '#storybook/preview.ts';
import ScrobbleArtwork, { type ScrobbleArtworkSignature } from './scrobble-artwork.gts';
import type { ScrobbleRecord } from '#shared/types.ts';

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

const ScrobbleArtworkStory: TOC<ScrobbleArtworkSignature> = <template>
  <ScrobbleArtwork
    @scrobble={{@scrobble}}
    data-testid="scrobble-artwork"
    class="size-24 rounded-lg text-2xl"
  />
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
  'renders album initials immediately without loading when imageUrl is omitted',
  async ({ canvas }) => {
    const container = canvas.getByTestId('scrobble-artwork');

    await expect(canvas.getByText('Ti')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(container).not.toHaveAttribute('data-loading');
    await expect(container).not.toHaveAttribute('data-error');
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
  'falls back to artist initials when both imageUrl and album are empty',
  async ({ canvas }) => {
    await expect(canvas.getByText('Ja')).toBeInTheDocument();
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
    await expect(canvas.getByText('Br')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
);
