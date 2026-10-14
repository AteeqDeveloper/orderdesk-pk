import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl text-brand-700">404</p>
      <h1 className="mt-4 text-xl font-medium text-ink-900">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        Check the link, or head back to your dashboard.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
      >
        Go home
      </Link>
    </div>
  );
}
