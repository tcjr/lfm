import { createClient } from '../src/config.ts';
import { printJson } from '../src/format.ts';
import type { ArtistInfoResponse } from '../src/types.ts';

// Scratchpad: edit this file and run `pnpm play`.
// `client.call()` works with any method from https://www.last.fm/api.

const client = createClient();

const data = await client.call<ArtistInfoResponse>('artist.getInfo', {
  artist: 'Wussy',
});

printJson(data.artist);
