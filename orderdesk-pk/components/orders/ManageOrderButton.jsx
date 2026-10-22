"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import {
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUSES,
} from "@/lib/constants";
import {
  updateOrderStatus,
  updatePaymentStatus,
} from "@/services/orderService";

function isManualPaymentMethod(method) {
  return method === "COD" || method === "Bank Transfer";
}

export default function ManageOrderButton({ order }) {
  const router = useRouter();
  const requestLock = useRef(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderStatus, setOrderStatus] = useState(order.order_status);
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status);
  const [message, setMessage] = useState(null);

  const allowedOrderStatuses = ORDER_STATUS_TRANSITIONS[order.order_status] || [];
  const canConfirmManualPayment = isManualPaymentMethod(order.payment_method);
  const orderStatusOptions = ORDER_STATUSES.filter(
    (status) =>
      status === order.order_status || allowedOrderStatuses.includes(status)
  );

  function openModal() {
    setOrderStatus(order.order_status);
    setPaymentStatus(order.payment_status);
    setMessage(null);
    setOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (requestLock.current) return;

    const orderStatusChanged = orderStatus !== order.order_status;
    const paymentStatusChanged = paymentStatus !== order.payment_status;

    if (!orderStatusChanged && !paymentStatusChanged) {
      setMessage({ type: "error", text: "No changes to save." });
      return;
    }

    if (
      orderStatus === "cancelled" &&
      (paymentStatusChanged || order.payment_status !== "unpaid")
    ) {
      setMessage({
        type: "error",
        text: "Only unpaid orders can be cancelled. Handle a verified refund separately.",
      });
      return;
    }

    if (paymentStatusChanged && paymentStatus === "refunded") {
      setMessage({
        type: "error",
        text: "Refunds cannot be recorded until a verified refund workflow is available.",
      });
      return;
    }

    if (
      paymentStatusChanged &&
      paymentStatus === "paid" &&
      !canConfirmManualPayment
    ) {
      setMessage({
        type: "error",
        text: "This payment method requires trusted provider verification.",
      });
      return;
    }

    if (
      orderStatusChanged &&
      orderStatus === "cancelled" &&
      !window.confirm(
        "Cancel this order? Its stock will be restored once. Delivered orders cannot be cancelled."
      )
    ) {
      return;
    }

    if (
      paymentStatusChanged &&
      paymentStatus === "paid" &&
      !window.confirm(
        "Confirm that you verified receipt of this COD or bank-transfer payment outside OrderDesk."
      )
    ) {
      return;
    }

    requestLock.current = true;
    setSaving(true);
    setMessage(null);
    let orderStatusSaved = false;

    try {
      if (orderStatusChanged) {
        const result = await updateOrderStatus(order.id, orderStatus);
        if (result.error) throw result.error;
        if (!result.order) throw new Error("The order update returned no order.");
        orderStatusSaved = true;
      }

      if (paymentStatusChanged) {
        const result = await updatePaymentStatus(
          order.id,
          paymentStatus,
          paymentStatus === "paid"
        );
        if (result.error) throw result.error;
        if (!result.order) throw new Error("The payment update returned no order.");
      }

      setMessage({ type: "success", text: "Order changes saved successfully." });
      setOpen(false);
      router.refresh();
    } catch (error) {
      if (orderStatusSaved) {
        setMessage({
          type: "error",
          text: `Order status was saved, but the payment update failed: ${
            error.message || "Unknown error"
          }`,
        });
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: error.message || "Could not save order changes.",
        });
      }
    } finally {
      requestLock.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          onClick={openModal}
        >
          Manage
        </Button>
        {message && (
          <span
            role={message.type === "error" ? "alert" : "status"}
            className={`max-w-48 text-xs ${
              message.type === "error" ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>

      <Modal
        open={open}
        title={`Manage ${order.order_number}`}
        onClose={() => !saving && setOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {message?.type === "error" && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {message.text}
            </p>
          )}

          <div>
            <label
              htmlFor={`manage-order-status-${order.id}`}
              className="mb-1.5 block text-sm font-medium text-ink-700"
            >
              Order Status
            </label>
            <Select
              id={`manage-order-status-${order.id}`}
              value={orderStatus}
              onChange={(event) => setOrderStatus(event.target.value)}
              disabled={saving || allowedOrderStatuses.length === 0}
            >
              {ORDER_STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={
                    status !== order.order_status &&
                    !allowedOrderStatuses.includes(status)
                  }
                >
                  {status}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink-500">
              Only valid next steps are enabled. Delivered and cancelled orders
              cannot be changed.
            </p>
          </div>

          <div>
            <label
              htmlFor={`manage-payment-status-${order.id}`}
              className="mb-1.5 block text-sm font-medium text-ink-700"
            >
              Payment Status
            </label>
            <Select
              id={`manage-payment-status-${order.id}`}
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
              disabled={
                saving ||
                order.order_status === "cancelled" ||
                order.payment_status !== "unpaid" ||
                !canConfirmManualPayment
              }
            >
              {PAYMENT_STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={
                    status !== order.payment_status &&
                    (status !== "paid" ||
                      order.payment_status !== "unpaid" ||
                      !canConfirmManualPayment)
                  }
                >
                  {status === "refunded" ? "refunded (unavailable)" : status}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink-500">
              {canConfirmManualPayment
                ? "Mark paid only after verifying COD collection or bank receipt. Refunds require a verified refund workflow."
                : "Online payment requires trusted provider verification, which is not currently integrated. Refunds are unavailable."}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
