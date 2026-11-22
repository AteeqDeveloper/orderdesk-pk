"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CreditCard, Users, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeading,
  formatAdminMoney,
} from "@/components/super-admin/AdminCommon";

const STAT_CARDS = [
  ["totalUsers", "Registered users", Users],
  ["activeUsers", "Active users", Users],
  ["totalSubscriptions", "Current subscriptions", CreditCard],
  ["verifiedPayments", "Verified payments", Wallet],
  ["subscriptionRevenue", "Verified revenue", Wallet, "money"],
  ["pendingPayments", "Pending payments", CreditCard],
  ["cancelledSubscriptions", "Cancelled subscriptions", CreditCard],
];

export default function SuperAdminOverview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest("super-admin/overview")
      .then((response) => active && setStats(response.data))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <AdminLoading />;

  return (
    <div>
      <AdminPageHeading
        title="Platform overview"
        description="Live account, subscription, and verified payment totals from MongoDB."
      />
      <AdminError message={error} />
      {!stats && !error ? <AdminEmpty /> : null}
      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STAT_CARDS.map(([key, label, Icon, type]) => (
              <article key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {key === "pendingPayments" ? (
                    <Link href="/super-admin/payments?status=pending" aria-label="View pending payments">
                      <ArrowUpRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                <p className="mt-4 text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  {type === "money"
                    ? formatAdminMoney(stats[key], stats.currency)
                    : new Intl.NumberFormat("en-PK").format(stats[key] || 0)}
                </p>
              </article>
            ))}
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Current subscription distribution
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Counts include current subscriptions only.
                </p>
              </div>
              <Link href="/super-admin/subscriptions" className="text-sm font-medium text-emerald-800 hover:underline">
                View subscriptions
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["free", "starter", "pro"].map((slug) => (
                <div key={slug} className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{slug}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {new Intl.NumberFormat("en-PK").format(stats.subscriptionsByPlan?.[slug] || 0)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
