import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { artistName, bestImage } from './format.ts';
import type { ScrobbleRecord, ScrobbleSnapshot, Track } from './types.ts';

export const DEFAULT_DB_PATH = 'data/lastfm.db';
export const DEFAULT_EXPORT_PATH = 'public/data/scrobbles.json';

interface ScrobbleRow {
  uts: number;
  track: string;
  artist: string;
  album: string;
  track_mbid: string;
  artist_mbid: string;
  album_mbid: string;
  loved: number;
  image_url: string;
}

export function openDatabase(dbPath = DEFAULT_DB_PATH): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS scrobbles (
      user TEXT NOT NULL,
      uts INTEGER NOT NULL,
      artist TEXT NOT NULL,
      track TEXT NOT NULL,
      album TEXT NOT NULL DEFAULT '',
      artist_mbid TEXT NOT NULL DEFAULT '',
      track_mbid TEXT NOT NULL DEFAULT '',
      album_mbid TEXT NOT NULL DEFAULT '',
      loved INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      raw_json TEXT NOT NULL,
      PRIMARY KEY (user, uts, artist, track)
    );
    CREATE INDEX IF NOT EXISTS idx_scrobbles_user_uts ON scrobbles (user, uts DESC);
  `);
  return db;
}

export function upsertTracks(
  db: DatabaseSync,
  user: string,
  tracks: Track[],
): { stored: number; skippedNowPlaying: number } {
  const normalizedUser = user.toLowerCase();
  const stmt = db.prepare(`
    INSERT INTO scrobbles (
      user, uts, artist, track, album,
      artist_mbid, track_mbid, album_mbid,
      loved, image_url, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user, uts, artist, track) DO UPDATE SET
      album = excluded.album,
      artist_mbid = excluded.artist_mbid,
      track_mbid = excluded.track_mbid,
      album_mbid = excluded.album_mbid,
      loved = excluded.loved,
      image_url = excluded.image_url,
      raw_json = excluded.raw_json
  `);

  let stored = 0;
  let skippedNowPlaying = 0;

  db.exec('BEGIN');
  try {
    for (const track of tracks) {
      if (track['@attr']?.nowplaying === 'true' || !track.date?.uts) {
        skippedNowPlaying++;
        continue;
      }

      const uts = Number(track.date.uts);
      if (!Number.isFinite(uts) || uts <= 0) {
        skippedNowPlaying++;
        continue;
      }

      const artist = artistName(track.artist);
      const artistMbid = typeof track.artist === 'object' ? (track.artist.mbid ?? '') : '';
      const album = track.album?.title ?? track.album?.['#text'] ?? '';
      const albumMbid = track.album?.mbid ?? '';
      const trackMbid = track.mbid ?? '';
      const loved = track.loved === '1' ? 1 : 0;
      const imageUrl = bestImage(track.image) ?? '';

      stmt.run(
        normalizedUser,
        uts,
        artist,
        track.name,
        album,
        artistMbid,
        trackMbid,
        albumMbid,
        loved,
        imageUrl,
        JSON.stringify(track),
      );
      stored++;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { stored, skippedNowPlaying };
}

export function getScrobbleBounds(
  db: DatabaseSync,
  user: string,
): { count: number; minUts?: number; maxUts?: number } {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count, MIN(uts) AS min_uts, MAX(uts) AS max_uts
       FROM scrobbles
       WHERE user = ?`,
    )
    .get(user.toLowerCase()) as
    { count: number; min_uts: number | null; max_uts: number | null } | undefined;

  return {
    count: Number(row?.count ?? 0),
    minUts: row?.min_uts ?? undefined,
    maxUts: row?.max_uts ?? undefined,
  };
}

export function getStoredUser(db: DatabaseSync): string | undefined {
  const row = db
    .prepare(`SELECT user FROM scrobbles GROUP BY user ORDER BY COUNT(*) DESC LIMIT 1`)
    .get() as { user: string } | undefined;
  return row?.user;
}

export function exportSnapshot(
  db: DatabaseSync,
  user: string,
  exportPath = DEFAULT_EXPORT_PATH,
): ScrobbleSnapshot {
  const normalizedUser = user.toLowerCase();
  const rows = db
    .prepare(
      `SELECT uts, track, artist, album, track_mbid, artist_mbid, album_mbid, loved, image_url
       FROM scrobbles
       WHERE user = ?
       ORDER BY uts DESC`,
    )
    .all(normalizedUser) as unknown as ScrobbleRow[];

  const scrobbles: ScrobbleRecord[] = rows.map((row) => ({
    uts: row.uts,
    track: row.track,
    artist: row.artist,
    album: row.album,
    ...(row.track_mbid ? { trackMbid: row.track_mbid } : {}),
    ...(row.artist_mbid ? { artistMbid: row.artist_mbid } : {}),
    ...(row.album_mbid ? { albumMbid: row.album_mbid } : {}),
    loved: row.loved === 1,
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
  }));

  const snapshot: ScrobbleSnapshot = {
    user: normalizedUser,
    exportedAt: new Date().toISOString(),
    count: scrobbles.length,
    scrobbles,
  };

  mkdirSync(dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return snapshot;
}
