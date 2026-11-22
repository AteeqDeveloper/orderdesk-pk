import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";

const ACTIONS = new Set([
  "product_created",
  "product_updated",
  "product_deleted",
  "customer_created",
  "customer_updated",
  "customer_deleted",
  "order_created",
  "order_status_changed",
  "payment_status_changed",
  "order_cancelled",
  "stock_increased",
  "stock_decreased",
  "low_stock_threshold_updated",
  "variant_created",
  "variant_updated",
  "variant_deleted",
  "notification_read",
  "notification_deleted",
]);

const ENTITY_TYPES = new Set([
  "product",
  "customer",
  "order",
  "inventory",
  "variant",
  "notification",
]);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const invalidQuery = (res, message) =>
  res.status(400).json({ success: false, message });

const getDateBoundary = (value, isEndDate) => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnly) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [, yearValue, monthValue, dayValue] = dateOnly;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      isEndDate ? 23 : 0,
      isEndDate ? 59 : 0,
      isEndDate ? 59 : 0,
      isEndDate ? 999 : 0
    )
  );
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const parseListQuery = (query, res) => {
  const allowedParams = new Set([
    "page",
    "limit",
    "action",
    "entityType",
    "startDate",
    "endDate",
    "search",
  ]);
  if (Object.keys(query).some((key) => !allowedParams.has(key))) {
    invalidQuery(res, "Unsupported activity log filter");
    return null;
  }

  if (
    (query.page !== undefined && typeof query.page !== "string") ||
    (query.limit !== undefined && typeof query.limit !== "string") ||
    (query.page !== undefined && !/^\d+$/.test(query.page)) ||
    (query.limit !== undefined && !/^\d+$/.test(query.limit))
  ) {
    invalidQuery(res, "page and limit must be whole numbers");
    return null;
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) {
    invalidQuery(res, "page must be a positive whole number");
    return null;
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    invalidQuery(res, "limit must be a whole number from 1 to 100");
    return null;
  }

  if (
    (query.action !== undefined && typeof query.action !== "string") ||
    (query.action && !ACTIONS.has(query.action))
  ) {
    invalidQuery(res, "Invalid action filter");
    return null;
  }
  if (
    (query.entityType !== undefined && typeof query.entityType !== "string") ||
    (query.entityType && !ENTITY_TYPES.has(query.entityType))
  ) {
    invalidQuery(res, "Invalid entity type filter");
    return null;
  }
  if (query.search !== undefined && (typeof query.search !== "string" || query.search.length > 100)) {
    invalidQuery(res, "search must be 100 characters or fewer");
    return null;
  }

  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.search) filter.description = { $regex: escapeRegex(query.search), $options: "i" };

  if (
    (query.startDate !== undefined && typeof query.startDate !== "string") ||
    (query.endDate !== undefined && typeof query.endDate !== "string")
  ) {
    invalidQuery(res, "Date filters must be valid dates");
    return null;
  }

  if (query.startDate || query.endDate) {
    const startDate = query.startDate
      ? getDateBoundary(query.startDate, false)
      : null;
    const endDate = query.endDate ? getDateBoundary(query.endDate, true) : null;
    if ((query.startDate && !startDate) || (query.endDate && !endDate)) {
      invalidQuery(res, "Date filters must be valid dates");
      return null;
    }
    if (startDate && endDate && startDate > endDate) {
      invalidQuery(res, "startDate must be on or before endDate");
      return null;
    }
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  return { page, limit, filter };
};

export const getActivityLogs = async (req, res) => {
  const parsed = parseListQuery(req.query, res);
  if (!parsed) return;

  try {
    const { page, limit, filter } = parsed;
    const scopedFilter = { ...filter, userId: req.user._id };
    const [logs, total] = await Promise.all([
      ActivityLog.find(scopedFilter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(scopedFilter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get activity logs error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch activity logs",
    });
  }
};

export const getActivityLogById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity log ID",
      });
    }

    const log = await ActivityLog.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Activity log not found",
      });
    }

    return res.status(200).json({ success: true, data: { log } });
  } catch (error) {
    console.error("Get activity log error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch activity log",
    });
  }
};
