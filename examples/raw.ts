import { createClient } from "../src/config.ts";
import { printJson } from "../src/format.ts";

// Call any Last.fm method without writing code.
//
//   pnpm raw artist.getInfo artist="Aphex Twin"
//   pnpm raw user.getTopArtists user=rj period=1month limit=5
//   pnpm raw track.love --signed artist="Aphex Twin" track=Xtal
//
// Add --signed for methods that need a signature (requires LASTFM_API_SECRET
// and, for user-specific methods, LASTFM_SESSION_KEY).

const args = process.argv.slice(2);
const signed = args.includes("--signed");
const [method, ...pairs] = args.filter((arg) => arg !== "--signed");

if (!method) {
  console.error("Usage: pnpm raw <method> [--signed] [key=value ...]");
  process.exit(1);
}

const params: Record<string, string> = {};

for (const pair of pairs) {
  const separator = pair.indexOf("=");
  if (separator === -1) {
    console.error(`Invalid parameter "${pair}". Expected key=value.`);
    process.exit(1);
  }
  params[pair.slice(0, separator)] = pair.slice(separator + 1);
}

const client = createClient();
printJson(await client.call(method, params, { signed }));
