import { parseArgs } from 'node:util';
import {
  ARTWORK_OVERRIDE_SOURCES,
  findMissingArtwork,
  isArtworkOverrideSource,
  listArtworkOverrides,
  removeArtworkOverride,
  removeArtworkOverrideByRowid,
  selfHealArtworkOverrides,
  upsertArtworkOverride,
} from './artwork-overrides.ts';
import { loadEnv } from './config.ts';
import { DEFAULT_DB_PATH, getStoredUser, openDatabase } from './db.ts';

loadEnv();

const USAGE = `Usage: pnpm artwork <subcommand> [options]

Subcommands:
  set       Set or clear a manual artwork override
            --artist <name> [--album <name>] [--track <name>] (--url <url|/path> | --clear) [--db <path>]
  remove    Remove an existing artwork override
            (--rowid <id> | --artist <name> [--album <name>] [--track <name>]) [--db <path>]
  list      List stored artwork overrides
            [--source <${ARTWORK_OVERRIDE_SOURCES.join('|')}>] [--db <path>]
  missing   Report scrobbles still missing artwork after overrides
            [--user <username>] [--limit <n>] [--album-only | --no-album] [--db <path>]
  enrich    Auto-heal missing artwork from existing scrobbles in SQLite
            [--user <username>] [--dry-run] [--force] [--db <path>]

Artwork commands only update SQLite; run "pnpm export" afterward to regenerate scrobbles.json.`;

function formatTarget(entry: { artist: string; album: string; track: string }): string {
  if (entry.album && entry.track) {
    return `${entry.artist} — ${entry.album} / ${entry.track}`;
  }
  if (entry.album) {
    return `${entry.artist} — ${entry.album}`;
  }
  return `${entry.artist} — ${entry.track} (no album)`;
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function runSet(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      artist: { type: 'string', short: 'a' },
      album: { type: 'string' },
      track: { type: 'string', short: 't' },
      url: { type: 'string', short: 'u' },
      clear: { type: 'boolean', default: false },
      db: { type: 'string', default: DEFAULT_DB_PATH },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: pnpm artwork set --artist <name> [--album <name>] [--track <name>] (--url <url|/path> | --clear) [--db <path>]',
    );
    return;
  }

  if (!values.artist?.trim()) {
    throw new Error('Missing required flag --artist <name>.');
  }
  if (values.clear && values.url !== undefined) {
    throw new Error('Pass either --url <url|/path> or --clear, not both.');
  }
  if (!values.clear && values.url === undefined) {
    throw new Error('Provide --url <url|/path> or --clear.');
  }

  const db = openDatabase(values.db);
  try {
    const saved = upsertArtworkOverride(db, {
      artist: values.artist,
      album: values.album,
      track: values.track,
      imageUrl: values.clear ? '' : (values.url ?? ''),
      source: 'manual',
    });

    if (values.clear) {
      console.log(`Cleared artwork for ${formatTarget(saved)} (source: manual).`);
    } else {
      console.log(`Saved manual artwork override for ${formatTarget(saved)} -> ${saved.imageUrl}`);
    }
    console.log('Run "pnpm export" to update public/data/scrobbles.json.');
  } finally {
    db.close();
  }
}

function runRemove(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      rowid: { type: 'string', short: 'r' },
      artist: { type: 'string', short: 'a' },
      album: { type: 'string' },
      track: { type: 'string', short: 't' },
      db: { type: 'string', default: DEFAULT_DB_PATH },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: pnpm artwork remove (--rowid <id> | --artist <name> [--album <name>] [--track <name>]) [--db <path>]',
    );
    return;
  }

  const hasRowid = values.rowid !== undefined;
  const hasKeyFlags =
    values.artist !== undefined || values.album !== undefined || values.track !== undefined;

  if (hasRowid && hasKeyFlags) {
    throw new Error('Pass either --rowid <id> or --artist/--album/--track, not both.');
  }

  if (hasRowid) {
    const rawRowid = values.rowid?.trim() ?? '';
    const rowid = /^\d+$/.test(rawRowid) ? Number(rawRowid) : Number.NaN;
    if (!Number.isInteger(rowid) || rowid <= 0) {
      throw new Error(`Invalid --rowid value "${values.rowid}". Must be a positive integer.`);
    }

    const db = openDatabase(values.db);
    try {
      const removed = removeArtworkOverrideByRowid(db, rowid);
      if (removed) {
        console.log(`Removed artwork override #${rowid} (${formatTarget(removed)}).`);
        console.log('Run "pnpm export" to update public/data/scrobbles.json.');
      } else {
        console.log(`No artwork override found with rowid ${rowid}.`);
      }
    } finally {
      db.close();
    }
    return;
  }

  if (!values.artist?.trim()) {
    throw new Error('Provide --rowid <id> or --artist <name> with --album/--track.');
  }

  const db = openDatabase(values.db);
  try {
    const removed = removeArtworkOverride(db, {
      artist: values.artist,
      album: values.album,
      track: values.track,
    });

    const target = formatTarget({
      artist: values.artist.trim(),
      album: (values.album ?? '').trim(),
      track: (values.track ?? '').trim(),
    });

    if (removed) {
      console.log(`Removed artwork override for ${target}.`);
      console.log('Run "pnpm export" to update public/data/scrobbles.json.');
    } else {
      console.log(`No artwork override found for ${target}.`);
    }
  } finally {
    db.close();
  }
}

function runList(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      source: { type: 'string', short: 's' },
      db: { type: 'string', default: DEFAULT_DB_PATH },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      `Usage: pnpm artwork list [--source <${ARTWORK_OVERRIDE_SOURCES.join('|')}>] [--db <path>]`,
    );
    return;
  }

  if (values.source && !isArtworkOverrideSource(values.source)) {
    throw new Error(
      `Invalid --source "${values.source}". Expected one of: ${ARTWORK_OVERRIDE_SOURCES.join(', ')}.`,
    );
  }

  const db = openDatabase(values.db);
  try {
    const overrides = listArtworkOverrides(db, {
      source: values.source && isArtworkOverrideSource(values.source) ? values.source : undefined,
    });

    if (overrides.length === 0) {
      console.log(
        values.source
          ? `No artwork overrides found with source "${values.source}".`
          : 'No artwork overrides stored.',
      );
      return;
    }

    console.table(
      overrides.map((item) => ({
        rowid: item.rowid,
        artist: item.artist,
        album: item.album || '—',
        track: item.track || '—',
        source: item.source,
        imageUrl: item.imageUrl || '(cleared)',
        updated: formatDate(item.updatedAt),
      })),
    );
    console.log(`Total: ${overrides.length.toLocaleString()} override(s).`);
  } finally {
    db.close();
  }
}

function runMissing(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      user: { type: 'string', short: 'u' },
      limit: { type: 'string', short: 'l', default: '50' },
      'album-only': { type: 'boolean', default: false },
      'no-album': { type: 'boolean', default: false },
      db: { type: 'string', default: DEFAULT_DB_PATH },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: pnpm artwork missing [--user <username>] [--limit <n>] [--album-only | --no-album] [--db <path>]',
    );
    return;
  }

  if (values['album-only'] && values['no-album']) {
    throw new Error('Pass either --album-only or --no-album, not both.');
  }

  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`Invalid --limit value "${values.limit}". Must be a non-negative integer.`);
  }

  const db = openDatabase(values.db);
  try {
    const user = values.user?.trim() || process.env.LASTFM_USER?.trim() || getStoredUser(db);
    if (!user) {
      throw new Error('No user specified. Set LASTFM_USER in .env or pass --user <username>.');
    }

    const filter = values['album-only'] ? 'album-only' : values['no-album'] ? 'no-album' : 'all';

    const report = findMissingArtwork(db, user, {
      filter,
      limit: limit === 0 ? undefined : limit,
    });

    if (report.entries.length === 0) {
      console.log(`No missing artwork found for "${user.toLowerCase()}".`);
      return;
    }

    console.table(
      report.entries.map((entry) => ({
        scrobbles: entry.scrobbleCount,
        artist: entry.artist,
        album: entry.album || '—',
        track: entry.track || '—',
        lastPlayed: formatDate(entry.lastScrobbledAt),
      })),
    );

    const showingNote =
      report.entries.length < report.totalGroups
        ? `Showing top ${report.entries.length.toLocaleString()} of ${report.totalGroups.toLocaleString()} groups`
        : `${report.totalGroups.toLocaleString()} group(s)`;
    console.log(
      `${showingNote} (${report.totalScrobbles.toLocaleString()} scrobble(s) without artwork for "${user.toLowerCase()}").`,
    );
  } finally {
    db.close();
  }
}

function runEnrich(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      user: { type: 'string', short: 'u' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      db: { type: 'string', default: DEFAULT_DB_PATH },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: pnpm artwork enrich [--user <username>] [--dry-run] [--force] [--db <path>]',
    );
    return;
  }

  const db = openDatabase(values.db);
  try {
    const result = selfHealArtworkOverrides(db, {
      user: values.user?.trim() || undefined,
      dryRun: values['dry-run'],
      force: values.force,
    });

    const prefix = result.dryRun ? '[dry-run] ' : '';

    if (result.candidates.length === 0) {
      console.log(`${prefix}No self-healable artwork candidates found in ${values.db}.`);
      return;
    }

    console.table(
      result.candidates.map((item) => ({
        action: item.action,
        scrobbles: item.matchCount,
        artist: item.artist,
        album: item.album || '—',
        track: item.track || '—',
        imageUrl: item.imageUrl,
      })),
    );

    const summary = [
      `${prefix}DB self-heal complete:`,
      `${result.inserted.toLocaleString()} ${result.dryRun ? 'to insert' : 'inserted'}`,
      `${result.updated.toLocaleString()} ${result.dryRun ? 'to update' : 'updated'}`,
      `${result.skippedManual.toLocaleString()} skipped (manual)`,
      `${result.skippedExisting.toLocaleString()} skipped (existing)`,
    ].join(' ');

    console.log(summary);
    if (!result.dryRun && (result.inserted > 0 || result.updated > 0)) {
      console.log('Run "pnpm export" to update public/data/scrobbles.json.');
    }
  } finally {
    db.close();
  }
}

const [subcommand, ...rest] = process.argv.slice(2);

try {
  switch (subcommand) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      break;
    case 'set':
      runSet(rest);
      break;
    case 'remove':
      runRemove(rest);
      break;
    case 'list':
      runList(rest);
      break;
    case 'missing':
      runMissing(rest);
      break;
    case 'enrich':
      runEnrich(rest);
      break;
    default:
      throw new Error(`Unknown subcommand "${subcommand}".\n\n${USAGE}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
