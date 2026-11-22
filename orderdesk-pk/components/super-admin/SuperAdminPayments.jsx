"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeading,
  AdminPagination,
  adminInputClass,
  formatAdminDate,
  formatAdminMoney,
} from "@/components/super-admin/AdminCommon";

export default function SuperAdminPayments() {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    apiRequest(`super-admin/payments?${params}`)
      .then((response) => {
        if (!active) return;
        setPayments(response.data?.payments || []);
        setPagination(response.data?.pagination || null);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, q, status]);

  return (
    <div>
      <AdminPageHeading
        title="Payments"
        description="Read-only payment inspection. Payment credentials are not exposed and this page cannot mark payments successful."
      />
      <AdminError message={error} />
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(14rem,1fr)_12rem]">
        <label className="relative">
          <span className="sr-only">Search transaction reference</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} className={`${adminInputClass} w-full pl-9`} placeholder="Search transaction reference" />
        </label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={adminInputClass} aria-label="Filter payment status">
          <option value="">All payment statuses</option>
          {["pending", "paid", "failed", "refunded", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {loading ? (
        <AdminLoading label="Loading payments…" />
      ) : payments.length === 0 ? (
        <AdminEmpty>No payment records match this filter.</AdminEmpty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[66rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payment date</th>
                  <th className="px-4 py-3 font-medium">Verified at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{payment.transactionReference || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{payment.user?.name || "Unavailable"}</p>
                      <p className="text-xs text-slate-500">{payment.user?.businessName || payment.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{payment.plan?.name || "Unavailable"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{formatAdminMoney(payment.amount, payment.currency)}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{payment.paymentMethod.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 capitalize">{payment.status}</td>
                    <td className="px-4 py-3 text-slate-600">{formatAdminDate(payment.paidAt || payment.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatAdminDate(payment.verifiedAt)}</td>
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
