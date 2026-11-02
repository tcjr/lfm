import { createClient } from "../src/config.ts";

// Browser auth flow:
//   1. pnpm auth          -> prints a URL to authorize
//   2. pnpm auth TOKEN -> prints a session key to put in .env
//
// Requires LASTFM_API_KEY and LASTFM_API_SECRET.

const client = createClient();
const token = process.argv[2];

if (!token) {
  const newToken = await client.getToken();

  console.log("\n1. Open this URL and authorize the app:\n");
  console.log(`   ${client.getAuthUrl(newToken)}\n`);
  console.log("2. Then run:\n");
  console.log(`   pnpm auth ${newToken}\n`);
} else {
  const session = await client.getSession(token);

  console.log(`\nAuthorized as ${session.name}.`);
  console.log("Add this to .env to make signed requests:\n");
  console.log(`   LASTFM_SESSION_KEY=${session.key}\n`);
}
