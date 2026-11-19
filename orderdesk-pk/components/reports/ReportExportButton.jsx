"use client";

import { useState } from "react";
import { AlertCircle, Download } from "lucide-react";

const EXPORT_TYPES = [
  { value: "sales", label: "Sales trend" },
  { value: "orders", label: "Order status summary" },
  { value: "products", label: "Top products" },
  { value: "customers", label: "Customer summary" },
];

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function getCsvRows(type, data) {
  if (type === "sales") {
    return {
      filename: "sales",
      headers: [
        "Period (UTC)",
        "Orders",
        "Delivered Orders",
        "Delivered Revenue (PKR)",
        "Paid Orders",
        "Paid Amount (PKR)",
        "Unpaid Orders",
        "Unpaid Amount (PKR)",
        "Refunded Amount (PKR)",
        "Cancelled Orders",
        "Cancelled Amount (PKR)",
      ],
      rows: (data.sales?.trend || []).map((row) => [
        row.date,
        row.totalOrders,
        row.deliveredOrders,
        row.deliveredSales,
        row.paidOrders,
        row.paidAmounts,
        row.unpaidOrders,
        row.unpaidAmounts,
        row.refundedAmounts,
        row.cancelledOrders,
        row.cancelledOrderAmount,
      ]),
    };
  }

  if (type === "orders") {
    const orders = data.orders || {};
    return {
      filename: "orders",
      headers: ["Order Status", "Orders"],
      rows: [
        ["All statuses", orders.totalOrders],
        ["Pending", orders.pendingOrders],
        ["Confirmed", orders.confirmedOrders],
        ["Shipped", orders.shippedOrders],
        ["Delivered", orders.deliveredOrders],
        ["Cancelled", orders.cancelledOrders],
      ],
    };
  }

  if (type === "products") {
    return {
      filename: "products",
      headers: [
        "Product",
        "SKU",
        "Variant",
        "Units Sold",
        "Sales (PKR)",
        "Image URL",
      ],
      rows: (data.topProducts || []).map((product) => [
        product.name,
        product.variant?.sku || product.sku,
        [product.variant?.size, product.variant?.color]
          .filter(Boolean)
          .join(" / "),
        product.unitsSold,
        product.revenueGenerated,
        product.imageUrl,
      ]),
    };
  }

  const customers = data.customers || {};
  return {
    filename: "customers",
    headers: [
      "Record Type",
      "Customer",
      "Completed Orders",
      "Completed Spending (PKR)",
      "Total Customers",
      "New Customers",
      "Repeat Customers",
    ],
    rows: [
      [
        "Summary",
        "",
        "",
        "",
        customers.totalCustomers,
        customers.newCustomers,
        customers.repeatCustomers,
      ],
      ...(customers.topSpendingCustomers || []).map((customer) => [
        "Top spender",
        customer.name,
        customer.completedOrders,
        customer.completedSpending,
        "",
        "",
        "",
      ]),
    ],
  };
}

export default function ReportExportButton({ data, disabled, period }) {
  const [type, setType] = useState("sales");
  const [error, setError] = useState("");

  function handleExport() {
    setError("");
    if (!data) return;

    try {
      const report = getCsvRows(type, data);
      if (type === "products" && report.rows.length === 0) {
        setError("No top product data is available for this period.");
        return;
      }

      const content = [
        report.headers.map(csvCell).join(","),
        ...report.rows.map((row) => row.map(csvCell).join(",")),
      ].join("\r\n");
      const blob = new Blob([`\uFEFF${content}`], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orderdesk-${report.filename}-${period?.startDate || "report"}-to-${period?.endDate || "report"}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (exportError) {
      setError(exportError.message || "The report could not be exported.");
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="report-export-type">
          Select report to export
        </label>
        <select
          id="report-export-type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="min-w-36 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        >
          {EXPORT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
