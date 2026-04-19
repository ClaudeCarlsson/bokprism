"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl dark:text-zinc-100">
        Något gick fel
      </h1>
      <p className="mt-2 text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
        Ett oväntat fel inträffade. Försök igen om en stund.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Försök igen
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Till startsidan
        </Link>
      </div>
    </div>
  );
}
