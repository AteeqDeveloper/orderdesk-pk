import Link from "next/link";
import { PlusCircle, PackagePlus, UserPlus } from "lucide-react";

const ACTIONS = [
  {
    href: "/dashboard/orders",
    label: "New order",
    icon: PlusCircle,
  },
  {
    href: "/dashboard/products/new",
    label: "Add product",
    icon: PackagePlus,
  },
  {
    href: "/dashboard/customers",
    label: "Add customer",
    icon: UserPlus,
  },
];

// These routes are on the roadmap (Phases 3-5) — the links are wired up
// now so no future rewiring is needed once those pages exist.
export default function QuickActions() {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="font-display text-base text-ink-900">Quick actions</h2>
      <div className="mt-4 grid gap-2.5">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 rounded-lg border border-ink-100 px-3.5 py-2.5 text-sm font-medium text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          >
            <action.icon className="h-4 w-4" aria-hidden="true" />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
