import { parseArgs } from 'node:util';
import { loadEnv } from './config.ts';
import {
  DEFAULT_DB_PATH,
  DEFAULT_EXPORT_PATH,
  exportSnapshot,
  getStoredUser,
  openDatabase,
} from './db.ts';

loadEnv();

const { values } = parseArgs({
  options: {
    user: { type: 'string', short: 'u' },
    db: { type: 'string', default: DEFAULT_DB_PATH },
    out: { type: 'string', default: DEFAULT_EXPORT_PATH },
  },
});

const db = openDatabase(values.db);
const user = values.user?.trim() || process.env.LASTFM_USER?.trim() || getStoredUser(db);

if (!user) {
  console.error('No user specified. Set LASTFM_USER in .env or pass --user <username>.');
  process.exit(1);
}

const snapshot = exportSnapshot(db, user, values.out);
console.log(
  `Exported ${snapshot.count.toLocaleString()} scrobbles for "${snapshot.user}" to ${values.out}`,
);
