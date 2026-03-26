## Time Grid

Full-stack group scheduling app built with:

- Next.js 14 App Router + TypeScript + Tailwind CSS
- NextAuth.js v5 (Google OAuth)
- Prisma ORM + Vercel Postgres
- Google Calendar API (read-only sync)

## Getting Started

1) Install dependencies:

```bash
pnpm install
```

2) Create env file:

```bash
cp .env.example .env.local
```

3) Start local Postgres:

```bash
docker compose up -d db
```

4) Run Prisma migrations:

```bash
pnpm prisma migrate dev --name init
```

5) Start dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Google OAuth Setup

- Create an OAuth client in Google Cloud Console
- Add redirect URI: `http://localhost:3000/api/auth/callback/google`
- Put credentials in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`

For production, also add:

- `https://<your-domain>/api/auth/callback/google`

## Vercel Deployment Notes

- Add all variables from `.env.example` to Vercel Project Settings
- Use Vercel Postgres `DATABASE_URL`
- Run `pnpm prisma migrate deploy` during deployment (or in CI)

## TIHLDE Login Notes

- TIHLDE login writes/reads user and session data through Prisma.
- If `DATABASE_URL` points to a placeholder or unreachable host, login fails and can surface as auth errors.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Prisma docs](https://www.prisma.io/docs)
- [NextAuth.js docs](https://authjs.dev)
