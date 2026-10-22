import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import { getCustomerById, getCustomers } from "../controllers/customerController.js";
import {
  getCustomerStatsPipeline,
  isCustomerSpendOrder,
} from "../utils/customerStats.js";

test("customer spending includes only paid, non-cancelled orders", () => {
  assert.equal(
    isCustomerSpendOrder({
      paymentStatus: "paid",
      orderStatus: "confirmed",
    }),
    true
  );
  assert.equal(
    isCustomerSpendOrder({
      paymentStatus: "unpaid",
      orderStatus: "delivered",
    }),
    false
  );
  assert.equal(
    isCustomerSpendOrder({
      paymentStatus: "refunded",
      orderStatus: "delivered",
    }),
    false
  );
  assert.equal(
    isCustomerSpendOrder({
      paymentStatus: "paid",
      orderStatus: "cancelled",
    }),
    false
  );
});

test("customer list counts linked orders and aggregates eligible server totals by owner", async () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const customerWithoutOrdersId = new mongoose.Types.ObjectId();
  const originalFind = Customer.find;
  const originalAggregate = Order.aggregate;
  const customers = [
    {
      _id: customerId,
      toObject: () => ({ _id: customerId, name: "Customer with orders" }),
    },
    {
      _id: customerWithoutOrdersId,
      toObject: () => ({ _id: customerWithoutOrdersId, name: "New customer" }),
    },
  ];
  let responseStatus;
  let responseBody;

  Customer.find = () => ({
    sort: async () => customers,
  });
  Order.aggregate = async (pipeline) => {
    assert.deepEqual(pipeline, getCustomerStatsPipeline(userId));
    assert.deepEqual(pipeline[0].$match, { userId });
    assert.equal(pipeline[1].$group._id, "$customerId");
    assert.deepEqual(pipeline[1].$group.totalOrders, { $sum: 1 });
    assert.deepEqual(
      pipeline[1].$group.totalSpent.$sum.$cond[0],
      {
        $and: [
          { $eq: ["$paymentStatus", "paid"] },
          { $ne: ["$paymentStatus", "refunded"] },
          { $ne: ["$orderStatus", "cancelled"] },
        ],
      }
    );
    assert.deepEqual(pipeline[1].$group.totalSpent.$sum.$cond[1], {
      $ifNull: ["$totalAmount", 0],
    });
    return [{ _id: customerId, totalOrders: 3, totalSpent: 1250 }];
  };

  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  try {
    await getCustomers({ user: { _id: userId } }, response);
  } finally {
    Customer.find = originalFind;
    Order.aggregate = originalAggregate;
  }

  assert.equal(responseStatus, 200);
  assert.equal(responseBody.count, 2);
  assert.deepEqual(
    responseBody.customers.map(({ totalOrders, totalSpent }) => ({
      totalOrders,
      totalSpent,
    })),
    [
      { totalOrders: 3, totalSpent: 1250 },
      { totalOrders: 0, totalSpent: 0 },
    ]
  );
});

test("customer detail stats aggregate only orders linked to that customer and owner", async () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const originalFindOne = Customer.findOne;
  const originalAggregate = Order.aggregate;
  const customer = {
    _id: customerId,
    toObject: () => ({ _id: customerId, name: "Customer" }),
  };
  let responseStatus;
  let responseBody;

  Customer.findOne = async (filter) => {
    assert.deepEqual(filter, { _id: customerId.toString(), userId });
    return customer;
  };
  Order.aggregate = async (pipeline) => {
    assert.deepEqual(
      pipeline,
      getCustomerStatsPipeline(userId, customerId)
    );
    assert.deepEqual(pipeline[0].$match, { userId, customerId });
    return [{ _id: customerId, totalOrders: 2, totalSpent: 3090 }];
  };

  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  try {
    await getCustomerById(
      { user: { _id: userId }, params: { id: customerId.toString() } },
      response
    );
  } finally {
    Customer.findOne = originalFindOne;
    Order.aggregate = originalAggregate;
  }

  assert.equal(responseStatus, 200);
  assert.equal(responseBody.customer.totalSpent, 3090);
});
