import { auth, signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function AuthButtons() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:justify-end">
        <p
          className="min-w-0 max-w-full shrink truncate text-sm text-muted-foreground sm:max-w-[min(100%,14rem)]"
          title={session.user.email ?? undefined}
        >
          {session.user.email}
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Logg ut
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Logg inn</h2>
        <p className="text-sm text-muted-foreground">
          Logg inn med ditt TIHLDE brukernavn og passord
        </p>
      </header>

      <form
        className="mt-6 space-y-4"
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
        <div className="space-y-1.5">
          <label htmlFor="user_id" className="text-sm font-medium">
            Brukernavn <span className="text-red-300">*</span>
          </label>
          <input
            id="user_id"
            name="user_id"
            type="text"
            placeholder="Skriv her..."
            required
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Passord <span className="text-red-300">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Skriv her..."
            required
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Logg inn
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
        <span className="select-none cursor-not-allowed opacity-70" aria-disabled="true">
          Glemt passord?
        </span>
        <span className="select-none cursor-not-allowed opacity-70" aria-disabled="true">
          Opprett bruker
        </span>
      </div>
    </div>
  );
}
