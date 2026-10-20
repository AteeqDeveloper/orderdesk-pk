import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";

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

    // Combine duplicate product IDs into one quantity
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

      const key = item.productId.toString();

      quantities.set(
        key,
        (quantities.get(key) || 0) + item.quantity
      );
    }

    const orderItems = [];
    let subtotal = 0;

    for (const [productId, quantity] of quantities) {
      // Only select products owned by this seller
      const product = await Product.findOne({
        _id: productId,
        userId,
        status: "active",
      });

      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
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
        quantity,
      });

      const lineTotal = product.price * quantity;

      orderItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku || "",
        quantity,
        unitPrice: product.price,
        lineTotal,
      });

      subtotal += lineTotal;
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
        await Product.updateOne(
          {
            _id: item.productId,
            userId,
          },
          {
            $inc: { stock: item.quantity },
          }
        );
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
  try {
    const { orderStatus, paymentStatus } = req.body;

    const allowedOrderStatuses = [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];

    const allowedPaymentStatuses = [
      "unpaid",
      "paid",
      "refunded",
    ];

    if (
      orderStatus === undefined &&
      paymentStatus === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide an order status or payment status",
      });
    }

    if (
      orderStatus !== undefined &&
      !allowedOrderStatuses.includes(orderStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    if (
      paymentStatus !== undefined &&
      !allowedPaymentStatuses.includes(paymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    if (
      orderStatus === "cancelled" &&
      paymentStatus !== undefined &&
      paymentStatus !== "unpaid"
    ) {
      return res.status(400).json({
        success: false,
        message: "Handle refunds separately before recording a refund",
      });
    }

    const changes = {};

    if (orderStatus !== undefined) {
      changes.orderStatus = orderStatus;
    }

    if (paymentStatus !== undefined) {
      changes.paymentStatus = paymentStatus;
    }

    const filter = {
      _id: req.params.id,
      userId: req.user._id,
    };

    if (orderStatus === "cancelled") {
      filter.orderStatus = {
        $nin: ["cancelled", "delivered"],
      };
    } else {
      filter.orderStatus = { $ne: "cancelled" };
    }

    const order = await Order.findOneAndUpdate(
      filter,
      { $set: changes },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found, already cancelled, or cannot be cancelled",
      });
    }

    // Restore stock once when the order is cancelled
    if (orderStatus === "cancelled") {
      for (const item of order.items) {
        await Product.updateOne(
          {
            _id: item.productId,
            userId: req.user._id,
          },
          {
            $inc: { stock: item.quantity },
          }
        );
      }
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
      message: "Could not update order",
    });
  }
};