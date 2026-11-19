import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { getAnalyticsOverview } from "../controllers/analyticsController.js";
import {
  fillSalesTrend,
  getCustomerSpendingPipeline,
  getInventoryAnalyticsPipeline,
  getOrderStatsPipeline,
  getSalesMetricExpressions,
  getSalesPipeline,
  getTopProductsPipeline,
  parseAnalyticsQuery,
} from "../utils/analytics.js";

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("analytics date filters use inclusive UTC calendar dates", () => {
  const range = parseAnalyticsQuery({
    startDate: "2026-03-01",
    endDate: "2026-03-03",
  });

  assert.equal(range.start.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-03-04T00:00:00.000Z");
  assert.deepEqual(range.period, {
    startDate: "2026-03-01",
    endDate: "2026-03-03",
    timezone: "UTC",
  });
});

test("analytics date filters reject malformed, reversed, and conflicting ranges", () => {
  assert.throws(
    () => parseAnalyticsQuery({ startDate: "2026-02-30", endDate: "2026-03-01" }),
    /startDate is not a valid date/
  );
  assert.throws(
    () => parseAnalyticsQuery({ startDate: "2026-03-02", endDate: "2026-03-01" }),
    /startDate must be on or before endDate/
  );
  assert.throws(
    () => parseAnalyticsQuery({ startDate: "2026-03-01" }),
    /Both startDate and endDate are required/
  );
  assert.throws(
    () =>
      parseAnalyticsQuery({
        period: "today",
        startDate: "2026-03-01",
        endDate: "2026-03-01",
      }),
    /Use either period or startDate\/endDate/
  );
  assert.throws(
    () => parseAnalyticsQuery({ period: "yearToDate" }),
    /period must be one of/
  );
  assert.throws(
    () => parseAnalyticsQuery({ unexpected: "value" }),
    /Unsupported query parameter/
  );
});

test("preset ranges and trend buckets use UTC and Monday-based weeks", () => {
  const now = new Date("2026-03-04T23:30:00.000Z");
  const today = parseAnalyticsQuery({ period: "today" }, { now });
  const last7 = parseAnalyticsQuery({ period: "last7days" }, { now });
  const thisMonth = parseAnalyticsQuery({ period: "thisMonth" }, { now });

  assert.equal(today.period.startDate, "2026-03-04");
  assert.equal(today.period.endDate, "2026-03-04");
  assert.equal(last7.period.startDate, "2026-02-26");
  assert.equal(thisMonth.period.startDate, "2026-03-01");

  const trend = fillSalesTrend(
    [{ date: "2026-03-02", totalOrders: 2 }],
    new Date("2026-03-04T00:00:00.000Z"),
    new Date("2026-03-06T00:00:00.000Z"),
    "weekly"
  );
  assert.deepEqual(
    trend.map((row) => row.date),
    ["2026-03-02"]
  );
  assert.equal(trend[0].totalOrders, 2);
});

test("sales calculations separately account for delivery, payment, refunds, and cancellations", () => {
  const metrics = getSalesMetricExpressions();
  const deliveredConditions = metrics.deliveredSales.$sum.$cond[0].$and;

  assert.deepEqual(deliveredConditions, [
    { $eq: ["$orderStatus", "delivered"] },
    { $ne: ["$paymentStatus", "refunded"] },
  ]);
  assert.deepEqual(metrics.deliveredSalesOrders.$sum.$cond[0].$and, deliveredConditions);
  assert.deepEqual(metrics.paidAmounts.$sum.$cond[0].$and, [
    { $eq: ["$paymentStatus", "paid"] },
    { $ne: ["$orderStatus", "cancelled"] },
  ]);
  assert.deepEqual(metrics.unpaidAmounts.$sum.$cond[0].$and, [
    { $eq: ["$paymentStatus", "unpaid"] },
    { $ne: ["$orderStatus", "cancelled"] },
  ]);
  assert.deepEqual(metrics.paidOrders.$sum.$cond[0].$and, [
    { $eq: ["$paymentStatus", "paid"] },
    { $ne: ["$orderStatus", "cancelled"] },
  ]);
  assert.deepEqual(metrics.unpaidOrders.$sum.$cond[0].$and, [
    { $eq: ["$paymentStatus", "unpaid"] },
    { $ne: ["$orderStatus", "cancelled"] },
  ]);
  assert.deepEqual(metrics.refundedAmounts.$sum.$cond[0], {
    $eq: ["$paymentStatus", "refunded"],
  });
  assert.deepEqual(metrics.cancelledOrders.$sum.$cond[0], {
    $eq: ["$orderStatus", "cancelled"],
  });
});

test("sales and order pipelines scope every order query to its owner and selected dates", () => {
  const userId = new mongoose.Types.ObjectId();
  const range = {
    start: new Date("2026-03-01T00:00:00.000Z"),
    end: new Date("2026-04-01T00:00:00.000Z"),
  };
  const salesPipeline = getSalesPipeline(userId, range, "monthly");
  const orderPipeline = getOrderStatsPipeline(userId, range);

  assert.deepEqual(salesPipeline[0].$match, {
    userId,
    createdAt: { $gte: range.start, $lt: range.end },
  });
  assert.deepEqual(orderPipeline[0].$match, salesPipeline[0].$match);
  assert.equal(salesPipeline[1].$facet.trend[0].$group._id.$dateTrunc.unit, "month");
  assert.equal(orderPipeline[1].$group.totalOrders.$sum, 1);
});

test("top product pipeline excludes cancelled and refunded orders and groups variants", () => {
  const userId = new mongoose.Types.ObjectId();
  const range = {
    start: new Date("2026-03-01T00:00:00.000Z"),
    end: new Date("2026-04-01T00:00:00.000Z"),
  };
  const pipeline = getTopProductsPipeline(userId, range, 5);

  assert.deepEqual(pipeline[0].$match, {
    userId,
    orderStatus: "delivered",
    paymentStatus: { $ne: "refunded" },
    createdAt: { $gte: range.start, $lt: range.end },
  });
  assert.deepEqual(pipeline[2].$group._id, {
    productId: "$items.productId",
    variantId: { $ifNull: ["$items.variantId", null] },
  });
  assert.deepEqual(pipeline[2].$group.revenueGenerated.$sum, "$items.lineTotal");
  assert.deepEqual(pipeline[3].$lookup.let.ownerId, userId);
  assert.equal(pipeline.at(-1).$limit, 5);
});

test("customer spending includes delivered non-refunded orders and enforces customer ownership", () => {
  const userId = new mongoose.Types.ObjectId();
  const range = {
    start: new Date("2026-03-01T00:00:00.000Z"),
    end: new Date("2026-04-01T00:00:00.000Z"),
  };
  const pipeline = getCustomerSpendingPipeline(userId, range, 5);

  assert.deepEqual(pipeline[0].$match, {
    userId,
    orderStatus: "delivered",
    paymentStatus: { $ne: "refunded" },
    createdAt: { $gte: range.start, $lt: range.end },
  });
  assert.deepEqual(pipeline[1].$group.completedSpending.$sum.$cond[0], {
    $eq: ["$paymentStatus", "paid"],
  });
  assert.deepEqual(pipeline[2].$lookup.let.ownerId, userId);
  assert.deepEqual(pipeline[3].$match, {
    "customer.0": { $exists: true },
  });
});

test("inventory pipeline selects active products and never sums parent stock with variant stock", () => {
  const userId = new mongoose.Types.ObjectId();
  const pipeline = getInventoryAnalyticsPipeline(userId);

  assert.deepEqual(pipeline[0].$match, { userId, status: "active" });
  const inventoryChoice = pipeline[1].$project.inventoryItems.$cond;
  assert.deepEqual(inventoryChoice[0].$and[0], {
    $eq: ["$hasVariants", true],
  });
  assert.deepEqual(inventoryChoice[1].$map.input.$filter.cond.$eq, [
    "$$variant.status",
    "active",
  ]);
  assert.deepEqual(inventoryChoice[2][0].stock, { $ifNull: ["$stock", 0] });
  assert.equal(pipeline[2].$set.inventoryUnits.$reduce.input, "$inventoryItems");
  assert.equal(pipeline[3].$facet.lowStock[0].$unwind, "$inventoryItems");
});

test("analytics overview returns complete zero values and scopes every collection to the seller", async () => {
  const userId = new mongoose.Types.ObjectId();
  const originalOrderAggregate = Order.aggregate;
  const originalCustomerAggregate = Customer.aggregate;
  const originalProductAggregate = Product.aggregate;
  const response = createResponse();
  const orderPipelines = [];

  Order.aggregate = async (pipeline) => {
    orderPipelines.push(pipeline);
    assert.deepEqual(pipeline[0].$match.userId, userId);

    if (pipeline[1].$facet?.totals) {
      return [{ totals: [], trend: [] }];
    }
    if (pipeline[1].$group?.completedOrders) {
      return [{ repeatCustomers: [], topSpendingCustomers: [] }];
    }
    if (pipeline[1].$unwind) return [];
    return [];
  };
  Customer.aggregate = async (pipeline) => {
    assert.deepEqual(pipeline[0].$match.userId, userId);
    return [{ totalCustomers: [], newCustomers: [] }];
  };
  Product.aggregate = async (pipeline) => {
    assert.deepEqual(pipeline[0].$match, { userId, status: "active" });
    return [{ summary: [], lowStock: [], outOfStock: [] }];
  };

  try {
    await getAnalyticsOverview(
      {
        user: { _id: userId },
        query: { startDate: "2026-03-01", endDate: "2026-03-01" },
      },
      response
    );
  } finally {
    Order.aggregate = originalOrderAggregate;
    Customer.aggregate = originalCustomerAggregate;
    Product.aggregate = originalProductAggregate;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.sales.totals.totalOrders, 0);
  assert.equal(response.body.data.orders.totalOrders, 0);
  assert.deepEqual(response.body.data.topProducts, []);
  assert.equal(response.body.data.customers.totalCustomers, 0);
  assert.deepEqual(response.body.data.inventory, {
    totalActiveProducts: 0,
    totalInventoryUnits: 0,
    inventoryValue: 0,
    lowStock: { count: 0, items: [] },
    outOfStock: { count: 0, items: [] },
  });
  assert.equal(orderPipelines.length, 4);
  assert.ok(
    orderPipelines.every(
      (pipeline) =>
        pipeline[0].$match.createdAt.$gte.toISOString() ===
        "2026-03-01T00:00:00.000Z"
    )
  );
});
