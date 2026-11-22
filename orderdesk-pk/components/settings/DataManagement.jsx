"use client";

import { useState } from "react";
import {
  Archive,
  Boxes,
  Download,
  FileSpreadsheet,
  History,
  Package,
  ShoppingCart,
  Upload,
  Users,
} from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Input from "@/components/ui/Input";
import {
  downloadDataFile,
  uploadBackupFile,
} from "@/services/dataManagementService";

const EXPORTS = [
  { type: "products", title: "Products", description: "Products, pricing, and stock.", icon: Package },
  { type: "customers", title: "Customers", description: "Customer contact and address details.", icon: Users },
  { type: "orders", title: "Orders", description: "Order items, payments, and delivery status.", icon: ShoppingCart },
  { type: "inventory", title: "Inventory", description: "Current product and variant stock levels.", icon: Boxes },
  { type: "variants", title: "Variants", description: "Variant pricing, SKU, and stock details.", icon: FileSpreadsheet },
  { type: "activity-logs", title: "Activity logs", description: "Business activity history.", icon: History },
  { type: "sales-reports", title: "Sales reports", description: "Order sales and delivered revenue, excluding refunds.", icon: Archive },
];

const MAX_BACKUP_SIZE = 10 * 1024 * 1024;

export default function DataManagement() {
  const [format, setFormat] = useState("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loadingExport, setLoadingExport] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const exportRows = async (type) => {
    setError("");
    setMessage("");
    if (Boolean(startDate) !== Boolean(endDate)) {
      setError("Choose both a start and end date, or leave both empty.");
      return;
    }
    if (startDate && startDate > endDate) {
      setError("Start date must be on or before end date.");
      return;
    }
    setLoadingExport(type);
    try {
      const query = new URLSearchParams({ format });
      if (startDate) query.set("startDate", startDate);
      if (endDate) query.set("endDate", endDate);
      await downloadDataFile(
        `data-management/exports/${type}?${query.toString()}`
      );
      setMessage(`${type.replaceAll("-", " ")} download started.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingExport("");
    }
  };

  const downloadBackup = async () => {
    setError("");
    setMessage("");
    setBackupLoading(true);
    try {
      await downloadDataFile("data-management/backup");
      setMessage("Your account backup download has started.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const inspectBackup = async (file) => {
    setError("");
    setMessage("");
    setPreview(null);
    setSelectedFile(file);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Choose a JSON backup file.");
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_BACKUP_SIZE) {
      setError("Backup files must be 10 MB or smaller.");
      setSelectedFile(null);
      return;
    }
    setRestoreLoading(true);
    try {
      const response = await uploadBackupFile(
        "data-management/backup/validate",
        file
      );
      setPreview(response.data);
    } catch (requestError) {
      setError(requestError.message);
      setSelectedFile(null);
    } finally {
      setRestoreLoading(false);
    }
  };

  const restoreBackup = async () => {
    if (!selectedFile) return;
    setError("");
    setRestoreLoading(true);
    try {
      const response = await uploadBackupFile(
        "data-management/backup/restore",
        selectedFile
      );
      const { products, customers, orders } = response.data.restored;
      setMessage(
        `Restore complete: ${products} products, ${customers} customers, and ${orders} orders added. Existing records were preserved.`
      );
      setPreview(null);
      setSelectedFile(null);
      setConfirmOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="data-management-title">
      <div>
        <h2
          id="data-management-title"
          className="font-display text-lg text-ink-900"
        >
          Data Management
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Export business records or create and restore an account backup.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {message}
        </p>
      )}

      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-base text-ink-900">Export data</h3>
            <p className="mt-1 text-sm text-ink-500">
              CSV files are streamed from the server and include only business data.
            </p>
          </div>
          <label className="block text-sm font-medium text-ink-700">
            Format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm sm:w-56"
            >
              <option value="csv">CSV (.csv)</option>
              <option value="xlsx" disabled>
                Excel (.xlsx) - not installed
              </option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-ink-700">
            Start date
            <Input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium text-ink-700">
            End date
            <Input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-400">
          Leave both dates empty to export all records. Date filters use record creation dates.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {EXPORTS.map(({ type, title, description, icon: Icon }) => (
            <div
              key={type}
              className="flex items-start justify-between gap-3 rounded-lg border border-ink-100 p-4"
            >
              <div className="flex gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
                <div>
                  <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
                  <p className="mt-1 text-xs leading-5 text-ink-500">{description}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="shrink-0 px-3"
                onClick={() => exportRows(type)}
                loading={loadingExport === type}
                disabled={Boolean(loadingExport && loadingExport !== type)}
                aria-label={`Export ${title} as CSV`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-brand-700" aria-hidden="true" />
            <h3 className="font-display text-base text-ink-900">Download backup</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            Creates a versioned JSON file with products (including variants and stock),
            customers, orders, and business name and phone settings.
          </p>
          <p className="mt-2 text-xs text-ink-400">
            Passwords, authentication tokens, and credentials are never included.
          </p>
          <Button className="mt-4" onClick={downloadBackup} loading={backupLoading}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download JSON backup
          </Button>
        </div>

        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-brand-700" aria-hidden="true" />
            <h3 className="font-display text-base text-ink-900">Restore backup</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            Preview a backup before merging records into this account. Only backups
            created for your account are accepted; existing records are never overwritten.
          </p>
          <label className="mt-4 block text-sm font-medium text-ink-700">
            JSON backup file (up to 10 MB)
            <Input
              type="file"
              accept=".json,application/json"
              className="mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={(event) => inspectBackup(event.target.files?.[0] || null)}
              disabled={restoreLoading}
            />
          </label>
          {restoreLoading && (
            <p role="status" className="mt-3 text-sm text-ink-500">Validating backup...</p>
          )}
          {preview && (
            <div className="mt-4 rounded-lg bg-ink-50 p-4">
              <h4 className="text-sm font-semibold text-ink-900">Backup preview</h4>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-ink-600">
                <dt>Products</dt><dd className="text-right">{preview.counts.products} ({preview.toRestore.products} new)</dd>
                <dt>Customers</dt><dd className="text-right">{preview.counts.customers} ({preview.toRestore.customers} new)</dd>
                <dt>Orders</dt><dd className="text-right">{preview.counts.orders} ({preview.toRestore.orders} new)</dd>
                <dt>Already present</dt>
                <dd className="text-right">
                  {preview.skipped.products + preview.skipped.customers + preview.skipped.orders}
                </dd>
              </dl>
              {preview.settingsWillBeFilled && (
                <p className="mt-2 text-xs text-ink-500">
                  Blank business name or phone settings may be filled; existing values stay unchanged.
                </p>
              )}
              <Button
                className="mt-4"
                onClick={() => setConfirmOpen(true)}
                disabled={preview.toRestore.products + preview.toRestore.customers + preview.toRestore.orders === 0 && !preview.settingsWillBeFilled}
              >
                Review and restore
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Merge this backup?"
        description={`This will add ${preview?.toRestore.products || 0} products, ${preview?.toRestore.customers || 0} customers, and ${preview?.toRestore.orders || 0} orders. Records already present will be skipped; existing data will not be replaced.`}
        confirmLabel="Merge backup"
        loading={restoreLoading}
        onConfirm={restoreBackup}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
