import { ORDER_STATUSES } from "@/lib/constants";

const CLOSED_STATUSES = ["cancelled", "returned"];

/**
 * All functions here take an already-created Supabase client (server or
 * browser) plus the current user's id, and return plain data — no UI
 * concerns. RLS already scopes rows to the signed-in user; the explicit
 * `user_id` filters below are kept for clarity and query efficiency.
 */

export async function getDashboardStats(supabase, userId) {
  const [ordersResult, customersResult, productsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total_amount, order_status")
      .eq("user_id", userId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("products")
      .select("id, stock, low_stock_threshold, status")
      .eq("user_id", userId),
  ]);

  const orders = ordersResult.data || [];
  const products = productsResult.data || [];

  const totalOrders = orders.length;

  const totalSales = orders
    .filter((order) => !CLOSED_STATUSES.includes(order.order_status))
    .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  const lowStockCount = products.filter(
    (product) =>
      product.status !== "archived" &&
      Number(product.stock) <= Number(product.low_stock_threshold ?? 0)
  ).length;

  return {
    totalOrders,
    totalSales,
    totalCustomers: customersResult.count || 0,
    lowStockCount,
    error: ordersResult.error || customersResult.error || productsResult.error || null,
  };
}

export async function getRecentOrders(supabase, userId, limit = 5) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, total_amount, order_status, payment_status, created_at, customers(name)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { orders: data || [], error };
}

export async function getOrderStatusSummary(supabase, userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("order_status")
    .eq("user_id", userId);

  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
  (data || []).forEach((order) => {
    if (counts[order.order_status] !== undefined) {
      counts[order.order_status] += 1;
    }
  });

  return { counts, error };
}

export async function getSalesOverview(supabase, userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("orders")
    .select("total_amount, order_status, created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    buckets.push({ dateKey: date.toDateString(), date, total: 0 });
  }

  (data || []).forEach((order) => {
    if (CLOSED_STATUSES.includes(order.order_status)) return;
    const orderDateKey = new Date(order.created_at).toDateString();
    const bucket = buckets.find((b) => b.dateKey === orderDateKey);
    if (bucket) bucket.total += Number(order.total_amount) || 0;
  });

  return { days: buckets, error };
}
