"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "@/components/super-admin/AdminCommon";

const StatusBadge = ({ status }) => (
  <span
    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
      status === "suspended"
        ? "bg-red-50 text-red-700"
        : "bg-emerald-50 text-emerald-800"
    }`}
  >
    {status || "active"}
  </span>
);

export default function SuperAdminUsers() {
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [q, setQ] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    apiRequest("super-admin/plans")
      .then((response) => setPlans(response.data?.plans || []))
      .catch((requestError) => setPlanError(requestError.message));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (q.trim()) params.set("q", q.trim());
    if (planId) params.set("planId", planId);
    if (status) params.set("status", status);
    apiRequest(`super-admin/users?${params}`)
      .then((response) => {
        if (!active) return;
        setUsers(response.data?.users || []);
        setPagination(response.data?.pagination || null);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, q, planId, status]);

  return (
    <div>
      <AdminPageHeading
        title="Users"
        description="Search business accounts, review their active plan, and manage account access."
      />
      <AdminError message={planError} />
      <AdminError message={error} />
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(14rem,1fr)_12rem_12rem]">
        <label className="relative">
          <span className="sr-only">Search users</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email or business"
            className={`${adminInputClass} w-full pl-9`}
          />
        </label>
        <select
          value={planId}
          onChange={(event) => {
            setPlanId(event.target.value);
            setPage(1);
          }}
          className={adminInputClass}
          aria-label="Filter by plan"
        >
          <option value="">All plans</option>
          {plans.map((plan) => (
            <option key={plan._id} value={plan._id}>{plan.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className={adminInputClass}
          aria-label="Filter by account status"
        >
          <option value="">All account statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      {loading ? (
        <AdminLoading label="Loading users…" />
      ) : users.length === 0 ? (
        <AdminEmpty>No matching users.</AdminEmpty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{user.fullName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.businessName || "—"}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {user.currentSubscription?.planName || "No plan"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatAdminDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/super-admin/users/${user.id}`}
                        className="font-medium text-emerald-800 hover:underline"
                      >
                        View
                      </Link>
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
