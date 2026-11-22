"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeading,
  AdminPagination,
  adminButtonClass,
  adminInputClass,
  formatAdminDate,
  formatAdminMoney,
} from "@/components/super-admin/AdminCommon";

const ACTION_STATUSES = ["cancelled", "expired", "past_due", "failed"];

export default function SuperAdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [statusById, setStatusById] = useState({});
  const [reasonById, setReasonById] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (active = () => true) => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (statusFilter) params.set("status", statusFilter);
    if (q.trim()) params.set("q", q.trim());
    const response = await apiRequest(`super-admin/subscriptions?${params}`);
    if (active()) {
      setSubscriptions(response.data?.subscriptions || []);
      setPagination(response.data?.pagination || null);
    }
  }, [page, statusFilter, q]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    load(() => active)
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  const updateStatus = async (subscription) => {
    const status = statusById[subscription.id] || "cancelled";
    const reason = reasonById[subscription.id] || "";
    if (!window.confirm(`Change this subscription status to "${status}"?`)) return;
    setBusyId(subscription.id);
    setError("");
    try {
      await apiRequest(`super-admin/subscriptions/${subscription.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <AdminPageHeading
        title="Subscriptions"
        description="Inspect account plans and lifecycle dates. Administrative status changes require a reason and are audited."
      />
      <AdminError message={error} />
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(14rem,1fr)_14rem]">
        <label className="relative">
          <span className="sr-only">Search subscriptions</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} className={`${adminInputClass} w-full pl-9`} placeholder="Search user or business" />
        </label>
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className={adminInputClass} aria-label="Filter by subscription status">
          <option value="">All statuses</option>
          {["pending_payment", "active", "cancel_at_period_end", "past_due", "failed", "cancelled", "expired"].map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <AdminLoading label="Loading subscriptions…" />
      ) : subscriptions.length === 0 ? (
        <AdminEmpty>No matching subscription records.</AdminEmpty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">User / business</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">Next billing</th>
                  <th className="px-4 py-3 font-medium">Manage status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="align-top">
                    <td className="px-4 py-3">
                      {subscription.user ? (
                        <Link href={`/super-admin/users/${subscription.user.id}`} className="font-medium text-emerald-800 hover:underline">
                          {subscription.user.name}
                        </Link>
                      ) : <span className="text-slate-500">Unavailable</span>}
                      <p className="mt-0.5 text-xs text-slate-500">{subscription.user?.businessName || subscription.user?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{subscription.plan.name}</p>
                      <p className="text-xs text-slate-500">{subscription.billingCycle} · {formatAdminMoney(subscription.priceAtPurchase, subscription.currency)}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">{subscription.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-600">{formatAdminDate(subscription.startDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatAdminDate(subscription.endDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatAdminDate(subscription.nextBillingDate)}</td>
                    <td className="w-72 px-4 py-3">
                      <div className="space-y-2">
                        <select
                          value={statusById[subscription.id] || "cancelled"}
                          onChange={(event) => setStatusById((current) => ({ ...current, [subscription.id]: event.target.value }))}
                          className={`${adminInputClass} w-full`}
                          aria-label={`Set status for ${subscription.user?.name || "subscription"}`}
                        >
                          {ACTION_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                        </select>
                        <input
                          value={reasonById[subscription.id] || ""}
                          onChange={(event) => setReasonById((current) => ({ ...current, [subscription.id]: event.target.value }))}
                          maxLength={500}
                          className={`${adminInputClass} w-full`}
                          placeholder="Required reason"
                        />
                        <button
                          type="button"
                          disabled={busyId === subscription.id || (reasonById[subscription.id] || "").trim().length < 5}
                          onClick={() => updateStatus(subscription)}
                          className={`${adminButtonClass} w-full`}
                        >
                          {busyId === subscription.id ? "Saving…" : "Apply status"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
