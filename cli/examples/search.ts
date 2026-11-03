import { createClient } from '../config.ts';
import { searchArtists, searchTracks } from '../endpoints.ts';
import { artistName, formatCount, printTrackTable } from '../format.ts';

const query = process.argv.slice(2).join(' ').trim();

if (!query) {
  console.error('Usage: pnpm search "aphex"');
  process.exit(1);
}

const client = createClient();

const [artists, tracks] = await Promise.all([
  searchArtists(client, query, { limit: 5 }),
  searchTracks(client, query, { limit: 5 }),
]);

console.log(`\nArtists matching "${query}"`);
console.table(
  artists.results.artistmatches.artist.map((artist) => ({
    artist: artistName(artist),
    listeners: formatCount(artist.listeners),
    url: artist.url,
  })),
);

console.log(`\nTracks matching "${query}"`);
printTrackTable(tracks.results.trackmatches.track);
