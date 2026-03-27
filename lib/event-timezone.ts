import { addDays, format, parse } from "date-fns";
import { toDate } from "date-fns-tz";

export function getEventTimezone(): string {
  return (
    process.env.NEXT_PUBLIC_EVENT_TIMEZONE ??
    process.env.EVENT_TIMEZONE ??
    "Europe/Oslo"
  );
}

export function slotRangeUtc(
  dateStr: string,
  timeStr: string,
  slotDurationMinutes: number,
  timeZone: string = getEventTimezone(),
): { start: Date; end: Date } {
  const normalized =
    timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const start = toDate(`${dateStr}T${normalized}`, { timeZone });
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

/** [dayStart, nextDayStart) in absolute time for the given calendar date in `timeZone`. */
export function getDayBoundsUtc(
  dateStr: string,
  timeZone: string = getEventTimezone(),
): { dayStart: Date; nextDayStart: Date } {
  const dayStart = toDate(`${dateStr}T00:00:00`, { timeZone });
  const nextCal = addDays(parse(dateStr, "yyyy-MM-dd", new Date(0)), 1);
  const nextStr = format(nextCal, "yyyy-MM-dd");
  const nextDayStart = toDate(`${nextStr}T00:00:00`, { timeZone });
  return { dayStart, nextDayStart };
}

/**
 * Clip [eventStart, eventEnd) to the calendar day `dateStr` in `timeZone`, or null if no overlap.
 */
export function clipEventToCalendarDay(
  eventStart: Date,
  eventEnd: Date,
  dateStr: string,
  timeZone: string = getEventTimezone(),
): { start: Date; end: Date } | null {
  const { dayStart, nextDayStart } = getDayBoundsUtc(dateStr, timeZone);
  const clippedStart =
    eventStart.getTime() > dayStart.getTime() ? eventStart : dayStart;
  const clippedEnd =
    eventEnd.getTime() < nextDayStart.getTime() ? eventEnd : nextDayStart;
  if (clippedStart.getTime() >= clippedEnd.getTime()) return null;
  return { start: clippedStart, end: clippedEnd };
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
