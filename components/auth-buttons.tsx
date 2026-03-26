import { auth, signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function AuthButtons() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-3">
        <p className="text-sm text-muted-foreground">{session.user.email}</p>
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
    <div className="w-full space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm text-primary-foreground hover:opacity-90"
        >
          Logg inn med Google
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">eller</span>
        <div className="h-px flex-1 bg-border" />
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
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <input
          name="password"
          type="password"
          placeholder="Passord"
          required
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <button
          type="submit"
          className="w-full rounded-md border border-border px-3 py-2.5 text-sm hover:bg-muted"
        >
          Logg inn med TIHLDE
        </button>
      </form>
    </div>
  );
}
