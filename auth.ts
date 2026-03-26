import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const tihldeApiBaseUrl = process.env.TIHLDE_API_URL?.replace(/\/+$/, "");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
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
            throw new Error("TIHLDE login endpoint returned a server error.");
          }
          return null;
        }

        const loginData = (await loginResponse.json()) as { token?: string };
        if (!loginData.token) {
          throw new Error("TIHLDE login response did not include a token.");
        }

        const profileResponse = await fetch(`${tihldeApiBaseUrl}/users/me/`, {
          headers: {
            "x-csrf-token": loginData.token,
          },
          cache: "no-store",
        });

        if (!profileResponse.ok) {
          if (profileResponse.status >= 500) {
            throw new Error("TIHLDE profile endpoint returned a server error.");
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
          throw new Error("TIHLDE profile response did not include an email.");
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
          tihldeToken: loginData.token,
        };
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        await prisma.user.update({
          where: { email: user.email },
          data: {
            googleAccessToken: account.access_token ?? undefined,
            googleRefreshToken: account.refresh_token ?? undefined,
          },
        });
      }

      if (account?.provider === "credentials") {
        const tihldeToken = (user as { tihldeToken?: string }).tihldeToken;
        if (user.id && tihldeToken) {
          await prisma.user.update({
            where: { id: user.id },
            data: { tihldeToken },
          });
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/",
  },
});
