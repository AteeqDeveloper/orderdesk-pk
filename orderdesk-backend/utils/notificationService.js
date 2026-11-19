import Notification from "../models/Notification.js";

export function getStockAlertType(stock, lowStockThreshold, active = true) {
  if (!active || !Number.isFinite(stock) || !Number.isFinite(lowStockThreshold)) {
    return null;
  }
  if (stock <= 0) return "out_of_stock";
  if (stock <= lowStockThreshold) return "low_stock";
  return null;
}

const idString = (id) => (id ? id.toString() : "");

const upsertNotification = async (userId, dedupeKey, values) => {
  const filter = { userId, dedupeKey };
  const update = {
    $set: { ...values, isRead: false },
    $setOnInsert: { userId, dedupeKey },
  };

  try {
    return await Notification.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      runValidators: true,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Notification.findOneAndUpdate(filter, update, {
      new: true,
      runValidators: true,
    });
  }
};

export async function syncStockAlert({
  userId,
  productId,
  variantId = null,
  productName,
  variantName = "",
  before = null,
  after,
}) {
  const entityId = variantId || productId;
  const dedupeKey = `${variantId ? "variant" : "product"}:${idString(entityId)}`;
  const beforeType = before
    ? getStockAlertType(
        before.stock,
        before.lowStockThreshold,
        before.active !== false
      )
    : null;
  const afterType = getStockAlertType(
    after.stock,
    after.lowStockThreshold,
    after.active !== false
  );

  if (beforeType === afterType) return null;

  if (!afterType) {
    if (beforeType) {
      await Notification.updateOne(
        { userId, dedupeKey, isRead: false },
        { $set: { isRead: true } }
      );
    }
    return null;
  }

  const itemName = [productName, variantName].filter(Boolean).join(" · ");
  const outOfStock = afterType === "out_of_stock";

  return upsertNotification(userId, dedupeKey, {
    title: outOfStock ? "Out of stock" : "Low stock",
    message: outOfStock
      ? `${itemName} is out of stock.`
      : `${itemName} has ${after.stock} units remaining (threshold: ${after.lowStockThreshold}).`,
    type: afterType,
    relatedId: entityId,
    relatedType: variantId ? "variant" : "product",
    relatedProductId: productId,
  });
}

export async function syncProductStockAlerts(userId, before, after) {
  const beforeHasVariants =
    Boolean(before?.hasVariants) && (before?.variants?.length || 0) > 0;
  const afterHasVariants =
    Boolean(after?.hasVariants) && (after?.variants?.length || 0) > 0;
  const beforeVariants = beforeHasVariants
    ? new Map(before.variants.map((variant) => [idString(variant._id), variant]))
    : new Map();
  const afterVariants = afterHasVariants ? after.variants : [];
  const afterIds = new Set(afterVariants.map((variant) => idString(variant._id)));

  if (beforeHasVariants && !afterHasVariants) {
    for (const variant of before.variants) {
      await safelyNotify(
        () =>
          Notification.updateOne(
            {
              userId,
              dedupeKey: `variant:${idString(variant._id)}`,
              isRead: false,
            },
            { $set: { isRead: true } }
          ),
        "Resolve deleted variant stock"
      );
    }
  }

  if (afterHasVariants) {
    if (before && !beforeHasVariants) {
      await safelyNotify(
        () =>
          Notification.updateOne(
            {
              userId,
              dedupeKey: `product:${idString(after._id)}`,
              isRead: false,
            },
            { $set: { isRead: true } }
          ),
        "Resolve parent stock"
      );
    }

    for (const variant of afterVariants) {
      const previous = beforeVariants.get(idString(variant._id));
      await safelyNotify(
        () =>
          syncStockAlert({
            userId,
            productId: after._id,
            variantId: variant._id,
            productName: after.name,
            variantName:
              [variant.size, variant.color].filter(Boolean).join(" / ") ||
              "Variant",
            before: previous
              ? {
                  stock: previous.stock,
                  lowStockThreshold: previous.lowStockThreshold,
                  active:
                    before.status === "active" &&
                    previous.status === "active",
                }
              : null,
            after: {
              stock: variant.stock,
              lowStockThreshold: variant.lowStockThreshold,
              active: after.status === "active" && variant.status === "active",
            },
          }),
        "Variant stock"
      );
    }

    for (const variant of before?.variants || []) {
      if (!afterIds.has(idString(variant._id))) {
        await safelyNotify(
          () =>
            Notification.updateOne(
              {
                userId,
                dedupeKey: `variant:${idString(variant._id)}`,
                isRead: false,
              },
              { $set: { isRead: true } }
            ),
          "Resolve removed variant stock"
        );
      }
    }
    return;
  }

  await safelyNotify(
    () =>
      syncStockAlert({
        userId,
        productId: after._id,
        productName: after.name,
        before:
          before && !beforeHasVariants
            ? {
                stock: before.stock,
                lowStockThreshold: before.lowStockThreshold,
                active: before.status === "active",
              }
            : null,
        after: {
          stock: after.stock,
          lowStockThreshold: after.lowStockThreshold,
          active: after.status === "active",
        },
      }),
    "Product stock"
  );
}

export async function notifyOrderStatusChange({
  userId,
  orderId,
  previousStatus,
  orderStatus,
}) {
  if (!orderId || !orderStatus || previousStatus === orderStatus) return null;
  const orderReference = idString(orderId).slice(-8).toUpperCase();
  const statusLabel = orderStatus.replace(/_/g, " ");
  return upsertNotification(userId, `order:${idString(orderId)}`, {
    title: "Order status updated",
    message: `Order #${orderReference} is now ${statusLabel}.`,
    type: "order_update",
    relatedId: orderId,
    relatedType: "order",
  });
}

export async function resolveProductStockAlerts(userId, productId) {
  return Notification.updateMany(
    {
      userId,
      relatedProductId: productId,
      type: { $in: ["low_stock", "out_of_stock"] },
      isRead: false,
    },
    { $set: { isRead: true } }
  );
}

export async function safelyNotify(operation, context) {
  try {
    return await operation();
  } catch (error) {
    console.error(`${context} notification error:`, error.message);
    return null;
  }
}
