import Link from "next/link";
import Image from "next/image";
import { AuthButtons } from "@/components/auth-buttons";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth();
  const myEvents = session?.user?.id
    ? await prisma.event.findMany({
        where: { createdById: session.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          createdAt: true,
        },
      })
    : [];
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const authError = resolvedSearchParams?.authError;
  const hasCredentialsError =
    typeof authError === "string" && authError === "credentials";
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-8 sm:py-14">
      <header className="flex w-full items-center justify-between gap-4">
        <Image
          src="/tihlde-logo.svg"
          alt="TIHLDE logo"
          width={280}
          height={64}
          priority
          className="h-10 w-auto text-foreground"
        />
        {session?.user ? <AuthButtons /> : null}
      </header>
      <main className="mt-8 space-y-5 rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight text-card-foreground">
          Gruppeplanlegging
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Opprett et arrangement, del en lenke, og la alle fylle inn
          tilgjengelighet i et dra-vennlig 30-minutters varmegrid.
        </p>
        {session?.user ? (
          <div className="space-y-5">
            <Link
              href="/create"
              className="inline-block rounded-md bg-primary px-5 py-3 text-primary-foreground hover:opacity-90"
            >
              Opprett arrangement
            </Link>

            <section className="space-y-3 border-t border-border pt-5">
              <h2 className="text-lg font-semibold text-card-foreground">
                Mine arrangementer
              </h2>
              {myEvents.length > 0 ? (
                <div className="space-y-2">
                  {myEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/event/${event.slug}`}
                      className="block rounded-md border border-border px-3 py-2 hover:bg-muted"
                    >
                      <p className="font-medium text-card-foreground">
                        {event.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Opprettet {event.createdAt.toLocaleDateString("nb-NO")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Du har ikke opprettet noen arrangementer ennå.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </main>
      <div className="mx-auto mt-8 w-full max-w-lg">
        {hasCredentialsError ? (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Ugyldig TIHLDE-brukernavn eller passord.
          </p>
        ) : null}
        {!session?.user ? <AuthButtons /> : null}
      </div>
      {!session?.user ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Logg inn med TIHLDE for å opprette arrangementer.
        </p>
      ) : null}
    </div>
  );
}
