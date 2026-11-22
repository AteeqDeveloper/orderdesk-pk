import test from "node:test";
import assert from "node:assert/strict";
import ActivityLog from "../models/ActivityLog.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import dataManagementRoutes from "../routes/dataManagementRoutes.js";
import {
  escapeCsvCell,
  exportData,
  formatDate,
  formatMoney,
  generateBackup,
  parseExportDateRange,
  restoreBackup,
  validateBackup,
  validateBackupShape,
} from "../controllers/dataManagementController.js";

const createResponse = () => ({
  statusCode: null,
  headers: {},
  body: "",
  ended: false,
  status(code) {
    this.statusCode = code;
    return this;
  },
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  write(chunk) {
    this.body += chunk;
    return true;
  },
  end(chunk = "") {
    this.body += chunk;
    this.ended = true;
  },
  json(body) {
    this.body = body;
    return this;
  },
  destroy(error) {
    this.destroyedWith = error;
  },
});

const makeQuery = (records) => ({
  select(value) {
    this.projection = value;
    return this;
  },
  sort(value) {
    this.sortValue = value;
    return this;
  },
  lean() {
    return this;
  },
  cursor() {
    return {
      async *[Symbol.asyncIterator]() {
        yield* records;
      },
    };
  },
});
const makeLookupQuery = (records) => ({
  select() { return this; },
  lean: async () => records,
});

const validBackup = (ownerId = "65a000000000000000000001") => ({
  format: "orderdesk-backup",
  version: 1,
  ownerId,
  createdAt: "2026-01-01T00:00:00.000Z",
  settings: { businessName: "Store", phone: "" },
  products: [
    {
      _id: "65a000000000000000000010",
      name: "Shirt",
      price: 100,
      stock: 5,
      hasVariants: false,
      variants: [],
    },
  ],
  customers: [
    {
      _id: "65a000000000000000000020",
      name: "Customer",
      phone: "03000000000",
    },
  ],
  orders: [
    {
      _id: "65a000000000000000000030",
      customerId: "65a000000000000000000020",
      customerSnapshot: { name: "Customer", phone: "03000000000" },
      items: [
        {
          productId: "65a000000000000000000010",
          name: "Shirt",
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        },
      ],
      subtotal: 100,
      totalAmount: 100,
    },
  ],
});

test("CSV helpers format currency and dates and neutralize spreadsheet formulas", () => {
  assert.match(formatMoney(1234.5), /^PKR /);
  assert.equal(formatDate("2026-06-07T08:09:10.000Z"), "2026-06-07T08:09:10.000Z");
  assert.equal(escapeCsvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(escapeCsvCell("Plain, text"), "\"Plain, text\"");
});

test("export date ranges require valid paired inclusive boundaries", () => {
  assert.deepEqual(parseExportDateRange({}), { filter: {} });
  assert.deepEqual(parseExportDateRange({ startDate: "2026-03-01", endDate: "2026-03-02" }), {
    filter: {
      createdAt: {
        $gte: new Date("2026-03-01T00:00:00.000Z"),
        $lte: new Date("2026-03-02T23:59:59.999Z"),
      },
    },
  });
  assert.equal(parseExportDateRange({ startDate: "2026-02-31", endDate: "2026-03-02" }).error, "Date filters must be valid calendar dates");
  assert.ok(parseExportDateRange({ startDate: "2026-03-02" }).error);
  assert.equal(parseExportDateRange({ format: "xlsx" }).error, "Only CSV exports are currently supported");
});

test("product and customer exports are user-scoped, date-filtered CSV", async (t) => {
  const originalProductFind = Product.find;
  const originalCustomerFind = Customer.find;
  t.after(() => {
    Product.find = originalProductFind;
    Customer.find = originalCustomerFind;
  });
  const userId = "65a000000000000000000001";
  const expectedRange = {
    createdAt: {
      $gte: new Date("2026-05-01T00:00:00.000Z"),
      $lte: new Date("2026-05-31T23:59:59.999Z"),
    },
  };

  let productFilter;
  Product.find = (filter) => {
    productFilter = filter;
    return makeQuery([
      {
        _id: "product-id",
        name: "=formula",
        sku: "SKU1",
        price: 1250,
        costPrice: 500,
        stock: 4,
        createdAt: "2026-05-02T00:00:00.000Z",
      },
    ]);
  };
  const productResponse = createResponse();
  await exportData(
    {
      params: { type: "products" },
      query: { format: "csv", startDate: "2026-05-01", endDate: "2026-05-31" },
      user: { _id: userId },
    },
    productResponse
  );
  assert.deepEqual(productFilter, { userId, ...expectedRange });
  assert.match(productResponse.body, /Price \(PKR\)/);
  assert.match(productResponse.body, /PKR/);
  assert.match(productResponse.body, /'=formula/);

  let customerFilter;
  Customer.find = (filter) => {
    customerFilter = filter;
    return makeQuery([
      {
        _id: "customer-id",
        name: "Customer",
        phone: "03000000000",
        email: "customer@example.test",
      },
    ]);
  };
  const customerResponse = createResponse();
  await exportData(
    { params: { type: "customers" }, query: {}, user: { _id: userId } },
    customerResponse
  );
  assert.deepEqual(customerFilter, { userId });
  assert.match(customerResponse.body, /Customer ID/);
  assert.match(customerResponse.body, /customer@example\.test/);
});

test("order, inventory, variant, activity, and sales exports flatten business rows", async (t) => {
  const originals = [Product.find, Order.find, ActivityLog.find];
  t.after(() => {
    Product.find = originals[0];
    Order.find = originals[1];
    ActivityLog.find = originals[2];
  });
  const product = {
    _id: "product-id",
    name: "Jacket",
    stock: 5,
    costPrice: 200,
    hasVariants: true,
    variants: [{ _id: "variant-id", size: "M", stock: 2, costPrice: 300, sku: "J-M" }],
  };
  const order = {
    _id: "order-id",
    customerSnapshot: { name: "Buyer" },
    items: [{ productId: "product-id", name: "Jacket", quantity: 1, unitPrice: 100, lineTotal: 100 }],
    totalAmount: 100,
    orderStatus: "delivered",
    createdAt: "2026-05-02T00:00:00.000Z",
  };
  Product.find = () => makeQuery([product]);
  Order.find = () => makeQuery([order]);
  ActivityLog.find = () =>
    makeQuery([{ _id: "activity-id", action: "product_created", description: "Created", createdAt: "2026-05-02T00:00:00.000Z" }]);

  for (const [type, Model] of [
    ["orders", Order],
    ["sales-reports", Order],
    ["inventory", Product],
    ["variants", Product],
    ["activity-logs", ActivityLog],
  ]) {
    const response = createResponse();
    await exportData({ params: { type }, query: {}, user: { _id: "owner-id" } }, response);
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"], /text\/csv/);
    assert.match(response.body, type === "inventory" || type === "variants" ? /variant-id/ : type === "activity-logs" ? /activity-id/ : /order-id/);
    assert.ok(Model.find);
  }
});

test("CSV export iterates large cursors without pagination truncation", async (t) => {
  const originalFind = Customer.find;
  t.after(() => {
    Customer.find = originalFind;
  });
  const records = Array.from({ length: 1200 }, (_, index) => ({
    _id: `customer-${index}`,
    name: `Customer ${index}`,
    phone: "03000000000",
  }));
  Customer.find = () => makeQuery(records);
  const response = createResponse();
  await exportData(
    { params: { type: "customers" }, query: {}, user: { _id: "owner-id" } },
    response
  );
  assert.equal(response.body.trim().split("\r\n").length, 1201);
});

test("backup shape validates references and rejects cross-account or secret-bearing files", async () => {
  const backup = validBackup();
  const validated = await validateBackupShape(backup, backup.ownerId);
  assert.equal(validated.totalRecords, 3);
  await assert.rejects(
    validateBackupShape(backup, "65a000000000000000000002"),
    (error) => error.status === 403
  );
  await assert.rejects(
    validateBackupShape({ ...backup, password: "not allowed" }, backup.ownerId),
    /unsupported field "password"/i
  );
  const orphaned = validBackup();
  orphaned.orders[0].customerId = "not-an-object-id";
  await assert.rejects(validateBackupShape(orphaned, backup.ownerId), /customerId/i);
});

test("backup generation streams a versioned backup without user or credential fields", async (t) => {
  const originals = [Product.find, Customer.find, Order.find];
  t.after(() => {
    Product.find = originals[0];
    Customer.find = originals[1];
    Order.find = originals[2];
  });
  const projections = [];
  const emptyQuery = () => ({
    select(value) {
      projections.push(value);
      return this;
    },
    sort() { return this; },
    lean() { return this; },
    cursor() { return makeQuery([]).cursor(); },
  });
  Product.find = emptyQuery;
  Customer.find = emptyQuery;
  Order.find = emptyQuery;
  const response = createResponse();
  await generateBackup(
    {
      user: {
        _id: "65a000000000000000000001",
        businessName: "Shop",
        phone: "03000000000",
        email: "private@example.test",
        password: "secret-hash",
      },
    },
    response
  );
  const backup = JSON.parse(response.body);
  assert.equal(backup.format, "orderdesk-backup");
  assert.equal(backup.version, 1);
  assert.deepEqual(backup.settings, { businessName: "Shop", phone: "03000000000" });
  assert.deepEqual(backup.products, []);
  assert.equal(JSON.stringify(backup).includes("secret-hash"), false);
  assert.equal(JSON.stringify(backup).includes("private@example.test"), false);
  assert.equal(
    projections.some((projection) =>
      ["userId", "password", "idempotencyKey", "idempotencyFingerprint"].some(
        (field) => projection.includes(field)
      )
    ),
    false
  );
});

test("backup preview rejects another account before querying its records", async (t) => {
  const originalFind = Product.find;
  t.after(() => {
    Product.find = originalFind;
  });
  Product.find = () => assert.fail("A foreign account backup must be rejected before lookup");
  const response = createResponse();
  await validateBackup(
    {
      file: { buffer: Buffer.from(JSON.stringify(validBackup("65a000000000000000000002"))) },
      user: { _id: "65a000000000000000000001" },
    },
    response
  );
  assert.equal(response.statusCode, 403);
});

test("backup preview rejects malformed JSON files", async () => {
  const response = createResponse();
  await validateBackup(
    {
      file: { buffer: Buffer.from("{not json") },
      user: { _id: "65a000000000000000000001" },
    },
    response
  );
  assert.equal(response.statusCode, 400);
  assert.ok(response.body.message);
});

test("backup preview skips records already present and refuses foreign references", async (t) => {
  const originals = [Product.find, Customer.find, Order.find];
  t.after(() => {
    Product.find = originals[0];
    Customer.find = originals[1];
    Order.find = originals[2];
  });
  const backup = validBackup();
  const userId = backup.ownerId;
  const existingProduct = { _id: backup.products[0]._id, variants: [] };
  const existingCustomer = { _id: backup.customers[0]._id };
  const existingOrder = { _id: backup.orders[0]._id };
  const ownedMatch = (filter, record) =>
    filter.userId === userId &&
    filter._id.$in.map(String).includes(String(record._id))
      ? [record]
      : [];
  Product.find = (filter) =>
    makeLookupQuery(ownedMatch(filter, existingProduct));
  Customer.find = (filter) =>
    makeLookupQuery(ownedMatch(filter, existingCustomer));
  Order.find = (filter) => makeLookupQuery(ownedMatch(filter, existingOrder));

  const previewResponse = createResponse();
  await validateBackup(
    { file: { buffer: Buffer.from(JSON.stringify(backup)) }, user: { _id: userId } },
    previewResponse
  );
  assert.equal(previewResponse.statusCode, 200);
  assert.deepEqual(previewResponse.body.data.toRestore, {
    products: 0,
    customers: 0,
    orders: 0,
  });
  assert.deepEqual(previewResponse.body.data.skipped, {
    products: 1,
    customers: 1,
    orders: 1,
  });

  const foreignCustomerId = "65a000000000000000000099";
  const foreignBackup = validBackup();
  foreignBackup.orders[0].customerId = foreignCustomerId;
  Customer.find = (filter) => {
    const records = filter.userId?.$ne
      ? [{ _id: foreignCustomerId }]
      : [];
    return makeLookupQuery(records);
  };
  const foreignResponse = createResponse();
  await validateBackup(
    {
      file: { buffer: Buffer.from(JSON.stringify(foreignBackup)) },
      user: { _id: userId },
    },
    foreignResponse
  );
  assert.equal(foreignResponse.statusCode, 400);
  assert.match(foreignResponse.body.message, /outside this account/i);
});

test("backup preview preserves historical order snapshots after source records were deleted", async (t) => {
  const originals = [Product.find, Customer.find, Order.find];
  t.after(() => {
    Product.find = originals[0];
    Customer.find = originals[1];
    Order.find = originals[2];
  });
  Product.find = () => makeLookupQuery([]);
  Customer.find = () => makeLookupQuery([]);
  Order.find = () => makeLookupQuery([]);
  const backup = validBackup();
  backup.products = [];
  backup.customers = [];
  const response = createResponse();
  await validateBackup(
    {
      file: { buffer: Buffer.from(JSON.stringify(backup)) },
      user: { _id: backup.ownerId },
    },
    response
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.toRestore.orders, 1);
});

test("restore merges missing records, skips IDs on repeat, and fills only blank settings", async (t) => {
  const originals = {
    find: [Product.find, Customer.find, Order.find],
    create: [Product.create, Customer.create, Order.create],
    deleteMany: [Product.deleteMany, Customer.deleteMany, Order.deleteMany],
  };
  t.after(() => {
    Product.find = originals.find[0];
    Customer.find = originals.find[1];
    Order.find = originals.find[2];
    Product.create = originals.create[0];
    Customer.create = originals.create[1];
    Order.create = originals.create[2];
    Product.deleteMany = originals.deleteMany[0];
    Customer.deleteMany = originals.deleteMany[1];
    Order.deleteMany = originals.deleteMany[2];
  });

  const backup = validBackup();
  backup.settings.phone = "03123456789";
  const userId = backup.ownerId;
  const stored = { products: [], customers: [], orders: [] };
  let createCount = 0;
  const queryFor = (Model, filter) => {
    if (filter.userId?.$ne) return makeLookupQuery([]);
    if (filter.userId !== userId) return makeLookupQuery([]);
    if (filter.$or) return makeLookupQuery([]);
    const records = stored[Model];
    const requestedIds = new Set((filter._id?.$in || []).map((id) => String(id)));
    return makeLookupQuery(records.filter((record) => requestedIds.has(String(record._id))));
  };
  Product.find = (filter) => queryFor("products", filter);
  Customer.find = (filter) => queryFor("customers", filter);
  Order.find = (filter) => queryFor("orders", filter);
  const modelStores = [
    [Product, "products"],
    [Customer, "customers"],
    [Order, "orders"],
  ];
  for (const [Model, key] of modelStores) {
    Model.create = async (record) => {
      createCount += 1;
      stored[key].push(record);
      return { _id: record._id };
    };
    Model.deleteMany = async () => ({ deletedCount: 0 });
  }
  const user = {
    _id: userId,
    businessName: "Existing business",
    phone: "",
    save: async () => {},
  };
  const request = () => ({
    file: { buffer: Buffer.from(JSON.stringify(backup)) },
    user,
  });
  const firstResponse = createResponse();
  await restoreBackup(request(), firstResponse);
  assert.equal(firstResponse.statusCode, 200);
  assert.deepEqual(firstResponse.body.data.restored, {
    products: 1,
    customers: 1,
    orders: 1,
  });
  assert.equal(stored.products[0].userId, userId);
  assert.equal(user.businessName, "Existing business");
  assert.equal(user.phone, "03123456789");

  const secondResponse = createResponse();
  await restoreBackup(request(), secondResponse);
  assert.equal(secondResponse.statusCode, 200);
  assert.deepEqual(secondResponse.body.data.restored, {
    products: 0,
    customers: 0,
    orders: 0,
  });
  assert.equal(createCount, 3);
});

test("restore rolls back only records it inserted if a later record fails", async (t) => {
  const originals = {
    find: [Product.find, Customer.find, Order.find],
    create: [Product.create, Customer.create, Order.create],
    deleteMany: [Product.deleteMany, Customer.deleteMany, Order.deleteMany],
    consoleError: console.error,
  };
  t.after(() => {
    Product.find = originals.find[0];
    Customer.find = originals.find[1];
    Order.find = originals.find[2];
    Product.create = originals.create[0];
    Customer.create = originals.create[1];
    Order.create = originals.create[2];
    Product.deleteMany = originals.deleteMany[0];
    Customer.deleteMany = originals.deleteMany[1];
    Order.deleteMany = originals.deleteMany[2];
    console.error = originals.consoleError;
  });

  Product.find = () => makeLookupQuery([]);
  Customer.find = () => makeLookupQuery([]);
  Order.find = () => makeLookupQuery([]);
  Product.create = async (record) => ({ _id: record._id });
  Customer.create = async (record) => ({ _id: record._id });
  Order.create = async () => {
    throw new Error("database write failed");
  };
  const rollbackFilters = [];
  Product.deleteMany = async (filter) => rollbackFilters.push(filter);
  Customer.deleteMany = async (filter) => rollbackFilters.push(filter);
  Order.deleteMany = async (filter) => rollbackFilters.push(filter);
  console.error = () => {};
  const backup = validBackup();
  const response = createResponse();
  await restoreBackup(
    {
      file: { buffer: Buffer.from(JSON.stringify(backup)) },
      user: { _id: backup.ownerId },
    },
    response
  );
  assert.equal(response.statusCode, 500);
  assert.equal(rollbackFilters.length, 2);
  assert.ok(rollbackFilters.every((filter) => filter.userId === backup.ownerId));
});

test("data management routes apply authentication to every operation", () => {
  const firstLayer = dataManagementRoutes.stack[0];
  assert.equal(firstLayer.handle.name, "authMiddleware");
  const routes = dataManagementRoutes.stack.filter((layer) => layer.route);
  assert.deepEqual(
    routes.map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`),
    [
      "get /exports/:type",
      "get /backup",
      "post /backup/validate",
      "post /backup/restore",
    ]
  );
});
