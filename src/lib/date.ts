import dayjs from "dayjs";

/**
 * Calendar-date handling for attendance and reports.
 *
 * Attendance is a calendar fact — "the session on 7 August" — not an instant.
 * It is stored as midnight UTC so the same date string resolves to the same row
 * no matter what timezone the server happens to run in.
 *
 * `dayjs(date).startOf("day")` cannot be used for this: it normalises to *local*
 * midnight, so a server in UTC+3 writes 21:00 the previous day while one in UTC
 * writes 00:00, and neither can read the other's records.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function calendarParts(date: string): { year: number; month: number; day: number } | null {
  // Covers both "2026-08-07" and "2026-08-07T00:00:00.000Z": the leading
  // calendar date is taken verbatim, with any time and offset ignored.
  const match = ISO_DATE.exec(date.trim());
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  const parsed = dayjs(date);
  if (!parsed.isValid()) return null;
  return { year: parsed.year(), month: parsed.month() + 1, day: parsed.date() };
}

/** Midnight UTC on the given calendar date — the value attendance is keyed by. */
export function toUtcDayStart(date: string): Date | null {
  const parts = calendarParts(date);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
}

/** The last instant of the given calendar date in UTC, for inclusive range filters. */
export function toUtcDayEnd(date: string): Date | null {
  const parts = calendarParts(date);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999));
}

/** Midnight UTC on today's calendar date, as the person using the app sees it. */
export function todayUtcDayStart(): Date {
  return toUtcDayStart(dayjs().format("YYYY-MM-DD"))!;
}
