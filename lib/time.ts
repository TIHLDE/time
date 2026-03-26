import { addMinutes, format, parse, parseISO } from "date-fns";

export function buildTimeSlots(startTime: string, endTime: string, duration = 30) {
  const slots: string[] = [];
  let cursor = parse(startTime, "HH:mm", new Date());
  const end = parse(endTime, "HH:mm", new Date());

  while (cursor < end) {
    slots.push(format(cursor, "HH:mm"));
    cursor = addMinutes(cursor, duration);
  }

  return slots;
}

export function normalizeDates(dates: string[]) {
  return [...dates].sort((a, b) => parseISO(a).getTime() - parseISO(b).getTime());
}

export function toPrettyTime(time: string) {
  return format(parse(time, "HH:mm", new Date()), "h:mm a");
}
