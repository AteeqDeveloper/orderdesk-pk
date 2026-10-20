import mongoose from "mongoose";
import Order from "../models/Order.js";

export const getDashboardStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(
      req.user._id.toString()
    );

    // Total orders and pending orders
    const orderStatsPromise = Order.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", "pending"] },
                1,
                0,
              ],
            },
          },
          deliveredOrders: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", "delivered"] },
                1,
                0,
              ],
            },
          },
          totalSales: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", "delivered"] },
                "$totalAmount",
                0,
              ],
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);

    // Monthly revenue: last 6 calendar months
    const now = new Date();
    const startDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - 5,
        1
      )
    );

    const monthlyRevenuePromise = Order.aggregate([
      {
        $match: {
          userId,
          orderStatus: "delivered",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Best-selling products from delivered orders
    const topProductsPromise = Order.aggregate([
      {
        $match: {
          userId,
          orderStatus: "delivered",
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: {
            $sum: "$items.lineTotal",
          },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: 1,
          quantitySold: 1,
          revenue: 1,
        },
      },
    ]);

    // Latest 5 orders
    const recentOrdersPromise = Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "customerSnapshot items totalAmount orderStatus paymentStatus createdAt"
      )
      .lean();

    const [
      orderStats,
      monthlyRevenue,
      topProducts,
      recentOrders,
    ] = await Promise.all([
      orderStatsPromise,
      monthlyRevenuePromise,
      topProductsPromise,
      recentOrdersPromise,
    ]);

    // Include months with zero revenue
    const revenueByMonth = new Map(
      monthlyRevenue.map((item) => [
        `${item._id.year}-${item._id.month}`,
        item,
      ])
    );

    const monthlyReport = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - i,
          1
        )
      );

      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const key = `${year}-${month}`;
      const record = revenueByMonth.get(key);

      monthlyReport.push({
        year,
        month,
        revenue: record?.revenue ?? 0,
        orders: record?.orders ?? 0,
      });
    }

    const stats = orderStats[0] || {
      totalOrders: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalSales: 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        summary: stats,
        monthlyRevenue: monthlyReport,
        topProducts,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics.",
    });
  }
};