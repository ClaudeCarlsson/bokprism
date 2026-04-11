import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BokPrism - Svensk Finansdata",
  description:
    "Utforska finansiell data for alla svenska foretag. Bokslut, styrelser, kopplingar och trender.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

function Navbar() {
  return (
    <nav className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
          <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" opacity="0.3" />
            <path d="M4 4h5v5H4V4zm11 0h5v5h-5V4zM4 15h5v5H4v-5zm11 0h5v5h-5v-5z" />
          </svg>
          BokPrism
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/rankings"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Topplistor
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-200 px-4 py-8 text-center text-xs text-zinc-500 sm:text-sm dark:border-zinc-800">
          <p>
            Data from{" "}
            <a
              href="https://vardefulla-datamangder.bolagsverket.se/arsredovisningar/"
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bolagsverket
            </a>
            . Open data, no ads, no tracking.
          </p>
        </footer>
      </body>
    </html>
  );
}
