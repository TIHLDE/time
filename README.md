## Tidsgitter

Fullstack-app for gruppeplanlegging bygget med:

- Next.js 14 App Router + TypeScript + Tailwind CSS
- NextAuth.js v5 (Google OAuth)
- Prisma ORM + Vercel Postgres
- Google Calendar API (skrivebeskyttet synkronisering)

## Kom i gang

1) Installer avhengigheter:

```bash
pnpm install
```

2) Opprett miljøfil:

```bash
cp .env.example .env.local
```

3) Start lokal Postgres:

```bash
docker compose up -d db
```

4) Kjør Prisma-migreringer:

```bash
pnpm prisma migrate dev --name init
```

5) Start utviklingsserver:

```bash
pnpm dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Oppsett av Google OAuth

- Opprett en OAuth-klient i Google Cloud Console
- Legg til redirect-URI: `http://localhost:3000/api/auth/callback/google`
- Legg inn nøkler i `AUTH_GOOGLE_ID` og `AUTH_GOOGLE_SECRET`

For produksjon, legg også til:

- `https://<your-domain>/api/auth/callback/google`

## Notater for deploy til Vercel

- Legg til alle variablene fra `.env.example` i Vercel Project Settings
- Use Vercel Postgres `DATABASE_URL`
- Kjør `pnpm prisma migrate deploy` under deploy (eller i CI)

## Notater om TIHLDE-innlogging

- TIHLDE-innlogging skriver/leser bruker- og sesjonsdata via Prisma.
- Hvis `DATABASE_URL` peker på en ugyldig eller utilgjengelig host, feiler innlogging og kan vises som auth-feil.

## Lær mer

- [Next.js Documentation](https://nextjs.org/docs) - lær mer om funksjoner og API i Next.js.
- [Prisma docs](https://www.prisma.io/docs)
- [NextAuth.js docs](https://authjs.dev)
