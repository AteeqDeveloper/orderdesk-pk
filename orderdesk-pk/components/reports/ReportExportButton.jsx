"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { getOrdersForExport, getDateRange } from "@/services/reportApiService";
import { formatDate } from "@/lib/utils";

/**
 * CSV export button — all encoding done in the browser, no extra npm packages.
 * Uses vanilla JS Blob + URL.createObjectURL for the download.
 */
export default function ReportExportButton({ datePreset = "30d", customFrom = "", customTo = "" }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleExport() {
    setExporting(true);
    setError("");
    setSuccess(false);

    try {
      let dateRange;
      if (datePreset === "custom") {
        dateRange = {
          from: customFrom ? new Date(customFrom).toISOString() : null,
          to: customTo ? new Date(customTo + "T23:59:59").toISOString() : null,
        };
      } else {
        dateRange = getDateRange(datePreset);
      }

      const { orders, error: fetchError } = await getOrdersForExport(dateRange);

      if (fetchError) {
        setError("Failed to fetch data for export.");
        setExporting(false);
        return;
      }

      if (orders.length === 0) {
        setError("No orders found in this date range to export.");
        setExporting(false);
        return;
      }

      // Build CSV
      const headers = [
        "Order Number",
        "Customer",
        "Order Date",
        "Total Amount (PKR)",
        "Order Status",
        "Payment Status",
        "Payment Method",
      ];

      function escapeCSV(val) {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }

      const rows = orders.map((order) => [
        escapeCSV(order.order_number),
        escapeCSV(order.customers?.name || ""),
        escapeCSV(formatDate(order.created_at)),
        escapeCSV(order.total_amount),
        escapeCSV(order.order_status),
        escapeCSV(order.payment_status),
        escapeCSV(
          order.payment_method
            ? order.payment_method.replace(/_/g, " ")
            : ""
        ),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n"
      );

      // Download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orderdesk-report-${datePreset}-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("An unexpected error occurred during export.");
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : success ? (
          <CheckCircle className="h-4 w-4 text-emerald-600" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {exporting ? "Exporting…" : success ? "Exported!" : "Export CSV"}
      </button>

      {error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
    </div>
  );
}
