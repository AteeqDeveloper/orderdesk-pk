import { ORDER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHODS } from "@/lib/constants";
import { mapOrder } from "@/services/orderService";
import { apiRequest } from "@/lib/api";

const CLOSED_STATUSES = ["cancelled", "returned"];

export function getDateRange(preset) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  if (preset === "today") start.setHours(0, 0, 0, 0);
  else if (preset === "7d") start.setDate(start.getDate() - 6);
  else if (preset === "30d") start.setDate(start.getDate() - 29);
  else if (preset === "3m") start.setMonth(start.getMonth() - 3);
  else return { from: null, to: null };
  if (preset !== "today") start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

function withinRange(order, { from, to }) {
  const time = new Date(order.created_at).getTime();
  return (!from || time >= new Date(from).getTime()) && (!to || time <= new Date(to).getTime());
}

function buildBuckets(from, to, preset) {
  let days = preset === "today" ? 1 : preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "3m" ? 90 : 30;
  if (preset === "custom" && from && to) {
    days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));
  }
  const buckets = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = preset === "custom" && from ? new Date(from) : new Date();
    if (!(preset === "custom" && from)) date.setDate(date.getDate() - offset);
    else date.setDate(date.getDate() + days - 1 - offset);
    date.setHours(0, 0, 0, 0);
    buckets.push({
      dateKey: date.toDateString(),
      date,
      total: 0,
      label: date.toLocaleDateString("en-PK", { day: "numeric", month: "short", ...(days <= 7 ? { weekday: "short" } : {}) }),
    });
  }
  return buckets;
}

function mapPaymentMethod(method) {
  return {
    COD: "cash_on_delivery",
    "Bank Transfer": "bank_transfer",
    JazzCash: "jazzcash",
    Easypaisa: "easypaisa",
  }[method];
}

export async function getReportData(request, dateRange, preset = "30d") {
  try {
    const [ordersResponse, customersResponse, productsResponse] = await Promise.all([
      request("orders"),
      request("customers"),
      request("products"),
    ]);
    const allOrders = (ordersResponse.orders || []).map(mapOrder);
    const orders = allOrders.filter((order) => withinRange(order, dateRange));
    const activeOrders = orders.filter((order) => !CLOSED_STATUSES.includes(order.order_status));
    const totalSales = activeOrders.reduce((total, order) => total + Number(order.total_amount || 0), 0);
    const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
    const statusCounts = Object.fromEntries(PAYMENT_STATUSES.map((status) => [status, 0]));
    const methodCounts = Object.fromEntries(PAYMENT_METHODS.map(({ value, label }) => [value, { label, count: 0, total: 0 }]));

    for (const order of orders) {
      if (counts[order.order_status] !== undefined) counts[order.order_status] += 1;
      if (statusCounts[order.payment_status] !== undefined) statusCounts[order.payment_status] += 1;
      const method = mapPaymentMethod(order.payment_method);
      if (method && methodCounts[method]) {
        methodCounts[method].count += 1;
        methodCounts[method].total += Number(order.total_amount || 0);
      }
    }

    const buckets = buildBuckets(dateRange.from, dateRange.to, preset);
    for (const order of activeOrders) {
      const bucket = buckets.find((item) => item.dateKey === new Date(order.created_at).toDateString());
      if (bucket) bucket.total += Number(order.total_amount || 0);
    }

    const topMap = new Map();
    for (const order of activeOrders) {
      for (const item of order.items || []) {
        const productId = String(item.productId || item.product_id || item.name);
        const current = topMap.get(productId) || {
          product_id: productId,
          name: item.name || "Unknown Product",
          unitsSold: 0,
          revenue: 0,
        };
        current.unitsSold += Number(item.quantity || 0);
        current.revenue += Number(item.lineTotal ?? item.line_total ?? (item.unitPrice || 0) * (item.quantity || 0));
        topMap.set(productId, current);
      }
    }

    return {
      stats: {
        totalSales,
        totalOrders: orders.length,
        deliveredOrders: orders.filter((order) => order.order_status === "delivered").length,
        pendingOrders: orders.filter((order) => order.order_status === "pending").length,
        cancelledOrders: orders.filter((order) => order.order_status === "cancelled").length,
        totalCustomers: customersResponse.customers?.length || 0,
        totalProducts: productsResponse.products?.length || 0,
      },
      chart: { buckets, error: null },
      orderStatus: { counts, total: orders.length, error: null },
      payment: { statusCounts, methodCounts, total: orders.length, error: null },
      topProducts: Array.from(topMap.values()).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
      error: null,
    };
  } catch (error) {
    return {
      stats: { totalSales: 0, totalOrders: 0, deliveredOrders: 0, pendingOrders: 0, cancelledOrders: 0, totalCustomers: 0, totalProducts: 0 },
      chart: { buckets: [], error },
      orderStatus: { counts: {}, total: 0, error },
      payment: { statusCounts: {}, methodCounts: {}, total: 0, error },
      topProducts: [],
      error,
    };
  }
}

export async function getOrdersForExport(dateRange) {
  try {
    const response = await apiRequest("orders");
    const orders = (response.orders || []).map(mapOrder).filter((order) => withinRange(order, dateRange));
    return {
      orders: orders.map((order) => ({
        ...order,
        customers: order.customers,
      })),
      error: null,
    };
  } catch (error) {
    return { orders: [], error };
  }
}
