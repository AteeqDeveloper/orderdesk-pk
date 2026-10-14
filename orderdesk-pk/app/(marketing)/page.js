import Link from "next/link";
import { NotebookPen, Package, Receipt, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold text-ink-900">
          <NotebookPen className="h-5 w-5 text-brand-700" aria-hidden="true" />
          OrderDesk PK
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium text-ink-600">
          <Link href="/login" className="hover:text-ink-900">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-brand-700 px-4 py-2 text-white hover:bg-brand-800"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-tight text-ink-900 sm:text-5xl">
            Everything your online shop needs, in one dashboard.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-600">
            OrderDesk PK brings orders, customers, stock and payments
            together for small businesses selling across WhatsApp, Instagram
            and Daraz — with PKR pricing and JazzCash, Easypaisa and
            Cash&nbsp;on&nbsp;Delivery built in.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-brand-700 px-5 py-3 text-sm font-medium text-white hover:bg-brand-800"
            >
              Create your free account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-ink-200 px-5 py-3 text-sm font-medium text-ink-800 hover:bg-ink-50"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={Receipt}
            title="Orders, tracked end to end"
            description="From pending to delivered, with payment status alongside every order."
          />
          <FeatureCard
            icon={Package}
            title="Stock that stays accurate"
            description="Low-stock alerts and variant-level tracking so you never oversell."
          />
          <FeatureCard
            icon={Users}
            title="Customers you remember"
            description="Order history and total spend for every customer, automatically."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="rounded-xl border border-ink-100 p-6 shadow-card">
      <Icon className="h-6 w-6 text-brand-700" aria-hidden="true" />
      <h3 className="mt-4 font-medium text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
        {description}
      </p>
    </div>
  );
}
