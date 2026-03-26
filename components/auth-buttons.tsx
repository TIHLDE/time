import { auth, signIn, signOut } from "@/auth";

export async function AuthButtons() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-zinc-600">{session.user.email}</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
      >
        Sign in with Google
      </button>
    </form>
  );
}
