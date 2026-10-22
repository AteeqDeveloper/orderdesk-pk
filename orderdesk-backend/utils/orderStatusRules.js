export const ORDER_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"];

export function getOrderStatusTransitionError(
  currentStatus,
  nextStatus,
  paymentStatus
) {
  if (!Object.hasOwn(ORDER_STATUS_TRANSITIONS, nextStatus)) {
    return "Invalid order status";
  }

  if (currentStatus === nextStatus) {
    return `Order is already ${nextStatus}`;
  }

  if (!ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    return `Cannot change order status from ${currentStatus} to ${nextStatus}`;
  }

  if (nextStatus === "cancelled" && paymentStatus !== "unpaid") {
    return "Paid orders cannot be cancelled until a verified refund is processed";
  }

  return null;
}

export function getPaymentStatusUpdateError(
  order,
  nextStatus,
  manualPaymentConfirmed
) {
  if (!PAYMENT_STATUSES.includes(nextStatus)) {
    return "Invalid payment status";
  }

  if (nextStatus === "refunded") {
    return "Refunds cannot be recorded until a verified refund workflow is available";
  }

  if (order.orderStatus === "cancelled") {
    return "Payment status cannot be changed for a cancelled order";
  }

  if (nextStatus === order.paymentStatus) {
    return `Payment is already ${nextStatus}`;
  }

  if (nextStatus === "unpaid") {
    return "A recorded payment cannot be changed back to unpaid";
  }

  if (order.paymentStatus !== "unpaid") {
    return "Only unpaid orders can be marked as paid";
  }

  if (!["COD", "Bank Transfer"].includes(order.paymentMethod)) {
    return "This payment method requires trusted payment-provider verification";
  }

  if (manualPaymentConfirmed !== true) {
    return "Confirm that you verified receipt of the payment";
  }

  return null;
}
