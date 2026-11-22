import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../config/subscriptionPlans.js";
import {
  addBillingCycle,
  ensureFreeSubscription,
  getMonthlyUsagePeriod,
  getUsageCount,
  getUsageLimitViolation,
} from "../utils/subscriptionService.js";
import Order from "../models/Order.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import UserSubscription from "../models/UserSubscription.js";
import Product from "../models/Product.js";

test("default plan quotas are configurable and paid prices are not invented", () => {
  const plans = Object.fromEntries(
    DEFAULT_SUBSCRIPTION_PLANS.map((plan) => [plan.slug, plan])
  );

  assert.deepEqual(plans.free.limits, {
    products: 50,
    customers: 100,
    ordersPerMonth: 100,
  });
  assert.deepEqual(plans.starter.limits, {
    products: 500,
    customers: 1000,
    ordersPerMonth: 1000,
  });
  assert.deepEqual(plans.pro.limits, {
    products: 5000,
    customers: 10000,
    ordersPerMonth: 10000,
  });
  assert.equal(plans.starter.priceConfigured, false);
  assert.equal(plans.pro.priceConfigured, false);
});

test("billing cycle dates clamp at month and leap-year boundaries", () => {
  const januaryEnd = new Date("2025-01-31T12:00:00.000Z");
  const februaryEnd = addBillingCycle(januaryEnd, "monthly");

  assert.equal(februaryEnd.toISOString(), "2025-02-28T12:00:00.000Z");
  assert.equal(
    addBillingCycle(new Date("2024-02-29T12:00:00.000Z"), "yearly").toISOString(),
    "2025-02-28T12:00:00.000Z"
  );
});

test("monthly order periods follow the subscription anniversary", () => {
  const period = getMonthlyUsagePeriod(
    { startDate: new Date("2025-01-31T12:00:00.000Z") },
    new Date("2025-03-15T12:00:00.000Z")
  );

  assert.equal(period.start.toISOString(), "2025-02-28T12:00:00.000Z");
  assert.equal(period.end.toISOString(), "2025-03-31T12:00:00.000Z");
});

test("new accounts receive the configured Free subscription", async (t) => {
  const originals = {
    findSubscription: UserSubscription.findOne,
    createSubscription: UserSubscription.create,
    findPlan: SubscriptionPlan.findOne,
  };
  t.after(() => {
    UserSubscription.findOne = originals.findSubscription;
    UserSubscription.create = originals.createSubscription;
    SubscriptionPlan.findOne = originals.findPlan;
  });

  const userId = "65a000000000000000000001";
  const plan = { _id: "free-plan", billingCycle: "monthly", isActive: true };
  let created;
  UserSubscription.findOne = async () => null;
  SubscriptionPlan.findOne = async () => plan;
  UserSubscription.create = async (subscription) => {
    created = subscription;
    return subscription;
  };

  const now = new Date("2025-01-15T00:00:00.000Z");
  await ensureFreeSubscription(userId, now);
  assert.equal(created.userId, userId);
  assert.equal(created.planId, plan._id);
  assert.equal(created.status, "active");
  assert.equal(created.isCurrent, true);
  assert.equal(created.priceAtPurchase, 0);
  assert.equal(created.startDate, now);
});

test("usage checks account for all requested records before writes", async (t) => {
  const originalCountDocuments = Product.countDocuments;
  t.after(() => {
    Product.countDocuments = originalCountDocuments;
  });
  Product.countDocuments = async (filter) => {
    assert.deepEqual(filter, { userId: "account-1" });
    return 2;
  };

  const violation = await getUsageLimitViolation(
    "account-1",
    "products",
    { name: "Free", slug: "free", limits: { products: 3 } },
    { startDate: new Date("2025-01-01T00:00:00.000Z") },
    2
  );
  assert.deepEqual(violation, {
    resource: "products",
    limit: 3,
    currentUsage: 2,
    requested: 2,
    plan: { name: "Free", slug: "free" },
    upgradePath: "/dashboard/pricing",
  });

  assert.equal(
    await getUsageLimitViolation(
      "account-1",
      "products",
      { name: "Free", slug: "free", limits: { products: 1 } },
      { startDate: new Date("2025-01-01T00:00:00.000Z") },
      0
    ),
    null
  );
});

test("monthly order usage counts restore inserts in the current period and legacy order dates", async (t) => {
  const originalCountDocuments = Order.countDocuments;
  t.after(() => {
    Order.countDocuments = originalCountDocuments;
  });
  let filter;
  Order.countDocuments = async (value) => {
    filter = value;
    return 3;
  };

  const subscription = {
    startDate: new Date("2025-01-15T00:00:00.000Z"),
  };
  await getUsageCount(
    "account-1",
    "ordersPerMonth",
    subscription,
    new Date("2025-02-01T00:00:00.000Z")
  );
  assert.equal(filter.userId, "account-1");
  assert.deepEqual(filter.$or[0].quotaCreatedAt, {
    $gte: new Date("2025-01-15T00:00:00.000Z"),
    $lt: new Date("2025-02-15T00:00:00.000Z"),
  });
  assert.deepEqual(filter.$or[1].createdAt, {
    $gte: new Date("2025-01-15T00:00:00.000Z"),
    $lt: new Date("2025-02-15T00:00:00.000Z"),
  });
});
