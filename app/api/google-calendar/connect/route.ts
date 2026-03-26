import { auth } from "@/auth";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

type StatePayload = {
  v: 1;
  userId: string;
  returnTo: string;
  nonce: string;
};

function encodeBase64Url(text: string) {
  return Buffer.from(text, "utf8").toString("base64url");
}

function signState(payloadB64url: string, secret: string) {
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64url)
    .digest("base64url");
  return `${payloadB64url}.${sig}`;
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const secret = process.env.AUTH_SECRET;
  const googleClientId = process.env.AUTH_GOOGLE_ID;
  const authUrl = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!secret || !googleClientId || !authUrl) {
    return NextResponse.json(
      { error: "Manglende OAuth-konfigurasjon i miljøvariabler" },
      { status: 500 },
    );
  }

  const returnToParam = new URL(req.url).searchParams.get("returnTo") ?? "/";
  const returnTo =
    typeof returnToParam === "string" && returnToParam.startsWith("/") ? returnToParam : "/";

  const redirectUri = `${authUrl.replace(/\/+$/, "")}/api/google-calendar/oauth/callback`;

  const payload: StatePayload = {
    v: 1,
    userId,
    returnTo,
    nonce: crypto.randomUUID(),
  };
  const payloadB64url = encodeBase64Url(JSON.stringify(payload));
  const state = signState(payloadB64url, secret);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/calendar.readonly",
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}

