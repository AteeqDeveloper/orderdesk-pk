import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

const BACKUP_VERSION = 1;
const MAX_BACKUP_RECORDS = 50000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const normalizeSku = (value) => value.trim().toUpperCase();

const EXPORT_TYPES = new Set([
  "products",
  "customers",
  "orders",
  "inventory",
  "variants",
  "activity-logs",
  "sales-reports",
]);

const csvColumns = {
  products: [
    ["Product ID", (record) => record._id],
    ["Name", (record) => record.name],
    ["SKU", (record) => record.sku],
    ["Category", (record) => record.category],
    ["Description", (record) => record.description],
    ["Price (PKR)", (record) => formatMoney(record.price)],
    ["Cost Price (PKR)", (record) => formatMoney(record.costPrice)],
    ["Stock", (record) => record.stock],
    ["Low Stock Threshold", (record) => record.lowStockThreshold],
    ["Status", (record) => record.status],
    ["Has Variants", (record) => record.hasVariants],
    ["Created At", (record) => formatDate(record.createdAt)],
    ["Updated At", (record) => formatDate(record.updatedAt)],
  ],
  customers: [
    ["Customer ID", (record) => record._id],
    ["Name", (record) => record.name],
    ["Phone", (record) => record.phone],
    ["Email", (record) => record.email],
    ["Address", (record) => record.address],
    ["City", (record) => record.city],
    ["Notes", (record) => record.notes],
    ["Created At", (record) => formatDate(record.createdAt)],
    ["Updated At", (record) => formatDate(record.updatedAt)],
  ],
  orders: [
    ["Order ID", (record) => record._id],
    ["Created At", (record) => formatDate(record.createdAt)],
    ["Customer Name", (record) => record.customerSnapshot?.name],
    ["Customer Phone", (record) => record.customerSnapshot?.phone],
    ["Customer Address", (record) => record.customerSnapshot?.address],
    ["Customer City", (record) => record.customerSnapshot?.city],
    ["Product ID", (record, item) => item.productId],
    ["Product", (record, item) => item.name],
    ["SKU", (record, item) => item.sku],
    ["Size", (record, item) => item.size],
    ["Color", (record, item) => item.color],
    ["Quantity", (record, item) => item.quantity],
    ["Unit Price (PKR)", (record, item) => formatMoney(item.unitPrice)],
    ["Line Total (PKR)", (record, item) => formatMoney(item.lineTotal)],
    ["Subtotal (PKR)", (record) => formatMoney(record.subtotal)],
    ["Discount (PKR)", (record) => formatMoney(record.discount)],
    ["Delivery Charges (PKR)", (record) => formatMoney(record.deliveryCharges)],
    ["Total (PKR)", (record) => formatMoney(record.totalAmount)],
    ["Payment Method", (record) => record.paymentMethod],
    ["Payment Status", (record) => record.paymentStatus],
    ["Order Status", (record) => record.orderStatus],
    ["Notes", (record) => record.notes],
  ],
  inventory: [
    ["Product ID", (record) => record._id],
    ["Product", (record) => record.name],
    ["Product SKU", (record) => record.sku],
    ["Variant ID", (record, variant) => variant?._id || ""],
    ["Variant SKU", (record, variant) => variant?.sku || ""],
    ["Size", (record, variant) => variant?.size || ""],
    ["Color", (record, variant) => variant?.color || ""],
    ["Stock", (record, variant) => variant ? variant.stock : record.stock],
    [
      "Low Stock Threshold",
      (record, variant) =>
        variant ? variant.lowStockThreshold : record.lowStockThreshold,
    ],
    ["Unit Cost (PKR)", (record, variant) => formatMoney(variant ? variant.costPrice : record.costPrice)],
    [
      "Inventory Value (PKR)",
      (record, variant) =>
        formatMoney(
          (variant ? variant.stock : record.stock) *
            (variant ? variant.costPrice : record.costPrice)
        ),
    ],
    ["Status", (record, variant) => variant?.status || record.status],
    ["Created At", (record) => formatDate(record.createdAt)],
  ],
  variants: [
    ["Product ID", (record) => record._id],
    ["Product", (record) => record.name],
    ["Variant ID", (record, variant) => variant._id],
    ["Size", (record, variant) => variant.size],
    ["Color", (record, variant) => variant.color],
    ["SKU", (record, variant) => variant.sku],
    ["Price (PKR)", (record, variant) => formatMoney(variant.price)],
    ["Cost Price (PKR)", (record, variant) => formatMoney(variant.costPrice)],
    ["Stock", (record, variant) => variant.stock],
    ["Low Stock Threshold", (record, variant) => variant.lowStockThreshold],
    ["Status", (record, variant) => variant.status],
    ["Created At", (record, variant) => formatDate(variant.createdAt)],
    ["Updated At", (record, variant) => formatDate(variant.updatedAt)],
  ],
  "activity-logs": [
    ["Activity ID", (record) => record._id],
    ["Date", (record) => formatDate(record.createdAt)],
    ["Action", (record) => record.action],
    ["Entity Type", (record) => record.entityType],
    ["Entity ID", (record) => record.entityId],
    ["Description", (record) => record.description],
  ],
  "sales-reports": [
    ["Order ID", (record) => record._id],
    ["Date", (record) => formatDate(record.createdAt)],
    ["Customer", (record) => record.customerSnapshot?.name],
    ["Order Status", (record) => record.orderStatus],
    ["Payment Status", (record) => record.paymentStatus],
    ["Total (PKR)", (record) => formatMoney(record.totalAmount)],
    [
      "Delivered Sales (excluding refunds) (PKR)",
      (record) =>
        formatMoney(
          record.orderStatus === "delivered" &&
            record.paymentStatus !== "refunded"
            ? record.totalAmount
            : 0
        ),
    ],
  ],
};

const backupFields = {
  products: [
    "_id",
    "name",
    "sku",
    "description",
    "price",
    "costPrice",
    "stock",
    "hasVariants",
    "variants",
    "category",
    "imageUrl",
    "lowStockThreshold",
    "status",
    "createdAt",
    "updatedAt",
  ],
  customers: [
    "_id",
    "name",
    "phone",
    "email",
    "address",
    "city",
    "notes",
    "createdAt",
    "updatedAt",
  ],
  orders: [
    "_id",
    "customerId",
    "customerSnapshot",
    "items",
    "subtotal",
    "discount",
    "deliveryCharges",
    "totalAmount",
    "paymentMethod",
    "paymentStatus",
    "orderStatus",
    "notes",
    "createdAt",
    "updatedAt",
  ],
};

const fieldsToSelect = (fields) => fields.join(" ");
const userIdFor = (req) => req.user._id;

export const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return `PKR ${new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

export const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

export const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const parseExportDateRange = (query) => {
  const allowed = new Set(["format", "startDate", "endDate"]);
  if (Object.keys(query).some((key) => !allowed.has(key))) {
    return { error: "Unsupported export filter" };
  }
  if (query.format && query.format !== "csv") {
    return { error: "Only CSV exports are currently supported" };
  }
  if ((query.startDate && !query.endDate) || (!query.startDate && query.endDate)) {
    return { error: "Provide both startDate and endDate" };
  }
  if (!query.startDate) return { filter: {} };
  if (
    typeof query.startDate !== "string" ||
    typeof query.endDate !== "string" ||
    !DATE_PATTERN.test(query.startDate) ||
    !DATE_PATTERN.test(query.endDate)
  ) {
    return { error: "Dates must use YYYY-MM-DD format" };
  }

  const start = new Date(`${query.startDate}T00:00:00.000Z`);
  const end = new Date(`${query.endDate}T23:59:59.999Z`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== query.startDate ||
    end.toISOString().slice(0, 10) !== query.endDate
  ) {
    return { error: "Date filters must be valid calendar dates" };
  }
  if (start > end) return { error: "startDate must be on or before endDate" };
  return { filter: { createdAt: { $gte: start, $lte: end } } };
};

const writeChunk = async (res, chunk) => {
  if (res.destroyed) throw new Error("The client closed the response");
  if (res.write(chunk)) return;
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      res.removeListener("drain", onDrain);
      res.removeListener("close", onClose);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("The client closed the response"));
    };
    res.once("drain", onDrain);
    res.once("close", onClose);
  });
};

const writeCsv = async (res, type, cursor) => {
  const columns = csvColumns[type];
  await writeChunk(
    res,
    `${columns.map(([label]) => escapeCsvCell(label)).join(",")}\r\n`
  );
  for await (const record of cursor) {
    const records =
      type === "orders"
        ? (record.items || []).map((item) => [record, item])
        : type === "variants"
          ? (record.variants || []).map((variant) => [record, variant])
          : type === "inventory" && record.hasVariants && record.variants?.length
            ? record.variants.map((variant) => [record, variant])
            : [[record, null]];
    for (const [parent, child] of records) {
      const line = columns
        .map(([, value]) => escapeCsvCell(value(parent, child)))
        .join(",");
      await writeChunk(res, `${line}\r\n`);
    }
  }
};

export const exportData = async (req, res) => {
  const { type } = req.params;
  if (!EXPORT_TYPES.has(type)) {
    return res.status(400).json({ success: false, message: "Unsupported export type" });
  }
  const parsed = parseExportDateRange(req.query);
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  const Model =
    type === "customers"
      ? Customer
      : type === "orders" || type === "sales-reports"
        ? Order
        : type === "activity-logs"
          ? ActivityLog
          : Product;
  const filter = { ...parsed.filter, userId: userIdFor(req) };
  const projection =
    type === "products" || type === "inventory" || type === "variants"
      ? "name sku description price costPrice stock hasVariants variants category lowStockThreshold status createdAt updatedAt"
      : type === "customers"
        ? "name phone email address city notes createdAt updatedAt"
        : type === "orders" || type === "sales-reports"
          ? "customerSnapshot items subtotal discount deliveryCharges totalAmount paymentMethod paymentStatus orderStatus notes createdAt"
          : "action entityType entityId description createdAt";

  try {
    const cursor = Model.find(filter)
      .select(projection)
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .cursor({ batchSize: 500 });
    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orderdesk-${type}-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    await writeCsv(res, type, cursor);
    res.end();
  } catch (error) {
    console.error("Data export failed:", error.message);
    if (res.destroyed) return;
    if (res.headersSent) res.destroy(error);
    else {
      res.status(500).json({ success: false, message: "Could not export data" });
    }
  }
};

const backupProjection = (fields) => fieldsToSelect(fields);

export const generateBackup = async (req, res) => {
  const backupDate = new Date();
  res.status(200);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="orderdesk-backup-${backupDate.toISOString().slice(0, 10)}.json"`
  );

  const writeCollection = async (Model, fields, userId) => {
    const cursor = Model.find({ userId })
      .select(backupProjection(fields))
      .sort({ _id: 1 })
      .lean()
      .cursor({ batchSize: 250 });
    let first = true;
    for await (const record of cursor) {
      await writeChunk(res, `${first ? "" : ","}${JSON.stringify(record)}`);
      first = false;
    }
  };

  try {
    await writeChunk(
      res,
      `${JSON.stringify({
        format: "orderdesk-backup",
        version: BACKUP_VERSION,
        ownerId: String(userIdFor(req)),
        createdAt: backupDate.toISOString(),
        settings: {
          businessName: req.user.businessName || "",
          phone: req.user.phone || "",
        },
      }).slice(0, -1)},"products":[`
    );
    await writeCollection(Product, backupFields.products, userIdFor(req));
    await writeChunk(res, '],"customers":[');
    await writeCollection(Customer, backupFields.customers, userIdFor(req));
    await writeChunk(res, '],"orders":[');
    await writeCollection(Order, backupFields.orders, userIdFor(req));
    await writeChunk(res, "]}");
    res.end();
  } catch (error) {
    console.error("Backup generation failed:", error.message);
    if (res.destroyed) return;
    if (res.headersSent) res.destroy(error);
    else res.status(500).json({ success: false, message: "Could not generate backup" });
  }
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const assertAllowedKeys = (record, allowed, label) => {
  if (!isRecord(record)) throw new Error(`${label} must be an object`);
  const unexpected = Object.keys(record).find((key) => !allowed.includes(key));
  if (unexpected) throw new Error(`${label} contains unsupported field "${unexpected}"`);
};

const validateRecordIds = (records, field, label) => {
  const seen = new Set();
  for (const record of records) {
    if (!mongoose.isValidObjectId(record[field])) {
      throw new Error(`${label} contains an invalid ${field}`);
    }
    const id = new mongoose.Types.ObjectId(record[field]).toString();
    if (seen.has(id)) throw new Error(`${label} contains duplicate IDs`);
    seen.add(id);
  }
  return seen;
};

const validateDateFields = (record, label) => {
  for (const field of ["createdAt", "updatedAt"]) {
    if (record[field] !== undefined && Number.isNaN(new Date(record[field]).getTime())) {
      throw new Error(`${label} contains an invalid ${field}`);
    }
  }
};
const validateModelRecord = async (Model, record, userId, label) => {
  try {
    await new Model({ ...record, userId }).validate();
  } catch (validationError) {
    const details = Object.values(validationError.errors)
      .map((item) => item.message)
      .join("; ");
    throw new Error(`${label} is invalid: ${details}`);
  }
};

const productAllowedFields = backupFields.products;
const variantAllowedFields = [
  "_id",
  "size",
  "color",
  "sku",
  "price",
  "costPrice",
  "stock",
  "lowStockThreshold",
  "imageUrl",
  "status",
  "createdAt",
  "updatedAt",
];
const customerAllowedFields = backupFields.customers;
const orderAllowedFields = backupFields.orders;
const orderItemAllowedFields = [
  "productId",
  "variantId",
  "name",
  "size",
  "color",
  "sku",
  "quantity",
  "unitPrice",
  "lineTotal",
];

export const validateBackupShape = async (backup, authenticatedUserId) => {
  assertAllowedKeys(
    backup,
    ["format", "version", "ownerId", "createdAt", "settings", "products", "customers", "orders"],
    "Backup"
  );
  if (backup.format !== "orderdesk-backup" || backup.version !== BACKUP_VERSION) {
    throw new Error("Unsupported backup format or version");
  }
  if (String(backup.ownerId) !== String(authenticatedUserId)) {
    const error = new Error("This backup belongs to a different account");
    error.status = 403;
    throw error;
  }
  if (!Array.isArray(backup.products) || !Array.isArray(backup.customers) || !Array.isArray(backup.orders)) {
    throw new Error("Backup must include products, customers, and orders arrays");
  }
  const totalRecords =
    backup.products.length + backup.customers.length + backup.orders.length;
  if (totalRecords > MAX_BACKUP_RECORDS) {
    throw new Error(`Backup cannot contain more than ${MAX_BACKUP_RECORDS} records`);
  }
  assertAllowedKeys(backup.settings, ["businessName", "phone"], "Settings");
  for (const field of ["businessName", "phone"]) {
    if (backup.settings[field] !== undefined && typeof backup.settings[field] !== "string") {
      throw new Error(`Settings field ${field} must be text`);
    }
  }
  if ((backup.settings.businessName || "").length > 120) {
    throw new Error("Business name must be 120 characters or fewer");
  }
  if ((backup.settings.phone || "").length > 32) {
    throw new Error("Phone must be 32 characters or fewer");
  }
  if (backup.createdAt && Number.isNaN(new Date(backup.createdAt).getTime())) {
    throw new Error("Backup createdAt is invalid");
  }

  const productIds = validateRecordIds(backup.products, "_id", "Products");
  const customerIds = validateRecordIds(backup.customers, "_id", "Customers");
  validateRecordIds(backup.orders, "_id", "Orders");

  const variantIds = new Set();
  const skuSet = new Set();
  for (const product of backup.products) {
    assertAllowedKeys(product, productAllowedFields, "Product");
    validateDateFields(product, "Product");
    if (product.variants !== undefined && !Array.isArray(product.variants)) {
      throw new Error("Product variants must be an array");
    }
    const variants = product.variants || [];
    if (product.sku !== undefined && product.sku !== null && typeof product.sku !== "string") {
      throw new Error("Product SKU must be text");
    }
    if (
      variants.some(
        (variant) =>
          variant?.sku !== undefined &&
          variant.sku !== null &&
          typeof variant.sku !== "string"
      )
    ) {
      throw new Error("Variant SKU must be text");
    }
    await validateModelRecord(Product, product, authenticatedUserId, "Product");
    if (product.sku) {
      const sku = normalizeSku(product.sku);
      if (sku) {
        if (skuSet.has(sku)) throw new Error(`Duplicate SKU "${sku}" in backup`);
        skuSet.add(sku);
      }
    }
    for (const variant of variants) {
      assertAllowedKeys(variant, variantAllowedFields, "Variant");
      if (!mongoose.isValidObjectId(variant._id)) throw new Error("Variant has an invalid _id");
      const variantId = new mongoose.Types.ObjectId(variant._id).toString();
      if (variantIds.has(variantId)) throw new Error("Backup contains duplicate variant IDs");
      variantIds.add(variantId);
      validateDateFields(variant, "Variant");
      if (variant.sku) {
        const sku = normalizeSku(variant.sku);
        if (sku) {
          if (skuSet.has(sku)) throw new Error(`Duplicate SKU "${sku}" in backup`);
          skuSet.add(sku);
        }
      }
    }
    if (
      product.hasVariants &&
      variants.length > 0 &&
      product.stock !== variants.reduce((total, variant) => total + variant.stock, 0)
    ) {
      throw new Error("Product stock must equal the sum of its variant stock");
    }
  }
  for (const customer of backup.customers) {
    assertAllowedKeys(customer, customerAllowedFields, "Customer");
    validateDateFields(customer, "Customer");
    await validateModelRecord(Customer, customer, authenticatedUserId, "Customer");
  }
  for (const order of backup.orders) {
    assertAllowedKeys(order, orderAllowedFields, "Order");
    validateDateFields(order, "Order");
    await validateModelRecord(Order, order, authenticatedUserId, "Order");
    if (!mongoose.isValidObjectId(order.customerId)) {
      throw new Error("Order has an invalid customerId");
    }
    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new Error("Order must contain at least one item");
    }
    assertAllowedKeys(order.customerSnapshot, ["name", "phone", "address", "city"], "Order customerSnapshot");
    for (const item of order.items) {
      assertAllowedKeys(item, orderItemAllowedFields, "Order item");
      if (!mongoose.isValidObjectId(item.productId)) {
        throw new Error("Order item has an invalid productId");
      }
      if (item.variantId !== undefined && item.variantId !== null && !mongoose.isValidObjectId(item.variantId)) {
        throw new Error("Order item has an invalid variantId");
      }
    }
  }
  return { productIds, customerIds, variantIds, totalRecords };
};

const ids = (records) => records.map((record) => record._id);
const normalizedId = (id) => new mongoose.Types.ObjectId(id).toString();
const findOwned = async (Model, userId, recordIds, select = "_id") => {
  if (!recordIds.length) return [];
  return Model.find({ _id: { $in: recordIds }, userId }).select(select).lean();
};
const findForeign = async (Model, userId, recordIds) => {
  if (!recordIds.length) return [];
  return Model.find({ _id: { $in: recordIds }, userId: { $ne: userId } })
    .select("_id")
    .lean();
};
const findProductsBySkus = async (userId, skus) => {
  if (!skus.length) return [];
  return Product.find({
    userId,
    $or: [{ sku: { $in: skus } }, { "variants.sku": { $in: skus } }],
  })
    .select("sku variants.sku")
    .lean();
};

const getBackupValidation = async (backup, userId) => {
  await validateBackupShape(backup, userId);
  const referencedProductIds = [
    ...new Set(
      backup.orders.flatMap((order) =>
        order.items.map((item) => normalizedId(item.productId))
      )
    ),
  ];
  const referencedCustomerIds = [
    ...new Set(backup.orders.map((order) => normalizedId(order.customerId))),
  ];
  const productIdsToCheck = [
    ...new Set([...ids(backup.products).map(normalizedId), ...referencedProductIds]),
  ];
  const customerIdsToCheck = [
    ...new Set([...ids(backup.customers).map(normalizedId), ...referencedCustomerIds]),
  ];
  const [existingProducts, existingCustomers, existingOrders, foreignProducts, foreignCustomers, foreignOrders] =
    await Promise.all([
      findOwned(Product, userId, productIdsToCheck, "_id sku variants"),
      findOwned(Customer, userId, customerIdsToCheck),
      findOwned(Order, userId, ids(backup.orders)),
      findForeign(Product, userId, productIdsToCheck),
      findForeign(Customer, userId, customerIdsToCheck),
      findForeign(Order, userId, ids(backup.orders)),
    ]);
  if (foreignProducts.length || foreignCustomers.length || foreignOrders.length) {
    throw new Error("Backup record IDs conflict with records outside this account");
  }

  const backupProductIds = new Set(ids(backup.products).map(normalizedId));
  const backupCustomerIds = new Set(ids(backup.customers).map(normalizedId));
  const ownProductIds = new Set(
    existingProducts
      .filter((item) => backupProductIds.has(normalizedId(item._id)))
      .map((item) => normalizedId(item._id))
  );
  const ownCustomerIds = new Set(
    existingCustomers
      .filter((item) => backupCustomerIds.has(normalizedId(item._id)))
      .map((item) => normalizedId(item._id))
  );
  const ownOrderIds = new Set(existingOrders.map((item) => normalizedId(item._id)));
  const pendingProducts = backup.products.filter(
    (item) => !ownProductIds.has(normalizedId(item._id))
  );
  const pendingSkus = pendingProducts.flatMap((product) => [
    ...(product.sku ? [normalizeSku(product.sku)] : []),
    ...(product.variants || [])
      .map((variant) => variant.sku && normalizeSku(variant.sku))
      .filter(Boolean),
  ]).filter(Boolean);
  const productsWithMatchingSkus = await findProductsBySkus(userId, pendingSkus);
  const variantsById = new Map();
  for (const product of pendingProducts) {
    for (const variant of product.variants || []) {
      variantsById.set(normalizedId(variant._id), normalizedId(product._id));
    }
  }
  for (const product of existingProducts) {
    for (const variant of product.variants || []) {
      variantsById.set(normalizedId(variant._id), normalizedId(product._id));
    }
  }

  for (const order of backup.orders) {
    for (const item of order.items) {
      if (
        item.variantId &&
        variantsById.has(normalizedId(item.variantId)) &&
        variantsById.get(normalizedId(item.variantId)) !== normalizedId(item.productId)
      ) {
        throw new Error("An order variant does not belong to its referenced product");
      }
    }
  }

  const existingSkus = [
    ...productsWithMatchingSkus.flatMap((product) => [
      ...(product.sku ? [normalizeSku(product.sku)] : []),
      ...(product.variants || [])
        .map((variant) => variant.sku && normalizeSku(variant.sku))
        .filter(Boolean),
    ]),
  ];
  const uniqueSkus = new Set(existingSkus);
  for (const product of pendingProducts) {
    for (const sku of [product.sku, ...(product.variants || []).map((variant) => variant.sku)]) {
      if (!sku) continue;
      const normalized = normalizeSku(sku);
      if (uniqueSkus.has(normalized)) {
        throw new Error(`SKU "${normalized}" already exists in this account`);
      }
      uniqueSkus.add(normalized);
    }
  }

  return {
    pending: {
      products: pendingProducts,
      customers: backup.customers.filter(
        (item) => !ownCustomerIds.has(normalizedId(item._id))
      ),
      orders: backup.orders.filter(
        (item) => !ownOrderIds.has(normalizedId(item._id))
      ),
    },
    skipped: {
      products: backup.products.length - pendingProducts.length,
      customers:
        backup.customers.length -
        backup.customers.filter(
          (item) => !ownCustomerIds.has(normalizedId(item._id))
        ).length,
      orders:
        backup.orders.length -
        backup.orders.filter((item) => !ownOrderIds.has(normalizedId(item._id)))
          .length,
    },
  };
};

const sendBackupError = (res, error) =>
  res.status(error.status || 400).json({
    success: false,
    message: error.message || "Backup validation failed",
  });

export const validateBackup = async (req, res) => {
  try {
    const backup = JSON.parse(req.file.buffer.toString("utf8"));
    const result = await getBackupValidation(backup, userIdFor(req));
    return res.status(200).json({
      success: true,
      data: {
        format: backup.format,
        version: backup.version,
        createdAt: backup.createdAt,
        counts: {
          products: backup.products.length,
          customers: backup.customers.length,
          orders: backup.orders.length,
          total: backup.products.length + backup.customers.length + backup.orders.length,
        },
        skipped: result.skipped,
        toRestore: {
          products: result.pending.products.length,
          customers: result.pending.customers.length,
          orders: result.pending.orders.length,
        },
        settingsWillBeFilled: Boolean(
          (!req.user.businessName && backup.settings.businessName) ||
            (!req.user.phone && backup.settings.phone)
        ),
      },
    });
  } catch (error) {
    return sendBackupError(res, error);
  }
};

const onlyFields = (record, fields) =>
  Object.fromEntries(fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]));

export const restoreBackup = async (req, res) => {
  let result;
  const created = { products: [], customers: [], orders: [] };
  try {
    const backup = JSON.parse(req.file.buffer.toString("utf8"));
    result = await getBackupValidation(backup, userIdFor(req));

    for (const record of result.pending.products) {
      const product = await Product.create({
        ...onlyFields(record, productAllowedFields),
        userId: userIdFor(req),
      });
      created.products.push(product._id);
    }
    for (const record of result.pending.customers) {
      const customer = await Customer.create({
        ...onlyFields(record, customerAllowedFields),
        userId: userIdFor(req),
      });
      created.customers.push(customer._id);
    }
    for (const record of result.pending.orders) {
      const order = await Order.create({
        ...onlyFields(record, orderAllowedFields),
        userId: userIdFor(req),
      });
      created.orders.push(order._id);
    }

    let settingsUpdated = false;
    if (!req.user.businessName && backup.settings.businessName) {
      req.user.businessName = backup.settings.businessName;
      settingsUpdated = true;
    }
    if (!req.user.phone && backup.settings.phone) {
      req.user.phone = backup.settings.phone;
      settingsUpdated = true;
    }
    if (settingsUpdated) await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Backup merged successfully. Existing records were not overwritten.",
      data: {
        restored: {
          products: created.products.length,
          customers: created.customers.length,
          orders: created.orders.length,
        },
        skipped: result.skipped,
        settingsUpdated,
      },
    });
  } catch (error) {
    try {
      if (created.orders.length) {
        await Order.deleteMany({ _id: { $in: created.orders }, userId: userIdFor(req) });
      }
      if (created.products.length) {
        await Product.deleteMany({ _id: { $in: created.products }, userId: userIdFor(req) });
      }
      if (created.customers.length) {
        await Customer.deleteMany({ _id: { $in: created.customers }, userId: userIdFor(req) });
      }
    } catch (rollbackError) {
      console.error("Backup restore rollback failed:", rollbackError.message);
      return res.status(500).json({
        success: false,
        message: "Restore failed and automatic rollback was incomplete. Contact support.",
      });
    }
    if (result === undefined) return sendBackupError(res, error);
    console.error("Backup restore failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Restore failed. Newly added records were rolled back.",
    });
  }
};
