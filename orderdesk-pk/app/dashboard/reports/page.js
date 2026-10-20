import { Suspense } from "react";
import {
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Package,
  BarChart3,
} from "lucide-react";
import { serverApiRequest } from "@/lib/serverApi";
import { getDateRange, getReportData } from "@/services/reportApiService";
import ReportCard from "@/components/reports/ReportCard";
import SalesChart from "@/components/reports/SalesChart";
import OrderStatusReport from "@/components/reports/OrderStatusReport";
import PaymentReport from "@/components/reports/PaymentReport";
import TopProducts from "@/components/reports/TopProducts";
import DateFilter from "@/components/reports/DateFilter";
import ReportExportButton from "@/components/reports/ReportExportButton";
import { formatPKR } from "@/lib/utils";

export const metadata = {
  title: "Reports & Analytics — OrderDesk PK",
  description: "Business insights, revenue summaries, order performance and payment analytics.",
};

export default async function ReportsPage({ searchParams }) {
  // Read date parameters from URL
  const datePreset = searchParams?.datePreset || "30d";
  const customFrom = searchParams?.from || "";
  const customTo = searchParams?.to || "";
  const sortBy = searchParams?.sortBy || "unitsSold";

  // Compute date range for all queries
  let dateRange;
  if (datePreset === "custom") {
    dateRange = {
      from: customFrom ? new Date(customFrom + "T00:00:00").toISOString() : null,
      to: customTo ? new Date(customTo + "T23:59:59").toISOString() : null,
    };
  } else {
    dateRange = getDateRange(datePreset);
  }

  const report = await getReportData(serverApiRequest, dateRange, datePreset);
  const statsResult = report.stats;
  const chartResult = report.chart;
  const orderStatusResult = report.orderStatus;
  const paymentResult = report.payment;
  const topProductsResult = { products: report.topProducts };

  // Sort top products client-side based on sortBy
  const sortedTopProducts =
    sortBy === "revenue"
      ? [...(topProductsResult.products || [])].sort((a, b) => b.revenue - a.revenue)
      : topProductsResult.products || [];

  const avgDeliveredOrderValue =
    statsResult.deliveredOrders > 0
      ? statsResult.totalSales / statsResult.deliveredOrders
      : 0;

  const hasError =
    report.error;

  const dateLabel = {
    today: "Today",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "3m": "Last 3 Months",
    all: "All Time",
    custom: customFrom && customTo ? `${customFrom} → ${customTo}` : "Custom Range",
  }[datePreset] || "Selected Period";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-xl text-ink-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-ink-500">
            Business insights for <span className="font-medium text-ink-700">{dateLabel}</span>.
            Sales include delivered orders only; pending and other undelivered orders are excluded.
          </p>
        </div>

        {/* Export button */}
        <ReportExportButton
          datePreset={datePreset}
          customFrom={customFrom}
          customTo={customTo}
        />
      </div>

      {/* Date Filter */}
      <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
        <Suspense>
          <DateFilter />
        </Suspense>
      </div>

      {/* Error Banner */}
      {hasError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          Some report data couldn&apos;t be loaded. Please refresh the page.
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard
          icon={TrendingUp}
          label="Delivered Sales"
          value={formatPKR(statsResult.totalSales)}
          subtext="Orders marked delivered"
          tone="success"
        />
        <ReportCard
          icon={ShoppingBag}
          label="Total Orders"
          value={statsResult.totalOrders.toLocaleString()}
          tone="default"
        />
        <ReportCard
          icon={BarChart3}
          label="Avg. Delivered Order"
          value={formatPKR(avgDeliveredOrderValue)}
          subtext="Delivered sales / delivered orders"
          tone="info"
        />
        <ReportCard
          icon={Users}
          label="Total Customers"
          value={statsResult.totalCustomers.toLocaleString()}
          tone="default"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ReportCard
          icon={CheckCircle2}
          label="Delivered Orders"
          value={statsResult.deliveredOrders.toLocaleString()}
          tone="success"
        />
        <ReportCard
          icon={Clock}
          label="Pending Orders"
          value={statsResult.pendingOrders.toLocaleString()}
          tone="warning"
        />
        <ReportCard
          icon={XCircle}
          label="Cancelled Orders"
          value={statsResult.cancelledOrders.toLocaleString()}
          tone="danger"
        />
      </div>

      {/* Sales Chart + Sort Controls */}
      <div className="space-y-3">
        <SalesChart buckets={chartResult.buckets || []} preset={datePreset} />
      </div>

      {/* Top Products + Order Status side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products with sort toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-700">Top Products</h2>
            <div className="flex gap-1.5">
              <a
                href={`?datePreset=${datePreset}&sortBy=unitsSold${customFrom ? `&from=${customFrom}` : ""}${customTo ? `&to=${customTo}` : ""}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortBy !== "revenue"
                    ? "bg-brand-700 text-white"
                    : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                }`}
              >
                By Units
              </a>
              <a
                href={`?datePreset=${datePreset}&sortBy=revenue${customFrom ? `&from=${customFrom}` : ""}${customTo ? `&to=${customTo}` : ""}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortBy === "revenue"
                    ? "bg-brand-700 text-white"
                    : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                }`}
              >
                By Revenue
              </a>
            </div>
          </div>
          <TopProducts products={sortedTopProducts} sortBy={sortBy} />
        </div>

        {/* Order Status Report */}
        <OrderStatusReport
          counts={orderStatusResult.counts || {}}
          total={orderStatusResult.total || 0}
        />
      </div>

      {/* Payment Report */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentReport
          statusCounts={paymentResult.statusCounts || {}}
          methodCounts={paymentResult.methodCounts || {}}
          total={paymentResult.total || 0}
        />

        {/* Products quick-stat */}
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="font-display text-base text-ink-900">Product Catalog</h2>
          <p className="mt-0.5 text-sm text-ink-500">Total products in your store</p>
          <div className="mt-6 flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <Package className="h-7 w-7 text-brand-700" />
            </span>
            <p className="font-display text-4xl font-bold text-ink-900">
              {statsResult.totalProducts.toLocaleString()}
            </p>
          </div>
          <p className="mt-4 text-xs text-ink-400">
            Product count is not filtered by date range.
          </p>
        </div>
      </div>
    </div>
  );
}
