import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import {
  AnalyticsQueryError,
  fillSalesTrend,
  getCustomerSpendingPipeline,
  getCustomerSummaryPipeline,
  getInventoryAnalyticsPipeline,
  getOrderStatsPipeline,
  getSalesPipeline,
  getTopProductsPipeline,
  parseAnalyticsQuery,
} from "../utils/analytics.js";

const getUserId = (req) => new mongoose.Types.ObjectId(req.user._id.toString());

const sendError = (res, error, operation) => {
  if (error instanceof AnalyticsQueryError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error(`${operation} error:`, error.message);
  return res.status(500).json({
    success: false,
    message: `Failed to load ${operation.toLowerCase()}.`,
  });
};

const getSalesReport = async (userId, dateRange) => {
  const [result = {}] = await Order.aggregate(
    getSalesPipeline(userId, dateRange, dateRange.interval)
  );
  const [totals = {}] = result.totals || [];
  return {
    totals: {
      totalOrders: totals.totalOrders || 0,
      deliveredOrders: totals.deliveredOrders || 0,
      deliveredSalesOrders: totals.deliveredSalesOrders || 0,
      paidOrders: totals.paidOrders || 0,
      unpaidOrders: totals.unpaidOrders || 0,
      cancelledOrders: totals.cancelledOrders || 0,
      deliveredSales: totals.deliveredSales || 0,
      paidAmounts: totals.paidAmounts || 0,
      unpaidAmounts: totals.unpaidAmounts || 0,
      refundedAmounts: totals.refundedAmounts || 0,
      cancelledOrderAmount: totals.cancelledOrderAmount || 0,
    },
    trend: fillSalesTrend(
      result.trend || [],
      dateRange.start,
      dateRange.end,
      dateRange.interval
    ),
  };
};

const getOrderReport = async (userId, dateRange) => {
  const [stats = {}] = await Order.aggregate(
    getOrderStatsPipeline(userId, dateRange)
  );
  return {
    totalOrders: stats.totalOrders || 0,
    pendingOrders: stats.pendingOrders || 0,
    confirmedOrders: stats.confirmedOrders || 0,
    shippedOrders: stats.shippedOrders || 0,
    deliveredOrders: stats.deliveredOrders || 0,
    cancelledOrders: stats.cancelledOrders || 0,
  };
};

const getTopProducts = (userId, dateRange, limit) =>
  Order.aggregate(getTopProductsPipeline(userId, dateRange, limit));

const getCustomerReport = async (userId, dateRange, limit) => {
  const [customerSummary, spendingSummary] = await Promise.all([
    Customer.aggregate(getCustomerSummaryPipeline(userId, dateRange)),
    Order.aggregate(getCustomerSpendingPipeline(userId, dateRange, limit)),
  ]);
  const customerCounts = customerSummary[0] || {};
  const spending = spendingSummary[0] || {};

  return {
    totalCustomers: customerCounts.totalCustomers?.[0]?.count || 0,
    newCustomers: customerCounts.newCustomers?.[0]?.count || 0,
    repeatCustomers: spending.repeatCustomers?.[0]?.count || 0,
    topSpendingCustomers: spending.topSpendingCustomers || [],
  };
};

const getInventoryReport = async (userId) => {
  const [inventory = {}] = await Product.aggregate(
    getInventoryAnalyticsPipeline(userId)
  );
  const [summary = {}] = inventory.summary || [];
  const lowStock = inventory.lowStock || [];
  const outOfStock = inventory.outOfStock || [];

  return {
    totalActiveProducts: summary.totalActiveProducts || 0,
    totalInventoryUnits: summary.totalInventoryUnits || 0,
    inventoryValue: summary.inventoryValue || 0,
    lowStock: { count: lowStock.length, items: lowStock },
    outOfStock: { count: outOfStock.length, items: outOfStock },
  };
};

const parseRequest = (req, res, allowedParams = []) => {
  try {
    return parseAnalyticsQuery(req.query, { allowedParams });
  } catch (error) {
    sendError(res, error, "Analytics");
    return null;
  }
};

export const getAnalyticsOverview = async (req, res) => {
  const dateRange = parseRequest(req, res, ["interval", "limit"]);
  if (!dateRange) return;

  try {
    const userId = getUserId(req);
    const [sales, orders, topProducts, customers, inventory] =
      await Promise.all([
        getSalesReport(userId, dateRange),
        getOrderReport(userId, dateRange),
        getTopProducts(userId, dateRange, dateRange.limit),
        getCustomerReport(userId, dateRange, dateRange.limit),
        getInventoryReport(userId),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        period: { ...dateRange.period, interval: dateRange.interval },
        sales,
        orders,
        topProducts,
        customers,
        inventory,
      },
    });
  } catch (error) {
    return sendError(res, error, "Analytics overview");
  }
};

export const getSalesAnalytics = async (req, res) => {
  const dateRange = parseRequest(req, res, ["interval"]);
  if (!dateRange) return;

  try {
    dateRange.interval = req.query.interval || "daily";
    const sales = await getSalesReport(getUserId(req), dateRange);
    return res.status(200).json({
      success: true,
      data: {
        period: { ...dateRange.period, interval: dateRange.interval },
        ...sales,
      },
    });
  } catch (error) {
    return sendError(res, error, "Sales analytics");
  }
};

export const getOrderAnalytics = async (req, res) => {
  const dateRange = parseRequest(req, res);
  if (!dateRange) return;

  try {
    const orders = await getOrderReport(getUserId(req), dateRange);
    return res.status(200).json({
      success: true,
      data: { period: dateRange.period, ...orders },
    });
  } catch (error) {
    return sendError(res, error, "Order analytics");
  }
};

export const getTopSellingProducts = async (req, res) => {
  const dateRange = parseRequest(req, res, ["limit"]);
  if (!dateRange) return;

  try {
    const products = await getTopProducts(
      getUserId(req),
      dateRange,
      dateRange.limit
    );
    return res.status(200).json({
      success: true,
      data: { period: dateRange.period, products },
    });
  } catch (error) {
    return sendError(res, error, "Top-selling product analytics");
  }
};

export const getCustomerAnalytics = async (req, res) => {
  const dateRange = parseRequest(req, res, ["limit"]);
  if (!dateRange) return;

  try {
    const customers = await getCustomerReport(
      getUserId(req),
      dateRange,
      dateRange.limit
    );
    return res.status(200).json({
      success: true,
      data: { period: dateRange.period, ...customers },
    });
  } catch (error) {
    return sendError(res, error, "Customer analytics");
  }
};

export const getInventoryAnalytics = async (req, res) => {
  if (Object.keys(req.query).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Inventory analytics does not accept query parameters",
    });
  }

  try {
    const inventory = await getInventoryReport(getUserId(req));
    return res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    return sendError(res, error, "Inventory analytics");
  }
};
