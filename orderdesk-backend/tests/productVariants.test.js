import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Notification from "../models/Notification.js";
import ActivityLog from "../models/ActivityLog.js";
import {
  createProduct,
  addVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
  updateProduct,
} from "../controllers/productController.js";
import {
  adjustStock,
  getInventory,
  getLowStockProducts,
} from "../controllers/inventoryController.js";
import { createOrder, updateOrder } from "../controllers/orderController.js";
import { isSkuAvailable, sanitizeVariantData } from "../utils/skuValidator.js";

Notification.findOneAndUpdate = async () => null;
Notification.updateOne = async () => ({ modifiedCount: 0 });
Notification.updateMany = async () => ({ modifiedCount: 0 });

// Helper to create mock Express response
function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

// -----------------------------------------------------------------------------
// Test 1: Creating a product with variants
// -----------------------------------------------------------------------------
test("1. Creating a product with variants computes total stock and sets hasVariants", async () => {
  const userId = new mongoose.Types.ObjectId();
  const originalCreate = Product.create;
  const originalFindOne = Product.findOne;
  const originalFind = Product.find;
  const originalActivityCreate = ActivityLog.create;
  const activities = [];

  let createdDoc = null;
  Product.findOne = () => ({
    lean: async () => null,
  });
  Product.find = () => ({
    lean: async () => [],
  });
  Product.create = async (doc) => {
    createdDoc = doc;
    return { ...doc, _id: new mongoose.Types.ObjectId() };
  };
  ActivityLog.create = async (activity) => {
    activities.push(activity);
    return activity;
  };

  const req = {
    user: { _id: userId },
    body: {
      name: "Stitched Lawn 3pc",
      price: 4500,
      sku: "LAWN-001",
      variants: [
        { size: "S", color: "Blue", sku: "LAWN-001-S", price: 4500, stock: 10 },
        { size: "M", color: "Blue", sku: "LAWN-001-M", price: 4500, stock: 15 },
        { size: "L", color: "Blue", sku: "LAWN-001-L", price: 4700, stock: 5 },
      ],
    },
  };
  const res = mockRes();

  try {
    await createProduct(req, res);
  } finally {
    Product.create = originalCreate;
    Product.findOne = originalFindOne;
    Product.find = originalFind;
    ActivityLog.create = originalActivityCreate;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(createdDoc.hasVariants, true);
  assert.equal(createdDoc.stock, 30); // 10 + 15 + 5
  assert.equal(createdDoc.variants.length, 3);
  assert.equal(createdDoc.variants[0].sku, "LAWN-001-S");
  assert.deepEqual(
    activities.map((activity) => activity.action),
    [
      "product_created",
      "variant_created",
      "variant_created",
      "variant_created",
    ]
  );
});

// -----------------------------------------------------------------------------
// Test 2: Adding and updating variants
// -----------------------------------------------------------------------------
test("2. Adding and updating variants modifies product variants and updates total stock", async () => {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const originalFindOne = Product.findOne;
  const originalFind = Product.find;

  // Create a real Mongoose product instance
  const product = new Product({
    _id: productId,
    userId,
    name: "Classic Chiffon",
    price: 3000,
    sku: "CHIFFON-01",
    stock: 0,
    hasVariants: false,
    variants: [],
  });

  product.save = async function () {
    return this;
  };

  Product.findOne = (filter) => {
    if (filter?._id?.toString() === productId.toString() && filter?.userId?.toString() === userId.toString()) {
      return product;
    }
    return {
      lean: async () => null,
    };
  };
  Product.find = () => ({
    lean: async () => [],
  });

  try {
    // 2a. Add variant
    const addReq = {
      user: { _id: userId },
      params: { id: productId.toString() },
      body: {
        size: "M",
        color: "Pink",
        sku: "CHIFFON-PINK-M",
        price: 3200,
        stock: 12,
      },
    };
    const addRes = mockRes();
    await addVariant(addReq, addRes);

    assert.equal(addRes.statusCode, 201);
    assert.equal(product.hasVariants, true);
    assert.equal(product.variants.length, 1);
    assert.equal(product.stock, 12);

    const variantId = product.variants[0]._id.toString();

    // 2b. Update variant
    const updateReq = {
      user: { _id: userId },
      params: { id: productId.toString(), variantId },
      body: {
        price: 3500,
        stock: 20,
      },
    };
    const updateRes = mockRes();
    await updateVariant(updateReq, updateRes);

    assert.equal(updateRes.statusCode, 200);
    assert.equal(product.variants[0].price, 3500);
    assert.equal(product.variants[0].stock, 20);
    assert.equal(product.stock, 20);
  } finally {
    Product.findOne = originalFindOne;
    Product.find = originalFind;
  }
});

test("Updating a product preserves IDs for its existing variants", async () => {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const originalFindOne = Product.findOne;
  const originalFind = Product.find;
  const originalFindOneAndUpdate = Product.findOneAndUpdate;
  const product = new Product({
    _id: productId,
    userId,
    name: "Classic Chiffon",
    price: 3000,
    variants: [
      {
        _id: variantId,
        sku: "CHIFFON-M",
        size: "M",
        color: "Pink",
        price: 3200,
        stock: 12,
      },
    ],
  });
  let update;

  Product.findOne = (filter) => {
    if (filter?._id?.toString() === productId.toString()) {
      return product;
    }
    return { lean: async () => null };
  };
  Product.find = () => ({
    lean: async () => [
      { variants: [{ _id: variantId, sku: "CHIFFON-M" }] },
    ],
  });
  Product.findOneAndUpdate = async (_filter, updateDoc) => {
    update = updateDoc.$set;
    return product;
  };

  const req = {
    user: { _id: userId },
    params: { id: productId.toString() },
    body: {
      variants: [
        {
          _id: variantId.toString(),
          sku: "CHIFFON-M",
          size: "M",
          color: "Pink",
          price: 3200,
          stock: 15,
        },
      ],
    },
  };
  const res = mockRes();

  try {
    await updateProduct(req, res);
  } finally {
    Product.findOne = originalFindOne;
    Product.find = originalFind;
    Product.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(update.variants[0]._id.toString(), variantId.toString());
  assert.equal(update.stock, 15);
});

// -----------------------------------------------------------------------------
// Test 3: Deleting a variant
// -----------------------------------------------------------------------------
test("3. Deleting a variant removes it, updates total stock and updates hasVariants", async () => {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const originalFindOne = Product.findOne;

  const product = new Product({
    _id: productId,
    userId,
    name: "Silk Tunic",
    price: 5000,
    stock: 25,
    hasVariants: true,
    variants: [
      { size: "S", color: "Black", price: 5000, stock: 10 },
      { size: "M", color: "Black", price: 5000, stock: 15 },
    ],
  });

  product.save = async function () {
    return this;
  };

  Product.findOne = async () => product;

  try {
    const variantIdToDelete = product.variants[0]._id.toString();
    const req = {
      user: { _id: userId },
      params: { id: productId.toString(), variantId: variantIdToDelete },
    };
    const res = mockRes();

    await deleteVariant(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(product.variants.length, 1);
    assert.equal(product.stock, 15);
    assert.equal(product.hasVariants, true);

    // Delete the remaining variant
    const secondVariantId = product.variants[0]._id.toString();
    const req2 = {
      user: { _id: userId },
      params: { id: productId.toString(), variantId: secondVariantId },
    };
    const res2 = mockRes();
    await deleteVariant(req2, res2);

    assert.equal(res2.statusCode, 200);
    assert.equal(product.variants.length, 0);
    assert.equal(product.stock, 0);
    assert.equal(product.hasVariants, false);
  } finally {
    Product.findOne = originalFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 4: Rejecting duplicate SKUs
// -----------------------------------------------------------------------------
test("4. Duplicate SKUs are rejected within variants and across seller products", async () => {
  const userId = new mongoose.Types.ObjectId();
  const originalFindOne = Product.findOne;
  const originalFind = Product.find;

  Product.findOne = (query) => {
    if (query?.["sku"] === "EXISTING-SKU") {
      return { lean: async () => ({ _id: new mongoose.Types.ObjectId() }) };
    }
    return { lean: async () => null };
  };
  Product.find = () => ({ lean: async () => [] });

  try {
    // 4a. Duplicate SKU within same creation payload
    const createReq = {
      user: { _id: userId },
      body: {
        name: "Duplicate SKU Product",
        price: 1000,
        variants: [
          { size: "S", sku: "DUPLICATE-SKU", price: 1000, stock: 5 },
          { size: "M", sku: "DUPLICATE-SKU", price: 1000, stock: 5 },
        ],
      },
    };
    const createRes = mockRes();
    await createProduct(createReq, createRes);
    assert.equal(createRes.statusCode, 409);
    assert.match(createRes.body.message, /Duplicate SKU/);

    // 4b. Variant SKU matching parent product SKU
    const matchParentReq = {
      user: { _id: userId },
      body: {
        name: "Parent Match Product",
        sku: "PARENT-SKU",
        price: 1000,
        variants: [{ size: "S", sku: "PARENT-SKU", price: 1000, stock: 5 }],
      },
    };
    const matchParentRes = mockRes();
    await createProduct(matchParentReq, matchParentRes);
    assert.equal(matchParentRes.statusCode, 409);
    assert.match(matchParentRes.body.message, /match the product SKU/);

    // 4c. Variant SKU already taken by another product owned by this seller
    const existingSkuAvailable = await isSkuAvailable(userId, "EXISTING-SKU");
    assert.equal(existingSkuAvailable, false);
  } finally {
    Product.findOne = originalFindOne;
    Product.find = originalFind;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Rejecting negative stock and invalid prices
// -----------------------------------------------------------------------------
test("5. Rejecting negative stock, non-integer stock, and negative prices", () => {
  // Negative price
  const res1 = sanitizeVariantData({ price: -50 });
  assert.match(res1.error, /price must be a valid non-negative number/);

  // Negative stock
  const res2 = sanitizeVariantData({ price: 100, stock: -5 });
  assert.match(res2.error, /stock must be a non-negative whole number/);

  // Non-integer stock
  const res3 = sanitizeVariantData({ price: 100, stock: 3.5 });
  assert.match(res3.error, /stock must be a non-negative whole number/);

  // Negative cost price
  const res4 = sanitizeVariantData({ price: 100, costPrice: -10 });
  assert.match(res4.error, /cost price must be a valid non-negative number/);
});

// -----------------------------------------------------------------------------
// Test 6 & 7: Creating an order with a variant and deducting variant stock
// -----------------------------------------------------------------------------
test("6 & 7. Creating an order using a variant deducts variant stock and captures variant snapshot", async () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();

  const originalFindOneCustomer = Customer.findOne;
  const originalFindOneProduct = Product.findOne;
  const originalFindOneAndUpdateProduct = Product.findOneAndUpdate;
  const originalCreateOrder = Order.create;
  const originalActivityCreate = ActivityLog.create;
  const activities = [];

  Customer.findOne = async () => ({
    _id: customerId,
    name: "Amina Khan",
    phone: "03001234567",
    address: "Lahore",
    city: "Lahore",
  });

  const variantDoc = {
    _id: variantId,
    size: "M",
    color: "Emerald Green",
    sku: "EMERALD-M",
    price: 5200,
    stock: 8,
    status: "active",
  };

  const productDoc = {
    _id: productId,
    userId,
    name: "Embroidered Velvet",
    price: 5000,
    status: "active",
    hasVariants: true,
    variants: {
      id: (id) => (id.toString() === variantId.toString() ? variantDoc : null),
    },
  };

  Product.findOne = async () => productDoc;

  let stockDeducted = false;
  Product.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter._id.toString(), productId.toString());
    assert.deepEqual(filter.variants, {
      $elemMatch: {
        _id: variantId,
        status: "active",
        stock: { $gte: 2 },
      },
    });
    assert.deepEqual(update.$inc, {
      "variants.$.stock": -2,
      stock: -2,
    });
    stockDeducted = true;
    return { ...productDoc };
  };

  let createdOrderDoc = null;
  Order.create = async (doc) => {
    createdOrderDoc = doc;
    return doc;
  };
  ActivityLog.create = async (activity) => {
    activities.push(activity);
    return activity;
  };

  const req = {
    user: { _id: userId },
    body: {
      customerId: customerId.toString(),
      items: [
        {
          productId: productId.toString(),
          variantId: variantId.toString(),
          quantity: 2,
        },
      ],
      paymentMethod: "COD",
    },
  };
  const res = mockRes();

  try {
    await createOrder(req, res);
  } finally {
    Customer.findOne = originalFindOneCustomer;
    Product.findOne = originalFindOneProduct;
    Product.findOneAndUpdate = originalFindOneAndUpdateProduct;
    Order.create = originalCreateOrder;
    ActivityLog.create = originalActivityCreate;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(stockDeducted, true);
  assert.equal(createdOrderDoc.items.length, 1);

  const orderItem = createdOrderDoc.items[0];
  assert.equal(orderItem.productId.toString(), productId.toString());
  assert.equal(orderItem.variantId.toString(), variantId.toString());
  assert.deepEqual(
    activities.map((activity) => activity.action),
    ["order_created", "stock_decreased"]
  );
  assert.equal(orderItem.name, "Embroidered Velvet - M / Emerald Green");
  assert.equal(orderItem.size, "M");
  assert.equal(orderItem.color, "Emerald Green");
  assert.equal(orderItem.sku, "EMERALD-M");
  assert.equal(orderItem.unitPrice, 5200); // Actual variant price, not parent price
  assert.equal(orderItem.lineTotal, 10400);
});

// -----------------------------------------------------------------------------
// Test 8: Restoring variant stock on cancellation
// -----------------------------------------------------------------------------
test("8. Restoring variant stock on order cancellation and preventing duplicate restoration", async () => {
  const userId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();

  const originalStartSession = mongoose.startSession;
  const originalFindOneOrder = Order.findOne;
  const originalFindOneAndUpdateOrder = Order.findOneAndUpdate;
  const originalFindOneAndUpdateProduct = Product.findOneAndUpdate;
  const originalActivityCreate = ActivityLog.create;
  const activities = [];
  ActivityLog.create = async (activity) => {
    activities.push(activity);
    return activity;
  };

  let stockRestored = false;

  const mockSession = {
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  };
  mongoose.startSession = async () => mockSession;

  const existingOrder = {
    _id: orderId,
    userId,
    orderStatus: "confirmed",
    paymentStatus: "unpaid",
    items: [
      {
        productId,
        variantId,
        name: "Velvet - M / Blue",
        quantity: 3,
      },
    ],
  };

  Order.findOne = () => ({
    session: () => existingOrder,
  });

  Order.findOneAndUpdate = async () => ({
    ...existingOrder,
    orderStatus: "cancelled",
  });

  Product.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter._id.toString(), productId.toString());
    assert.equal(filter["variants._id"].toString(), variantId.toString());
    assert.deepEqual(update.$inc, {
      "variants.$.stock": 3,
      stock: 3,
    });
    stockRestored = true;
    const updatedVariant = {
      _id: variantId,
      size: "M",
      color: "Blue",
      stock: 8,
      lowStockThreshold: 5,
      status: "active",
    };
    return {
      status: "active",
      variants: { id: () => updatedVariant },
    };
  };

  const req = {
    user: { _id: userId },
    params: { id: orderId.toString() },
    body: { orderStatus: "cancelled" },
  };
  const res = mockRes();

  try {
    await updateOrder(req, res);
  } finally {
    mongoose.startSession = originalStartSession;
    Order.findOne = originalFindOneOrder;
    Order.findOneAndUpdate = originalFindOneAndUpdateOrder;
    Product.findOneAndUpdate = originalFindOneAndUpdateProduct;
    ActivityLog.create = originalActivityCreate;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(stockRestored, true);
  assert.match(res.body.message, /cancelled and stock restored/);
  assert.deepEqual(
    activities.map((activity) => activity.action),
    ["order_cancelled", "stock_increased"]
  );
});

// -----------------------------------------------------------------------------
// Test 9: Creating orders for normal products without variants
// -----------------------------------------------------------------------------
test("9. Creating orders for normal products without variants continues working normally", async () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  const originalFindOneCustomer = Customer.findOne;
  const originalFindOneProduct = Product.findOne;
  const originalFindOneAndUpdateProduct = Product.findOneAndUpdate;
  const originalCreateOrder = Order.create;

  Customer.findOne = async () => ({
    _id: customerId,
    name: "Bilal Tariq",
    phone: "03211234567",
  });

  const normalProduct = {
    _id: productId,
    userId,
    name: "Single Piece Dupatta",
    price: 1500,
    sku: "DUPATTA-01",
    status: "active",
    hasVariants: false,
    variants: [],
  };

  Product.findOne = async () => normalProduct;

  let parentStockDeducted = false;
  Product.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter._id.toString(), productId.toString());
    assert.equal(filter.stock.$gte, 2);
    assert.deepEqual(update.$inc, { stock: -2 });
    parentStockDeducted = true;
    return normalProduct;
  };

  let createdOrderDoc = null;
  Order.create = async (doc) => {
    createdOrderDoc = doc;
    return doc;
  };

  const req = {
    user: { _id: userId },
    body: {
      customerId: customerId.toString(),
      items: [{ productId: productId.toString(), quantity: 2 }],
      paymentMethod: "COD",
    },
  };
  const res = mockRes();

  try {
    await createOrder(req, res);
  } finally {
    Customer.findOne = originalFindOneCustomer;
    Product.findOne = originalFindOneProduct;
    Product.findOneAndUpdate = originalFindOneAndUpdateProduct;
    Order.create = originalCreateOrder;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(parentStockDeducted, true);
  assert.equal(createdOrderDoc.items[0].variantId, null);
  assert.equal(createdOrderDoc.items[0].unitPrice, 1500);
});

// -----------------------------------------------------------------------------
// Test 10: Access control between different users
// -----------------------------------------------------------------------------
test("10. Access control rejects access to other sellers' products and variants", async () => {
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();

  const originalFindOne = Product.findOne;

  // Product belongs to User A
  Product.findOne = async (filter) => {
    if (filter.userId?.toString() === userA.toString()) {
      return {
        _id: productId,
        userId: userA,
        name: "User A Product",
        variants: [{ _id: variantId, size: "M", price: 1000 }],
      };
    }
    // Return null if requested by User B
    return null;
  };

  try {
    // User B tries to get variants of User A's product
    const getReq = {
      user: { _id: userB },
      params: { id: productId.toString() },
    };
    const getRes = mockRes();
    await getVariants(getReq, getRes);
    assert.equal(getRes.statusCode, 404);

    // User B tries to update a variant of User A's product
    const updateReq = {
      user: { _id: userB },
      params: { id: productId.toString(), variantId: variantId.toString() },
      body: { price: 2000 },
    };
    const updateRes = mockRes();
    await updateVariant(updateReq, updateRes);
    assert.equal(updateRes.statusCode, 404);

    // User B tries to delete a variant of User A's product
    const deleteReq = {
      user: { _id: userB },
      params: { id: productId.toString(), variantId: variantId.toString() },
    };
    const deleteRes = mockRes();
    await deleteVariant(deleteReq, deleteRes);
    assert.equal(deleteRes.statusCode, 404);

    // User B tries to adjust stock of User A's variant
    const adjustReq = {
      user: { _id: userB },
      params: { id: productId.toString() },
      body: { variantId: variantId.toString(), change: 5 },
    };
    const adjustRes = mockRes();
    await adjustStock(adjustReq, adjustRes);
    assert.equal(adjustRes.statusCode, 404);
  } finally {
    Product.findOne = originalFindOne;
  }
});

test("A supplied empty variant ID is rejected instead of treated as a normal product", async () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const originalFindOneCustomer = Customer.findOne;
  const originalFindOneProduct = Product.findOne;

  Customer.findOne = async () => ({ _id: customerId });
  Product.findOne = async () => {
    throw new Error("Product lookup should not happen for an invalid variant ID");
  };

  const req = {
    user: { _id: userId },
    body: {
      customerId: customerId.toString(),
      items: [{ productId: productId.toString(), variantId: "", quantity: 1 }],
    },
  };
  const res = mockRes();

  try {
    await createOrder(req, res);
  } finally {
    Customer.findOne = originalFindOneCustomer;
    Product.findOne = originalFindOneProduct;
  }

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Invalid variant ID");
});

test("Repeated order submissions with the same idempotency key do not deduct stock twice", async () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const key = "123e4567-e89b-42d3-a456-426614174000";
  const originalFindOneCustomer = Customer.findOne;
  const originalFindOneProduct = Product.findOne;
  const originalFindOneAndUpdateProduct = Product.findOneAndUpdate;
  const originalFindOneOrder = Order.findOne;
  const originalCreateOrder = Order.create;
  let stockDeductionCount = 0;
  let savedOrder = null;

  Customer.findOne = async () => ({
    _id: customerId,
    name: "Amina Khan",
    phone: "03001234567",
  });
  Product.findOne = async () => ({
    _id: productId,
    userId,
    name: "Lawn Shirt",
    price: 2500,
    stock: 5,
    status: "active",
    hasVariants: false,
    variants: [],
  });
  Product.findOneAndUpdate = async () => {
    stockDeductionCount += 1;
    return { _id: productId };
  };
  Order.findOne = async (filter) => {
    assert.equal(filter.userId.toString(), userId.toString());
    assert.equal(filter.idempotencyKey, key);
    return savedOrder;
  };
  Order.create = async (doc) => {
    savedOrder = doc;
    return doc;
  };

  const request = {
    user: { _id: userId },
    headers: { "idempotency-key": key },
    body: {
      customerId: customerId.toString(),
      items: [{ productId: productId.toString(), quantity: 1 }],
    },
  };
  const firstResponse = mockRes();
  const retryResponse = mockRes();

  try {
    await createOrder(request, firstResponse);
    await createOrder(request, retryResponse);
  } finally {
    Customer.findOne = originalFindOneCustomer;
    Product.findOne = originalFindOneProduct;
    Product.findOneAndUpdate = originalFindOneAndUpdateProduct;
    Order.findOne = originalFindOneOrder;
    Order.create = originalCreateOrder;
  }

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(retryResponse.body.order, savedOrder);
  assert.equal(stockDeductionCount, 1);
});

test("Concurrent duplicate submissions roll back the losing stock deduction", async () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const key = "123e4567-e89b-42d3-a456-426614174001";
  const originalFindOneCustomer = Customer.findOne;
  const originalFindOneProduct = Product.findOne;
  const originalFindOneAndUpdateProduct = Product.findOneAndUpdate;
  const originalUpdateOneProduct = Product.updateOne;
  const originalFindOneOrder = Order.findOne;
  const originalCreateOrder = Order.create;
  let orderLookupCount = 0;
  let createCount = 0;
  let stockDeductionCount = 0;
  let stockRestorationCount = 0;
  let savedOrder = null;

  Customer.findOne = async () => ({
    _id: customerId,
    name: "Amina Khan",
    phone: "03001234567",
  });
  Product.findOne = async () => ({
    _id: productId,
    userId,
    name: "Lawn Shirt",
    price: 2500,
    stock: 5,
    status: "active",
    hasVariants: false,
    variants: [],
  });
  Product.findOneAndUpdate = async () => {
    stockDeductionCount += 1;
    return { _id: productId };
  };
  Product.updateOne = async () => {
    stockRestorationCount += 1;
    return { matchedCount: 1 };
  };
  Order.findOne = async () => {
    orderLookupCount += 1;
    return orderLookupCount === 3 ? savedOrder : null;
  };
  Order.create = async (doc) => {
    createCount += 1;
    if (createCount === 1) {
      savedOrder = doc;
      return doc;
    }
    const duplicateError = new Error("Duplicate idempotency key");
    duplicateError.code = 11000;
    throw duplicateError;
  };

  const request = {
    user: { _id: userId },
    headers: { "idempotency-key": key },
    body: {
      customerId: customerId.toString(),
      items: [{ productId: productId.toString(), quantity: 1 }],
    },
  };
  const firstResponse = mockRes();
  const retryResponse = mockRes();

  try {
    await createOrder(request, firstResponse);
    await createOrder(request, retryResponse);
  } finally {
    Customer.findOne = originalFindOneCustomer;
    Product.findOne = originalFindOneProduct;
    Product.findOneAndUpdate = originalFindOneAndUpdateProduct;
    Product.updateOne = originalUpdateOneProduct;
    Order.findOne = originalFindOneOrder;
    Order.create = originalCreateOrder;
  }

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(stockDeductionCount, 2);
  assert.equal(stockRestorationCount, 1);
});

test("Inventory exposes active low-stock variants and derives total stock from variants", async () => {
  const userId = new mongoose.Types.ObjectId();
  const product = {
    _id: new mongoose.Types.ObjectId(),
    name: "Seasonal Kurta",
    hasVariants: true,
    stock: 999,
    variants: [
      {
        _id: new mongoose.Types.ObjectId(),
        size: "S",
        color: "Blue",
        stock: 2,
        lowStockThreshold: 5,
        status: "active",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        size: "M",
        color: "Blue",
        stock: 8,
        lowStockThreshold: 5,
        status: "active",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        size: "L",
        color: "Blue",
        stock: 0,
        lowStockThreshold: 5,
        status: "inactive",
      },
    ],
  };
  const originalFind = Product.find;
  Product.find = () => ({ sort: async () => [product] });

  const res = mockRes();
  try {
    await getInventory({ user: { _id: userId } }, res);
  } finally {
    Product.find = originalFind;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].stock, 10);
  assert.equal(res.body.data[0].lowStockVariants.length, 1);
  assert.equal(res.body.data[0].lowStockVariants[0].variantName, "S / Blue");
});
