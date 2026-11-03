import type { LastfmClient } from './client.ts';
import type {
  ArtistInfoResponse,
  ArtistSearchResponse,
  ArtistSimilarResponse,
  ArtistTopAlbumsResponse,
  ArtistTopTracksResponse,
  ChartTopTracksResponse,
  RecentTracksResponse,
  TrackInfoResponse,
  TrackSearchResponse,
  UserTopArtistsResponse,
  UserTopTracksResponse,
} from './types.ts';

export interface PageOptions {
  limit?: number;
  page?: number;
}

export type Period = 'overall' | '7day' | '1month' | '3month' | '6month' | '12month';

export function artistInfo(client: LastfmClient, artist: string, username?: string) {
  return client.call<ArtistInfoResponse>('artist.getInfo', { artist, username });
}

export function artistTopTracks(client: LastfmClient, artist: string, options: PageOptions = {}) {
  return client.call<ArtistTopTracksResponse>('artist.getTopTracks', {
    artist,
    limit: options.limit,
    page: options.page,
  });
}

export function artistTopAlbums(client: LastfmClient, artist: string, options: PageOptions = {}) {
  return client.call<ArtistTopAlbumsResponse>('artist.getTopAlbums', {
    artist,
    limit: options.limit,
    page: options.page,
  });
}

export function artistSimilar(client: LastfmClient, artist: string, options: PageOptions = {}) {
  return client.call<ArtistSimilarResponse>('artist.getSimilar', {
    artist,
    limit: options.limit,
  });
}

export function trackInfo(client: LastfmClient, artist: string, track: string, username?: string) {
  return client.call<TrackInfoResponse>('track.getInfo', { artist, track, username });
}

export function userRecentTracks(
  client: LastfmClient,
  user: string,
  options: PageOptions & { from?: number; to?: number } = {},
) {
  return client.call<RecentTracksResponse>('user.getRecentTracks', {
    user,
    limit: options.limit,
    page: options.page,
    from: options.from,
    to: options.to,
  });
}

export function userTopArtists(
  client: LastfmClient,
  user: string,
  options: PageOptions & { period?: Period } = {},
) {
  return client.call<UserTopArtistsResponse>('user.getTopArtists', {
    user,
    period: options.period,
    limit: options.limit,
    page: options.page,
  });
}

export function userTopTracks(
  client: LastfmClient,
  user: string,
  options: PageOptions & { period?: Period } = {},
) {
  return client.call<UserTopTracksResponse>('user.getTopTracks', {
    user,
    period: options.period,
    limit: options.limit,
    page: options.page,
  });
}

export function chartTopTracks(client: LastfmClient, options: PageOptions = {}) {
  return client.call<ChartTopTracksResponse>('chart.getTopTracks', {
    limit: options.limit,
    page: options.page,
  });
}

export function searchArtists(client: LastfmClient, query: string, options: PageOptions = {}) {
  return client.call<ArtistSearchResponse>('artist.search', {
    artist: query,
    limit: options.limit,
    page: options.page,
  });
}

export function searchTracks(client: LastfmClient, query: string, options: PageOptions = {}) {
  return client.call<TrackSearchResponse>('track.search', {
    track: query,
    limit: options.limit,
    page: options.page,
  });
}
