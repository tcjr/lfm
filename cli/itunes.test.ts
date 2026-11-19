import { describe, expect, test } from 'vitest';
import {
  artistsMatch,
  ItunesClient,
  ItunesError,
  normalizeArtist,
  normalizeMusicText,
  pickBestItunesMatch,
  stripTitleEditionSuffixes,
  titlesMatch,
  upgradeItunesArtworkUrl,
  type ItunesSearchResult,
} from './itunes.ts';

const ART_100 = 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/aa/bb/cc/100x100bb.jpg';
const ART_600 = 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/aa/bb/cc/600x600bb.jpg';
const OTHER_100 = 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/dd/ee/ff/100x100bb.jpg';
const OTHER_600 = 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/dd/ee/ff/600x600bb.jpg';

describe('iTunes URL & text normalization helpers', () => {
  test('upgradeItunesArtworkUrl rewrites 100x100bb to 600x600bb', () => {
    expect(upgradeItunesArtworkUrl(ART_100)).toBe(ART_600);
    expect(
      upgradeItunesArtworkUrl('https://is1-ssl.mzstatic.com/image/thumb/foo/60x60bb.png', 500),
    ).toBe('https://is1-ssl.mzstatic.com/image/thumb/foo/500x500bb.png');
    expect(upgradeItunesArtworkUrl('')).toBeUndefined();
    expect(upgradeItunesArtworkUrl(undefined)).toBeUndefined();
  });

  test('normalizeMusicText and normalizeArtist fold case, diacritics, punctuation, & and leading The', () => {
    expect(normalizeMusicText('Drive-By Truckers')).toBe('drive by truckers');
    expect(normalizeMusicText('Bonzo Dog Doo-Dah Band')).toBe('bonzo dog doo dah band');
    expect(normalizeMusicText("Ah Holly Fam'ly")).toBe('ah holly famly');
    expect(normalizeMusicText('Björk & Sigur Rós')).toBe('bjork and sigur ros');
    expect(normalizeArtist('The White Stripes')).toBe('white stripes');
    expect(normalizeArtist('The')).toBe('the');
  });

  test('stripTitleEditionSuffixes strips standard release tags without stripping core parenthetical titles', () => {
    expect(stripTitleEditionSuffixes('Blues for a Barbecue (Remastered)')).toBe(
      'Blues for a Barbecue',
    );
    expect(stripTitleEditionSuffixes('Gorilla (Deluxe Edition) [Bonus Track Version]')).toBe(
      'Gorilla',
    );
    expect(stripTitleEditionSuffixes('Thunder Road - Single')).toBe('Thunder Road');
    expect(stripTitleEditionSuffixes('Good Riddance (Time of Your Life)')).toBe(
      'Good Riddance (Time of Your Life)',
    );
  });

  test('titlesMatch and artistsMatch handle punctuation, collaborations, and word boundaries', () => {
    expect(titlesMatch('Blues for a Barbecue', 'Blues for a Barbecue (2018 Remaster)')).toBe(true);
    expect(titlesMatch('Epics', 'Got Swing!')).toBe(false);

    expect(artistsMatch('Drive By Truckers', 'Drive-By Truckers')).toBe(true);
    expect(artistsMatch('Erich Kunzel', 'Erich Kunzel & Cincinnati Pops Orchestra')).toBe(true);
    expect(artistsMatch('Maz', 'Mazzy Star')).toBe(false);
    expect(artistsMatch('Tom Waits', 'Various Artists')).toBe(false);
    expect(artistsMatch('Tom Waits', 'Various Artists', { allowVariousArtists: true })).toBe(true);
  });
});

describe('pickBestItunesMatch', () => {
  test('prefers exact normalized artist match over collaborative credit, and upgrades to 600x600bb', () => {
    const results: ItunesSearchResult[] = [
      {
        artistName: 'Erich Kunzel & Cincinnati Pops Orchestra',
        collectionName: 'Epics (Remastered)',
        artworkUrl100: OTHER_100,
      },
      {
        artistName: 'Erich Kunzel',
        collectionName: 'Epics',
        artworkUrl100: ART_100,
      },
    ];

    expect(
      pickBestItunesMatch(results, { artist: 'Erich Kunzel', album: 'Epics', track: '' }),
    ).toEqual({
      imageUrl: ART_600,
      matchedArtist: 'Erich Kunzel',
      matchedTitle: 'Epics',
    });
  });

  test('matches collaborative credits and hyphenation differences', () => {
    const results: ItunesSearchResult[] = [
      {
        artistName: 'Drive-By Truckers',
        collectionName: 'A Blessing and a Curse (Bonus Track Version)',
        artworkUrl100: ART_100,
      },
    ];

    expect(
      pickBestItunesMatch(results, {
        artist: 'Drive By Truckers',
        album: 'A Blessing and a Curse',
        track: '',
      }),
    ).toEqual({
      imageUrl: ART_600,
      matchedArtist: 'Drive-By Truckers',
      matchedTitle: 'A Blessing and a Curse (Bonus Track Version)',
    });
  });

  test('rejects unrelated studio albums for bootlegs and playlists', () => {
    const results: ItunesSearchResult[] = [
      {
        artistName: 'Wussy',
        collectionName: 'Funeral Dress',
        artworkUrl100: ART_100,
      },
      {
        artistName: 'Wussy',
        collectionName: 'Strawberry',
        artworkUrl100: OTHER_100,
      },
    ];

    expect(
      pickBestItunesMatch(results, {
        artist: 'Wussy',
        album: 'Private House Concert, Larchmont NY',
        track: '',
      }),
    ).toBeUndefined();
  });

  test('allows Various Artists only for sufficiently specific exact compilation album titles', () => {
    const results: ItunesSearchResult[] = [
      {
        artistName: 'Various Artists',
        collectionName: 'The Ultimate Headphone & Hi-Fi Album',
        artworkUrl100: ART_100,
      },
      {
        artistName: 'Various Artists',
        collectionName: 'Epics',
        artworkUrl100: OTHER_100,
      },
    ];

    expect(
      pickBestItunesMatch(results, {
        artist: 'Tom Waits',
        album: 'The Ultimate Headphone & Hi-Fi Album',
        track: '',
      }),
    ).toEqual({
      imageUrl: ART_600,
      matchedArtist: 'Various Artists',
      matchedTitle: 'The Ultimate Headphone & Hi-Fi Album',
    });

    // Short generic single-word title must NOT match Various Artists
    expect(
      pickBestItunesMatch(results, {
        artist: 'Erich Kunzel',
        album: 'Epics',
        track: '',
      }),
    ).toBeUndefined();
  });

  test('matches album-less tracks using trackName', () => {
    const results: ItunesSearchResult[] = [
      {
        artistName: 'Philanthrope',
        collectionName: 'Atmospheres - Single',
        trackName: 'Atmospheres',
        artworkUrl100: OTHER_100,
      },
    ];

    expect(
      pickBestItunesMatch(results, {
        artist: 'Philanthrope',
        album: '',
        track: 'Atmospheres',
      }),
    ).toEqual({
      imageUrl: OTHER_600,
      matchedArtist: 'Philanthrope',
      matchedTitle: 'Atmospheres',
    });
  });
});

describe('ItunesClient', () => {
  test('builds search URL with US storefront and classifies 403/429 as rateLimited ItunesError', async () => {
    const requestedUrls: string[] = [];
    const client = new ItunesClient({
      minIntervalMs: 0,
      maxRetries: 0,
      fetchImpl: (input) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        requestedUrls.push(url);
        if (url.includes('rate-limited')) {
          return Promise.resolve(new Response('Too many requests', { status: 429 }));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              resultCount: 1,
              results: [{ artistName: 'Artist', collectionName: 'Album', artworkUrl100: ART_100 }],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });

    const ok = await client.search({ term: 'Artist Album', entity: 'album', limit: 10 });
    expect(ok.resultCount).toBe(1);
    expect(requestedUrls[0]).toContain('country=US');
    expect(requestedUrls[0]).toContain('media=music');
    expect(requestedUrls[0]).toContain('entity=album');

    await expect(client.search({ term: 'rate-limited', entity: 'album' })).rejects.toSatisfy(
      (error: unknown) => {
        return error instanceof ItunesError && error.status === 429 && error.rateLimited;
      },
    );
  });
});
