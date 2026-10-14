import Link from "next/link";
import { NotebookPen } from "lucide-react";

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — hidden on small screens, this is the one bold
          moment; the form itself stays quiet and functional. */}
      <div className="relative hidden w-[42%] flex-col justify-between bg-brand-950 px-12 py-12 text-brand-50 lg:flex">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <NotebookPen className="h-5 w-5" aria-hidden="true" />
          OrderDesk PK
        </Link>
        <div className="max-w-sm">
          <p className="font-display text-3xl leading-snug text-white">
            Run your whole shop from one dashboard.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Orders, customers, stock and payments in one place — built for
            businesses selling on WhatsApp, Instagram and Daraz across
            Pakistan.
          </p>
        </div>
        <p className="text-xs text-brand-300">
          &copy; {new Date().getFullYear()} OrderDesk PK
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 flex items-center gap-2 text-lg font-semibold text-ink-900 lg:hidden"
          >
            <NotebookPen className="h-5 w-5 text-brand-700" aria-hidden="true" />
            OrderDesk PK
          </Link>

          <h1 className="font-display text-2xl text-ink-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-500">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
