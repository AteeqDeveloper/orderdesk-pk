import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { createOrder, updateOrder } from "../controllers/orderController.js";
import {
  getStockAlertType,
  notifyOrderStatusChange,
  syncProductStockAlerts,
  syncStockAlert,
} from "../utils/notificationService.js";

const mockResponse = () => ({
  statusCode: 200,
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

const notificationQuery = (result) => ({
  select() {
    return this;
  },
  lean: async () => result,
});

test("stock alert severity detects threshold and out-of-stock states", () => {
  assert.equal(getStockAlertType(5, 5), "low_stock");
  assert.equal(getStockAlertType(1, 5), "low_stock");
  assert.equal(getStockAlertType(0, 5), "out_of_stock");
  assert.equal(getStockAlertType(8, 5), null);
  assert.equal(getStockAlertType(0, 5, false), null);
});

test("product stock crossing into low stock creates a seller-scoped alert", async () => {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  let savedFilter;
  let savedUpdate;
  Notification.findOneAndUpdate = async (filter, update, options) => {
    savedFilter = filter;
    savedUpdate = update;
    assert.equal(options.upsert, true);
    return { _id: new mongoose.Types.ObjectId() };
  };

  try {
    await syncStockAlert({
      userId,
      productId,
      productName: "Canvas Tote",
      before: { stock: 6, lowStockThreshold: 5, active: true },
      after: { stock: 5, lowStockThreshold: 5, active: true },
    });
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.deepEqual(savedFilter, {
    userId,
    dedupeKey: `product:${productId}`,
  });
  assert.equal(savedUpdate.$set.type, "low_stock");
  assert.equal(savedUpdate.$set.relatedId.toString(), productId.toString());
  assert.equal(savedUpdate.$set.relatedType, "product");
  assert.equal(savedUpdate.$set.isRead, false);
});

test("zero stock creates an out-of-stock notification and reuses the same variant alert key", async () => {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const filters = [];
  const updates = [];
  Notification.findOneAndUpdate = async (filter, update) => {
    filters.push(filter);
    updates.push(update);
    return {};
  };

  try {
    for (const [beforeStock, stock] of [[2, 0], [1, 0]]) {
      await syncStockAlert({
        userId,
        productId,
        variantId,
        productName: "Linen Shirt",
        variantName: "M / Blue",
        before: {
          stock: beforeStock,
          lowStockThreshold: 3,
          active: true,
        },
        after: { stock, lowStockThreshold: 3, active: true },
      });
    }
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(filters.length, 2);
  assert.deepEqual(filters[0], filters[1]);
  assert.equal(filters[0].dedupeKey, `variant:${variantId}`);
  assert.equal(updates[0].$set.type, "out_of_stock");
  assert.match(updates[0].$set.message, /Linen Shirt · M \/ Blue is out of stock/);
  const uniqueIndex = Notification.schema.indexes().find(
    ([fields, options]) =>
      fields.userId === 1 &&
      fields.dedupeKey === 1 &&
      options.unique === true
  );
  assert.ok(uniqueIndex);
});

test("variant stock updates transition an existing low-stock alert to out of stock", async () => {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  let update;
  Notification.findOneAndUpdate = async (_filter, notificationUpdate) => {
    update = notificationUpdate;
    return {};
  };

  try {
    await syncProductStockAlerts(
      userId,
      {
        _id: productId,
        name: "Kurta",
        status: "active",
        hasVariants: true,
        variants: [
          {
            _id: variantId,
            size: "L",
            color: "Green",
            stock: 2,
            lowStockThreshold: 4,
            status: "active",
          },
        ],
      },
      {
        _id: productId,
        name: "Kurta",
        status: "active",
        hasVariants: true,
        variants: [
          {
            _id: variantId,
            size: "L",
            color: "Green",
            stock: 0,
            lowStockThreshold: 4,
            status: "active",
          },
        ],
      }
    );
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(update.$set.type, "out_of_stock");
  assert.equal(update.$set.relatedType, "variant");
  assert.equal(update.$set.relatedProductId.toString(), productId.toString());
});

test("order creation emits a low-stock alert after successful stock deduction", async () => {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const originalProductFindOne = Product.findOne;
  const originalProductUpdate = Product.findOneAndUpdate;
  const originalCustomerFindOne = Customer.findOne;
  const originalOrderCreate = Order.create;
  const originalNotificationUpdate = Notification.findOneAndUpdate;
  let alert;

  Product.findOne = async () => ({
    _id: productId,
    userId,
    name: "Wallet",
    price: 1000,
    stock: 6,
    lowStockThreshold: 5,
    hasVariants: false,
    variants: [],
    status: "active",
  });
  Product.findOneAndUpdate = async (_filter, update) => {
    assert.deepEqual(update.$inc, { stock: -1 });
    return {
      _id: productId,
      name: "Wallet",
      stock: 5,
      lowStockThreshold: 5,
      status: "active",
    };
  };
  Customer.findOne = async () => ({
    _id: customerId,
    name: "Customer",
    phone: "03000000000",
  });
  Order.create = async (order) => order;
  Notification.findOneAndUpdate = async (_filter, update) => {
    alert = update.$set;
    return {};
  };

  const response = mockResponse();
  try {
    await createOrder(
      {
        user: { _id: userId },
        body: {
          customerId: customerId.toString(),
          items: [{ productId: productId.toString(), quantity: 1 }],
        },
      },
      response
    );
  } finally {
    Product.findOne = originalProductFindOne;
    Product.findOneAndUpdate = originalProductUpdate;
    Customer.findOne = originalCustomerFindOne;
    Order.create = originalOrderCreate;
    Notification.findOneAndUpdate = originalNotificationUpdate;
  }

  assert.equal(response.statusCode, 201);
  assert.equal(alert.type, "low_stock");
  assert.equal(alert.relatedProductId.toString(), productId.toString());
});

test("order cancellation restores stock and notifies the owner of the status change", async () => {
  const userId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const originalStartSession = mongoose.startSession;
  const originalOrderFindOne = Order.findOne;
  const originalOrderUpdate = Order.findOneAndUpdate;
  const originalProductUpdate = Product.findOneAndUpdate;
  const originalNotificationUpdate = Notification.findOneAndUpdate;
  const originalNotificationReadUpdate = Notification.updateOne;
  const notifications = [];

  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => {},
  });
  const currentOrder = {
    _id: orderId,
    userId,
    orderStatus: "confirmed",
    paymentStatus: "unpaid",
    items: [{ productId, quantity: 3, name: "Wallet" }],
  };
  Order.findOne = () => ({ session: () => currentOrder });
  Order.findOneAndUpdate = async () => ({
    ...currentOrder,
    orderStatus: "cancelled",
  });
  Product.findOneAndUpdate = async (_filter, update) => {
    assert.deepEqual(update.$inc, { stock: 3 });
    return {
      _id: productId,
      name: "Wallet",
      stock: 3,
      lowStockThreshold: 5,
      status: "active",
    };
  };
  Notification.findOneAndUpdate = async (_filter, update) => {
    notifications.push(update.$set);
    return {};
  };
  Notification.updateOne = async () => ({ modifiedCount: 0 });

  const response = mockResponse();
  try {
    await updateOrder(
      {
        user: { _id: userId },
        params: { id: orderId.toString() },
        body: { orderStatus: "cancelled" },
      },
      response
    );
  } finally {
    mongoose.startSession = originalStartSession;
    Order.findOne = originalOrderFindOne;
    Order.findOneAndUpdate = originalOrderUpdate;
    Product.findOneAndUpdate = originalProductUpdate;
    Notification.findOneAndUpdate = originalNotificationUpdate;
    Notification.updateOne = originalNotificationReadUpdate;
  }

  assert.equal(response.statusCode, 200);
  assert.ok(notifications.some((item) => item.type === "low_stock"));
  assert.ok(notifications.some((item) => item.type === "order_update"));
});

test("order status notifications deduplicate per order and skip unchanged states", async () => {
  const userId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  let calls = 0;
  let saved;
  Notification.findOneAndUpdate = async (filter, update) => {
    calls += 1;
    saved = { filter, update };
    return {};
  };

  try {
    await notifyOrderStatusChange({
      userId,
      orderId,
      previousStatus: "pending",
      orderStatus: "confirmed",
    });
    await notifyOrderStatusChange({
      userId,
      orderId,
      previousStatus: "confirmed",
      orderStatus: "confirmed",
    });
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(calls, 1);
  assert.deepEqual(saved.filter, { userId, dedupeKey: `order:${orderId}` });
  assert.equal(saved.update.$set.type, "order_update");
  assert.equal(saved.update.$set.relatedId.toString(), orderId.toString());
});

test("notification list and unread total are scoped to the authenticated user", async () => {
  const userA = new mongoose.Types.ObjectId();
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;
  let query;
  let countQuery;
  Notification.find = (filter) => {
    query = filter;
    return {
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      select() {
        return this;
      },
      lean: async () => [],
    };
  };
  Notification.countDocuments = async (filter) => {
    countQuery = filter;
    return 0;
  };

  const response = mockResponse();
  try {
    await getNotifications({ user: { _id: userA }, query: { limit: "10" } }, response);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  }

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query, { userId: userA });
  assert.deepEqual(countQuery, { userId: userA, isRead: false });
});

test("mark read, mark all read, and delete use owner filters", async () => {
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();
  const notificationId = new mongoose.Types.ObjectId();
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const originalUpdateMany = Notification.updateMany;
  const originalFindOneAndDelete = Notification.findOneAndDelete;
  const filters = [];

  Notification.findOneAndUpdate = (filter) => {
    filters.push(filter);
    return notificationQuery(
      filter.userId.equals(userA) ? { _id: notificationId, isRead: true } : null
    );
  };
  Notification.updateMany = async (filter) => {
    filters.push(filter);
    return { modifiedCount: 1 };
  };
  Notification.findOneAndDelete = async (filter) => {
    filters.push(filter);
    return filter.userId.equals(userA) &&
      filter._id.toString() === notificationId.toString()
      ? { _id: notificationId }
      : null;
  };

  const readResponse = mockResponse();
  const allReadResponse = mockResponse();
  const deleteResponse = mockResponse();
  const otherUserResponse = mockResponse();
  try {
    await markNotificationRead(
      { user: { _id: userA }, params: { id: notificationId.toString() } },
      readResponse
    );
    await markAllNotificationsRead({ user: { _id: userA } }, allReadResponse);
    await deleteNotification(
      { user: { _id: userA }, params: { id: notificationId.toString() } },
      deleteResponse
    );
    await deleteNotification(
      { user: { _id: userA }, params: { id: userB.toString() } },
      otherUserResponse
    );
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
    Notification.updateMany = originalUpdateMany;
    Notification.findOneAndDelete = originalFindOneAndDelete;
  }

  assert.equal(readResponse.statusCode, 200);
  assert.equal(allReadResponse.statusCode, 200);
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(otherUserResponse.statusCode, 404);
  assert.ok(filters.every((filter) => filter.userId.equals(userA)));
  assert.equal(filters[1].isRead, false);
});

test("invalid notification IDs are rejected before database access", async () => {
  const response = mockResponse();
  await markNotificationRead(
    { user: { _id: new mongoose.Types.ObjectId() }, params: { id: "invalid" } },
    response
  );
  assert.equal(response.statusCode, 400);
});
