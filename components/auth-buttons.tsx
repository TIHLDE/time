import { auth, signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function AuthButtons() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
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
    <div className="w-full space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-3 py-2.5 text-sm text-white hover:bg-zinc-800"
        >
          Sign in with Google
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs uppercase tracking-wide text-zinc-500">eller</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <form
        className="space-y-2.5"
        action={async (formData) => {
          "use server";
          const user_id = String(formData.get("user_id") ?? "");
          const password = String(formData.get("password") ?? "");
          try {
            await signIn("credentials", { user_id, password, redirectTo: "/" });
          } catch (error) {
            if (error instanceof AuthError && error.type === "CredentialsSignin") {
              redirect("/?authError=credentials");
            }
            throw error;
          }
        }}
      >
        <input
          name="user_id"
          type="text"
          placeholder="TIHLDE-brukernavn"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <input
          name="password"
          type="password"
          placeholder="Passord"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-md border border-zinc-300 px-3 py-2.5 text-sm hover:bg-zinc-100"
        >
          Logg inn med TIHLDE
        </button>
      </form>
    </div>
  );
}
