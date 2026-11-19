import type { LastfmImage, Track } from '#shared/types.ts';

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Artist names appear as `name` or `#text` depending on the endpoint. */
export function artistName(
  value: { name?: string; '#text'?: string } | string | undefined,
): string {
  if (typeof value === 'string') {
    return value;
  }
  return value?.name ?? value?.['#text'] ?? 'Unknown artist';
}

/** Last.fm's generic "star" placeholder image hash returned when artwork is missing. */
export const LASTFM_PLACEHOLDER_IMAGE_HASH = '2a96cbd8b46e442fc41c2b86b821562f';

/** Check whether an image URL points to Last.fm's default star placeholder image. */
export function isPlaceholderImageUrl(url: string | undefined): boolean {
  return Boolean(url?.includes(LASTFM_PLACEHOLDER_IMAGE_HASH));
}

/** Check whether a Last.fm image array contains at least one placeholder image URL. */
export function hasPlaceholderImage(images: LastfmImage[] | undefined): boolean {
  if (!images?.length) {
    return false;
  }
  return images.some((image) => isPlaceholderImageUrl(image['#text']));
}

function isUsableImage(image: LastfmImage): boolean {
  return Boolean(image['#text']) && !isPlaceholderImageUrl(image['#text']);
}

/** Pick the largest non-empty, non-placeholder image URL. */
export function bestImage(images: LastfmImage[] | undefined): string | undefined {
  if (!images?.length) {
    return undefined;
  }

  for (const size of ['mega', 'extralarge', 'large', 'medium', 'small']) {
    const match = images.find((image) => image.size === size && isUsableImage(image));
    if (match) {
      return match['#text'];
    }
  }

  return images.find(isUsableImage)?.['#text'];
}

export function formatCount(value: string | number | undefined): string {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString('en-US') : String(value ?? '?');
}

export function formatDuration(ms: string | number | undefined): string {
  const totalSeconds = Math.round(Number(ms) / 1000);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '—';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return unitIndex === 0 ? `${Math.round(value)} B` : `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** Format a local timestamp as `YYYYMMDD_HHMMSS` for backup filenames. */
export function formatBackupTimestamp(date: Date = new Date()): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/** Build a timestamped backup path alongside the source database (e.g. `data/lastfm-backup-20261119_070244.db`). */
export function defaultBackupPath(dbPath: string, date: Date = new Date()): string {
  const lastSep = Math.max(dbPath.lastIndexOf('/'), dbPath.lastIndexOf('\\'));
  const dir = lastSep >= 0 ? dbPath.slice(0, lastSep + 1) : '';
  const filename = lastSep >= 0 ? dbPath.slice(lastSep + 1) : dbPath;
  const dotIndex = filename.lastIndexOf('.');
  const hasExt = dotIndex > 0;
  const stem = hasExt ? filename.slice(0, dotIndex) : filename;
  const ext = hasExt ? filename.slice(dotIndex) : '';
  return `${dir}${stem}-backup-${formatBackupTimestamp(date)}${ext}`;
}

export function printTrackTable(tracks: Track[]): void {
  console.table(
    tracks.map((track, index) => ({
      '#': track['@attr']?.rank ?? index + 1,
      track: track.name,
      artist: artistName(track.artist),
      album: track.album?.title ?? track.album?.['#text'] ?? '—',
      duration: formatDuration(track.duration),
      listeners: track.listeners ? formatCount(track.listeners) : undefined,
      playcount: track.playcount ? formatCount(track.playcount) : undefined,
    })),
  );
}
