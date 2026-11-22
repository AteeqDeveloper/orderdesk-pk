"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";

const LIMIT_LABELS = [
  ["products", "Products"],
  ["customers", "Customers"],
  ["ordersPerMonth", "Orders per month"],
];

const formatPrice = (price, billingCycle) => {
  if (price === null || price === undefined) return "Pricing not configured";
  if (price === 0) return "Free";
  const amount = new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(price);
  return `${amount} / ${billingCycle === "yearly" ? "year" : "month"}`;
};

const formatLimit = (value) =>
  value === null || value === undefined
    ? "Unlimited"
    : new Intl.NumberFormat("en-PK").format(value);

export default function PricingPlans() {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("subscriptions/plans"),
      apiRequest("subscriptions/current"),
    ])
      .then(([plansResponse, currentResponse]) => {
        if (!active) return;
        setPlans(plansResponse.data?.plans || []);
        setCurrent(currentResponse.data?.subscription || null);
        setPendingRequest(currentResponse.data?.pendingRequest || null);
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

  const requestPlan = async (plan) => {
    const price = formatPrice(plan.price, plan.billingCycle);
    if (
      !window.confirm(
        `Request the ${plan.name} plan for ${price}? No payment will be taken online.`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    setSubmittingPlanId(plan._id);
    try {
      const response = await apiRequest("subscriptions/requests", {
        method: "POST",
        body: JSON.stringify({ planId: plan._id }),
      });
      setPendingRequest({
        subscriptionId: response.data.subscription.id,
        planId: plan._id,
        status: response.data.subscription.status,
        payment: response.data.payment,
      });
      setMessage(response.message);
    } catch (requestError) {
      if (requestError instanceof ApiError) setError(requestError.message);
      else setError("Could not submit the plan request.");
    } finally {
      setSubmittingPlanId("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-ink-500">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading plans…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Plans</h1>
        <p className="mt-1 text-sm text-ink-500">
          Compare available plans and request an upgrade.
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
      {pendingRequest && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          A plan request is awaiting payment verification. No payment has been
          taken online. Manage or cancel it in Billing settings.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = current?.planId === plan._id;
          const hasPendingRequest = pendingRequest?.planId === plan._id;
          const canRequest =
            plan.slug !== "free" &&
            plan.priceConfigured &&
            !pendingRequest &&
            !isCurrent;

          return (
            <article
              key={plan._id}
              className={`flex flex-col rounded-xl border bg-white p-5 shadow-card ${
                isCurrent ? "border-brand-300 ring-1 ring-brand-200" : "border-ink-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg text-ink-900">{plan.name}</h2>
                  <p className="mt-1 min-h-10 text-sm text-ink-500">
                    {plan.description}
                  </p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                    Current plan
                  </span>
                )}
              </div>

              <p className="mt-5 text-xl font-semibold text-ink-900">
                {formatPrice(plan.price, plan.billingCycle)}
              </p>

              <dl className="mt-5 space-y-2 border-y border-ink-100 py-4 text-sm">
                {LIMIT_LABELS.map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className="font-medium text-ink-800">
                      {formatLimit(plan.limits?.[key])}
                    </dd>
                  </div>
                ))}
              </dl>

              <ul className="mt-4 flex-1 space-y-2">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-ink-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={!canRequest || submittingPlanId === plan._id}
                onClick={() => requestPlan(plan)}
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500"
              >
                {submittingPlanId === plan._id ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-label="Submitting request" />
                ) : isCurrent ? (
                  "Current plan"
                ) : hasPendingRequest ? (
                  "Request pending"
                ) : plan.slug === "free" ? (
                  "Included"
                ) : !plan.priceConfigured ? (
                  "Pricing not configured"
                ) : pendingRequest ? (
                  "Resolve pending request"
                ) : (
                  "Request upgrade"
                )}
              </button>
            </article>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-ink-400">
        Paid plans are not activated until an administrator verifies a payment.
        Online checkout and automatic renewals are not configured.
      </p>
    </div>
  );
}
