import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrderStatusTransitionError,
  getPaymentStatusUpdateError,
} from "../utils/orderStatusRules.js";

test("order status advances only through the allowed workflow", () => {
  assert.equal(
    getOrderStatusTransitionError("pending", "confirmed", "unpaid"),
    null
  );
  assert.equal(
    getOrderStatusTransitionError("confirmed", "shipped", "unpaid"),
    null
  );
  assert.equal(
    getOrderStatusTransitionError("shipped", "delivered", "unpaid"),
    null
  );
  assert.match(
    getOrderStatusTransitionError("pending", "shipped", "unpaid"),
    /Cannot change order status/
  );
});

test("cancellation is limited to unpaid, undelivered orders", () => {
  assert.equal(
    getOrderStatusTransitionError("pending", "cancelled", "unpaid"),
    null
  );
  assert.match(
    getOrderStatusTransitionError("delivered", "cancelled", "unpaid"),
    /Cannot change order status/
  );
  assert.match(
    getOrderStatusTransitionError("shipped", "cancelled", "paid"),
    /verified refund/
  );
  assert.match(
    getOrderStatusTransitionError("cancelled", "cancelled", "unpaid"),
    /already cancelled/
  );
});

test("manual payment confirmation is restricted to COD and bank transfer", () => {
  const codOrder = {
    orderStatus: "confirmed",
    paymentStatus: "unpaid",
    paymentMethod: "COD",
  };
  assert.equal(
    getPaymentStatusUpdateError(codOrder, "paid", true),
    null
  );
  assert.match(
    getPaymentStatusUpdateError(codOrder, "paid", false),
    /verified receipt/
  );
  assert.match(
    getPaymentStatusUpdateError(
      { ...codOrder, paymentMethod: "JazzCash" },
      "paid",
      true
    ),
    /provider verification/
  );
});

test("unsupported refunds and payment reversals are rejected", () => {
  const paidOrder = {
    orderStatus: "delivered",
    paymentStatus: "paid",
    paymentMethod: "COD",
  };
  assert.match(
    getPaymentStatusUpdateError(paidOrder, "refunded", true),
    /verified refund workflow/
  );
  assert.match(
    getPaymentStatusUpdateError(paidOrder, "unpaid", true),
    /changed back to unpaid/
  );
});
