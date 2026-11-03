import { createClient } from '../src/config.ts';
import { artistInfo, artistSimilar, artistTopTracks } from '../src/endpoints.ts';
import { artistName, formatCount, printTrackTable, stripHtml } from '../src/format.ts';

const query = process.argv.slice(2).join(' ').trim();

if (!query) {
  console.error('Usage: pnpm artist "Aphex Twin"');
  process.exit(1);
}

const client = createClient();

const { artist } = await artistInfo(client, query);
console.log(`\n${artist.name}`);
console.log(
  `${formatCount(artist.stats.listeners)} listeners · ${formatCount(artist.stats.playcount)} scrobbles`,
);
console.log(artist.url);
console.log(`\n${stripHtml(artist.bio.summary)}\n`);

const top = await artistTopTracks(client, query, { limit: 5 });
console.log('Top tracks');
printTrackTable(top.toptracks.track);

const similar = await artistSimilar(client, query, { limit: 5 });
console.log('\nSimilar artists');
console.log(similar.similarartists.artist.map((entry) => artistName(entry)).join(', '));
