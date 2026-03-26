import Link from "next/link";
import { AuthButtons } from "@/components/auth-buttons";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col bg-zinc-50 px-4 py-12 sm:px-8">
      <header className="mb-10 flex items-center justify-between">
        <p className="text-xl font-semibold">Time Grid</p>
        <AuthButtons />
      </header>
      <main className="space-y-5 rounded-xl border border-zinc-200 bg-white p-8">
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
        ) : (
          <p className="text-sm text-zinc-500">
            Sign in with Google to create events.
          </p>
        )}
      </main>
    </div>
  );
}
