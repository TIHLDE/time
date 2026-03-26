import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

type StatePayload = {
  v: 1;
  userId: string;
  returnTo: string;
  nonce: string;
};

function decodeBase64UrlToJson<T>(b64url: string): T {
  const raw = Buffer.from(b64url, "base64url").toString("utf8");
  return JSON.parse(raw) as T;
}

function verifyState(state: string, secret: string) {
  const [payloadB64url, sig] = state.split(".");
  if (!payloadB64url || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64url)
    .digest("base64url");

  const sigBuf = Buffer.from(sig, "base64url");
  const expectedBuf = Buffer.from(expectedSig, "base64url");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    return decodeBase64UrlToJson<StatePayload>(payloadB64url);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const secret = process.env.AUTH_SECRET;
  const googleClientId = process.env.AUTH_GOOGLE_ID;
  const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
  const authUrl = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!secret || !googleClientId || !googleClientSecret || !authUrl) {
    return NextResponse.json(
      { error: "Manglende OAuth-konfigurasjon i miljøvariabler" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.json({ error: "Mangler code/state" }, { status: 400 });
  }

  const payload = verifyState(stateParam, secret);
  if (!payload || payload.userId !== userId) {
    return NextResponse.json({ error: "Ugyldig state" }, { status: 400 });
  }

  const redirectUri = `${authUrl.replace(/\/+$/, "")}/api/google-calendar/oauth/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Kunne ikke utveksle kode til tokens", details: errText || undefined },
      { status: 400 },
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!tokenData.access_token) {
    return NextResponse.json({ error: "Mangler access_token" }, { status: 400 });
  }

  const dataToUpdate: { googleAccessToken?: string; googleRefreshToken?: string } = {
    googleAccessToken: tokenData.access_token,
  };

  // Google only returns a refresh token reliably on first consent; keep existing when absent.
  if (tokenData.refresh_token) {
    dataToUpdate.googleRefreshToken = tokenData.refresh_token;
  }

  await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  const returnTo = typeof payload.returnTo === "string" && payload.returnTo.startsWith("/")
    ? payload.returnTo
    : "/";

  return NextResponse.redirect(new URL(returnTo, authUrl).toString());
}

