import type { LastfmImage, Track } from "./types.ts";

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Artist names appear as `name` or `#text` depending on the endpoint. */
export function artistName(value: { name?: string; "#text"?: string } | string | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  return value?.name ?? value?.["#text"] ?? "Unknown artist";
}

/** Pick the largest non-empty image URL. */
export function bestImage(images: LastfmImage[] | undefined): string | undefined {
  if (!images?.length) {
    return undefined;
  }

  for (const size of ["mega", "extralarge", "large", "medium", "small"]) {
    const match = images.find((image) => image.size === size && image["#text"]);
    if (match) {
      return match["#text"];
    }
  }

  return images.find((image) => image["#text"])?.["#text"];
}

export function formatCount(value: string | number | undefined): string {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString("en-US") : String(value ?? "?");
}

export function formatDuration(ms: string | number | undefined): string {
  const totalSeconds = Math.round(Number(ms) / 1000);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "—";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function printTrackTable(tracks: Track[]): void {
  console.table(
    tracks.map((track, index) => ({
      "#": track["@attr"]?.rank ?? index + 1,
      track: track.name,
      artist: artistName(track.artist),
      album: track.album?.title ?? track.album?.["#text"] ?? "—",
      duration: formatDuration(track.duration),
      listeners: track.listeners ? formatCount(track.listeners) : undefined,
      playcount: track.playcount ? formatCount(track.playcount) : undefined,
    })),
  );
}
