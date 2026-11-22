"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeading,
  adminButtonClass,
  adminInputClass,
  formatAdminMoney,
} from "@/components/super-admin/AdminCommon";

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  price: "0",
  billingCycle: "monthly",
  features: "",
  products: "",
  customers: "",
  ordersPerMonth: "",
  isActive: true,
  reason: "",
};

const limitValue = (value) => {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : NaN;
};

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPlans = async () => {
    const response = await apiRequest("super-admin/plans");
    setPlans(response.data?.plans || []);
  };

  useEffect(() => {
    let active = true;
    apiRequest("super-admin/plans")
      .then((response) => active && setPlans(response.data?.plans || []))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const selectPlan = (plan) => {
    setEditingId(plan._id);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price: String(plan.price || 0),
      billingCycle: plan.billingCycle,
      features: (plan.features || []).join("\n"),
      products: plan.limits?.products == null ? "" : String(plan.limits.products),
      customers: plan.limits?.customers == null ? "" : String(plan.limits.customers),
      ordersPerMonth: plan.limits?.ordersPerMonth == null ? "" : String(plan.limits.ordersPerMonth),
      isActive: plan.isActive,
      reason: "",
    });
    setError("");
    setMessage("");
  };

  const savePlan = async (event) => {
    event.preventDefault();
    const limits = {
      products: limitValue(form.products),
      customers: limitValue(form.customers),
      ordersPerMonth: limitValue(form.ordersPerMonth),
    };
    if (Object.values(limits).some(Number.isNaN)) {
      setError("Usage limits must be non-negative whole numbers or unlimited.");
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid non-negative PKR price.");
      return;
    }
    if (!window.confirm(`${editingId ? "Save changes to" : "Create"} this plan? Existing subscriptions keep their saved plan terms.`)) return;

    const payload = {
      name: form.name,
      description: form.description,
      price,
      billingCycle: form.billingCycle,
      features: form.features.split("\n").map((feature) => feature.trim()).filter(Boolean),
      limits,
      isActive: form.isActive,
      reason: form.reason,
    };
    if (!editingId) payload.slug = form.slug;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiRequest(
        editingId
          ? `super-admin/plans/${editingId}`
          : "super-admin/plans",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setMessage(response.message || (editingId ? "Plan updated." : "Plan created."));
      setEditingId("");
      setForm(EMPTY_FORM);
      await loadPlans();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <AdminLoading label="Loading plans…" />;

  return (
    <div>
      <AdminPageHeading
        title="Plan management"
        description="Plan edits are versioned into existing current and pending subscriptions before saving, so their saved limits and billing terms do not silently change."
      />
      <AdminError message={error} />
      <AdminNotice message={message} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {plans.length === 0 ? (
            <AdminEmpty>No plans found.</AdminEmpty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Limits</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Edit</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plans.map((plan) => (
                    <tr key={plan._id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.slug} · {plan.billingCycle}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {plan.priceConfigured ? formatAdminMoney(plan.price) : <span className="text-amber-700">Not configured</span>}
                      </td>
                      <td className="px-4 py-3 text-xs leading-5 text-slate-600">
                        P {plan.limits?.products ?? "∞"} · C {plan.limits?.customers ?? "∞"} · O {plan.limits?.ordersPerMonth ?? "∞"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${plan.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => selectPlan(plan)} className="font-medium text-emerald-800 hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form onSubmit={savePlan} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {editingId ? `Edit ${form.name}` : "Create a plan"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">A reason is required and recorded in the immutable audit log.</p>
            </div>
            {editingId && <button type="button" onClick={() => { setEditingId(""); setForm(EMPTY_FORM); }} className="text-xs font-medium text-slate-500 hover:text-slate-900">New plan</button>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Plan name
              <input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${adminInputClass} mt-1.5 w-full`} />
            </label>
            {!editingId && (
              <label className="text-xs font-medium text-slate-600">
                Slug
                <input required pattern="[a-z0-9-]{2,40}" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} className={`${adminInputClass} mt-1.5 w-full`} />
              </label>
            )}
            <label className="text-xs font-medium text-slate-600">
              Price (PKR)
              <input type="number" min="0" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className={`${adminInputClass} mt-1.5 w-full`} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Billing cycle
              <select value={form.billingCycle} onChange={(event) => setForm({ ...form, billingCycle: event.target.value })} className={`${adminInputClass} mt-1.5 w-full`}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Description
            <textarea maxLength={500} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-emerald-600" />
          </label>
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-slate-700">Usage limits (leave blank for unlimited)</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                ["products", "Products"],
                ["customers", "Customers"],
                ["ordersPerMonth", "Orders / month"],
              ].map(([key, label]) => (
                <label key={key} className="text-[11px] font-medium text-slate-500">
                  {label}
                  <input type="number" min="0" step="1" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={`${adminInputClass} mt-1 w-full px-2`} />
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-xs font-medium text-slate-600">
            Plan features (one per line)
            <textarea rows={4} value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-emerald-600" />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            Plan is active and available to new requests
          </label>
          <label className="mt-4 block text-xs font-medium text-slate-600">
            Administrative reason
            <textarea required minLength={5} maxLength={500} rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-emerald-600" placeholder="Why is this plan being changed?" />
          </label>
          <button type="submit" disabled={busy || form.reason.trim().length < 5} className={`${adminButtonClass} mt-4 w-full`}>
            {busy ? "Saving…" : editingId ? "Save plan changes" : "Create plan"}
          </button>
        </form>
      </div>
    </div>
  );
}
