import mongoose from "mongoose";
import Order, { getOrderRequestFingerprint } from "../models/Order.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import {
  getOrderStatusTransitionError,
  getPaymentStatusUpdateError,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUSES,
} from "../utils/orderStatusRules.js";
import {
  notifyOrderStatusChange,
  safelyNotify,
  syncStockAlert,
} from "../utils/notificationService.js";
import { recordActivity } from "../utils/activityLog.js";

const validId = (id) => mongoose.isValidObjectId(id);

const validMoney = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0;

// CREATE ORDER
export const createOrder = async (req, res) => {
  const userId = req.user._id;
  const decrementedProducts = [];
  const stockAlertChanges = [];
  const idempotencyKey =
    req.get?.("Idempotency-Key") || req.headers?.["idempotency-key"];
  const idempotencyFingerprint = idempotencyKey
    ? getOrderRequestFingerprint(req.body || {})
    : null;

  try {
    if (
      idempotencyKey !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotencyKey
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid idempotency key",
      });
    }

    if (idempotencyKey) {
      const previousOrder = await Order.findOne({ userId, idempotencyKey });
      if (previousOrder) {
        if (previousOrder.idempotencyFingerprint !== idempotencyFingerprint) {
          return res.status(409).json({
            success: false,
            message: "This idempotency key was already used for a different order",
          });
        }
        return res.status(200).json({
          success: true,
          message: "Order already created",
          order: previousOrder,
        });
      }
    }

    const {
      customerId,
      items,
      discount = 0,
      deliveryCharges = 0,
      paymentMethod = "COD",
      notes = "",
    } = req.body;

    if (!validId(customerId)) {
      return res.status(400).json({
        success: false,
        message: "A valid customer ID is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one product",
      });
    }

    if (!validMoney(discount) || !validMoney(deliveryCharges)) {
      return res.status(400).json({
        success: false,
        message: "Discount and delivery charges must be non-negative numbers",
      });
    }

    const allowedPaymentMethods = [
      "COD",
      "JazzCash",
      "Easypaisa",
      "Bank Transfer",
    ];

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // Verify customer belongs to this seller
    const customer = await Customer.findOne({
      _id: customerId,
      userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Combine duplicate product and variant items into aggregated quantities
    const quantities = new Map();

    for (const item of items) {
      if (
        !item ||
        !validId(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Each item needs a valid product ID and positive whole-number quantity",
        });
      }

      if (
        item.variantId !== undefined &&
        item.variantId !== null &&
        !validId(item.variantId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid variant ID",
        });
      }

      const variantKey = item.variantId ? item.variantId.toString() : "";
      const key = `${item.productId.toString()}:${variantKey}`;

      const existing = quantities.get(key);
      quantities.set(key, {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: (existing?.quantity || 0) + item.quantity,
      });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const { productId, variantId, quantity } of quantities.values()) {
      // Only select products owned by this seller
      const product = await Product.findOne({
        _id: productId,
        userId,
        status: "active",
      });

      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
      }

      if (variantId) {
        const variant = product.variants?.id(variantId);
        if (!variant || variant.status !== "active") {
          throw new Error(`VARIANT_NOT_FOUND:${product.name}`);
        }

        // Atomically reduce variant stock AND parent stock
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            userId,
            status: "active",
            variants: {
              $elemMatch: {
                _id: variant._id,
                status: "active",
                stock: { $gte: quantity },
              },
            },
          },
          {
            $inc: {
              "variants.$.stock": -quantity,
              stock: -quantity,
            },
          },
          {
            new: true,
          }
        );

        if (!updatedProduct) {
          const variantName =
            [variant.size, variant.color].filter(Boolean).join(" / ") || "variant";
          throw new Error(`INSUFFICIENT_STOCK:${product.name} (${variantName})`);
        }

        const updatedVariant = updatedProduct.variants?.id(variant._id);
        if (!updatedVariant) {
          throw new Error(`Could not read updated stock for variant ${variant._id}`);
        }

        decrementedProducts.push({
          productId: product._id,
          variantId: variant._id,
          quantity,
        });
        stockAlertChanges.push({
          userId,
          productId: product._id,
          variantId: variant._id,
          productName: product.name,
          variantName:
            [variant.size, variant.color].filter(Boolean).join(" / ") ||
            "Variant",
          before: {
            stock: updatedVariant.stock + quantity,
            lowStockThreshold: updatedVariant.lowStockThreshold,
            active:
              updatedProduct.status === "active" &&
              updatedVariant.status === "active",
          },
          after: {
            stock: updatedVariant.stock,
            lowStockThreshold: updatedVariant.lowStockThreshold,
            active:
              updatedProduct.status === "active" &&
              updatedVariant.status === "active",
          },
        });

        if (
          typeof variant.price !== "number" ||
          !Number.isFinite(variant.price) ||
          variant.price < 0
        ) {
          throw new Error(`INVALID_VARIANT_PRICE:${product.name}`);
        }

        const unitPrice = variant.price;
        const lineTotal = unitPrice * quantity;
        const variantDetails = [variant.size, variant.color].filter(Boolean).join(" / ");
        const itemName = variantDetails
          ? `${product.name} - ${variantDetails}`
          : product.name;

        orderItems.push({
          productId: product._id,
          variantId: variant._id,
          name: itemName,
          size: variant.size || "",
          color: variant.color || "",
          sku: variant.sku || product.sku || "",
          quantity,
          unitPrice,
          lineTotal,
        });

        subtotal += lineTotal;
      } else {
        if (product.hasVariants && product.variants.length > 0) {
          throw new Error(`VARIANT_REQUIRED:${product.name}`);
        }

        // Atomically reduce stock only if enough is available
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            userId,
            stock: { $gte: quantity },
            status: "active",
          },
          {
            $inc: { stock: -quantity },
          },
          {
            new: true,
          }
        );

        if (!updatedProduct) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        decrementedProducts.push({
          productId: product._id,
          variantId: null,
          quantity,
        });
        stockAlertChanges.push({
          userId,
          productId: product._id,
          productName: product.name,
          before: {
            stock: updatedProduct.stock + quantity,
            lowStockThreshold: updatedProduct.lowStockThreshold,
            active: updatedProduct.status === "active",
          },
          after: {
            stock: updatedProduct.stock,
            lowStockThreshold: updatedProduct.lowStockThreshold,
            active: updatedProduct.status === "active",
          },
        });

        const unitPrice = product.price;
        const lineTotal = unitPrice * quantity;

        orderItems.push({
          productId: product._id,
          variantId: null,
          name: product.name,
          size: "",
          color: "",
          sku: product.sku || "",
          quantity,
          unitPrice,
          lineTotal,
        });

        subtotal += lineTotal;
      }
    }

    const totalAmount = subtotal - discount + deliveryCharges;

    if (discount > subtotal) {
      throw new Error("DISCOUNT_EXCEEDS_SUBTOTAL");
    }

    const order = await Order.create({
      userId,
      ...(idempotencyKey
        ? { idempotencyKey, idempotencyFingerprint }
        : {}),
      customerId: customer._id,

      customerSnapshot: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address || "",
        city: customer.city || "",
      },

      items: orderItems,
      subtotal,
      discount,
      deliveryCharges,
      totalAmount,
      paymentMethod,
      notes,
    });

    await Promise.all(
      stockAlertChanges.map((change) =>
        safelyNotify(
          () => syncStockAlert(change),
          "Order stock"
        )
      )
    );
    await recordActivity({
      userId,
      action: "order_created",
      entityType: "order",
      entityId: order._id,
      description: "Order created",
      metadata: {
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
      },
    });
    for (const item of order.items) {
      await recordActivity({
        userId,
        action: "stock_decreased",
        entityType: "inventory",
        entityId: item.productId,
        description: `Stock decreased for ${item.name} due to order`,
        metadata: {
          entityName: item.name,
          orderId: order._id,
          variantId: item.variantId,
          change: -item.quantity,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    // Restore stock if order creation fails
    let rollbackFailed = false;
    for (const item of decrementedProducts) {
      try {
        if (item.variantId) {
          await Product.updateOne(
            {
              _id: item.productId,
              userId,
              "variants._id": item.variantId,
            },
            {
              $inc: {
                "variants.$.stock": item.quantity,
                stock: item.quantity,
              },
            }
          );
        } else {
          await Product.updateOne(
            {
              _id: item.productId,
              userId,
            },
            {
              $inc: { stock: item.quantity },
            }
          );
        }
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error(
          "Stock rollback failed:",
          rollbackError.message
        );
      }
    }

    if (error.message.startsWith("PRODUCT_NOT_FOUND:")) {
      return res.status(404).json({
        success: false,
        message: "One or more products were not found or are inactive",
      });
    }

    if (error.message.startsWith("VARIANT_REQUIRED:")) {
      const prodName = error.message.replace("VARIANT_REQUIRED:", "");
      return res.status(400).json({
        success: false,
        message: `Please select a variant for ${prodName}`,
      });
    }

    if (error.message.startsWith("VARIANT_NOT_FOUND:")) {
      return res.status(404).json({
        success: false,
        message: "One or more selected variants were not found or are inactive",
      });
    }

    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(409).json({
        success: false,
        message: "Insufficient stock for one of the products",
      });
    }

    if (error.message === "DISCOUNT_EXCEEDS_SUBTOTAL") {
      return res.status(400).json({
        success: false,
        message: "Discount cannot exceed subtotal",
      });
    }

    if (error.code === 11000 && idempotencyKey && !rollbackFailed) {
      const previousOrder = await Order.findOne({ userId, idempotencyKey });
      if (previousOrder) {
        if (previousOrder.idempotencyFingerprint !== idempotencyFingerprint) {
          return res.status(409).json({
            success: false,
            message: "This idempotency key was already used for a different order",
          });
        }
        return res.status(200).json({
          success: true,
          message: "Order already created",
          order: previousOrder,
        });
      }
    }

    console.error("Create order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not create order",
    });
  }
};

// GET ALL ORDERS FOR THIS SELLER
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not fetch orders",
    });
  }
};

// GET ONE ORDER
export const getOrderById = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not fetch order",
    });
  }
};

// UPDATE ORDER / PAYMENT STATUS
export const updateOrder = async (req, res) => {
  let session;
  let restoredStockAlerts = [];

  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid status update",
      });
    }

    const allowedFields = new Set([
      "orderStatus",
      "paymentStatus",
      "manualPaymentConfirmed",
    ]);
    if (Object.keys(req.body).some((field) => !allowedFields.has(field))) {
      return res.status(400).json({
        success: false,
        message: "Only order and payment status fields can be updated",
      });
    }

    const hasOrderStatus = Object.hasOwn(req.body, "orderStatus");
    const hasPaymentStatus = Object.hasOwn(req.body, "paymentStatus");
    if (hasOrderStatus === hasPaymentStatus) {
      return res.status(400).json({
        success: false,
        message: "Provide exactly one order status or payment status",
      });
    }

    if (
      Object.hasOwn(req.body, "manualPaymentConfirmed") &&
      (!hasPaymentStatus || req.body.paymentStatus !== "paid")
    ) {
      return res.status(400).json({
        success: false,
        message: "Manual payment confirmation is only valid when marking an order paid",
      });
    }

    const orderStatus = hasOrderStatus ? req.body.orderStatus : undefined;
    const paymentStatus = hasPaymentStatus ? req.body.paymentStatus : undefined;

    if (
      orderStatus !== undefined &&
      !Object.hasOwn(ORDER_STATUS_TRANSITIONS, orderStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    if (
      paymentStatus !== undefined &&
      !PAYMENT_STATUSES.includes(paymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const orderFilter = {
      _id: req.params.id,
      userId: req.user._id,
    };

    if (orderStatus === "cancelled") {
      let updateResult;
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        restoredStockAlerts = [];
        const currentOrder = await Order.findOne(orderFilter).session(session);
        if (!currentOrder) {
          updateResult = {
            status: 404,
            message: "Order not found",
          };
          return;
        }

        const transitionError = getOrderStatusTransitionError(
          currentOrder.orderStatus,
          orderStatus,
          currentOrder.paymentStatus
        );
        if (transitionError) {
          updateResult = { status: 409, message: transitionError };
          return;
        }

        const order = await Order.findOneAndUpdate(
          {
            ...orderFilter,
            orderStatus: currentOrder.orderStatus,
            paymentStatus: currentOrder.paymentStatus,
          },
          { $set: { orderStatus } },
          { new: true, runValidators: true, session }
        );

        if (!order) {
          updateResult = {
            status: 409,
            message: "The order changed before it could be cancelled. Refresh and try again.",
          };
          return;
        }

        for (const item of order.items) {
          if (item.variantId) {
            const updatedProduct = await Product.findOneAndUpdate(
              {
                _id: item.productId,
                userId: req.user._id,
                "variants._id": item.variantId,
              },
              {
                $inc: {
                  "variants.$.stock": item.quantity,
                  stock: item.quantity,
                },
              },
              { new: true, session }
            );

            if (updatedProduct) {
              const updatedVariant = updatedProduct.variants?.id(item.variantId);
              if (!updatedVariant) {
                throw new Error(
                  `Could not read restored stock for variant ${item.variantId}`
                );
              }
              restoredStockAlerts.push({
                userId: req.user._id,
                productId: item.productId,
                variantId: item.variantId,
                productName: item.name,
                variantName:
                  [item.size, item.color].filter(Boolean).join(" / ") ||
                  "Variant",
                before: {
                  stock: updatedVariant.stock - item.quantity,
                  lowStockThreshold: updatedVariant.lowStockThreshold,
                  active:
                    updatedProduct.status === "active" &&
                    updatedVariant.status === "active",
                },
                after: {
                  stock: updatedVariant.stock,
                  lowStockThreshold: updatedVariant.lowStockThreshold,
                  active:
                    updatedProduct.status === "active" &&
                    updatedVariant.status === "active",
                },
              });
            } else {
              const restoredParent = await Product.findOneAndUpdate(
                {
                  _id: item.productId,
                  userId: req.user._id,
                },
                { $inc: { stock: item.quantity } },
                { new: true, session }
              );
              if (!restoredParent) {
                throw new Error(`Could not restore stock for product ${item.productId}`);
              }
            }
          } else {
            const restoredProduct = await Product.findOneAndUpdate(
              {
                _id: item.productId,
                userId: req.user._id,
              },
              { $inc: { stock: item.quantity } },
              { new: true, session }
            );
            if (!restoredProduct) {
              throw new Error(`Could not restore stock for product ${item.productId}`);
            }
            restoredStockAlerts.push({
              userId: req.user._id,
              productId: item.productId,
              productName: item.name,
              before: {
                stock: restoredProduct.stock - item.quantity,
                lowStockThreshold: restoredProduct.lowStockThreshold,
                active: restoredProduct.status === "active",
              },
              after: {
                stock: restoredProduct.stock,
                lowStockThreshold: restoredProduct.lowStockThreshold,
                active: restoredProduct.status === "active",
              },
            });
          }
        }

        updateResult = {
          status: 200,
          order,
          previousStatus: currentOrder.orderStatus,
        };
      });

      if (updateResult.status !== 200) {
        return res.status(updateResult.status).json({
          success: false,
          message: updateResult.message,
        });
      }

      await Promise.all([
        ...restoredStockAlerts.map((change) =>
          safelyNotify(
            () => syncStockAlert(change),
            "Order cancellation stock"
          )
        ),
        safelyNotify(
          () =>
            notifyOrderStatusChange({
              userId: req.user._id,
              orderId: updateResult.order._id,
              previousStatus: updateResult.previousStatus,
              orderStatus,
            }),
          "Order status"
        ),
      ]);
      await recordActivity({
        userId: req.user._id,
        action: "order_cancelled",
        entityType: "order",
        entityId: updateResult.order._id,
        description: "Order cancelled",
        metadata: {
          previousStatus: updateResult.previousStatus,
          orderStatus: updateResult.order.orderStatus,
          paymentStatus: updateResult.order.paymentStatus,
        },
      });
      for (const item of updateResult.order.items) {
        await recordActivity({
          userId: req.user._id,
          action: "stock_increased",
          entityType: "inventory",
          entityId: item.productId,
          description: `Stock restored for ${item.name} after order cancellation`,
          metadata: {
            entityName: item.name,
            orderId: updateResult.order._id,
            variantId: item.variantId,
            change: item.quantity,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Order cancelled and stock restored successfully",
        order: updateResult.order,
      });
    }

    const currentOrder = await Order.findOne(orderFilter);
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const updateError = hasOrderStatus
      ? getOrderStatusTransitionError(
          currentOrder.orderStatus,
          orderStatus,
          currentOrder.paymentStatus
        )
      : getPaymentStatusUpdateError(
          currentOrder,
          paymentStatus,
          req.body.manualPaymentConfirmed
        );

    if (updateError) {
      return res.status(409).json({
        success: false,
        message: updateError,
      });
    }

    const filter = {
      ...orderFilter,
      ...(hasOrderStatus
        ? { orderStatus: currentOrder.orderStatus }
        : { paymentStatus: currentOrder.paymentStatus }),
    };
    const order = await Order.findOneAndUpdate(
      filter,
      { $set: hasOrderStatus ? { orderStatus } : { paymentStatus } },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(409).json({
        success: false,
        message: "The order changed before it could be updated. Refresh and try again.",
      });
    }

    if (hasOrderStatus && currentOrder.orderStatus !== order.orderStatus) {
      await safelyNotify(
        () =>
          notifyOrderStatusChange({
            userId: req.user._id,
            orderId: order._id,
            previousStatus: currentOrder.orderStatus,
            orderStatus: order.orderStatus,
          }),
        "Order status"
      );
      await recordActivity({
        userId: req.user._id,
        action: "order_status_changed",
        entityType: "order",
        entityId: order._id,
        description: "Order status changed",
        metadata: {
          previousStatus: currentOrder.orderStatus,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
        },
      });
    } else if (
      hasPaymentStatus &&
      currentOrder.paymentStatus !== order.paymentStatus
    ) {
      await recordActivity({
        userId: req.user._id,
        action: "payment_status_changed",
        entityType: "order",
        entityId: order._id,
        description: "Payment status changed",
        metadata: {
          previousStatus: currentOrder.paymentStatus,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    console.error("Update order error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        req.body?.orderStatus === "cancelled"
          ? "Could not cancel the order because stock could not be restored safely"
          : "Could not update order",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};