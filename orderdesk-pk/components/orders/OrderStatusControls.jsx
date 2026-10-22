"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import Select from "@/components/ui/Select";
import { ORDER_STATUS_TRANSITIONS } from "@/lib/constants";
import {
  updateOrderStatus,
  updatePaymentStatus,
} from "@/services/orderService";

const ORDER_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-sky-50 text-sky-700",
  shipped: "bg-blue-50 text-blue-700",
  delivered: "bg-brand-50 text-brand-800",
  cancelled: "bg-ink-100 text-ink-500",
};

const PAYMENT_STATUS_STYLES = {
  unpaid: "bg-red-50 text-red-700",
  paid: "bg-brand-50 text-brand-800",
  refunded: "bg-ink-100 text-ink-500",
};

export default function OrderStatusControls({ order }) {
  const router = useRouter();
  const requestLock = useRef(false);
  const [orderStatus, setOrderStatus] = useState(order.order_status);
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const allowedNextStatuses = (
    ORDER_STATUS_TRANSITIONS[orderStatus] || []
  ).filter(
    (status) =>
      status !== "cancelled" ||
      (paymentStatus === "unpaid" && orderStatus !== "delivered")
  );
  const canManuallyConfirmPayment = ["COD", "Bank Transfer"].includes(
    order.payment_method
  );

  async function saveStatus(kind, value, manualPaymentConfirmed = false) {
    if (requestLock.current) return;

    const previousValue = kind === "order" ? orderStatus : paymentStatus;
    requestLock.current = true;
    setUpdating(true);
    setFeedback(null);
    if (kind === "order") setOrderStatus(value);
    else setPaymentStatus(value);

    try {
      const result =
        kind === "order"
          ? await updateOrderStatus(order.id, value)
          : await updatePaymentStatus(
              order.id,
              value,
              manualPaymentConfirmed
            );
      if (result.error) throw result.error;
      if (!result.order) throw new Error("The order update returned no order.");

      setFeedback({
        type: "success",
        text: kind === "order" ? "Order status updated." : "Payment status updated.",
      });
      router.refresh();
    } catch (error) {
      if (kind === "order") setOrderStatus(previousValue);
      else setPaymentStatus(previousValue);
      setFeedback({
        type: "error",
        text: error.message || "Could not update this order.",
      });
    } finally {
      requestLock.current = false;
      setUpdating(false);
    }
  }

  function handleOrderStatusChange(event) {
    const nextStatus = event.target.value;
    if (
      nextStatus === "cancelled" &&
      !window.confirm(
        "Cancel this order? Its stock will be restored once. Paid and delivered orders cannot be cancelled."
      )
    ) {
      return;
    }
    saveStatus("order", nextStatus);
  }

  function handlePaymentStatusChange(event) {
    const nextStatus = event.target.value;
    if (
      nextStatus === "paid" &&
      !window.confirm(
        "Confirm that you verified receipt of this COD or bank-transfer payment outside OrderDesk."
      )
    ) {
      return;
    }
    saveStatus("payment", nextStatus, nextStatus === "paid");
  }

  const paymentControlDisabled =
    updating ||
    orderStatus === "cancelled" ||
    paymentStatus !== "unpaid" ||
    !canManuallyConfirmPayment;

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
      <h2 className="font-display text-base text-ink-900">Update order</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`order-status-${order.id}`}
            className="mb-1.5 block text-xs font-medium text-ink-500"
          >
            Order status
          </label>
          <Select
            id={`order-status-${order.id}`}
            value={orderStatus}
            onChange={handleOrderStatusChange}
            disabled={updating || allowedNextStatuses.length === 0}
            className={`rounded-full border-0 py-2 text-xs font-medium capitalize ${
              ORDER_STATUS_STYLES[orderStatus] || "bg-ink-100 text-ink-500"
            }`}
          >
            <option value={orderStatus}>{orderStatus}</option>
            {allowedNextStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor={`payment-status-${order.id}`}
            className="mb-1.5 block text-xs font-medium text-ink-500"
          >
            Payment status
          </label>
          <Select
            id={`payment-status-${order.id}`}
            value={paymentStatus}
            onChange={handlePaymentStatusChange}
            disabled={paymentControlDisabled}
            className={`rounded-full border-0 py-2 text-xs font-medium capitalize ${
              PAYMENT_STATUS_STYLES[paymentStatus] || "bg-ink-100 text-ink-500"
            }`}
          >
            <option value={paymentStatus}>{paymentStatus}</option>
            {paymentStatus === "unpaid" && (
              <option
                value="paid"
                disabled={!canManuallyConfirmPayment || orderStatus === "cancelled"}
              >
                {canManuallyConfirmPayment ? "paid" : "paid (verification required)"}
              </option>
            )}
            <option value="refunded" disabled>
              refunded (unavailable)
            </option>
          </Select>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-500">
        {paymentStatus === "unpaid" && canManuallyConfirmPayment
          ? "Mark paid only after personally verifying COD collection or bank receipt."
          : paymentStatus === "unpaid"
            ? "Online payment methods require trusted provider verification; this app has no provider integration."
            : "Refund status is unavailable until a verified refund workflow is implemented."}
      </p>

      {updating && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-500">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saving status…
        </p>
      )}
      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`mt-3 text-sm ${
            feedback.type === "error" ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
