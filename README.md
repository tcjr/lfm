# lastfm-lab

A TypeScript playground and Ember visualization lab for the [Last.fm API](https://www.last.fm/api), generated with `ember.nvp`.

## Getting Started

### Prerequisites

- Node.js >= 24 (runs TypeScript directly for CLI scripts and includes built-in `node:sqlite`)
- pnpm

### Setup

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

4. Put your API key (and secret/username) in `.env`:

   ```dotenv
   LASTFM_API_KEY=your_key
   LASTFM_API_SECRET=your_secret
   LASTFM_USER=your_username
   ```

`LASTFM_API_SECRET` is only needed for signed methods (auth, scrobbling, loving tracks).

### Syncing Scrobble Data & Running the Front-End

Download your scrobbles into the local SQLite database (`data/lastfm.db`) and export the front-end JSON snapshot (`public/data/scrobbles.json`):

```sh
pnpm sync                              # initial 3 months, or incremental since last sync
pnpm sync -- --months 6                # backfill the last 6 months
pnpm sync -- --from 2026-01-01         # backfill from an ISO date or unix timestamp
pnpm export                            # regenerate public/data/scrobbles.json offline from SQLite
```

Start the local Ember development server:

```sh
pnpm dev
# or
pnpm start
```

## CLI Examples

Node strips TypeScript types at load time, so CLI scripts in `cli/` and `cli/examples/` run directly with no build step:

```sh
node cli/examples/artist.ts "Ass Ponys"         # artist info, top tracks, similar artists
node cli/examples/track.ts "Aphex Twin" "Xtal"  # track info, tags, wiki
node cli/examples/user.ts <username>            # recent tracks + top artists
node cli/examples/chart.ts                      # global top tracks
node cli/examples/search.ts afghan              # artist and track search
node cli/examples/playground.ts                 # edit cli/examples/playground.ts and experiment
```

`node cli/examples/raw.ts` calls any method directly. Parameters are `key=value` pairs:

```sh
node cli/examples/raw.ts artist.getTopAlbums artist="Afghan Whigs" limit=5
node cli/examples/raw.ts user.getRecentTracks user=rj limit=3
node cli/examples/raw.ts tag.getTopArtists tag=shoegaze limit=5
```

Add `--signed` for authenticated methods:

```sh
node cli/examples/raw.ts track.love --signed artist="Aphex Twin" track=Xtal
```

## Authentication

Some methods require a user session. The project includes a browser auth flow:

```sh
node cli/examples/auth.ts
```

Open the printed URL, authorize the app, then run the printed follow-up command:

```sh
node cli/examples/auth.ts <token>
```

Copy the resulting session key into `.env` as `LASTFM_SESSION_KEY`. Signed requests will then include it automatically.

## Features & Tooling

### Prettier

Code formatting is managed with [Prettier](https://prettier.io/).

- `pnpm format` - Format code
- `pnpm lint:prettier` - Check code formatting

### TypeScript

This project uses TypeScript 7 and [ember-content-mapper](https://github.com/NullVoxPopuli/ember-content-mapper) for static type checking.

- `pnpm lint:types` - Typecheck code with TypeScript
- Imports of `.gts` and `.gjs` modules must include the extension
- Editor setup: see [ember-content-mapper's editors section](https://github.com/NullVoxPopuli/ember-content-mapper#editors)

### Linting & Testing

- `pnpm lint` - Run ESLint, Prettier, and TypeScript checks
- `pnpm lint:fix` - Auto-fix lint and formatting issues
- `pnpm test` - Build and run QUnit tests
