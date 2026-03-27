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
