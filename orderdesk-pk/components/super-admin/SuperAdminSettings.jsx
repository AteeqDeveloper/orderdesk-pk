"use client";

import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  AdminError,
  AdminLoading,
  AdminPageHeading,
} from "@/components/super-admin/AdminCommon";

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest("super-admin/settings")
      .then((response) => active && setSettings(response.data))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <AdminLoading label="Loading security settings…" />;

  return (
    <div>
      <AdminPageHeading
        title="Super Admin settings"
        description="Review the active privileged account and platform billing configuration."
      />
      <AdminError message={error} />
      {settings && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display font-semibold text-slate-900">Privileged account</h2>
                <p className="text-xs text-slate-500">Role and identity only; no secrets are returned.</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Name</dt><dd className="font-medium text-slate-800">{settings.admin.fullName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-800">{settings.admin.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Role</dt><dd className="font-medium text-emerald-800">{settings.admin.role}</dd></div>
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display font-semibold text-slate-900">Payment configuration</h2>
                <p className="text-xs text-slate-500">Provider secrets are never exposed in this console.</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Currency</dt><dd className="font-medium">PKR</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Online provider</dt><dd className="font-medium">{settings.paymentProviderConfigured ? "Configured" : "Not configured"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Automatic renewals</dt><dd className="font-medium">{settings.automaticRenewalsEnabled ? "Enabled" : "Disabled"}</dd></div>
            </dl>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Payment activation remains restricted to documented, server-side manual verification. No frontend success state can activate a plan.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
