"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const eventSchema = z.object({
  title: z.string().min(2),
  dates: z.array(z.string()).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  deadline: z.string().optional(),
});

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Du må være innlogget.");
  }

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    dates: formData.getAll("dates").map(String),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    deadline: formData.get("deadline") || undefined,
  });

  if (!parsed.success) {
    throw new Error("Ugyldig arrangementsinndata");
  }

  const slug = uuidv4().replace(/-/g, "").slice(0, 6);
  const event = await prisma.event.create({
    data: {
      slug,
      title: parsed.data.title,
      createdById: session.user.id,
      dates: parsed.data.dates,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
    },
  });

  redirect(`/event/${event.slug}`);
}

const saveSchema = z.object({
  eventSlug: z.string().min(1),
  participantId: z.string().optional(),
  participantName: z.string().min(1),
  slots: z.array(
    z.object({
      date: z.string(),
      time: z.string(),
      status: z.enum(["AVAILABLE", "IF_NEEDED"]),
    }),
  ),
});

export async function saveAvailability(input: unknown) {
  const session = await auth();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Ugyldig payload for tilgjengelighet");
  }

  const { eventSlug, participantId, participantName, slots } = parsed.data;
  const event = await prisma.event.findUnique({ where: { slug: eventSlug } });
  if (!event) {
    throw new Error("Arrangementet ble ikke funnet");
  }

  if (event.deadline && new Date() > event.deadline) {
    throw new Error("Arrangementet er skrivebeskyttet etter fristen");
  }

  let participant = participantId
    ? await prisma.participant.findUnique({
        where: { id: participantId },
      })
    : null;

  let authenticatedUserId: string | null = null;
  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (!dbUser) {
      throw new Error("Innloggingen er ikke gyldig lenger. Logg ut og inn igjen.");
    }
    authenticatedUserId = dbUser.id;
  }

  if (!participant) {
    if (authenticatedUserId) {
      participant = await prisma.participant.upsert({
        where: { eventId_userId: { eventId: event.id, userId: authenticatedUserId } },
        create: {
          eventId: event.id,
          userId: authenticatedUserId,
          name: participantName,
        },
        update: {
          name: participantName,
        },
      });
    } else {
      participant = await prisma.participant.create({
        data: {
          eventId: event.id,
          name: participantName,
        },
      });
    }
  } else if (participant.eventId !== event.id) {
    throw new Error("Deltaker og arrangement stemmer ikke overens");
  } else {
    participant = await prisma.participant.update({
      where: { id: participant.id },
      data: { name: participantName },
    });
  }

  await prisma.slot.deleteMany({ where: { participantId: participant.id } });

  if (slots.length) {
    await prisma.slot.createMany({
      data: slots.map((slot) => ({
        participantId: participant.id,
        eventId: event.id,
        date: slot.date,
        time: slot.time,
        status: slot.status,
      })),
    });
  }

  revalidatePath(`/event/${eventSlug}`);
  return { participantId: participant.id };
}
