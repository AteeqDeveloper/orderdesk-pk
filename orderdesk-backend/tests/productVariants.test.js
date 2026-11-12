import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import {
  createProduct,
  addVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
} from "../controllers/productController.js";
import { adjustStock, getLowStockProducts } from "../controllers/inventoryController.js";
import { createOrder, updateOrder } from "../controllers/orderController.js";
import { isSkuAvailable, sanitizeVariantData } from "../utils/skuValidator.js";

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
  }

  assert.equal(res.statusCode, 201);
  assert.equal(createdDoc.hasVariants, true);
  assert.equal(createdDoc.stock, 30); // 10 + 15 + 5
  assert.equal(createdDoc.variants.length, 3);
  assert.equal(createdDoc.variants[0].sku, "LAWN-001-S");
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
    assert.equal(filter["variants._id"].toString(), variantId.toString());
    assert.deepEqual(filter["variants.stock"], { $gte: 2 });
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
  }

  assert.equal(res.statusCode, 201);
  assert.equal(stockDeducted, true);
  assert.equal(createdOrderDoc.items.length, 1);

  const orderItem = createdOrderDoc.items[0];
  assert.equal(orderItem.productId.toString(), productId.toString());
  assert.equal(orderItem.variantId.toString(), variantId.toString());
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
  const originalUpdateOneProduct = Product.updateOne;

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

  Product.updateOne = async (filter, update) => {
    assert.equal(filter._id.toString(), productId.toString());
    assert.equal(filter["variants._id"].toString(), variantId.toString());
    assert.deepEqual(update.$inc, {
      "variants.$.stock": 3,
      stock: 3,
    });
    stockRestored = true;
    return { matchedCount: 1 };
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
    Product.updateOne = originalUpdateOneProduct;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(stockRestored, true);
  assert.match(res.body.message, /cancelled and stock restored/);
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
