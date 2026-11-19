import { parseArgs } from 'node:util';
import { backupDatabase, DEFAULT_DB_PATH } from './db.ts';
import { defaultBackupPath, formatBytes } from './format.ts';

const { values } = parseArgs({
  options: {
    db: { type: 'string', default: DEFAULT_DB_PATH },
    out: { type: 'string', short: 'o' },
  },
});

const backupPath = values.out?.trim() || defaultBackupPath(values.db);

try {
  const result = await backupDatabase(values.db, backupPath);
  console.log(
    `Backed up ${result.sourcePath} to ${result.backupPath} (${formatBytes(result.bytes)}, ${result.pages.toLocaleString()} pages)`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
