import { Package, Boxes, AlertTriangle, AlertOctagon, CircleDollarSign } from "lucide-react";
import { formatPKR, cn } from "@/lib/utils";

export default function InventoryDashboard({ stats }) {
  const {
    totalProducts = 0,
    totalStockUnits = 0,
    lowStockCount = 0,
    lowStockVariantCount = 0,
    outOfStockCount = 0,
    totalInventoryValue = 0,
  } = stats || {};

  const cards = [
    {
      label: "Total Products",
      value: totalProducts.toLocaleString(),
      icon: Package,
      tone: "default",
      color: "text-brand-700 bg-brand-50 border-brand-100",
    },
    {
      label: "Total Stock Units",
      value: totalStockUnits.toLocaleString(),
      icon: Boxes,
      tone: "default",
      color: "text-blue-700 bg-blue-50 border-blue-100",
    },
    {
      label: "Low Stock Products",
      value: lowStockCount.toLocaleString(),
      icon: AlertTriangle,
      tone: lowStockCount > 0 ? "warning" : "default",
      color: lowStockCount > 0 
        ? "text-amber-700 bg-amber-50 border-amber-200" 
        : "text-ink-600 bg-ink-50 border-ink-100",
    },
    {
      label: "Low Stock Variants",
      value: lowStockVariantCount.toLocaleString(),
      icon: AlertTriangle,
      tone: lowStockVariantCount > 0 ? "warning" : "default",
      color:
        lowStockVariantCount > 0
          ? "text-amber-700 bg-amber-50 border-amber-200"
          : "text-ink-600 bg-ink-50 border-ink-100",
    },
    {
      label: "Out of Stock Products",
      value: outOfStockCount.toLocaleString(),
      icon: AlertOctagon,
      tone: outOfStockCount > 0 ? "danger" : "default",
      color: outOfStockCount > 0 
        ? "text-rose-700 bg-rose-50 border-rose-200" 
        : "text-ink-600 bg-ink-50 border-ink-100",
    },
    {
      label: "Total Inventory Value",
      value: formatPKR(totalInventoryValue),
      subtext: "stock × cost price",
      icon: CircleDollarSign,
      tone: "default",
      color: "text-emerald-700 bg-emerald-50 border-emerald-100",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex flex-col justify-between rounded-xl border border-ink-100 bg-white p-5 shadow-card transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
                {card.label}
              </span>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  card.color
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-3">
              <p
                className={cn(
                  "font-display text-2xl font-bold tracking-tight",
                  card.tone === "danger" && "text-rose-600",
                  card.tone === "warning" && "text-amber-600",
                  card.tone === "default" && "text-ink-900"
                )}
              >
                {card.value}
              </p>
              {card.subtext && (
                <p className="mt-1 text-[11px] text-ink-400">{card.subtext}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
