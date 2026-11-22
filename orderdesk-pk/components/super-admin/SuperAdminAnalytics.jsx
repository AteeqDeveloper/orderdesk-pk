"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeading,
  adminInputClass,
  formatAdminMoney,
} from "@/components/super-admin/AdminCommon";

const toDateInput = (date) => date.toISOString().slice(0, 10);
const rangeFor = (preset) => {
  const end = new Date();
  const to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const from = new Date(to);
  if (preset === "7") from.setUTCDate(from.getUTCDate() - 6);
  else if (preset === "30") from.setUTCDate(from.getUTCDate() - 29);
  else if (preset === "month") from.setUTCDate(1);
  return { from: toDateInput(from), to: toDateInput(to) };
};

function BarChart({ title, data, valueKey = "count", currency = false }) {
  const max = Math.max(1, ...data.map((item) => item[valueKey] || 0));
  if (!data.length) return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-display font-semibold text-slate-900">{title}</h2><p className="mt-8 text-center text-sm text-slate-500">No data in this date range.</p></section>;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-display font-semibold text-slate-900">{title}</h2>
      <div className="mt-5 flex h-48 items-end gap-1 overflow-x-auto border-b border-l border-slate-200 px-2">
        {data.map((item) => {
          const value = item[valueKey] || 0;
          const height = Math.max(value ? 4 : 0, (value / max) * 100);
          return (
            <div key={item._id} title={`${item._id}: ${currency ? formatAdminMoney(value) : value}`} className="group flex h-full min-w-3 flex-1 flex-col justify-end">
              <span className="mb-1 hidden text-center text-[10px] text-slate-500 group-hover:block">
                {currency ? formatAdminMoney(value) : value}
              </span>
              <div className="rounded-t bg-emerald-600 transition-colors group-hover:bg-emerald-800" style={{ height: `${height}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]._id}</span>
        <span>{data[data.length - 1]._id}</span>
      </div>
    </section>
  );
}

export default function SuperAdminAnalytics() {
  const [preset, setPreset] = useState("30");
  const [custom, setCustom] = useState(() => rangeFor("30"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(
    () => (preset === "custom" ? custom : rangeFor(preset)),
    [preset, custom]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams(range);
    apiRequest(`super-admin/analytics?${params}`)
      .then((response) => active && setData(response.data))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [range]);

  return (
    <div>
      <AdminPageHeading
        title="Platform analytics"
        description="Database aggregations for registrations, verified revenue, paid plan activations, and cancellations."
      />
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-xs font-medium text-slate-600">
          Date range
          <select value={preset} onChange={(event) => setPreset(event.target.value)} className={`${adminInputClass} mt-1.5 block min-w-44`}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {preset === "custom" && (
          <>
            <label className="block text-xs font-medium text-slate-600">From<input type="date" value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} className={`${adminInputClass} mt-1.5 block`} /></label>
            <label className="block text-xs font-medium text-slate-600">To<input type="date" value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} className={`${adminInputClass} mt-1.5 block`} /></label>
          </>
        )}
        {data && <p className="ml-auto text-xs text-slate-500">Showing {data.range.from} through {data.range.to} · PKR</p>}
      </div>
      <AdminError message={error} />
      {loading ? (
        <AdminLoading label="Aggregating analytics…" />
      ) : !data ? (
        <AdminEmpty>Analytics are unavailable.</AdminEmpty>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <BarChart title="User registrations" data={data.registrations || []} />
            <BarChart title="Verified revenue" data={data.revenue || []} valueKey="amount" currency />
            <BarChart title="Paid plan activations" data={data.upgrades || []} />
            <BarChart title="Cancellations" data={data.cancellations || []} />
          </div>
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display font-semibold text-slate-900">Current subscription distribution</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["free", "starter", "pro"].map((plan) => (
                <div key={plan} className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">{plan}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{new Intl.NumberFormat("en-PK").format(data.distribution?.[plan] || 0)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
