import type { ScrobbleRecord } from '#shared/types.ts';

export interface ArtworkFallbackPalette {
  id: string;
  /** Tailwind background gradient classes for the sleeve surface. */
  background: string;
  /** Tailwind SVG fill class for the vinyl center record label. */
  labelFill: string;
}

export const ARTWORK_FALLBACK_PALETTES: readonly ArtworkFallbackPalette[] = [
  {
    id: 'rose',
    background: 'bg-linear-to-br from-rose-600 via-rose-800 to-stone-950',
    labelFill: 'fill-rose-400/35',
  },
  {
    id: 'terracotta',
    background: 'bg-linear-to-br from-orange-600 via-red-800 to-stone-950',
    labelFill: 'fill-orange-400/35',
  },
  {
    id: 'amber',
    background: 'bg-linear-to-br from-amber-600 via-amber-800 to-stone-950',
    labelFill: 'fill-amber-400/35',
  },
  {
    id: 'lime',
    background: 'bg-linear-to-br from-lime-700 via-emerald-900 to-stone-950',
    labelFill: 'fill-lime-400/30',
  },
  {
    id: 'emerald',
    background: 'bg-linear-to-br from-emerald-600 via-emerald-800 to-slate-950',
    labelFill: 'fill-emerald-400/35',
  },
  {
    id: 'teal',
    background: 'bg-linear-to-br from-teal-600 via-teal-800 to-slate-950',
    labelFill: 'fill-teal-400/35',
  },
  {
    id: 'cyan',
    background: 'bg-linear-to-br from-cyan-600 via-sky-800 to-slate-950',
    labelFill: 'fill-cyan-400/35',
  },
  {
    id: 'sky',
    background: 'bg-linear-to-br from-blue-600 via-blue-800 to-slate-950',
    labelFill: 'fill-sky-400/35',
  },
  {
    id: 'indigo',
    background: 'bg-linear-to-br from-indigo-600 via-indigo-800 to-slate-950',
    labelFill: 'fill-indigo-400/35',
  },
  {
    id: 'violet',
    background: 'bg-linear-to-br from-violet-600 via-purple-800 to-slate-950',
    labelFill: 'fill-violet-400/35',
  },
  {
    id: 'fuchsia',
    background: 'bg-linear-to-br from-fuchsia-600 via-pink-800 to-zinc-950',
    labelFill: 'fill-fuchsia-400/35',
  },
];

export const ARTWORK_FALLBACK_NEUTRAL_PALETTE: ArtworkFallbackPalette = {
  id: 'slate',
  background: 'bg-linear-to-br from-zinc-600 via-zinc-800 to-zinc-950',
  labelFill: 'fill-zinc-400/25',
};

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

const FILLER_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

/**
 * Computes a deterministic 32-bit unsigned FNV-1a hash with a Murmur3 fmix32
 * finalizer for even distribution across small palette tables.
 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

/**
 * Extracts up to two uppercase initials from a title or artist name.
 *
 * Prefers the first letters of the first two significant words (skipping common
 * filler words when at least two content words remain), and falls back to the
 * first two characters for single-word or punctuation-only names.
 */
export function extractInitials(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '??';
  }

  const words = trimmed.match(WORD_PATTERN) ?? [];

  if (words.length === 0) {
    return Array.from(trimmed).slice(0, 2).join('').toUpperCase();
  }

  const significant = words.filter((word) => !FILLER_WORDS.has(word.toLowerCase()));
  const candidates = significant.length >= 2 ? significant : words;

  if (candidates.length >= 2) {
    const first = Array.from(candidates[0] ?? '')[0] ?? '';
    const second = Array.from(candidates[1] ?? '')[0] ?? '';

    return (first + second).toUpperCase();
  }

  return Array.from(candidates[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function formatFallbackInitials(scrobble: Pick<ScrobbleRecord, 'album' | 'artist'>): string {
  const source = scrobble.album.trim() || scrobble.artist.trim();

  return source ? extractInitials(source) : '??';
}

/**
 * Picks a deterministic fallback color palette for a scrobble.
 *
 * Hashes `artist + album` so tracks from the same album share a consistent visual
 * identity, falling back to `artist + track` for album-less scrobbles and a neutral
 * slate palette when all metadata fields are blank.
 */
export function getArtworkFallbackPalette(
  scrobble: Pick<ScrobbleRecord, 'artist' | 'album' | 'track'>,
): ArtworkFallbackPalette {
  const artist = scrobble.artist.trim().toLowerCase();
  const release = (scrobble.album.trim() || scrobble.track.trim()).toLowerCase();

  if (!artist && !release) {
    return ARTWORK_FALLBACK_NEUTRAL_PALETTE;
  }

  const index = hashString(`${artist}::${release}`) % ARTWORK_FALLBACK_PALETTES.length;

  return ARTWORK_FALLBACK_PALETTES[index] ?? ARTWORK_FALLBACK_NEUTRAL_PALETTE;
}
