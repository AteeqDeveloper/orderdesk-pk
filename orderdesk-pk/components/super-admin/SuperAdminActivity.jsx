"use client";

import { useEffect, useState } from "react";
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

export default function SuperAdminActivity() {
  const [activity, setActivity] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (action) params.set("action", action);
    apiRequest(`super-admin/activity?${params}`)
      .then((response) => {
        if (!active) return;
        setActivity(response.data?.activity || []);
        setPagination(response.data?.pagination || null);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, action]);

  return (
    <div>
      <AdminPageHeading
        title="Super Admin activity"
        description="Append-only audit records for privileged sign-ins, account actions, subscription changes, plan management, and payment administration."
      />
      <AdminError message={error} />
      <div className="mb-4 max-w-sm rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-xs font-medium text-slate-600">
          Filter action
          <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className={`${adminInputClass} mt-1.5 w-full`}>
            <option value="">All activity</option>
            {[
              "super_admin_login", "super_admin_logout", "user_suspended",
              "user_reactivated", "subscription_status_changed",
              "subscription_plan_assignment_attempted",
              "subscription_plan_assigned", "plan_created", "plan_updated",
              "plan_activated", "plan_deactivated", "payment_records_viewed",
              "payment_verification_attempted", "payment_verified",
            ].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>
      {loading ? (
        <AdminLoading label="Loading audit history…" />
      ) : activity.length === 0 ? (
        <AdminEmpty>No audit records match this filter.</AdminEmpty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Reason / metadata</th><th className="px-4 py-3">Timestamp</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activity.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{entry.admin?.name || "Unavailable"}</p>
                      <p className="text-xs text-slate-500">{entry.admin?.email || ""}</p>
                    </td>
                    <td className="px-4 py-3 font-medium capitalize text-slate-800">{entry.action.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{entry.targetType}{entry.targetId ? ` · ${entry.targetId}` : ""}</td>
                    <td className="max-w-sm px-4 py-3">
                      <p className="text-slate-700">{entry.reason || "—"}</p>
                      {Object.keys(entry.metadata || {}).length > 0 && (
                        <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] leading-4 text-slate-400">{JSON.stringify(entry.metadata)}</pre>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatAdminDate(entry.createdAt)}</td>
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
