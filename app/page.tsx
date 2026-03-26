import Link from "next/link";
import { AuthButtons } from "@/components/auth-buttons";
import { auth } from "@/auth";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const authError = resolvedSearchParams?.authError;
  const hasCredentialsError =
    typeof authError === "string" && authError === "credentials";
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-8 sm:py-14">
      <header className="flex min-h-[180px] items-center justify-center">
        <p className="text-3xl font-semibold tracking-tight text-zinc-900">Time Grid</p>
      </header>
      <main className="mt-2 space-y-5 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Group scheduling, like Timeful and When2meet
        </h1>
        <p className="max-w-2xl text-zinc-600">
          Create an event, share one link, and let everyone fill availability in a
          drag-friendly 30-minute heatmap grid.
        </p>
        {session?.user ? (
          <Link
            href="/create"
            className="inline-block rounded-md bg-zinc-900 px-5 py-3 text-white hover:bg-zinc-800"
          >
            Create event
          </Link>
        ) : null}
      </main>
      <div className="mx-auto mt-8 w-full max-w-xs">
        {hasCredentialsError ? (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Ugyldig TIHLDE-brukernavn eller passord.
          </p>
        ) : null}
        <AuthButtons />
      </div>
      {!session?.user ? (
        <p className="mt-4 text-center text-sm text-zinc-500">
          Sign in with Google or TIHLDE to create events.
        </p>
      ) : null}
    </div>
  );
}
