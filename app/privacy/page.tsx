import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Personvernerklæring",
  description:
    "Hvordan TIHLDE Time behandler personopplysninger, inkludert Google Kalender-tilkobling.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-8 sm:py-14">
      <p className="mb-6">
        <Link href="/" className="text-sm text-primary underline">
          ← Tilbake til forsiden
        </Link>
      </p>
      <article className="space-y-8 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-card-foreground">
            Personvernerklæring
          </h1>
          <p className="text-sm text-muted-foreground">
            Sist oppdatert: 27. mars 2026
          </p>
        </header>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Om tjenesten
          </h2>
          <p>
            TIHLDE Time («tjenesten») er et verktøy for gruppeplanlegging: du kan
            opprette arrangementer, dele en lenke, og samle inn tilgjengelighet
            i et tidsgitter. Denne erklæringen beskriver hvordan vi behandler
            personopplysninger når du bruker tjenesten.
          </p>
        </section>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Innlogging med TIHLDE
          </h2>
          <p>
            Når du logger inn med TIHLDE-brukernavn og passord, sender vi
            innloggingsforespørselen til TIHLDE sin API. Vi henter profilinformasjon
            som trengs for å identifisere deg (blant annet e-postadresse og navn)
            og lagrer en tilknytning til din TIHLDE-konto i vår database sammen
            med en sesjons-/autentiseringsnøkkel fra TIHLDE der det er nødvendig
            for innlogging.
          </p>
        </section>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Google Kalender (valgfritt)
          </h2>
          <p>
            Du kan koble til Google-kontoen din for å synkronisere med Google
            Kalender. Tjenesten ber om tilgang med omfanget{" "}
            <span className="text-card-foreground">
              Les Google Kalender (calendar.readonly)
            </span>
            : vi kan kun lese hendelser, ikke opprette, endre eller slette noe i
            kalenderen din.
          </p>
          <p>
            Når du bruker synkronisering, henter vi hendelser fra din primærkalender
            i det tidsrommet som er relevant for det aktuelle arrangementet du ser
            på. Opplysningene brukes til å beregne hvilke tidspunkter som
            kolliderer med eksisterende avtaler, slik at du kan se det i
            planleggingsgitteret. Kalenderhendelser lagres ikke som en egen kopi i
            vår database; beregningen skjer i forbindelse med forespørselen.
          </p>
          <p>
            For å kunne hente kalenderdata på vegne av deg lagrer vi OAuth-tokens
            fra Google (tilgangsnøkkel og ev. fornyelsesnøkkel) knyttet til
            brukerkontoen din i vår database. Disse brukes kun til å opprettholde
            tilkoblingen og hente kalenderdata som beskrevet over.
          </p>
          <p>
            Du kan når som helst trekke tilbake TIHLDE Time sin tilgang til Google
            Kalender i{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google-kontoen din under «Tredjepartsapper med kontotilgang»
            </a>
            .
          </p>
        </section>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Arrangement og deltakere
          </h2>
          <p>
            Vi lagrer informasjon om arrangementer du oppretter (tittel, datoer,
            tidsvindu, delingslenke/slug) og svar fra deltakere (navn og valgte
            tidsluker) slik at planleggingen fungerer. Deltakere trenger ikke å
            logge inn med TIHLDE for å legge inn tilgjengelighet via delingslenken,
            med mindre funksjonaliteten krever det.
          </p>
        </section>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Formål og rettslig grunnlag
          </h2>
          <p>
            Vi behandler opplysningene for å levere og forbedre tjenesten, for
            sikkerhet og feilsøking, og for å oppfylle avtale med deg som bruker
            tjenesten. Behandling av Google-tilkobling skjer på grunnlag av ditt
            samtykke når du velger å koble til Google.
          </p>
        </section>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Deling og overføring
          </h2>
          <p>
            Vi selger ikke personopplysninger. Data kan behandles av
            driftsleverandører (for eksempel hosting/database) som behandler data
            på våre vegne i tråd med formålet. Google behandles i tråd med
            Googles vilkår og personvern når du bruker Google-innlogging og
            kalender-API.
          </p>
        </section>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Dine rettigheter
          </h2>
          <p>
            Avhengig av gjeldende lov har du rett til innsyn, retting, sletting,
            begrensning av behandling, dataportabilitet og å protestere mot visse
            typer behandling. For å utøve rettigheter eller stille spørsmål om
            denne erklæringen, ta kontakt med den som er ansvarlig for driften av
            tjenesten (TIHLDE / linjeforeningen som tilbyr løsningen).
          </p>
        </section>

        <section className="space-y-3 text-muted-foreground">
          <h2 className="text-lg font-semibold text-card-foreground">
            Endringer
          </h2>
          <p>
            Vi kan oppdatere denne personvernerklæringen. Vesentlige endringer vil
            bli gjort synlige på denne siden med oppdatert dato.
          </p>
        </section>
      </article>
    </div>
  );
}
