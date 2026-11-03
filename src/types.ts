export interface LastfmImage {
  '#text': string;
  size: string;
}

export interface LastfmTag {
  name: string;
  url: string;
  count?: string | number;
}

export interface LastfmWiki {
  published: string;
  summary: string;
  content: string;
}

export interface LastfmStreamable {
  '#text': string;
  fulltrack: string;
}

export interface ArtistRef {
  name?: string;
  '#text'?: string;
  mbid: string;
  url: string;
  image: LastfmImage[];
}

export interface Artist extends ArtistRef {
  streamable: string;
  ontour: string;
  stats: {
    listeners: string;
    playcount: string;
  };
  similar: {
    artist: ArtistRef[];
  };
  tags: {
    tag: LastfmTag[];
  };
  bio: LastfmWiki & {
    links: {
      link: Array<{ '#text': string; rel: string; href: string }>;
    };
  };
}

export interface AlbumRef {
  artist: string;
  title: string;
  '#text'?: string;
  mbid: string;
  url: string;
  image: LastfmImage[];
  '@attr'?: {
    position: string;
  };
}

export interface Track {
  name: string;
  mbid?: string;
  url?: string;
  duration?: string;
  listeners?: string;
  playcount?: string;
  loved?: string;
  streamable?: LastfmStreamable | string;
  artist: ArtistRef | string;
  album?: AlbumRef;
  toptags?: {
    tag: LastfmTag[];
  };
  wiki?: LastfmWiki;
  image?: LastfmImage[];
  date?: {
    uts: string;
    '#text': string;
  };
  '@attr'?: {
    rank?: string;
    nowplaying?: string;
  };
}

export interface PagedAttr {
  page: string;
  perPage: string;
  totalPages: string;
  total: string;
  user?: string;
}

export interface ArtistInfoResponse {
  artist: Artist;
}

export interface ArtistTopTracksResponse {
  toptracks: {
    track: Track[];
    '@attr': PagedAttr;
  };
}

export interface ArtistTopAlbumsResponse {
  topalbums: {
    album: AlbumRef[];
    '@attr': PagedAttr;
  };
}

export interface ArtistSimilarResponse {
  similarartists: {
    artist: ArtistRef[];
    '@attr': PagedAttr;
  };
}

export interface TrackInfoResponse {
  track: Track;
}

export interface RecentTracksResponse {
  recenttracks: {
    track: Track[];
    '@attr': PagedAttr;
  };
}

export interface UserTopArtistsResponse {
  topartists: {
    artist: Array<ArtistRef & { playcount: string }>;
    '@attr': PagedAttr;
  };
}

export interface UserTopTracksResponse {
  toptracks: {
    track: Track[];
    '@attr': PagedAttr;
  };
}

export interface ChartTopTracksResponse {
  tracks: {
    track: Track[];
    '@attr': PagedAttr;
  };
}

export interface ArtistSearchResult extends ArtistRef {
  listeners?: string;
}

export interface ArtistSearchResponse {
  results: {
    'opensearch:totalResults': string;
    artistmatches: {
      artist: ArtistSearchResult[];
    };
  };
}

export interface TrackSearchResponse {
  results: {
    'opensearch:totalResults': string;
    trackmatches: {
      track: Track[];
    };
  };
}

export interface ScrobbleRecord {
  uts: number;
  track: string;
  artist: string;
  album: string;
  trackMbid?: string;
  artistMbid?: string;
  albumMbid?: string;
  loved: boolean;
  imageUrl?: string;
}

export interface ScrobbleSnapshot {
  user: string;
  exportedAt: string;
  count: number;
  scrobbles: ScrobbleRecord[];
}
