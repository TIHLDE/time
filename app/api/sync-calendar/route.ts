import { auth } from "@/auth";
import {
  getEventTimezone,
  intervalsOverlap,
  slotRangeUtc,
} from "@/lib/event-timezone";
import { prisma } from "@/lib/prisma";
import { buildTimeSlots } from "@/lib/time";
import type { SyncCalendarEvent } from "@/lib/types";
import { toDate } from "date-fns-tz";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GoogleEvent = {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function parseGoogleEventRange(
  item: GoogleEvent,
  timeZone: string,
): { start: Date; end: Date } | null {
  if (item.start?.dateTime && item.end?.dateTime) {
    const start = new Date(item.start.dateTime);
    const end = new Date(item.end.dateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }
  if (item.start?.date && item.end?.date) {
    let start: Date;
    let end: Date;
    try {
      start = toDate(`${item.start.date}T00:00:00`, { timeZone });
      end = toDate(`${item.end.date}T00:00:00`, { timeZone });
    } catch {
      start = toDate(`${item.start.date}T00:00:00`, {
        timeZone: "Europe/Oslo",
      });
      end = toDate(`${item.end.date}T00:00:00`, { timeZone: "Europe/Oslo" });
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
    }

    const { slug } = (await req.json()) as { slug?: string };
    if (!slug) {
      return NextResponse.json({ error: "Mangler slug" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user?.googleAccessToken) {
      return NextResponse.json({ error: "Fant ikke Google-token" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { slug },
    });
    if (!event) {
      return NextResponse.json({ error: "Arrangementet ble ikke funnet" }, { status: 404 });
    }

    const timeZone = getEventTimezone();

    const minDate = `${event.dates[0]}T00:00:00.000Z`;
    const maxDate = `${event.dates[event.dates.length - 1]}T23:59:59.999Z`;
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", minDate);
    url.searchParams.set("timeMax", maxDate);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    async function fetchGoogleEvents(accessToken: string) {
      return fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
    }

    let response = await fetchGoogleEvents(user.googleAccessToken);

    if (!response.ok && (response.status === 401 || response.status === 403)) {
    if (!user.googleRefreshToken) {
      return NextResponse.json({ error: "Fant ikke Google-token" }, { status: 400 });
    }

    const googleClientId = process.env.AUTH_GOOGLE_ID;
    const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
    if (!googleClientId || !googleClientSecret) {
      return NextResponse.json(
        { error: "Google OAuth er ikke konfigurert" },
        { status: 500 },
      );
    }

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: user.googleRefreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!refreshRes.ok) {
      return NextResponse.json(
        { error: "Kunne ikke oppdatere Google-token" },
        { status: 400 },
      );
    }

    const refreshData = (await refreshRes.json()) as {
      access_token?: string;
    };
    if (!refreshData.access_token) {
      return NextResponse.json(
        { error: "Kunne ikke oppdatere Google-token" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: refreshData.access_token,
      },
    });

    response = await fetchGoogleEvents(refreshData.access_token);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Kunne ikke hente Google-hendelser" },
        { status: 500 },
      );
    }

    const data = (await response.json()) as { items?: GoogleEvent[] };
    const items = data.items ?? [];

    const slots = buildTimeSlots(event.startTime, event.endTime, event.slotDuration);
    const blocked = new Set<string>();
    const overlayEvents: SyncCalendarEvent[] = [];

    for (const item of items) {
      const range = parseGoogleEventRange(item, timeZone);
      if (!range) continue;

      const title = (item.summary ?? "(Uten tittel)").trim() || "(Uten tittel)";
      overlayEvents.push({
        title,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      });

      for (const date of event.dates) {
        for (const time of slots) {
          const { start: slotStart, end: slotEnd } = slotRangeUtc(
            date,
            time,
            event.slotDuration,
            timeZone,
          );
          if (intervalsOverlap(slotStart, slotEnd, range.start, range.end)) {
            blocked.add(`${date}|${time}`);
          }
        }
      }
    }
    

    return NextResponse.json({
      blocked: Array.from(blocked),
      events: overlayEvents,
    });
  } catch (error) {
    console.error("sync-calendar failed", error);
    return NextResponse.json(
      { error: "Synkronisering feilet på serveren" },
      { status: 500 },
    );
  }
}
