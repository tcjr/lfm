import { createClient } from '../config.ts';
import { chartTopTracks } from '../endpoints.ts';
import { printTrackTable } from '../format.ts';

const client = createClient();
const { tracks } = await chartTopTracks(client, { limit: 10 });

console.log('\nLast.fm global top tracks\n');
printTrackTable(tracks.track);
