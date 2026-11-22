"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-PK", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value))
    : "Not scheduled";

const formatMoney = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

const usageItems = [
  ["products", "Products"],
  ["customers", "Customers"],
  ["ordersPerMonth", "Orders this billing month"],
];

export default function BillingSettings() {
  const [details, setDetails] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadBilling = useCallback(async () => {
    const [currentResponse, historyResponse] = await Promise.all([
      apiRequest("subscriptions/current"),
      apiRequest("subscriptions/payments?limit=20"),
    ]);
    setDetails(currentResponse.data);
    setPayments(historyResponse.data?.payments || []);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("subscriptions/current"),
      apiRequest("subscriptions/payments?limit=20"),
    ])
      .then(([currentResponse, historyResponse]) => {
        if (!active) return;
        setDetails(currentResponse.data);
        setPayments(historyResponse.data?.payments || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cancel = async (subscriptionId) => {
    const confirmed = window.confirm(
      subscriptionId
        ? "Cancel this pending plan request? The current plan will not change."
        : "Schedule cancellation at the end of the current billing period?"
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiRequest("subscriptions/cancel", {
        method: "POST",
        body: JSON.stringify(subscriptionId ? { subscriptionId } : {}),
      });
      setMessage(response.message);
      await loadBilling();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-ink-500">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading billing details…
      </div>
    );
  }

  const subscription = details?.subscription;
  const plan = details?.plan;
  const pendingRequest = details?.pendingRequest;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Billing</h1>
        <p className="mt-1 text-sm text-ink-500">
          Review your plan, usage, and payment history.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {message}
        </p>
      )}

      <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Current plan
            </p>
            <h2 className="mt-1 font-display text-lg text-ink-900">
              {plan?.name || "Plan unavailable"}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Status: {subscription?.status?.replaceAll("_", " ") || "Unknown"}
            </p>
          </div>
          <Link
            href="/dashboard/pricing"
            className="rounded-lg border border-brand-200 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
          >
            View plans
          </Link>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-ink-50/70 p-3.5">
            <dt className="text-xs text-ink-400">Next billing date</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">
              {formatDate(subscription?.nextBillingDate)}
            </dd>
          </div>
          <div className="rounded-lg bg-ink-50/70 p-3.5">
            <dt className="text-xs text-ink-400">Billing period</dt>
            <dd className="mt-1 text-sm font-semibold capitalize text-ink-900">
              {subscription?.billingCycle || "Monthly"}
            </dd>
          </div>
        </dl>
        {subscription?.status === "active" &&
          plan?.slug !== "free" &&
          !subscription.cancelAtPeriodEnd && (
            <button
              type="button"
              disabled={busy}
              onClick={() => cancel()}
              className="mt-5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Cancel at period end"}
            </button>
          )}
        {subscription?.cancelAtPeriodEnd && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Cancellation is scheduled. Your plan remains active until{" "}
            {formatDate(subscription.endDate)}.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Plan usage</h2>
        <div className="mt-4 space-y-5">
          {usageItems.map(([key, label]) => {
            const usage = details?.usage?.[key];
            const current = usage?.current || 0;
            const limit = usage?.limit;
            const percent =
              limit === null || limit === undefined || limit === 0
                ? 0
                : Math.min(100, (current / limit) * 100);
            return (
              <div key={key}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm">
                  <span className="text-ink-700">{label}</span>
                  <span className="font-medium text-ink-900">
                    {new Intl.NumberFormat("en-PK").format(current)} /{" "}
                    {limit === null || limit === undefined
                      ? "Unlimited"
                      : new Intl.NumberFormat("en-PK").format(limit)}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-ink-100"
                  role="progressbar"
                  aria-label={label}
                  aria-valuemin={0}
                  aria-valuemax={limit || 100}
                  aria-valuenow={limit ? Math.min(current, limit) : 0}
                >
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {pendingRequest && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-base text-amber-950">
            Pending plan request
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            This request is awaiting manual payment verification. No online
            payment or automatic renewal is configured.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => cancel(pendingRequest.subscriptionId)}
            className="mt-4 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            Cancel request
          </button>
        </section>
      )}

      <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Payment history</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No payments recorded.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-ink-100 text-xs uppercase text-ink-400">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-3 pr-4 text-ink-600">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-ink-800">
                      {formatMoney(payment.amount, payment.currency)}
                    </td>
                    <td className="py-3 pr-4 capitalize text-ink-600">
                      {payment.status}
                    </td>
                    <td className="py-3 text-ink-500">
                      {payment.transactionReference || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
