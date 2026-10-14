import { cn } from "@/lib/utils";

const ORDER_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-sky-50 text-sky-700",
  processing: "bg-violet-50 text-violet-700",
  shipped: "bg-blue-50 text-blue-700",
  delivered: "bg-brand-50 text-brand-800",
  cancelled: "bg-ink-100 text-ink-500",
  returned: "bg-red-50 text-red-700",
};

const PAYMENT_STATUS_STYLES = {
  unpaid: "bg-red-50 text-red-700",
  partial: "bg-amber-50 text-amber-700",
  paid: "bg-brand-50 text-brand-800",
  refunded: "bg-ink-100 text-ink-500",
};

const PRODUCT_STATUS_STYLES = {
  active: "bg-brand-50 text-brand-800",
  draft: "bg-amber-50 text-amber-700",
  archived: "bg-ink-100 text-ink-500",
};

const INVENTORY_STATUS_STYLES = {
  in_stock: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  low_stock: "bg-amber-50 text-amber-700 border border-amber-200/60",
  out_of_stock: "bg-rose-50 text-rose-700 border border-rose-200/60",
};

const STYLE_MAP = {
  order: ORDER_STATUS_STYLES,
  payment: PAYMENT_STATUS_STYLES,
  product: PRODUCT_STATUS_STYLES,
  inventory: INVENTORY_STATUS_STYLES,
};

function toLabel(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export default function StatusBadge({ status, type = "order" }) {
  const styles = STYLE_MAP[type] || ORDER_STATUS_STYLES;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        styles[status] || "bg-ink-100 text-ink-500"
      )}
    >
      {toLabel(status)}
    </span>
  );
}
