import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TIHLDE Time",
  description: "Gruppeplanlegging for TIHLDE",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nb"
      className={`${inter.className} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="flex min-h-full flex-1 flex-col">
          {children}
          <footer className="mt-auto border-t border-border/60 py-6 text-center text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Personvernerklæring
            </Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
