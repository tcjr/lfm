import { styleText } from 'node:util';
import { createClient } from '../src/config.ts';
import { userRecentTracks, userTopArtists } from '../src/endpoints.ts';
import { artistName, formatCount } from '../src/format.ts';

const username = process.argv[2] ?? process.env.LASTFM_USER;

if (!username) {
  console.error('Usage: pnpm user <username>');
  console.error('Or set LASTFM_USER in .env');
  process.exit(1);
}

console.log(`last.fm user: ${styleText('yellow', username)}`);

const client = createClient();

const recent = await userRecentTracks(client, username, { limit: 10 });
console.log('\nRecent tracks');

for (const track of recent.recenttracks.track) {
  const nowPlaying = track['@attr']?.nowplaying === 'true';
  const when = nowPlaying ? 'now playing' : (track.date?.['#text'] ?? '');
  const marker = nowPlaying ? '▶' : ' ';
  console.log(`${marker} ${artistName(track.artist)} — ${track.name}${when ? ` (${when})` : ''}`);
}

const topArtists = await userTopArtists(client, username, {
  period: '1month',
  limit: 10,
});
console.log(`\nTop artists (last month)`);
console.table(
  topArtists.topartists.artist.map((artist, index) => ({
    '#': index + 1,
    artist: artistName(artist),
    playcount: formatCount(artist.playcount),
  })),
);
