"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeading,
  adminButtonClass,
  adminInputClass,
  formatAdminDate,
  formatAdminMoney,
} from "@/components/super-admin/AdminCommon";

export default function SuperAdminUserDetail({ userId }) {
  const router = useRouter();
  const [detail, setDetail] = useState(null);
  const [plans, setPlans] = useState([]);
  const [reason, setReason] = useState("");
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [userResponse, plansResponse] = await Promise.all([
      apiRequest(`super-admin/users/${userId}`),
      apiRequest("super-admin/plans"),
    ]);
    setDetail(userResponse.data);
    setPlans((plansResponse.data?.plans || []).filter((plan) => plan.isActive));
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest(`super-admin/users/${userId}`),
      apiRequest("super-admin/plans"),
    ])
      .then(([userResponse, plansResponse]) => {
        if (!active) return;
        setDetail(userResponse.data);
        setPlans((plansResponse.data?.plans || []).filter((plan) => plan.isActive));
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  const changeStatus = async () => {
    const nextStatus = detail.user.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(`${nextStatus === "suspended" ? "Suspend" : "Reactivate"} this account?`)) return;
    setBusy("status");
    setError("");
    setMessage("");
    try {
      const response = await apiRequest(`super-admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      setMessage(response.message);
      setReason("");
      await load();
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const assignPlan = async (event) => {
    event.preventDefault();
    if (!window.confirm("Assign this plan as a complimentary Super Admin grant? No payment will be recorded.")) return;
    setBusy("plan");
    setError("");
    setMessage("");
    try {
      const response = await apiRequest(`super-admin/users/${userId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ planId, reason }),
      });
      setMessage(response.message);
      setReason("");
      setPlanId("");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  if (loading) return <AdminLoading label="Loading user details…" />;
  if (!detail) return <><AdminError message={error} /><AdminEmpty>User could not be found.</AdminEmpty></>;

  const { user, subscriptions, payments } = detail;
  return (
    <div>
      <AdminPageHeading
        title={user.fullName}
        description={`${user.email} · Registered ${formatAdminDate(user.createdAt)}`}
        action={
          <Link href="/super-admin/users" className="text-sm font-medium text-emerald-800 hover:underline">
            ← Back to users
          </Link>
        }
      />
      <AdminError message={error} />
      <AdminNotice message={message} />
      <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-slate-900">Account details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Business</dt><dd className="mt-1 text-sm font-medium">{user.businessName || "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Phone</dt><dd className="mt-1 text-sm font-medium">{user.phone || "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Role</dt><dd className="mt-1 text-sm font-medium">{user.role}</dd></div>
              <div><dt className="text-xs text-slate-500">Account status</dt><dd className="mt-1 text-sm font-medium capitalize">{user.status}</dd></div>
              <div><dt className="text-xs text-slate-500">Current plan</dt><dd className="mt-1 text-sm font-medium">{user.currentSubscription?.planName || "None"}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-slate-900">Subscription history</h2>
            {subscriptions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No subscription records.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[35rem] text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <tr><th className="pb-2 pr-3">Plan</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Start</th><th className="pb-2 pr-3">Expires</th><th className="pb-2">Price at assignment</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td className="py-3 pr-3">{subscription.planName}</td>
                        <td className="py-3 pr-3 capitalize">{subscription.status.replaceAll("_", " ")}</td>
                        <td className="py-3 pr-3">{formatAdminDate(subscription.startDate)}</td>
                        <td className="py-3 pr-3">{formatAdminDate(subscription.endDate)}</td>
                        <td className="py-3">{formatAdminMoney(subscription.priceAtPurchase, subscription.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-slate-900">Recent payments</h2>
            {payments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No payment records.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{formatAdminMoney(payment.amount, payment.currency)} · {payment.status}</p>
                      <p className="text-xs text-slate-500">{payment.transactionReference || "No transaction reference"} · {formatAdminDate(payment.paidAt || payment.createdAt)}</p>
                    </div>
                    <span className="text-xs capitalize text-slate-500">{payment.paymentMethod.replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-slate-900">Account access</h2>
            <p className="mt-2 text-sm text-slate-500">
              Suspended accounts are denied by backend authentication middleware.
            </p>
            {user.role !== "super_admin" && (
              <>
                <label className="mt-4 block text-xs font-medium text-slate-600">
                  Required reason
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-emerald-600"
                    placeholder="Explain this account action"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy !== "" || reason.trim().length < 5}
                  onClick={changeStatus}
                  className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                    user.status === "suspended"
                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                      : "bg-red-700 text-white hover:bg-red-800"
                  }`}
                >
                  {busy === "status" ? "Saving…" : user.status === "suspended" ? "Reactivate account" : "Suspend account"}
                </button>
              </>
            )}
          </section>

          {user.status !== "suspended" && user.role !== "super_admin" && (
            <form onSubmit={assignPlan} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-semibold text-slate-900">Assign a plan</h2>
              <p className="mt-2 text-sm text-slate-500">
                This is a complimentary administrative grant. It will not mark a payment as paid.
              </p>
              <select required value={planId} onChange={(event) => setPlanId(event.target.value)} className={`${adminInputClass} mt-4 w-full`}>
                <option value="">Choose an active plan</option>
                {plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}
              </select>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Assignment reason
                <textarea
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-emerald-600"
                  placeholder="Explain why this plan is being assigned"
                />
              </label>
              <button type="submit" disabled={busy !== "" || !planId || reason.trim().length < 5} className={`${adminButtonClass} mt-3 w-full`}>
                {busy === "plan" ? "Assigning…" : "Assign plan"}
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
