const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = ["today", "last7days", "last30days", "thisMonth"];
const INTERVALS = ["daily", "weekly", "monthly"];

export class AnalyticsQueryError extends Error {}

const utcStartOfDay = (date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

const parseDate = (value, fieldName) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new AnalyticsQueryError(`${fieldName} must use YYYY-MM-DD format`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  if (date.toISOString().slice(0, 10) !== value) {
    throw new AnalyticsQueryError(`${fieldName} is not a valid date`);
  }

  return date;
};

const addUtcDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export function parseAnalyticsQuery(
  query,
  { allowedParams = [], now = new Date() } = {}
) {
  const allowed = new Set([
    "period",
    "startDate",
    "endDate",
    ...allowedParams,
  ]);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key)) {
      throw new AnalyticsQueryError(`Unsupported query parameter: ${key}`);
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new AnalyticsQueryError(`${key} must be a single non-empty value`);
    }
  }

  const { period, startDate, endDate } = query;
  if ((startDate && !endDate) || (!startDate && endDate)) {
    throw new AnalyticsQueryError(
      "Both startDate and endDate are required for a custom range"
    );
  }
  if (period && (startDate || endDate)) {
    throw new AnalyticsQueryError(
      "Use either period or startDate/endDate, not both"
    );
  }
  if (period && !PERIODS.includes(period)) {
    throw new AnalyticsQueryError(
      `period must be one of: ${PERIODS.join(", ")}`
    );
  }

  const today = utcStartOfDay(now);
  let start;
  let end;

  if (startDate) {
    start = parseDate(startDate, "startDate");
    const inclusiveEnd = parseDate(endDate, "endDate");
    if (start > inclusiveEnd) {
      throw new AnalyticsQueryError("startDate must be on or before endDate");
    }
    end = addUtcDays(inclusiveEnd, 1);
  } else {
    const selectedPeriod = period || "last30days";
    if (selectedPeriod === "today") {
      start = today;
    } else if (selectedPeriod === "last7days") {
      start = addUtcDays(today, -6);
    } else if (selectedPeriod === "last30days") {
      start = addUtcDays(today, -29);
    } else {
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    }
    end = addUtcDays(today, 1);
  }

  const interval = query.interval || "daily";
  if (query.interval && !INTERVALS.includes(query.interval)) {
    throw new AnalyticsQueryError(
      `interval must be one of: ${INTERVALS.join(", ")}`
    );
  }

  let limit = 5;
  if (query.limit) {
    if (!/^\d+$/.test(query.limit)) {
      throw new AnalyticsQueryError("limit must be a whole number from 1 to 50");
    }
    limit = Number(query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      throw new AnalyticsQueryError("limit must be a whole number from 1 to 50");
    }
  }

  return {
    start,
    end,
    interval,
    limit,
    period: {
      startDate: start.toISOString().slice(0, 10),
      endDate: addUtcDays(end, -1).toISOString().slice(0, 10),
      timezone: "UTC",
    },
  };
}

const floorToBucket = (date, interval) => {
  const result = utcStartOfDay(date);
  if (interval === "weekly") {
    const daysSinceMonday = (result.getUTCDay() + 6) % 7;
    result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  } else if (interval === "monthly") {
    result.setUTCDate(1);
  }
  return result;
};

const nextBucket = (date, interval) => {
  const result = new Date(date);
  if (interval === "monthly") {
    result.setUTCMonth(result.getUTCMonth() + 1);
  } else {
    result.setUTCDate(result.getUTCDate() + (interval === "weekly" ? 7 : 1));
  }
  return result;
};

export function fillSalesTrend(rows, start, end, interval) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const lastIncludedDay = addUtcDays(end, -1);
  const result = [];

  for (
    let bucket = floorToBucket(start, interval);
    bucket <= floorToBucket(lastIncludedDay, interval);
    bucket = nextBucket(bucket, interval)
  ) {
    const date = bucket.toISOString().slice(0, 10);
    result.push(
      byDate.get(date) || {
        date,
        totalOrders: 0,
        deliveredOrders: 0,
        deliveredSalesOrders: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        cancelledOrders: 0,
        deliveredSales: 0,
        paidAmounts: 0,
        unpaidAmounts: 0,
        refundedAmounts: 0,
        cancelledOrderAmount: 0,
      }
    );
  }
  return result;
}

export const getSalesMetricExpressions = () => ({
  totalOrders: { $sum: 1 },
  deliveredOrders: {
    $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] },
  },
  deliveredSalesOrders: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$orderStatus", "delivered"] },
            { $ne: ["$paymentStatus", "refunded"] },
          ],
        },
        1,
        0,
      ],
    },
  },
  paidOrders: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$paymentStatus", "paid"] },
            { $ne: ["$orderStatus", "cancelled"] },
          ],
        },
        1,
        0,
      ],
    },
  },
  unpaidOrders: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$paymentStatus", "unpaid"] },
            { $ne: ["$orderStatus", "cancelled"] },
          ],
        },
        1,
        0,
      ],
    },
  },
  cancelledOrders: {
    $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] },
  },
  deliveredSales: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$orderStatus", "delivered"] },
            { $ne: ["$paymentStatus", "refunded"] },
          ],
        },
        { $ifNull: ["$totalAmount", 0] },
        0,
      ],
    },
  },
  paidAmounts: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$paymentStatus", "paid"] },
            { $ne: ["$orderStatus", "cancelled"] },
          ],
        },
        { $ifNull: ["$totalAmount", 0] },
        0,
      ],
    },
  },
  unpaidAmounts: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$paymentStatus", "unpaid"] },
            { $ne: ["$orderStatus", "cancelled"] },
          ],
        },
        { $ifNull: ["$totalAmount", 0] },
        0,
      ],
    },
  },
  refundedAmounts: {
    $sum: {
      $cond: [
        { $eq: ["$paymentStatus", "refunded"] },
        { $ifNull: ["$totalAmount", 0] },
        0,
      ],
    },
  },
  cancelledOrderAmount: {
    $sum: {
      $cond: [
        { $eq: ["$orderStatus", "cancelled"] },
        { $ifNull: ["$totalAmount", 0] },
        0,
      ],
    },
  },
});

export function getSalesPipeline(userId, dateRange, interval) {
  const dateBucket = {
    $dateTrunc: {
      date: "$createdAt",
      unit: interval === "daily" ? "day" : interval === "weekly" ? "week" : "month",
      timezone: "UTC",
      ...(interval === "weekly" ? { startOfWeek: "Monday" } : {}),
    },
  };
  const metrics = getSalesMetricExpressions();

  return [
    { $match: { userId, createdAt: { $gte: dateRange.start, $lt: dateRange.end } } },
    {
      $facet: {
        totals: [{ $group: { _id: null, ...metrics } }, { $project: { _id: 0 } }],
        trend: [
          { $group: { _id: dateBucket, ...metrics } },
          {
            $project: {
              _id: 0,
              date: {
                $dateToString: {
                  date: "$_id",
                  format: "%Y-%m-%d",
                  timezone: "UTC",
                },
              },
              totalOrders: 1,
              deliveredOrders: 1,
              deliveredSalesOrders: 1,
              paidOrders: 1,
              unpaidOrders: 1,
              cancelledOrders: 1,
              deliveredSales: 1,
              paidAmounts: 1,
              unpaidAmounts: 1,
              refundedAmounts: 1,
              cancelledOrderAmount: 1,
            },
          },
          { $sort: { date: 1 } },
        ],
      },
    },
  ];
}

export function getOrderStatsPipeline(userId, dateRange) {
  return [
    {
      $match: {
        userId,
        createdAt: { $gte: dateRange.start, $lt: dateRange.end },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0] },
        },
        confirmedOrders: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "confirmed"] }, 1, 0] },
        },
        shippedOrders: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "shipped"] }, 1, 0] },
        },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] },
        },
      },
    },
    { $project: { _id: 0 } },
  ];
}

export function getTopProductsPipeline(userId, dateRange, limit) {
  return [
    {
      $match: {
        userId,
        orderStatus: "delivered",
        paymentStatus: { $ne: "refunded" },
        createdAt: { $gte: dateRange.start, $lt: dateRange.end },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          productId: "$items.productId",
          variantId: { $ifNull: ["$items.variantId", null] },
        },
        name: { $first: "$items.name" },
        size: { $first: "$items.size" },
        color: { $first: "$items.color" },
        sku: { $first: "$items.sku" },
        unitsSold: { $sum: "$items.quantity" },
        revenueGenerated: { $sum: "$items.lineTotal" },
      },
    },
    {
      $lookup: {
        from: "products",
        let: { selectedProductId: "$_id.productId", ownerId: userId },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$selectedProductId"] },
                  { $eq: ["$userId", "$$ownerId"] },
                ],
              },
            },
          },
          { $project: { _id: 0, imageUrl: 1, variants: 1 } },
        ],
        as: "product",
      },
    },
    {
      $set: {
        variant: {
          $arrayElemAt: [
            {
              $filter: {
                input: { $ifNull: [{ $arrayElemAt: ["$product.variants", 0] }, []] },
                as: "variant",
                cond: { $eq: ["$$variant._id", "$_id.variantId"] },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id.productId",
        variantId: "$_id.variantId",
        name: 1,
        sku: 1,
        imageUrl: {
          $cond: [
            { $ne: [{ $ifNull: ["$variant.imageUrl", ""] }, ""] },
            "$variant.imageUrl",
            { $ifNull: [{ $arrayElemAt: ["$product.imageUrl", 0] }, ""] },
          ],
        },
        unitsSold: 1,
        revenueGenerated: 1,
        variant: {
          $cond: [
            { $ne: ["$_id.variantId", null] },
            { size: "$size", color: "$color", sku: "$sku" },
            null,
          ],
        },
      },
    },
    { $sort: { unitsSold: -1, revenueGenerated: -1, name: 1 } },
    { $limit: limit },
  ];
}

export function getCustomerSummaryPipeline(userId, dateRange) {
  return [
    { $match: { userId } },
    {
      $facet: {
        totalCustomers: [{ $count: "count" }],
        newCustomers: [
          {
            $match: {
              createdAt: { $gte: dateRange.start, $lt: dateRange.end },
            },
          },
          { $count: "count" },
        ],
      },
    },
  ];
}

export function getCustomerSpendingPipeline(userId, dateRange, limit) {
  return [
    {
      $match: {
        userId,
        orderStatus: "delivered",
        paymentStatus: { $ne: "refunded" },
        createdAt: { $gte: dateRange.start, $lt: dateRange.end },
      },
    },
    {
      $group: {
        _id: "$customerId",
        completedOrders: { $sum: 1 },
        completedSpending: {
          $sum: {
            $cond: [
              { $eq: ["$paymentStatus", "paid"] },
              { $ifNull: ["$totalAmount", 0] },
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "customers",
        let: { selectedCustomerId: "$_id", ownerId: userId },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$selectedCustomerId"] },
                  { $eq: ["$userId", "$$ownerId"] },
                ],
              },
            },
          },
          { $project: { _id: 0, name: 1 } },
        ],
        as: "customer",
      },
    },
    { $match: { "customer.0": { $exists: true } } },
    {
      $facet: {
        repeatCustomers: [
          { $match: { completedOrders: { $gte: 2 } } },
          { $count: "count" },
        ],
        topSpendingCustomers: [
          { $sort: { completedSpending: -1, completedOrders: -1 } },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              customerId: "$_id",
              name: { $arrayElemAt: ["$customer.name", 0] },
              completedOrders: 1,
              completedSpending: 1,
            },
          },
        ],
      },
    },
  ];
}

export function getInventoryAnalyticsPipeline(userId) {
  const useVariants = {
    $and: [
      { $eq: ["$hasVariants", true] },
      { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
    ],
  };
  const activeVariants = {
    $filter: {
      input: { $ifNull: ["$variants", []] },
      as: "variant",
      cond: { $eq: ["$$variant.status", "active"] },
    },
  };

  return [
    { $match: { userId, status: "active" } },
    {
      $project: {
        name: 1,
        imageUrl: 1,
        stock: 1,
        lowStockThreshold: 1,
        costPrice: 1,
        inventoryItems: {
          $cond: [
            useVariants,
            {
              $map: {
                input: activeVariants,
                as: "variant",
                in: {
                  variantId: "$$variant._id",
                  variantName: {
                    $let: {
                      vars: {
                        label: {
                          $trim: {
                            input: {
                              $concat: [
                                { $ifNull: ["$$variant.size", ""] },
                                " ",
                                { $ifNull: ["$$variant.color", ""] },
                              ],
                            },
                          },
                        },
                      },
                      in: {
                        $cond: [{ $eq: ["$$label", ""] }, "Variant", "$$label"],
                      },
                    },
                  },
                  stock: { $ifNull: ["$$variant.stock", 0] },
                  lowStockThreshold: {
                    $ifNull: ["$$variant.lowStockThreshold", 5],
                  },
                  costPrice: { $ifNull: ["$$variant.costPrice", 0] },
                },
              },
            },
            [
              {
                variantId: null,
                variantName: "",
                stock: { $ifNull: ["$stock", 0] },
                lowStockThreshold: { $ifNull: ["$lowStockThreshold", 5] },
                costPrice: { $ifNull: ["$costPrice", 0] },
              },
            ],
          ],
        },
      },
    },
    {
      $set: {
        inventoryUnits: {
          $reduce: {
            input: "$inventoryItems",
            initialValue: 0,
            in: { $add: ["$$value", "$$this.stock"] },
          },
        },
        inventoryValue: {
          $reduce: {
            input: "$inventoryItems",
            initialValue: 0,
            in: {
              $add: [
                "$$value",
                { $multiply: ["$$this.stock", "$$this.costPrice"] },
              ],
            },
          },
        },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalActiveProducts: { $sum: 1 },
              totalInventoryUnits: { $sum: "$inventoryUnits" },
              inventoryValue: { $sum: "$inventoryValue" },
            },
          },
          { $project: { _id: 0 } },
        ],
        lowStock: [
          { $unwind: "$inventoryItems" },
          {
            $match: {
              $expr: {
                $and: [
                  { $gt: ["$inventoryItems.stock", 0] },
                  {
                    $lte: [
                      "$inventoryItems.stock",
                      "$inventoryItems.lowStockThreshold",
                    ],
                  },
                ],
              },
            },
          },
          {
            $project: {
              _id: 0,
              productId: "$_id",
              productName: "$name",
              variantId: "$inventoryItems.variantId",
              variantName: "$inventoryItems.variantName",
              stock: "$inventoryItems.stock",
              lowStockThreshold: "$inventoryItems.lowStockThreshold",
            },
          },
          { $sort: { stock: 1, productName: 1 } },
        ],
        outOfStock: [
          { $unwind: "$inventoryItems" },
          { $match: { "inventoryItems.stock": { $lte: 0 } } },
          {
            $project: {
              _id: 0,
              productId: "$_id",
              productName: "$name",
              variantId: "$inventoryItems.variantId",
              variantName: "$inventoryItems.variantName",
            },
          },
          { $sort: { productName: 1 } },
        ],
      },
    },
  ];
}
