# lastfm-lab

A small TypeScript playground for the [Last.fm API](https://www.last.fm/api).

It gives you a typed client, a few ready-made examples, and a raw `pnpm raw`
escape hatch so you can try any API method without writing code.

## Requirements

- Node.js 22.18+ (runs TypeScript directly, no build step)
- pnpm

## Setup

1. Create a Last.fm API account at <https://www.last.fm/api/account/create>.
   You'll get an API key and a shared secret.
2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Create your env file:

   ```sh
   cp .env.example .env
   ```

4. Put your API key (and secret) in `.env`:

   ```dotenv
   LASTFM_API_KEY=your_key
   LASTFM_API_SECRET=your_secret
   LASTFM_USER=your_username
   ```

`LASTFM_API_SECRET` is only needed for signed methods (auth, scrobbling,
loving tracks). `LASTFM_USER` is only used as the default for `examples/user.ts`.

## How it runs

Node strips TypeScript types at load time, so there is no build step or
transpiler. Relative imports therefore use `.ts` extensions, and only erasable
syntax is allowed (no `enum`, `namespace`, or constructor parameter
properties). Use `node --experimental-transform-types` if you ever need those.

## Commands

```sh
pnpm format                                 # format with Prettier
pnpm typecheck
node examples/artist.ts "Ass Ponys"         # artist info, top tracks, similar artists
node examples/track.ts "Aphex Twin" "Xtal"  # track info, tags, wiki
node examples/user.ts <username>            # recent tracks + top artists
node examples/chart.ts                      # global top tracks
node examples/search.ts afghan              # artist and track search
node examples/playground.ts                 # edit examples/playground.ts and experiment
```

`node examples/raw.ts` calls any method directly. Parameters are `key=value` pairs:

```sh
node examples/raw.ts artist.getTopAlbums artist="Afghan Whigs" limit=5
node examples/raw.ts user.getRecentTracks user=rj limit=3
node examples/raw.ts tag.getTopArtists tag=shoegaze limit=5
```

Add `--signed` for authenticated methods:

```sh
node examples/raw.ts track.love --signed artist="Aphex Twin" track=Xtal
```

## Authentication

Some methods require a user session. The project includes a browser auth flow:

```sh
node examples/auth.ts
```

Open the printed URL, authorize the app, then run the printed follow-up command:

```sh
node examples/auth.ts <token>
```

Copy the resulting session key into `.env` as `LASTFM_SESSION_KEY`. Signed
requests will then include it automatically.

## Project layout

```
src/
  client.ts     # Last.fm client: requests, signing, rate limiting, retries
  config.ts     # .env loading + client factory
  endpoints.ts  # typed helpers for common methods
  types.ts      # response types (numbers arrive as strings from Last.fm)
  format.ts     # console output helpers
examples/
  artist.ts
  track.ts
  user.ts
  chart.ts
  search.ts
  raw.ts
  auth.ts
  playground.ts
```

## Adding a typed endpoint

Add a function to `src/endpoints.ts`:

```ts
export function albumInfo(client: LastfmClient, artist: string, album: string) {
  return client.call<{ album: unknown }>('album.getInfo', { artist, album });
}
```

Or skip the helper and call the client directly:

```ts
const data = await client.call('album.getInfo', {
  artist: 'Aphex Twin',
  album: 'Selected Ambient Works 85-92',
});
```

## Notes

- Last.fm allows about 5 requests per second. The client serializes requests
  and spaces them 200 ms apart by default.
- Most numeric fields (`listeners`, `playcount`, `duration`, ...) are returned
  as strings. Use `Number(...)` or the helpers in `src/format.ts`.
- API errors come back with an `error` code and `message`. The client throws a
  `LastfmError` with both.
- Rate-limit (429) and server (5xx) responses are retried twice with backoff.

## Links

- API docs: <https://www.last.fm/api>
- Method reference: <https://www.last.fm/api/intro>
- API account: <https://www.last.fm/api/account/create>
