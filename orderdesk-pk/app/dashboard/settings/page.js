import { Settings, Store, Mail, User, ShieldCheck } from "lucide-react";
import { getServerUser } from "@/lib/serverApi";
import DataManagement from "@/components/settings/DataManagement";

export const metadata = {
  title: "Settings — OrderDesk PK",
};

export default async function SettingsPage() {
  const user = await getServerUser();
  const profile = {
    business_name: user?.businessName,
    full_name: user?.fullName,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Manage your business profile and preferences.
        </p>
      </div>

      {/* Business Details */}
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base text-ink-900">
              Business Profile
            </h2>
            <p className="text-xs text-ink-400">
              Your registered store identity
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-ink-50/70 p-3.5">
            <dt className="text-xs font-medium text-ink-400">Business Name</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">
              {profile?.business_name || "Not set"}
            </dd>
          </div>
          <div className="rounded-lg bg-ink-50/70 p-3.5">
            <dt className="text-xs font-medium text-ink-400">Owner Name</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">
              {profile?.full_name || "Not set"}
            </dd>
          </div>
          <div className="rounded-lg bg-ink-50/70 p-3.5">
            <dt className="text-xs font-medium text-ink-400">Account Email</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900 truncate">
              {user?.email}
            </dd>
          </div>
          <div className="rounded-lg bg-ink-50/70 p-3.5">
            <dt className="text-xs font-medium text-ink-400">Currency</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">
              Pakistani Rupee (PKR)
            </dd>
          </div>
        </dl>
      </div>

      {/* Regional & Payment Settings */}
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base text-ink-900">
              Payments & Regional Settings
            </h2>
            <p className="text-xs text-ink-400">
              Supported payment methods for Pakistan
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 text-sm">
            <span className="font-medium text-ink-800">Cash on Delivery (COD)</span>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
              Enabled
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 text-sm">
            <span className="font-medium text-ink-800">JazzCash & EasyPaisa</span>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
              Enabled
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 text-sm">
            <span className="font-medium text-ink-800">Bank Transfer</span>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
              Enabled
            </span>
          </div>
        </div>
      </div>

      <DataManagement />
    </div>
  );
}
