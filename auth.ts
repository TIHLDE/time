import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const tihldeApiBaseUrl = process.env.TIHLDE_API_URL?.replace(/\/+$/, "");

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// @ts-expect-error JWT module augmentation
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "TIHLDE",
      credentials: {
        user_id: { label: "TIHLDE-brukernavn", type: "text" },
        password: { label: "Passord", type: "password" },
      },
      async authorize(credentials) {
        const userId = credentials?.user_id;
        const password = credentials?.password;

        if (!tihldeApiBaseUrl || typeof userId !== "string" || typeof password !== "string") {
          return null;
        }

        const loginResponse = await fetch(`${tihldeApiBaseUrl}/auth/login/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userId, password }),
          cache: "no-store",
        });

        if (!loginResponse.ok) {
          if (loginResponse.status >= 500) {
            throw new Error("TIHLDE-innloggingstjenesten returnerte en serverfeil.");
          }
          return null;
        }

        const loginData = (await loginResponse.json()) as { token?: string };
        if (!loginData.token) {
          throw new Error("Svar fra TIHLDE-innlogging manglet token.");
        }

        const profileResponse = await fetch(`${tihldeApiBaseUrl}/users/me/`, {
          headers: {
            "x-csrf-token": loginData.token,
          },
          cache: "no-store",
        });

        if (!profileResponse.ok) {
          if (profileResponse.status >= 500) {
            throw new Error("TIHLDE-profiltjenesten returnerte en serverfeil.");
          }
          return null;
        }

        const profile = (await profileResponse.json()) as {
          user_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
        };

        if (!profile.email) {
          throw new Error("Svar fra TIHLDE-profil manglet e-postadresse.");
        }

        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();

        const dbUser = await prisma.user.upsert({
          where: { email: profile.email },
          update: {
            name: fullName || undefined,
            tihldeUserId: profile.user_id ?? userId,
            tihldeToken: loginData.token,
          },
          create: {
            email: profile.email,
            name: fullName || profile.user_id || userId,
            tihldeUserId: profile.user_id ?? userId,
            tihldeToken: loginData.token,
          },
        });

        return {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
