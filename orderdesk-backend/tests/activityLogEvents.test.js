import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "../controllers/customerController.js";
import { updateOrder } from "../controllers/orderController.js";
import { adjustStock } from "../controllers/inventoryController.js";

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("customer CRUD records generic, non-sensitive activity entries", async (t) => {
  const originalCreate = Customer.create;
  const originalFindOneAndUpdate = Customer.findOneAndUpdate;
  const originalFindOneAndDelete = Customer.findOneAndDelete;
  const originalActivityCreate = ActivityLog.create;
  const customerId = new mongoose.Types.ObjectId();
  const activities = [];

  Customer.create = async (data) => ({ ...data, _id: customerId });
  Customer.findOneAndUpdate = async (filter, update) => ({
    ...filter,
    ...update.$set,
  });
  Customer.findOneAndDelete = async (filter) => ({ ...filter });
  ActivityLog.create = async (activity) => {
    activities.push(activity);
  };
  t.after(() => {
    Customer.create = originalCreate;
    Customer.findOneAndUpdate = originalFindOneAndUpdate;
    Customer.findOneAndDelete = originalFindOneAndDelete;
    ActivityLog.create = originalActivityCreate;
  });

  const userId = new mongoose.Types.ObjectId();
  const createdResponse = await (async () => {
    const response = createResponseFactory();
    await createCustomer(
      {
        user: { _id: userId },
        body: {
          name: "Customer One",
          phone: "03000000000",
          email: "private@example.test",
        },
      },
      response
    );
    return response;
  })();
  const updateResponse = createResponseFactory();
  await updateCustomer(
    {
      user: { _id: userId },
      params: { id: customerId.toString() },
      body: { name: "Customer One Updated" },
    },
    updateResponse
  );
  const deleteResponse = createResponseFactory();
  await deleteCustomer(
    { user: { _id: userId }, params: { id: customerId.toString() } },
    deleteResponse
  );

  assert.equal(createdResponse.statusCode, 201);
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(
    activities.map((activity) => activity.action),
    ["customer_created", "customer_updated", "customer_deleted"]
  );
  assert.ok(activities.every((activity) => !activity.metadata?.email));
  assert.ok(activities.every((activity) => !activity.metadata?.phone));
});

test("payment status changes log only after a successful update", async (t) => {
  const originalFindOne = Order.findOne;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  const originalActivityCreate = ActivityLog.create;
  const userId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const currentOrder = {
    _id: orderId,
    userId,
    orderStatus: "confirmed",
    paymentStatus: "unpaid",
    paymentMethod: "COD",
  };
  const activities = [];

  Order.findOne = async () => currentOrder;
  Order.findOneAndUpdate = async (filter, update) => ({
    ...currentOrder,
    ...update.$set,
  });
  ActivityLog.create = async (activity) => {
    activities.push(activity);
  };
  t.after(() => {
    Order.findOne = originalFindOne;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
    ActivityLog.create = originalActivityCreate;
  });

  const response = createResponse();
  await updateOrder(
    {
      user: { _id: userId },
      params: { id: orderId.toString() },
      body: { paymentStatus: "paid", manualPaymentConfirmed: true },
    },
    response
  );

  Order.findOneAndUpdate = async () => null;
  const failedResponse = createResponse();
  await updateOrder(
    {
      user: { _id: userId },
      params: { id: orderId.toString() },
      body: { paymentStatus: "paid", manualPaymentConfirmed: true },
    },
    failedResponse
  );

  assert.equal(response.statusCode, 200);
  assert.equal(failedResponse.statusCode, 409);
  assert.deepEqual(
    activities.map((activity) => activity.action),
    ["payment_status_changed"]
  );
});

test("inventory adjustment records the successful stock change", async (t) => {
  const originalFindOne = Product.findOne;
  const originalActivityCreate = ActivityLog.create;
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const activities = [];
  const product = {
    _id: productId,
    userId,
    name: "Stocked item",
    stock: 5,
    lowStockThreshold: 2,
    status: "active",
    hasVariants: false,
    variants: [],
    toObject() {
      return {
        _id: this._id,
        userId: this.userId,
        name: this.name,
        stock: this.stock,
        lowStockThreshold: this.lowStockThreshold,
        status: this.status,
        hasVariants: this.hasVariants,
        variants: this.variants,
      };
    },
    async save() {},
  };

  Product.findOne = async () => product;
  ActivityLog.create = async (activity) => {
    activities.push(activity);
  };
  t.after(() => {
    Product.findOne = originalFindOne;
    ActivityLog.create = originalActivityCreate;
  });

  const response = createResponse();
  await adjustStock(
    {
      user: { _id: userId },
      params: { id: productId.toString() },
      body: { change: 2 },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(product.stock, 7);
  assert.equal(activities[0].action, "stock_increased");
  assert.equal(activities[0].metadata.change, 2);
});

function createResponseFactory() {
  return createResponse();
}
