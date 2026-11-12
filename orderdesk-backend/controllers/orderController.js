import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import {
  getOrderStatusTransitionError,
  getPaymentStatusUpdateError,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUSES,
} from "../utils/orderStatusRules.js";

const validId = (id) => mongoose.isValidObjectId(id);

const validMoney = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0;

// CREATE ORDER
export const createOrder = async (req, res) => {
  const userId = req.user._id;
  const decrementedProducts = [];

  try {
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

      if (item.variantId && !validId(item.variantId)) {
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
            "variants._id": variant._id,
            "variants.status": "active",
            "variants.stock": { $gte: quantity },
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

        decrementedProducts.push({
          productId: product._id,
          variantId: variant._id,
          quantity,
        });

        const unitPrice =
          typeof variant.price === "number" ? variant.price : product.price;
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

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    // Restore stock if order creation fails
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
          let stockUpdate;
          if (item.variantId) {
            stockUpdate = await Product.updateOne(
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
              { session }
            );

            // If the specific variant was removed from the product, restore parent stock
            if (stockUpdate.matchedCount === 0) {
              stockUpdate = await Product.updateOne(
                {
                  _id: item.productId,
                  userId: req.user._id,
                },
                { $inc: { stock: item.quantity } },
                { session }
              );
            }
          } else {
            stockUpdate = await Product.updateOne(
              {
                _id: item.productId,
                userId: req.user._id,
              },
              { $inc: { stock: item.quantity } },
              { session }
            );
          }

          if (stockUpdate.matchedCount !== 1) {
            throw new Error(`Could not restore stock for product ${item.productId}`);
          }
        }

        updateResult = { status: 200, order };
      });

      if (updateResult.status !== 200) {
        return res.status(updateResult.status).json({
          success: false,
          message: updateResult.message,
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