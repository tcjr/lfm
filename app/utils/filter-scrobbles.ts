import type { ScrobbleRecord } from '#shared/types.ts';

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
