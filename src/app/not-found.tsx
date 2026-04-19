import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-zinc-900 dark:text-zinc-100">404</p>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900 sm:text-2xl dark:text-zinc-100">
        Sidan kunde inte hittas
      </h1>
      <p className="mt-2 text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
        Företaget eller personen du söker finns inte i vårt register.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Tillbaka till startsidan
      </Link>
    </div>
  );
}
