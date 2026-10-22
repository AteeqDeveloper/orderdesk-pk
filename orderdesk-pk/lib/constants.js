export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

export const ORDER_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"];

export const PAYMENT_METHODS = [
  { value: "cash_on_delivery", label: "Cash on Delivery" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export const PAKISTANI_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Hyderabad",
];

export const PRODUCT_STATUSES = ["active", "inactive"];

// Shown as <datalist> suggestions on the variant form — the columns stay
// free text (variant_name/variant_value) so sellers aren't boxed in, but
// these cover the common Size/Color case without extra typing.
export const VARIANT_NAME_SUGGESTIONS = ["Size", "Color"];
export const VARIANT_VALUE_SUGGESTIONS = [
  "Small",
  "Medium",
  "Large",
  "Black",
  "White",
  "Blue",
];

export const INVENTORY_STATUSES = [
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];
