import type { ScrobbleRecord } from '#shared/types.ts';

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function daysAgo(days: number, now: Date = new Date()): string {
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
}

function localDayBoundary(value: string, endOfDay: boolean): number | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return undefined;

  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day);

  return date.getTime();
}

export function isValidDateRange(from: string, to: string): boolean {
  return !from || !to || from <= to;
}

export function filterScrobblesByDateRange(
  scrobbles: ScrobbleRecord[],
  from: string,
  to: string,
): ScrobbleRecord[] {
  const start = localDayBoundary(from, false);
  const end = localDayBoundary(to, true);

  return scrobbles.filter((scrobble) => {
    const timestamp = scrobble.uts * 1000;

    if (start !== undefined && timestamp < start) return false;
    if (end !== undefined && timestamp > end) return false;

    return true;
  });
}
