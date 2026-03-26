import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTimeSlots } from "@/lib/time";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GoogleEvent = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function overlaps(slotStart: Date, slotEnd: Date, eventStart: Date, eventEnd: Date) {
  return slotStart < eventEnd && eventStart < slotEnd;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = (await req.json()) as { slug?: string };
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.googleAccessToken) {
    return NextResponse.json({ error: "No Google token found" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { slug },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const minDate = `${event.dates[0]}T00:00:00.000Z`;
  const maxDate = `${event.dates[event.dates.length - 1]}T23:59:59.999Z`;
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", minDate);
  url.searchParams.set("timeMax", maxDate);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${user.googleAccessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch Google events" }, { status: 500 });
  }

  const data = (await response.json()) as { items?: GoogleEvent[] };
  const items = data.items ?? [];

  const slots = buildTimeSlots(event.startTime, event.endTime, event.slotDuration);
  const blocked = new Set<string>();

  for (const date of event.dates) {
    for (const time of slots) {
      const start = new Date(`${date}T${time}:00.000Z`);
      const end = new Date(start.getTime() + event.slotDuration * 60 * 1000);

      const hasConflict = items.some((item) => {
        if (!item.start?.dateTime || !item.end?.dateTime) {
          return false;
        }
        const eventStart = new Date(item.start.dateTime);
        const eventEnd = new Date(item.end.dateTime);
        return overlaps(start, end, eventStart, eventEnd);
      });

      if (hasConflict) {
        blocked.add(`${date}|${time}`);
      }
    }
  }

  return NextResponse.json({ blocked: Array.from(blocked) });
}
