import { createClient } from "../src/config.ts";
import { chartTopTracks } from "../src/endpoints.ts";
import { printTrackTable } from "../src/format.ts";

const client = createClient();
const { tracks } = await chartTopTracks(client, { limit: 10 });

console.log("\nLast.fm global top tracks\n");
printTrackTable(tracks.track);
