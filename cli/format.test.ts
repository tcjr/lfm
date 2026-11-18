import { describe, expect, test } from 'vitest';
import {
  bestImage,
  hasPlaceholderImage,
  isPlaceholderImageUrl,
  LASTFM_PLACEHOLDER_IMAGE_HASH,
} from './format.ts';
import type { LastfmImage } from '#shared/types.ts';

const PLACEHOLDER_SMALL = `https://lastfm-img.freetls.fastly.net/i/u/34s/${LASTFM_PLACEHOLDER_IMAGE_HASH}.png`;
const PLACEHOLDER_LARGE = `https://lastfm-img.freetls.fastly.net/i/u/174s/${LASTFM_PLACEHOLDER_IMAGE_HASH}.png`;
const PLACEHOLDER_EXTRALARGE = `https://lastfm-img.freetls.fastly.net/i/u/300x300/${LASTFM_PLACEHOLDER_IMAGE_HASH}.png`;

const VALID_SMALL =
  'https://lastfm-img.freetls.fastly.net/i/u/34s/c6f59c1e5e7240a4c0d427abd71f3dbb.jpg';
const VALID_LARGE =
  'https://lastfm-img.freetls.fastly.net/i/u/174s/c6f59c1e5e7240a4c0d427abd71f3dbb.jpg';
const VALID_EXTRALARGE =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/c6f59c1e5e7240a4c0d427abd71f3dbb.jpg';

describe('Last.fm placeholder image filtering', () => {
  test('isPlaceholderImageUrl detects Last.fm star placeholder URLs across sizes', () => {
    expect(isPlaceholderImageUrl(PLACEHOLDER_SMALL)).toBe(true);
    expect(isPlaceholderImageUrl(PLACEHOLDER_LARGE)).toBe(true);
    expect(isPlaceholderImageUrl(PLACEHOLDER_EXTRALARGE)).toBe(true);

    expect(isPlaceholderImageUrl(VALID_EXTRALARGE)).toBe(false);
    expect(isPlaceholderImageUrl('')).toBe(false);
    expect(isPlaceholderImageUrl(undefined)).toBe(false);
  });

  test('hasPlaceholderImage detects when an image list includes a placeholder URL', () => {
    const placeholders: LastfmImage[] = [
      { size: 'small', '#text': PLACEHOLDER_SMALL },
      { size: 'extralarge', '#text': PLACEHOLDER_EXTRALARGE },
    ];
    const validOnly: LastfmImage[] = [
      { size: 'small', '#text': VALID_SMALL },
      { size: 'extralarge', '#text': VALID_EXTRALARGE },
    ];
    const emptyOnly: LastfmImage[] = [
      { size: 'small', '#text': '' },
      { size: 'extralarge', '#text': '' },
    ];

    expect(hasPlaceholderImage(placeholders)).toBe(true);
    expect(hasPlaceholderImage(validOnly)).toBe(false);
    expect(hasPlaceholderImage(emptyOnly)).toBe(false);
    expect(hasPlaceholderImage([])).toBe(false);
    expect(hasPlaceholderImage(undefined)).toBe(false);
  });

  test('bestImage returns undefined when all image sizes are Last.fm placeholders', () => {
    const images: LastfmImage[] = [
      { size: 'small', '#text': PLACEHOLDER_SMALL },
      { size: 'large', '#text': PLACEHOLDER_LARGE },
      { size: 'extralarge', '#text': PLACEHOLDER_EXTRALARGE },
    ];

    expect(bestImage(images)).toBeUndefined();
  });

  test('bestImage selects the largest valid image URL', () => {
    const images: LastfmImage[] = [
      { size: 'small', '#text': VALID_SMALL },
      { size: 'large', '#text': VALID_LARGE },
      { size: 'extralarge', '#text': VALID_EXTRALARGE },
    ];

    expect(bestImage(images)).toBe(VALID_EXTRALARGE);
  });

  test('bestImage skips larger placeholder URLs in favor of smaller valid URLs', () => {
    const images: LastfmImage[] = [
      { size: 'small', '#text': VALID_SMALL },
      { size: 'large', '#text': VALID_LARGE },
      { size: 'extralarge', '#text': PLACEHOLDER_EXTRALARGE },
    ];

    expect(bestImage(images)).toBe(VALID_LARGE);
  });

  test('bestImage falls back to any usable image when size is unranked', () => {
    const images: LastfmImage[] = [
      { size: 'custom', '#text': PLACEHOLDER_EXTRALARGE },
      { size: 'other', '#text': VALID_LARGE },
    ];

    expect(bestImage(images)).toBe(VALID_LARGE);
  });
});
