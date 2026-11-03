import { createClient } from '../src/config.ts';
import { trackInfo } from '../src/endpoints.ts';
import { artistName, formatCount, formatDuration, stripHtml } from '../src/format.ts';

const [artistArg, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ').trim();

if (!artistArg || !title) {
  console.error('Usage: pnpm track "Aphex Twin" "Xtal"');
  process.exit(1);
}

const client = createClient();
const { track } = await trackInfo(client, artistArg, title, process.env.LASTFM_USER);

console.log(`\n${track.name} — ${artistName(track.artist)}`);
console.log(`Duration: ${formatDuration(track.duration)}`);
console.log(
  `Listeners: ${formatCount(track.listeners)} · Scrobbles: ${formatCount(track.playcount)}`,
);

if (track.album?.title) {
  console.log(`Album: ${track.album.title}`);
}

if (track.toptags?.tag.length) {
  console.log(`Tags: ${track.toptags.tag.map((tag) => tag.name).join(', ')}`);
}

if (track.wiki?.summary) {
  console.log(`\n${stripHtml(track.wiki.summary)}`);
}
