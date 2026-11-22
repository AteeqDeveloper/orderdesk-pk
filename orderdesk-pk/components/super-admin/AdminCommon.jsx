import { LoaderCircle } from "lucide-react";

export function AdminPageHeading({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-950">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function AdminLoading({ label = "Loading platform data…" }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function AdminError({ message }) {
  return message ? (
    <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </p>
  ) : null;
}

export function AdminNotice({ message }) {
  return message ? (
    <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {message}
    </p>
  ) : null;
}

export function AdminEmpty({ children = "No records found." }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function AdminPagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-slate-500">
        Page {pagination.page} of {pagination.pages} · {pagination.total} records
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.pages}
          onClick={() => onPageChange(pagination.page + 1)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export const formatAdminDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-PK", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";

export const formatAdminMoney = (value, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);

export const adminInputClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export const adminButtonClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg bg-slate-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
