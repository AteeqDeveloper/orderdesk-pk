/**
 * reportService.js
 *
 * All report data queries. Functions accept an authenticated Supabase
 * client and a user_id. Data is always scoped to the authenticated user.
 *
 * Sales calculation rule (matches dashboardService):
 *   Cancelled and Returned orders are EXCLUDED from revenue totals.
 *   All other statuses (pending, confirmed, processing, shipped, delivered)
 *   are INCLUDED so sellers can see their full pipeline value.
 *
 * Order items revenue: uses order_items.total when available,
 *   falls back to order_items.price * order_items.quantity.
 */

import { ORDER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHODS } from "@/lib/constants";

const CLOSED_STATUSES = ["cancelled", "returned"];

// ─── Date range helpers ────────────────────────────────────────────────────

/**
 * Returns { from, to } ISO strings for a preset range key.
 * "all" returns { from: null, to: null } meaning no date filter.
 */
export function getDateRange(preset) {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  switch (preset) {
    case "today": {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      return { from: startOfDay.toISOString(), to: endOfDay.toISOString() };
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return { from: d.toISOString(), to: endOfDay.toISOString() };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      d.setHours(0, 0, 0, 0);
      return { from: d.toISOString(), to: endOfDay.toISOString() };
    }
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      d.setHours(0, 0, 0, 0);
      return { from: d.toISOString(), to: endOfDay.toISOString() };
    }
    default:
      return { from: null, to: null };
  }
}

// ─── Report Summary Stats ──────────────────────────────────────────────────

export async function getReportStats(supabase, userId, dateRange = {}) {
  const { from, to } = dateRange;

  // Build order query
  let ordersQuery = supabase
    .from("orders")
    .select("id, total_amount, order_status, payment_status")
    .eq("user_id", userId);

  if (from) ordersQuery = ordersQuery.gte("created_at", from);
  if (to) ordersQuery = ordersQuery.lte("created_at", to);

  const [ordersResult, customersResult, productsResult] = await Promise.all([
    ordersQuery,
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const orders = ordersResult.data || [];

  // Total sales excludes cancelled/returned
  const totalSales = orders
    .filter((o) => !CLOSED_STATUSES.includes(o.order_status))
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const totalOrders = orders.length;

  const deliveredOrders = orders.filter(
    (o) => o.order_status === "delivered"
  ).length;

  const pendingOrders = orders.filter(
    (o) => o.order_status === "pending"
  ).length;

  const cancelledOrders = orders.filter(
    (o) => o.order_status === "cancelled"
  ).length;

  return {
    totalSales,
    totalOrders,
    deliveredOrders,
    pendingOrders,
    cancelledOrders,
    totalCustomers: customersResult.count || 0,
    totalProducts: productsResult.count || 0,
    error: ordersResult.error || customersResult.error || productsResult.error || null,
  };
}

// ─── Sales Over Time (for chart) ───────────────────────────────────────────

/**
 * Returns an array of { label, date, total } bucketed by day.
 * Only non-closed orders contribute to revenue.
 */
export async function getSalesChartData(supabase, userId, preset = "7d", customRange = {}) {
  let from, to;

  if (preset === "custom") {
    from = customRange.from || null;
    to = customRange.to || null;
  } else {
    ({ from, to } = getDateRange(preset));
  }

  let query = supabase
    .from("orders")
    .select("total_amount, order_status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  const orders = data || [];

  // Determine bucket count and labels
  const buckets = buildDayBuckets(from, to, preset);

  for (const order of orders) {
    if (CLOSED_STATUSES.includes(order.order_status)) continue;
    const orderDay = new Date(order.created_at).toDateString();
    const bucket = buckets.find((b) => b.dateKey === orderDay);
    if (bucket) {
      bucket.total += Number(order.total_amount) || 0;
    }
  }

  return { buckets, error };
}

function buildDayBuckets(from, to, preset) {
  // Number of days to show
  let days;
  if (preset === "today") days = 1;
  else if (preset === "7d") days = 7;
  else if (preset === "30d") days = 30;
  else if (preset === "3m") days = 90;
  else {
    // "all" or custom: compute from range or default 30
    if (from && to) {
      const diff =
        (new Date(to).getTime() - new Date(from).getTime()) /
        (1000 * 60 * 60 * 24);
      days = Math.max(1, Math.ceil(diff));
    } else {
      days = 30;
    }
  }

  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push({
      dateKey: d.toDateString(),
      date: new Date(d),
      total: 0,
      label:
        days <= 7
          ? d.toLocaleDateString("en-PK", { weekday: "short" })
          : days <= 30
          ? d.toLocaleDateString("en-PK", { day: "numeric", month: "short" })
          : d.toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
    });
  }

  return buckets;
}

// ─── Order Status Summary ──────────────────────────────────────────────────

export async function getOrderStatusReport(supabase, userId, dateRange = {}) {
  const { from, to } = dateRange;

  let query = supabase
    .from("orders")
    .select("order_status")
    .eq("user_id", userId);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;

  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const order of data || []) {
    if (counts[order.order_status] !== undefined) {
      counts[order.order_status] += 1;
    }
  }

  return { counts, total: (data || []).length, error };
}

// ─── Payment Status Summary ────────────────────────────────────────────────

export async function getPaymentReport(supabase, userId, dateRange = {}) {
  const { from, to } = dateRange;

  let query = supabase
    .from("orders")
    .select("payment_status, payment_method, total_amount")
    .eq("user_id", userId);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  const orders = data || [];

  // Payment status counts
  const statusCounts = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0]));
  for (const order of orders) {
    if (statusCounts[order.payment_status] !== undefined) {
      statusCounts[order.payment_status] += 1;
    }
  }

  // Payment method breakdown
  const methodCounts = {};
  for (const m of PAYMENT_METHODS) {
    methodCounts[m.value] = { label: m.label, count: 0, total: 0 };
  }
  for (const order of orders) {
    const key = order.payment_method;
    if (key && methodCounts[key]) {
      methodCounts[key].count += 1;
      methodCounts[key].total += Number(order.total_amount) || 0;
    }
  }

  return { statusCounts, methodCounts, total: orders.length, error };
}

// ─── Top Selling Products ──────────────────────────────────────────────────

/**
 * Joins order_items → orders (to apply date filter + user filter).
 * Uses order_items.quantity for units, order_items.total for revenue
 * (falls back to order_items.price * order_items.quantity).
 * Only includes items from non-closed orders.
 */
export async function getTopProducts(supabase, userId, dateRange = {}, limit = 10) {
  const { from, to } = dateRange;

  // Fetch orders in range to get their IDs
  let ordersQuery = supabase
    .from("orders")
    .select("id, order_status")
    .eq("user_id", userId)
    .not("order_status", "in", `(${CLOSED_STATUSES.join(",")})`);

  if (from) ordersQuery = ordersQuery.gte("created_at", from);
  if (to) ordersQuery = ordersQuery.lte("created_at", to);

  const { data: ordersData, error: ordersError } = await ordersQuery;
  if (ordersError) return { products: [], error: ordersError };

  const orderIds = (ordersData || []).map((o) => o.id);
  if (orderIds.length === 0) return { products: [], error: null };

  // Fetch order items for those orders
  const { data: itemsData, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, quantity, price, total, products(name)")
    .in("order_id", orderIds);

  if (itemsError) return { products: [], error: itemsError };

  // Aggregate by product
  const map = {};
  for (const item of itemsData || []) {
    const id = item.product_id;
    if (!id) continue;
    const revenue =
      Number(item.total) || Number(item.price) * (Number(item.quantity) || 0);
    const units = Number(item.quantity) || 0;

    if (map[id]) {
      map[id].unitsSold += units;
      map[id].revenue += revenue;
    } else {
      map[id] = {
        product_id: id,
        name: item.products?.name || "Unknown Product",
        unitsSold: units,
        revenue,
      };
    }
  }

  const products = Object.values(map)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);

  return { products, error: null };
}

// ─── Orders export data ────────────────────────────────────────────────────

/**
 * Returns raw order rows suitable for CSV export.
 * No CSV encoding is done here — that happens client-side to keep
 * this file dependency-free.
 */
export async function getOrdersForExport(supabase, userId, dateRange = {}) {
  const { from, to } = dateRange;

  let query = supabase
    .from("orders")
    .select(
      "order_number, total_amount, order_status, payment_status, payment_method, created_at, customers(name)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  return { orders: data || [], error };
}
