import { ORDER_STATUSES } from "@/lib/constants";
import { mapOrder } from "@/services/orderService";

export async function getDashboardData(request, days = 7) {
  try {
    const [dashboardResponse, ordersResponse, customersResponse, inventoryResponse] =
      await Promise.all([
        request("dashboard"),
        request("orders"),
        request("customers"),
        request("inventory/summary"),
      ]);
    const dashboard = dashboardResponse.data || {};
    const orders = (ordersResponse.orders || []).map(mapOrder);
    const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
    orders.forEach((order) => {
      if (counts[order.order_status] !== undefined) counts[order.order_status] += 1;
    });

    const salesDays = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      date.setHours(0, 0, 0, 0);
      salesDays.push({ dateKey: date.toDateString(), date, total: 0 });
    }
    orders.forEach((order) => {
      if (order.order_status === "cancelled") return;
      const day = salesDays.find((bucket) => bucket.dateKey === new Date(order.created_at).toDateString());
      if (day) day.total += Number(order.total_amount) || 0;
    });

    return {
      stats: {
        totalOrders: dashboard.summary?.totalOrders ?? orders.length,
        totalSales: dashboard.summary?.totalSales ?? 0,
        totalCustomers: customersResponse.customers?.length ?? 0,
        lowStockCount: inventoryResponse.data?.lowStockCount ?? 0,
      },
      recent: { orders: orders.slice(0, 5) },
      statusSummary: { counts },
      salesOverview: { days: salesDays },
      error: null,
    };
  } catch (error) {
    return {
      stats: { totalOrders: 0, totalSales: 0, totalCustomers: 0, lowStockCount: 0 },
      recent: { orders: [] },
      statusSummary: { counts: Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) },
      salesOverview: { days: [] },
      error,
    };
  }
}
