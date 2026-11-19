"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Package,
  PackageCheck,
  PackageX,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { getAnalyticsFilterError } from "@/lib/analytics";
import { formatPKR } from "@/lib/utils";
import { getAnalyticsOverview } from "@/services/analyticsService";
import DateFilter from "@/components/reports/DateFilter";
import ReportCard from "@/components/reports/ReportCard";
import ReportExportButton from "@/components/reports/ReportExportButton";
import SalesChart from "@/components/reports/SalesChart";
import TopProducts from "@/components/reports/TopProducts";
import ProductImage from "@/components/ui/ProductImage";

const LEGACY_PERIODS = {
  "7d": "last7days",
  "30d": "last30days",
};

const STATUSES = [
  { key: "pendingOrders", label: "Pending", icon: Clock3, tone: "warning" },
  { key: "confirmedOrders", label: "Confirmed", icon: CheckCircle2, tone: "info" },
  { key: "shippedOrders", label: "Shipped", icon: PackageCheck, tone: "info" },
  { key: "deliveredOrders", label: "Delivered", icon: ShoppingBag, tone: "success" },
  { key: "cancelledOrders", label: "Cancelled", icon: XCircle, tone: "danger" },
];

const numberValue = (value) => Number(value) || 0;
const countValue = (value) => numberValue(value).toLocaleString("en-PK");

function getFilterState(searchParams) {
  const legacyPreset = searchParams.get("datePreset");
  const period =
    searchParams.get("period") ||
    LEGACY_PERIODS[legacyPreset] ||
    (legacyPreset === "today" ? "today" : "last30days");
  const customRange =
    legacyPreset === "custom" ||
    searchParams.has("startDate") ||
    searchParams.has("endDate");

  return {
    period: customRange ? "custom" : period,
    startDate: searchParams.get("startDate") || searchParams.get("from") || "",
    endDate: searchParams.get("endDate") || searchParams.get("to") || "",
    interval: searchParams.get("interval") || "daily",
  };
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-label="Loading analytics" aria-busy="true">
      <div className="h-20 animate-pulse rounded-xl bg-ink-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl bg-ink-100"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-ink-100" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-ink-100" />
        <div className="h-64 animate-pulse rounded-xl bg-ink-100" />
      </div>
    </div>
  );
}

function EmptyPanel({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-white px-5 py-10 text-center text-sm text-ink-500">
      {children}
    </div>
  );
}

function OrderStatusSummary({ orders }) {
  const total = numberValue(orders.totalOrders);

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-ink-900">Order statistics</h2>
          <p className="mt-1 text-sm text-ink-500">
            Status counts for orders created in this period.
          </p>
        </div>
        <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-600">
          {countValue(total)} total
        </span>
      </div>
      <ul className="mt-5 space-y-4">
        {STATUSES.map(({ key, label, icon: Icon, tone }) => {
          const value = numberValue(orders[key]);
          const percent = total ? (value / total) * 100 : 0;

          return (
            <li key={key}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-ink-700">
                  <Icon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                  {label}
                </span>
                <span className="text-sm font-semibold text-ink-900">
                  {countValue(value)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full ${
                    tone === "success"
                      ? "bg-emerald-500"
                      : tone === "warning"
                        ? "bg-amber-500"
                        : tone === "danger"
                          ? "bg-rose-500"
                          : "bg-brand-500"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CustomerAnalytics({ customers }) {
  const topCustomers = customers.topSpendingCustomers || [];

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div>
        <h2 className="font-display text-base text-ink-900">Customer analytics</h2>
        <p className="mt-1 text-sm text-ink-500">
          Repeat customers and spending for the selected period.
        </p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          ["Total", customers.totalCustomers],
          ["New", customers.newCustomers],
          ["Repeat", customers.repeatCustomers],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-ink-50 p-3">
            <p className="text-xs text-ink-500">{label}</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink-900">
              {countValue(value)}
            </p>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-medium text-ink-700">
        Top customers by completed spending
      </h3>
      {topCustomers.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">
          No completed customer spending in this period.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 text-right font-medium">Orders</th>
                <th className="pb-2 text-right font-medium">Spending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {topCustomers.map((customer) => (
                <tr key={customer.customerId}>
                  <td className="py-3 font-medium text-ink-800">
                    {customer.name || "Customer"}
                  </td>
                  <td className="py-3 text-right text-ink-600">
                    {countValue(customer.completedOrders)}
                  </td>
                  <td className="py-3 text-right font-semibold text-ink-900">
                    {formatPKR(customer.completedSpending)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InventoryAnalytics({ inventory }) {
  const lowStock = inventory.lowStock?.items || [];
  const outOfStock = inventory.outOfStock?.items || [];

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-ink-900">Inventory health</h2>
          <p className="mt-1 text-sm text-ink-500">
            Active stock and cost value; variants are counted instead of parent stock.
          </p>
        </div>
        <Package className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-ink-50 p-3">
          <p className="text-xs text-ink-500">Active products</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink-900">
            {countValue(inventory.totalActiveProducts)}
          </p>
        </div>
        <div className="rounded-lg bg-ink-50 p-3">
          <p className="text-xs text-ink-500">Stock units</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink-900">
            {countValue(inventory.totalInventoryUnits)}
          </p>
        </div>
        <div className="rounded-lg bg-ink-50 p-3">
          <p className="text-xs text-ink-500">Inventory cost value</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink-900">
            {formatPKR(inventory.inventoryValue)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {[
          { label: "Low stock", items: lowStock, count: inventory.lowStock?.count },
          {
            label: "Out of stock",
            items: outOfStock,
            count: inventory.outOfStock?.count,
          },
        ].map(({ label, items, count }) => (
          <div key={label}>
            <h3 className="flex items-center justify-between text-sm font-medium text-ink-700">
              {label}
              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                {countValue(count)}
              </span>
            </h3>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">None to report.</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                {items.slice(0, 8).map((item) => (
                  <li
                    key={`${item.productId}-${item.variantId || "product"}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink-700">
                      {item.productName}
                      {item.variantName ? ` · ${item.variantName}` : ""}
                    </span>
                    {Number.isFinite(Number(item.stock)) && (
                      <span className="shrink-0 text-xs text-ink-500">
                        {countValue(item.stock)} left
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AnalyticsReports() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const filter = useMemo(
    () => getFilterState(new URLSearchParams(searchKey)),
    [searchKey]
  );
  const filterError = useMemo(() => getAnalyticsFilterError(filter), [filter]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (filterError) {
      setReport(null);
      setLoading(false);
      setError(filterError);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    getAnalyticsOverview(filter, { signal: controller.signal })
      .then((data) => setReport(data))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setReport(null);
          setError(requestError.message || "Analytics could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filter, filterError, retryKey]);

  function updateUrl(updates) {
    const params = new URLSearchParams(searchKey);
    ["datePreset", "from", "to", "period", "startDate", "endDate"].forEach(
      (key) => params.delete(key)
    );
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  }

  function selectPeriod(period) {
    if (period === "custom") {
      const params = new URLSearchParams(searchKey);
      ["period", "datePreset", "from", "to", "startDate", "endDate"].forEach(
        (key) => params.delete(key)
      );
      params.set("datePreset", "custom");
      const next = params.toString();
      router.push(next ? `${pathname}?${next}` : pathname);
      return;
    }
    updateUrl({ period });
  }

  function applyCustomRange(startDate, endDate) {
    updateUrl({ startDate, endDate });
  }

  function selectInterval(interval) {
    const params = new URLSearchParams(searchKey);
    params.set("interval", interval);
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  }

  const totals = report?.sales?.totals || {};
  const orders = report?.orders || {};
  const hasOrders = numberValue(totals.totalOrders) > 0;
  const deliveredSales = numberValue(totals.deliveredSales);
  const deliveredSalesOrders = numberValue(totals.deliveredSalesOrders);
  const averageOrderValue = deliveredSalesOrders
    ? deliveredSales / deliveredSalesOrders
    : 0;
  const period = report?.period;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-xl text-ink-900">Reports &amp; Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Seller-scoped reporting from your orders, customers, products, and inventory.
            Order trends use their creation date; comparisons are not available from the API.
          </p>
        </div>
        <ReportExportButton
          data={report}
          disabled={loading || !report}
          period={period}
        />
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
        <DateFilter
          period={filter.period}
          startDate={filter.startDate}
          endDate={filter.endDate}
          loading={loading}
          onPeriodChange={selectPeriod}
          onApplyCustom={applyCustomRange}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium hover:bg-red-100 sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              icon={TrendingUp}
              label="Delivered revenue"
              value={formatPKR(deliveredSales)}
              subtext="Delivered, non-refunded orders"
              tone="success"
            />
            <ReportCard
              icon={ShoppingBag}
              label="Total orders"
              value={countValue(totals.totalOrders)}
              subtext="All statuses in selected period"
            />
            <ReportCard
              icon={BarChart3}
              label="Average order value"
              value={formatPKR(averageOrderValue)}
              subtext="Delivered revenue / non-refunded delivered orders"
              tone="info"
            />
            <ReportCard
              icon={Users}
              label="Total customers"
              value={countValue(report.customers?.totalCustomers)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              icon={CheckCircle2}
              label="Delivered orders"
              value={countValue(orders.deliveredOrders)}
              tone="success"
            />
            <ReportCard
              icon={Clock3}
              label="Pending orders"
              value={countValue(orders.pendingOrders)}
              tone="warning"
            />
            <ReportCard
              icon={XCircle}
              label="Cancelled orders"
              value={countValue(orders.cancelledOrders)}
              tone="danger"
            />
            <ReportCard
              icon={Wallet}
              label="Paid / unpaid orders"
              value={`${countValue(totals.paidOrders)} / ${countValue(totals.unpaidOrders)}`}
              subtext="Cancelled orders excluded"
            />
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Paid amount",
                value: totals.paidAmounts,
                tone: "success",
              },
              {
                label: "Unpaid amount",
                value: totals.unpaidAmounts,
                tone: "warning",
              },
              {
                label: "Refunded amount",
                value: totals.refundedAmounts,
                tone: "danger",
              },
              {
                label: "Cancelled order amount",
                value: totals.cancelledOrderAmount,
                tone: "default",
              },
            ].map((metric) => (
              <ReportCard
                key={metric.label}
                icon={Wallet}
                label={metric.label}
                value={formatPKR(metric.value)}
                tone={metric.tone}
              />
            ))}
          </section>

          {!hasOrders && (
            <EmptyPanel>
              No orders were created during this period. Analytics below reflect
              your current customer and inventory data.
            </EmptyPanel>
          )}

          <SalesChart
            trend={report.sales?.trend || []}
            interval={filter.interval}
            onIntervalChange={selectInterval}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <TopProducts products={report.topProducts || []} />
            <OrderStatusSummary orders={orders} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CustomerAnalytics customers={report.customers || {}} />
            <InventoryAnalytics inventory={report.inventory || {}} />
          </div>
        </>
      ) : (
        <EmptyPanel>
          Analytics are unavailable until the authenticated report API responds successfully.
        </EmptyPanel>
      )}
    </div>
  );
}
