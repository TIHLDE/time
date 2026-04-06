import { toDate } from "date-fns-tz";

export function getEventTimezone(): string {
  const candidate =
    process.env.NEXT_PUBLIC_EVENT_TIMEZONE || process.env.EVENT_TIMEZONE;
  return candidate?.trim() ? candidate.trim() : "Europe/Oslo";
}

/** ISO calendar date `YYYY-MM-DD` plus `days` (UTC date arithmetic, timezone-agnostic). */
export function addDaysToIsoCalendarDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() + days);
  return u.toISOString().slice(0, 10);
}

/**
 * Instants for Google Calendar `events.list` timeMin / timeMax.
 * API semantics: returns events with end > timeMin and start < timeMax.
 * This window includes every event overlapping board days in `timeZone`
 * (local midnight of first date through local midnight after last date).
 */
export function googleCalendarListQueryBounds(
  firstDateStr: string,
  lastDateStr: string,
  timeZone: string = getEventTimezone(),
): { timeMin: Date; timeMax: Date } {
  let timeMin: Date;
  let timeMax: Date;
  try {
    timeMin = toDate(`${firstDateStr}T00:00:00`, { timeZone });
    const dayAfterLast = addDaysToIsoCalendarDate(lastDateStr, 1);
    timeMax = toDate(`${dayAfterLast}T00:00:00`, { timeZone });
  } catch {
    timeMin = toDate(`${firstDateStr}T00:00:00`, { timeZone: "Europe/Oslo" });
    const dayAfterLast = addDaysToIsoCalendarDate(lastDateStr, 1);
    timeMax = toDate(`${dayAfterLast}T00:00:00`, { timeZone: "Europe/Oslo" });
  }
  return { timeMin, timeMax };
}

export function slotRangeUtc(
  dateStr: string,
  timeStr: string,
  slotDurationMinutes: number,
  timeZone: string = getEventTimezone(),
): { start: Date; end: Date } {
  const normalized =
    timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  let start: Date;
  try {
    start = toDate(`${dateStr}T${normalized}`, { timeZone });
    if (Number.isNaN(start.getTime())) throw new Error("Invalid timezone date");
  } catch {
    // Never crash sync/render on bad timezone env values.
    start = toDate(`${dateStr}T${normalized}`, { timeZone: "Europe/Oslo" });
  }
  const end = new Date(start.getTime() + slotDurationMinutes * 60 * 1000);
  return { start, end };
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * First / exclusive-end slot indices on `dateStr` that overlap the event window (already UTC instants).
 */
export function slotIndicesOverlappingEventOnDate(
  dateStr: string,
  eventStart: Date,
  eventEnd: Date,
  slots: string[],
  slotDurationMinutes: number,
  timeZone: string = getEventTimezone(),
): { startIdx: number; endIdxExclusive: number } | null {
  let startIdx = -1;
  let endIdxExclusive = 0;
  for (let i = 0; i < slots.length; i++) {
    const time = slots[i];
    const { start: slotStart, end: slotEnd } = slotRangeUtc(
      dateStr,
      time,
      slotDurationMinutes,
      timeZone,
    );
    if (intervalsOverlap(slotStart, slotEnd, eventStart, eventEnd)) {
      if (startIdx === -1) startIdx = i;
      endIdxExclusive = i + 1;
    }
  }
  if (startIdx === -1) return null;
  return { startIdx, endIdxExclusive };
}
