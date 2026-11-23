import test from "node:test";
import assert from "node:assert/strict";
import Payment from "../models/Payment.js";
import UserSubscription from "../models/UserSubscription.js";
import SuperAdminAuditLog from "../models/SuperAdminAuditLog.js";
import { verifyManualPayment } from "../controllers/subscriptionController.js";

const ids = {
  user: "65a000000000000000000011",
  otherUser: "65a000000000000000000012",
  admin: "65a000000000000000000013",
  subscription: "65a000000000000000000021",
  payment: "65a000000000000000000031",
};

const createFixture = (overrides = {}) => {
  const payment = {
    _id: ids.payment,
    userId: ids.user,
    subscriptionId: ids.subscription,
    amount: 250,
    currency: "PKR",
    status: "pending",
    paymentMethod: "unconfigured",
    paymentProvider: "unconfigured",
    transactionReference: "",
    ...overrides.payment,
  };
  const subscription = {
    _id: ids.subscription,
    userId: ids.user,
    planId: "65a000000000000000000041",
    planSnapshot: {
      slug: "starter",
      price: 250,
      currency: "PKR",
      billingCycle: "monthly",
    },
    status: "pending_payment",
    isCurrent: false,
    priceAtPurchase: 250,
    currency: "PKR",
    billingCycle: "monthly",
    ...overrides.subscription,
  };
  const audits = [];
  let activationCount = 0;

  const originals = {
    paymentFindById: Payment.findById,
    paymentFindOne: Payment.findOne,
    paymentFindOneAndUpdate: Payment.findOneAndUpdate,
    subscriptionFindOne: UserSubscription.findOne,
    subscriptionUpdateOne: UserSubscription.updateOne,
    subscriptionFindOneAndUpdate: UserSubscription.findOneAndUpdate,
    auditCreate: SuperAdminAuditLog.create,
    auditFindOne: SuperAdminAuditLog.findOne,
  };

  const copy = (value) => (value ? { ...value } : value);
  Payment.findById = async () => copy(payment);
  Payment.findOne = async (filter) =>
    overrides.duplicateReference &&
    filter.transactionReference === overrides.duplicateReference
      ? { _id: "65a000000000000000000032" }
      : null;
  Payment.findOneAndUpdate = async (filter, update) => {
    if (payment._id !== filter._id || payment.status !== filter.status) {
      return null;
    }
    Object.assign(payment, update.$set);
    return copy(payment);
  };
  UserSubscription.findOne = async (filter) => {
    if (
      filter._id !== subscription._id ||
      String(filter.userId) !== String(subscription.userId)
    ) {
      return null;
    }
    if (
      filter.isCurrent !== undefined &&
      filter.isCurrent !== subscription.isCurrent
    ) {
      return null;
    }
    if (
      filter.status?.$in &&
      !filter.status.$in.includes(subscription.status)
    ) {
      return null;
    }
    return copy(subscription);
  };
  UserSubscription.updateOne = async () => ({ modifiedCount: 0 });
  UserSubscription.findOneAndUpdate = async (filter, update) => {
    if (
      subscription._id !== filter._id ||
      String(subscription.userId) !== String(filter.userId) ||
      subscription.status !== filter.status ||
      subscription.isCurrent !== filter.isCurrent
    ) {
      return null;
    }
    Object.assign(subscription, update.$set);
    activationCount += 1;
    return copy(subscription);
  };
  SuperAdminAuditLog.create = async (entry) => {
    if (
      entry.idempotencyKey &&
      audits.some((audit) => audit.idempotencyKey === entry.idempotencyKey)
    ) {
      const error = new Error("Duplicate idempotency key");
      error.code = 11000;
      throw error;
    }
    audits.push(entry);
    return entry;
  };
  SuperAdminAuditLog.findOne = async (filter) =>
    audits.find((audit) => audit.idempotencyKey === filter.idempotencyKey) ||
    null;

  return {
    payment,
    subscription,
    audits,
    get activationCount() {
      return activationCount;
    },
    restore() {
      Payment.findById = originals.paymentFindById;
      Payment.findOne = originals.paymentFindOne;
      Payment.findOneAndUpdate = originals.paymentFindOneAndUpdate;
      UserSubscription.findOne = originals.subscriptionFindOne;
      UserSubscription.updateOne = originals.subscriptionUpdateOne;
      UserSubscription.findOneAndUpdate =
        originals.subscriptionFindOneAndUpdate;
      SuperAdminAuditLog.create = originals.auditCreate;
      SuperAdminAuditLog.findOne = originals.auditFindOne;
    },
  };
};

const validBody = {
  transactionReference: "merchant-reference-123",
  paymentMethod: "manual_bank_transfer",
  reason: "Matched settled bank transfer",
};

const verify = (fixture, body = validBody) => {
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return verifyManualPayment(
    {
      params: { paymentId: ids.payment },
      body,
      user: { _id: ids.admin },
    },
    response
  ).then(() => response);
};

test("manual payment verification validates, claims, and activates only once", async (t) => {
  await t.test("activates only a matching pending payment and omits the reference from audit metadata", async (t) => {
    const fixture = createFixture();
    t.after(fixture.restore);

    const response = await verify(fixture);

    assert.equal(response.statusCode, 200);
    assert.equal(fixture.payment.status, "paid");
    assert.equal(fixture.payment.transactionReference, validBody.transactionReference);
    assert.equal(fixture.subscription.status, "active");
    assert.equal(fixture.subscription.isCurrent, true);
    assert.equal(fixture.activationCount, 1);
    assert.equal(
      fixture.audits.some((entry) => entry.action === "payment_verified"),
      true
    );
    assert.equal(
      JSON.stringify(fixture.audits).includes(validBody.transactionReference),
      false
    );
  });

  await t.test("rejects amount or currency mismatches without changing status", async (t) => {
    for (const payment of [
      { amount: 500 },
      { currency: "USD" },
    ]) {
      const fixture = createFixture({ payment });
      t.after(fixture.restore);

      const response = await verify(fixture);

      assert.equal(response.statusCode, 409);
      assert.equal(fixture.payment.status, "pending");
      assert.equal(fixture.subscription.status, "pending_payment");
      assert.equal(fixture.activationCount, 0);
    }
  });

  await t.test("rejects a payment not owned by the subscription user", async (t) => {
    const fixture = createFixture({
      subscription: { userId: ids.otherUser },
    });
    t.after(fixture.restore);

    const response = await verify(fixture);

    assert.equal(response.statusCode, 409);
    assert.equal(fixture.payment.status, "pending");
    assert.equal(fixture.activationCount, 0);
  });

  await t.test("rejects a transaction reference already assigned elsewhere", async (t) => {
    const fixture = createFixture({
      duplicateReference: validBody.transactionReference,
    });
    t.after(fixture.restore);

    const response = await verify(fixture);

    assert.equal(response.statusCode, 409);
    assert.equal(fixture.payment.status, "pending");
    assert.equal(fixture.activationCount, 0);
  });

  await t.test("retries the same verification idempotently and rejects different details", async (t) => {
    const fixture = createFixture();
    t.after(fixture.restore);

    const first = await verify(fixture);
    const retry = await verify(fixture);
    const differentReference = await verify(fixture, {
      ...validBody,
      transactionReference: "different-reference",
    });

    assert.equal(first.statusCode, 200);
    assert.equal(retry.statusCode, 200);
    assert.equal(differentReference.statusCode, 409);
    assert.equal(fixture.activationCount, 1);
    assert.equal(fixture.payment.transactionReference, validBody.transactionReference);
  });

  await t.test("concurrent duplicate verifications activate the subscription once", async (t) => {
    const fixture = createFixture();
    t.after(fixture.restore);

    const [first, second] = await Promise.all([
      verify(fixture),
      verify(fixture),
    ]);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(fixture.payment.status, "paid");
    assert.equal(fixture.activationCount, 1);
    assert.equal(
      fixture.audits.filter((entry) => entry.action === "payment_verified")
        .length,
      1
    );
    assert.equal(fixture.subscription.isCurrent, true);
  });

  await t.test("does not activate failed payments", async (t) => {
    const fixture = createFixture({ payment: { status: "failed" } });
    t.after(fixture.restore);

    const response = await verify(fixture);

    assert.equal(response.statusCode, 409);
    assert.equal(fixture.payment.status, "failed");
    assert.equal(fixture.subscription.status, "pending_payment");
    assert.equal(fixture.activationCount, 0);
  });
});
