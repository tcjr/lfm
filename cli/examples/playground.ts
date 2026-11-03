import { createClient } from '../config.ts';
import { printJson } from '../format.ts';
import type { ArtistInfoResponse } from '#shared/types.ts';

// Scratchpad: edit this file and run `pnpm play`.
// `client.call()` works with any method from https://www.last.fm/api.

const client = createClient();

const data = await client.call<ArtistInfoResponse>('artist.getInfo', {
  artist: 'Wussy',
});

printJson(data.artist);
