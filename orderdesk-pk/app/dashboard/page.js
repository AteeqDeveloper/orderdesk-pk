import { Receipt, Wallet, Users, PackageX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardStats,
  getRecentOrders,
  getOrderStatusSummary,
  getSalesOverview,
} from "@/services/dashboardService";
import StatCard from "@/components/dashboard/StatCard";
import SalesOverview from "@/components/dashboard/SalesOverview";
import OrderStatusSummary from "@/components/dashboard/OrderStatusSummary";
import RecentOrders from "@/components/dashboard/RecentOrders";
import QuickActions from "@/components/dashboard/QuickActions";
import { formatPKR } from "@/lib/utils";

export const metadata = {
  title: "Dashboard — OrderDesk PK",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [stats, recent, statusSummary, salesOverview] = await Promise.all([
    getDashboardStats(supabase, user.id),
    getRecentOrders(supabase, user.id),
    getOrderStatusSummary(supabase, user.id),
    getSalesOverview(supabase, user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-500">
          Here&apos;s how your shop is doing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Receipt} label="Total orders" value={stats.totalOrders} />
        <StatCard
          icon={Wallet}
          label="Total sales"
          value={formatPKR(stats.totalSales)}
        />
        <StatCard icon={Users} label="Total customers" value={stats.totalCustomers} />
        <StatCard
          icon={PackageX}
          label="Low stock products"
          value={stats.lowStockCount}
          tone={stats.lowStockCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SalesOverview days={salesOverview.days} />
          <RecentOrders orders={recent.orders} />
        </div>

        <div className="space-y-6">
          <QuickActions />
          <OrderStatusSummary counts={statusSummary.counts} />
        </div>
      </div>
    </div>
  );
}
