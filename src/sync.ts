import { parseArgs } from 'node:util';
import { createClient, getConfig } from './config.ts';
import {
  DEFAULT_DB_PATH,
  DEFAULT_EXPORT_PATH,
  exportSnapshot,
  getScrobbleBounds,
  openDatabase,
  upsertTracks,
} from './db.ts';
import { userRecentTracks } from './endpoints.ts';

const PAGE_LIMIT = 200;
const DEFAULT_INITIAL_MONTHS = 3;

function parseTimestamp(input: string, flagName: string): number {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    // Convert milliseconds to seconds if needed
    return num > 1e11 ? Math.floor(num / 1000) : num;
  }

  const parsedMs = Date.parse(trimmed);
  if (Number.isNaN(parsedMs)) {
    throw new Error(
      `Invalid ${flagName} value "${input}". Use a Unix timestamp or ISO date (e.g. 2026-08-01).`,
    );
  }
  return Math.floor(parsedMs / 1000);
}

function subtractMonths(nowSeconds: number, months: number): number {
  const date = new Date(nowSeconds * 1000);
  date.setUTCMonth(date.getUTCMonth() - months);
  return Math.floor(date.getTime() / 1000);
}

const { values } = parseArgs({
  options: {
    user: { type: 'string', short: 'u' },
    months: { type: 'string', short: 'm' },
    from: { type: 'string' },
    to: { type: 'string' },
    db: { type: 'string', default: DEFAULT_DB_PATH },
    out: { type: 'string', default: DEFAULT_EXPORT_PATH },
  },
});

const config = getConfig();
const user = values.user?.trim() || config.user;
if (!user) {
  console.error('Missing username. Set LASTFM_USER in .env or pass --user <username>.');
  process.exit(1);
}

const db = openDatabase(values.db);
const existing = getScrobbleBounds(db, user);
const nowSeconds = Math.floor(Date.now() / 1000);

const toTimestamp = values.to ? parseTimestamp(values.to, '--to') : undefined;
let fromTimestamp: number;
let modeLabel: string;

if (values.from) {
  fromTimestamp = parseTimestamp(values.from, '--from');
  modeLabel = `custom range from ${new Date(fromTimestamp * 1000).toISOString()}`;
} else if (values.months) {
  const months = Number(values.months);
  if (!Number.isFinite(months) || months <= 0) {
    console.error(`Invalid --months value "${values.months}". Must be a positive number.`);
    process.exit(1);
  }
  fromTimestamp = subtractMonths(toTimestamp ?? nowSeconds, months);
  modeLabel = `last ${months} month(s) (since ${new Date(fromTimestamp * 1000).toISOString()})`;
} else if (existing.maxUts !== undefined) {
  fromTimestamp = existing.maxUts + 1;
  modeLabel = `incremental since ${new Date(fromTimestamp * 1000).toISOString()}`;
} else {
  fromTimestamp = subtractMonths(nowSeconds, DEFAULT_INITIAL_MONTHS);
  modeLabel = `initial ${DEFAULT_INITIAL_MONTHS} months (since ${new Date(fromTimestamp * 1000).toISOString()})`;
}

console.log(`Syncing scrobbles for "${user}" (${modeLabel})...`);

const client = createClient();
let page = 1;
let totalPages = 1;
let fetchedTracks = 0;

while (page <= totalPages) {
  const response = await userRecentTracks(client, user, {
    limit: PAGE_LIMIT,
    page,
    from: fromTimestamp,
    to: toTimestamp,
    extended: 1,
  });

  const attr = response.recenttracks['@attr'];
  totalPages = Math.max(1, Number(attr.totalPages) || 0);
  const rawTracks = response.recenttracks.track;
  const tracks = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];

  const { stored } = upsertTracks(db, user, tracks);
  fetchedTracks += stored;

  if (Number(attr.totalPages) === 0 || tracks.length === 0) {
    console.log('No new scrobbles in this window.');
    break;
  }

  console.log(
    `  Page ${page}/${totalPages}: stored ${stored} scrobbles (running total: ${fetchedTracks})`,
  );
  page++;
}

const bounds = getScrobbleBounds(db, user);
const snapshot = exportSnapshot(db, user, values.out);

console.log(
  [
    `Sync complete: ${bounds.count.toLocaleString()} total scrobbles in ${values.db}.`,
    `Exported front-end snapshot to ${values.out} (${snapshot.count.toLocaleString()} scrobbles).`,
  ].join('\n'),
);
