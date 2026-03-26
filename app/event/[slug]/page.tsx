import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDates } from "@/lib/time";
import { EventBoard } from "@/components/event-board";

type PageProps = {
  params: { slug: string };
};

export default async function EventPage({ params }: PageProps) {
  const session = await auth();
  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
    include: {
      participants: {
        include: {
          slots: true,
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/event/${event.slug}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-3 py-8 sm:px-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <p className="text-sm text-zinc-500">Share this link: {shareUrl}</p>
          </div>
          <Link href="/" className="text-sm text-zinc-600 underline">
            Back home
          </Link>
        </div>
      </div>

      <EventBoard
        slug={event.slug}
        eventId={event.id}
        dates={normalizeDates(event.dates)}
        startTime={event.startTime}
        endTime={event.endTime}
        slotDuration={event.slotDuration}
        deadline={event.deadline?.toISOString() ?? null}
        signedInUserId={session?.user?.id}
        participants={event.participants}
      />
    </div>
  );
}
