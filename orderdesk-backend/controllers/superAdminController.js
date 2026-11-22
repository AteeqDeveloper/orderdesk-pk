import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import SuperAdminAuditLog from "../models/SuperAdminAuditLog.js";
import User from "../models/user.js";
import UserSubscription from "../models/UserSubscription.js";
import {
  addBillingCycle,
  createPlanSnapshot,
  ensureFreeSubscription,
  snapshotSubscriptionsBeforePlanEdit,
} from "../utils/subscriptionService.js";
import { writeSuperAdminAudit } from "../utils/superAdminAudit.js";

const SUBSCRIPTION_STATUSES = [
  "pending_payment",
  "active",
  "cancel_at_period_end",
  "past_due",
  "failed",
  "cancelled",
  "expired",
];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"];
const USER_FIELDS = "fullName email businessName phone role status createdAt";
const PAGE_MAX = 100;

const invalidRequest = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const validId = mongoose.isValidObjectId;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validReason = (reason) =>
  typeof reason === "string" && reason.trim().length >= 5 && reason.length <= 500;

const parsePagination = (query, defaultLimit = 25) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || defaultLimit);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > PAGE_MAX
  ) {
    return null;
  }
  return { page, limit, skip: (page - 1) * limit };
};

const paginationResult = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

const serializeUser = (user, subscription) => ({
  id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  businessName: user.businessName || "",
  phone: user.phone || "",
  role: user.role,
  status: user.status || "active",
  createdAt: user.createdAt,
  currentSubscription: subscription
    ? {
        id: String(subscription._id),
        status: subscription.status,
        planId: String(subscription.planId?._id || subscription.planId),
        planName:
          subscription.planSnapshot?.name ||
          subscription.planId?.name ||
          "Unknown plan",
        planSlug:
          subscription.planSnapshot?.slug || subscription.planId?.slug || "",
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextBillingDate: subscription.nextBillingDate,
      }
    : null,
});

const parseDateRange = (query) => {
  const today = new Date();
  const defaultTo = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const fromValue = query.from || defaultFrom.toISOString().slice(0, 10);
  const toValue = query.to || defaultTo.toISOString().slice(0, 10);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(fromValue) || !datePattern.test(toValue)) return null;
  const from = new Date(`${fromValue}T00:00:00.000Z`);
  const to = new Date(`${toValue}T00:00:00.000Z`);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from.toISOString().slice(0, 10) !== fromValue ||
    to.toISOString().slice(0, 10) !== toValue ||
    from > to
  ) {
    return null;
  }
  const days = (to.getTime() - from.getTime()) / 86_400_000 + 1;
  if (days > 366) return null;
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from, to, end };
};

export const getSuperAdminOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalSubscriptions,
      subscriptionCounts,
      verifiedPayments,
      revenue,
      pendingPayments,
      cancelledSubscriptions,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: { $ne: "suspended" } }),
      UserSubscription.countDocuments({ isCurrent: true }),
      UserSubscription.aggregate([
        { $match: { isCurrent: true } },
        {
          $lookup: {
            from: SubscriptionPlan.collection.name,
            localField: "planId",
            foreignField: "_id",
            as: "plan",
          },
        },
        { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$plan.slug", count: { $sum: 1 } } },
      ]),
      Payment.countDocuments({ status: "paid", verifiedAt: { $ne: null } }),
      Payment.aggregate([
        { $match: { status: "paid", verifiedAt: { $ne: null } } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ status: "pending" }),
      UserSubscription.countDocuments({
        status: { $in: ["cancelled", "cancel_at_period_end"] },
      }),
    ]);

    const byPlan = Object.fromEntries(
      subscriptionCounts
        .filter((entry) => entry._id)
        .map((entry) => [entry._id, entry.count])
    );
    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalSubscriptions,
        subscriptionsByPlan: {
          free: byPlan.free || 0,
          starter: byPlan.starter || 0,
          pro: byPlan.pro || 0,
        },
        verifiedPayments,
        subscriptionRevenue: revenue[0]?.amount || 0,
        currency: "PKR",
        pendingPayments,
        cancelledSubscriptions,
      },
    });
  } catch (error) {
    console.error("Super Admin overview error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load platform statistics.",
    });
  }
};

export const listSuperAdminUsers = async (req, res) => {
  const pagination = parsePagination(req.query);
  const { q = "", planId, status } = req.query;
  if (
    !pagination ||
    Object.keys(req.query).some(
      (key) => !["page", "limit", "q", "planId", "status"].includes(key)
    ) ||
    typeof q !== "string" ||
    q.length > 100 ||
    (planId !== undefined && !validId(planId)) ||
    (status !== undefined && !["active", "suspended"].includes(status))
  ) {
    return invalidRequest(res, "Invalid user search or pagination parameters.");
  }

  try {
    const filter = {};
    if (q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), "i");
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { businessName: regex },
      ];
    }
    if (status === "suspended") filter.status = "suspended";
    if (status === "active") filter.status = { $ne: "suspended" };
    if (planId) {
      const userIds = await UserSubscription.distinct("userId", {
        planId,
        isCurrent: true,
      });
      filter._id = { $in: userIds };
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(USER_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    const userIds = users.map((user) => user._id);
    const subscriptions = await UserSubscription.find({
      userId: { $in: userIds },
      isCurrent: true,
    })
      .populate("planId", "name slug")
      .lean();
    const byUser = new Map(
      subscriptions.map((subscription) => [
        String(subscription.userId),
        subscription,
      ])
    );
    return res.status(200).json({
      success: true,
      data: {
        users: users.map((user) =>
          serializeUser(user, byUser.get(String(user._id)))
        ),
        pagination: paginationResult(
          pagination.page,
          pagination.limit,
          total
        ),
      },
    });
  } catch (error) {
    console.error("Super Admin user list error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load users.",
    });
  }
};

export const getSuperAdminUser = async (req, res) => {
  if (!validId(req.params.userId)) return invalidRequest(res, "Invalid user ID.");
  try {
    const user = await User.findById(req.params.userId).select(USER_FIELDS).lean();
    if (!user) return invalidRequest(res, "User not found.", 404);
    const subscriptions = await UserSubscription.find({ userId: user._id })
      .populate("planId", "name slug price currency billingCycle")
      .sort({ createdAt: -1 })
      .lean();
    const payments = await Payment.find({ userId: user._id })
      .select("subscriptionId amount currency status paymentMethod transactionReference paidAt createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    if (payments.length) {
      await writeSuperAdminAudit({
        actorId: req.user._id,
        action: "payment_records_viewed",
        targetType: "payment",
        reason: "Payment history inspected from user details.",
        metadata: { userId: String(user._id), records: payments.length },
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        user: serializeUser(
          user,
          subscriptions.find((subscription) => subscription.isCurrent)
        ),
        subscriptions: subscriptions.map((subscription) => ({
          id: String(subscription._id),
          status: subscription.status,
          planName:
            subscription.planSnapshot?.name ||
            subscription.planId?.name ||
            "Unknown plan",
          planSlug:
            subscription.planSnapshot?.slug || subscription.planId?.slug || "",
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          nextBillingDate: subscription.nextBillingDate,
          priceAtPurchase: subscription.priceAtPurchase,
          currency: subscription.currency,
          adminNote: subscription.adminNote,
          createdAt: subscription.createdAt,
        })),
        payments: payments.map((payment) => ({
          id: String(payment._id),
          subscriptionId: String(payment.subscriptionId),
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          transactionReference: payment.transactionReference,
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Super Admin user detail error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load user details.",
    });
  }
};

export const setSuperAdminUserStatus = async (req, res) => {
  const { status, reason } = req.body || {};
  if (
    !validId(req.params.userId) ||
    Object.keys(req.body || {}).some((key) => !["status", "reason"].includes(key)) ||
    !["active", "suspended"].includes(status) ||
    !validReason(reason)
  ) {
    return invalidRequest(res, "Provide a valid account status and a reason of 5-500 characters.");
  }

  try {
    const user = await User.findById(req.params.userId).select("_id role status");
    if (!user) return invalidRequest(res, "User not found.", 404);
    if (user.role === "super_admin" || user._id.equals(req.user._id)) {
      return invalidRequest(res, "You cannot suspend or reactivate a Super Admin account.", 403);
    }
    const previousStatus = user.status || "active";
    if (previousStatus === status) {
      return invalidRequest(res, `This account is already ${status}.`, 409);
    }

    user.status = status;
    await user.save();
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: status === "suspended" ? "user_suspended" : "user_reactivated",
      targetType: "user",
      targetId: user._id,
      reason: reason.trim(),
      metadata: { previousStatus, status },
    });
    return res.status(200).json({
      success: true,
      message: `Account ${status === "suspended" ? "suspended" : "reactivated"}.`,
      data: { userId: String(user._id), status },
    });
  } catch (error) {
    console.error("Super Admin user status update error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Account status update or its audit record could not be completed.",
    });
  }
};

export const listSuperAdminSubscriptions = async (req, res) => {
  const pagination = parsePagination(req.query);
  const { status, planId, q = "" } = req.query;
  if (
    !pagination ||
    Object.keys(req.query).some(
      (key) => !["page", "limit", "status", "planId", "q"].includes(key)
    ) ||
    (status !== undefined && !SUBSCRIPTION_STATUSES.includes(status)) ||
    (planId !== undefined && !validId(planId)) ||
    typeof q !== "string" ||
    q.length > 100
  ) {
    return invalidRequest(res, "Invalid subscription filter or pagination.");
  }

  try {
    const filter = {};
    if (status) filter.status = status;
    if (planId) filter.planId = planId;
    if (q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), "i");
      const users = await User.find({
        $or: [{ fullName: regex }, { email: regex }, { businessName: regex }],
      })
        .select("_id")
        .limit(5000)
        .lean();
      filter.userId = { $in: users.map((user) => user._id) };
    }
    const [subscriptions, total] = await Promise.all([
      UserSubscription.find(filter)
        .populate("userId", "fullName email businessName status")
        .populate("planId", "name slug price currency billingCycle")
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      UserSubscription.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        subscriptions: subscriptions.map((subscription) => ({
          id: String(subscription._id),
          user: subscription.userId
            ? {
                id: String(subscription.userId._id),
                name: subscription.userId.fullName,
                email: subscription.userId.email,
                businessName: subscription.userId.businessName || "",
                status: subscription.userId.status || "active",
              }
            : null,
          plan: {
            id: String(subscription.planId?._id || subscription.planId),
            name:
              subscription.planSnapshot?.name ||
              subscription.planId?.name ||
              "Unknown plan",
            slug:
              subscription.planSnapshot?.slug ||
              subscription.planId?.slug ||
              "",
          },
          status: subscription.status,
          isCurrent: subscription.isCurrent,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          nextBillingDate: subscription.nextBillingDate,
          billingCycle: subscription.billingCycle,
          priceAtPurchase: subscription.priceAtPurchase,
          currency: subscription.currency,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          adminNote: subscription.adminNote,
          createdAt: subscription.createdAt,
        })),
        pagination: paginationResult(
          pagination.page,
          pagination.limit,
          total
        ),
      },
    });
  } catch (error) {
    console.error("Super Admin subscription list error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load subscriptions.",
    });
  }
};

export const changeSuperAdminSubscriptionStatus = async (req, res) => {
  const { status, reason } = req.body || {};
  if (
    !validId(req.params.subscriptionId) ||
    Object.keys(req.body || {}).some((key) => !["status", "reason"].includes(key)) ||
    !["cancelled", "expired", "past_due", "failed"].includes(status) ||
    !validReason(reason)
  ) {
    return invalidRequest(res, "Provide a supported status and a reason of 5-500 characters.");
  }

  try {
    const subscription = await UserSubscription.findById(req.params.subscriptionId);
    if (!subscription) return invalidRequest(res, "Subscription not found.", 404);
    const previousStatus = subscription.status;
    if (status === "past_due" && !subscription.isCurrent) {
      return invalidRequest(res, "Only a current subscription can be marked past due.", 409);
    }
    subscription.status = status;
    subscription.adminNote = reason.trim();
    if (status !== "past_due") {
      subscription.isCurrent = false;
      subscription.cancelAtPeriodEnd = false;
      subscription.endedAt = new Date();
    }
    await subscription.save();
    if (["cancelled", "failed", "expired"].includes(status)) {
      await Payment.updateMany(
        { subscriptionId: subscription._id, status: "pending" },
        {
          $set: {
            status: status === "failed" ? "failed" : "cancelled",
            failureReason: reason.trim(),
          },
        }
      );
    }
    if (status !== "past_due") await ensureFreeSubscription(subscription.userId);
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: "subscription_status_changed",
      targetType: "subscription",
      targetId: subscription._id,
      reason: reason.trim(),
      metadata: { previousStatus, status, userId: String(subscription.userId) },
    });
    return res.status(200).json({
      success: true,
      message: "Subscription status updated.",
      data: { subscriptionId: String(subscription._id), status },
    });
  } catch (error) {
    console.error("Super Admin subscription status error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Subscription status update or its audit record could not be completed.",
    });
  }
};

export const assignSuperAdminPlan = async (req, res) => {
  const { planId, reason } = req.body || {};
  if (
    !validId(req.params.userId) ||
    Object.keys(req.body || {}).some((key) => !["planId", "reason"].includes(key)) ||
    !validId(planId) ||
    !validReason(reason)
  ) {
    return invalidRequest(res, "Provide a valid plan ID and a reason of 5-500 characters.");
  }

  let createdSubscription;
  let previousSubscription;
  let previousState;
  let assignmentCommitted = false;
  try {
    const [user, plan] = await Promise.all([
      User.findById(req.params.userId).select("_id role status"),
      SubscriptionPlan.findOne({ _id: planId, isActive: true }),
    ]);
    if (!user) return invalidRequest(res, "User not found.", 404);
    if (user.role === "super_admin") {
      return invalidRequest(res, "A Super Admin cannot be assigned a business subscription.", 409);
    }
    if (user.status === "suspended") {
      return invalidRequest(res, "Reactivate this account before assigning a plan.", 409);
    }
    if (!plan) return invalidRequest(res, "Active plan not found.", 404);

    const current = await UserSubscription.findOne({
      userId: user._id,
      isCurrent: true,
    });
    if (current?.planId.equals(plan._id)) {
      return invalidRequest(res, "This user is already on that plan.", 409);
    }
    previousSubscription = current;
    if (previousSubscription) {
      previousState = {
        status: previousSubscription.status,
        cancelAtPeriodEnd: previousSubscription.cancelAtPeriodEnd,
        endedAt: previousSubscription.endedAt,
        adminNote: previousSubscription.adminNote,
      };
    }
    const now = new Date();
    const endDate = plan.slug === "free" ? null : addBillingCycle(now, plan.billingCycle);
    createdSubscription = await UserSubscription.create({
      userId: user._id,
      planId: plan._id,
      planSnapshot: createPlanSnapshot(plan),
      status: "active",
      isCurrent: false,
      startDate: now,
      endDate,
      nextBillingDate: endDate,
      billingCycle: plan.billingCycle,
      priceAtPurchase: 0,
      currency: "PKR",
      paymentProvider: "unconfigured",
      adminNote: reason.trim(),
      activatedAt: now,
    });

    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: "subscription_plan_assignment_attempted",
      targetType: "subscription",
      targetId: createdSubscription._id,
      reason: reason.trim(),
      metadata: {
        userId: String(user._id),
        planId: String(plan._id),
        complimentary: true,
      },
    });

    if (previousSubscription) {
      previousSubscription.status = "cancelled";
      previousSubscription.isCurrent = false;
      previousSubscription.cancelAtPeriodEnd = false;
      previousSubscription.endedAt = now;
      previousSubscription.adminNote = reason.trim();
      await previousSubscription.save();
    }
    createdSubscription.isCurrent = true;
    await createdSubscription.save();
    await UserSubscription.updateMany(
      {
        userId: user._id,
        status: "pending_payment",
        isCurrent: false,
      },
      { $set: { status: "cancelled", endedAt: now, adminNote: reason.trim() } }
    );
    await Payment.updateMany(
      { userId: user._id, status: "pending" },
      { $set: { status: "cancelled", failureReason: "Plan assigned by Super Admin" } }
    );
    assignmentCommitted = true;
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: "subscription_plan_assigned",
      targetType: "subscription",
      targetId: createdSubscription._id,
      reason: reason.trim(),
      metadata: {
        userId: String(user._id),
        planId: String(plan._id),
        previousPlanId: previousSubscription
          ? String(previousSubscription.planId)
          : null,
        complimentary: true,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Plan assigned. This administrative grant does not create a payment record.",
      data: {
        subscriptionId: String(createdSubscription._id),
        status: createdSubscription.status,
        plan: { id: String(plan._id), name: plan.name },
      },
    });
  } catch (error) {
    if (createdSubscription && !assignmentCommitted) {
      try {
        await UserSubscription.deleteOne({ _id: createdSubscription._id });
      } catch (cleanupError) {
        console.error("Super Admin plan assignment cleanup failed:", cleanupError.message);
      }
    }
    if (previousSubscription && previousState && !assignmentCommitted) {
      try {
        await UserSubscription.updateOne(
          { _id: previousSubscription._id },
          {
            $set: {
              status: previousState.status,
              isCurrent: true,
              cancelAtPeriodEnd: previousState.cancelAtPeriodEnd,
              endedAt: previousState.endedAt,
              adminNote: previousState.adminNote,
            },
          }
        );
      } catch (restoreError) {
        console.error("Super Admin subscription recovery failed:", restoreError.message);
      }
    }
    console.error("Super Admin plan assignment error:", error.message);
    return res.status(500).json({
      success: false,
      message: assignmentCommitted
        ? "Plan assignment succeeded, but its completion audit record failed. Check the activity log before retrying."
        : "Plan assignment could not be completed safely.",
    });
  }
};

export const listSuperAdminPayments = async (req, res) => {
  const pagination = parsePagination(req.query);
  const { status, q = "" } = req.query;
  if (
    !pagination ||
    Object.keys(req.query).some(
      (key) => !["page", "limit", "status", "q"].includes(key)
    ) ||
    (status !== undefined && !PAYMENT_STATUSES.includes(status)) ||
    typeof q !== "string" ||
    q.length > 160
  ) {
    return invalidRequest(res, "Invalid payment filter or pagination.");
  }
  try {
    const filter = {};
    if (status) filter.status = status;
    if (q.trim()) filter.transactionReference = new RegExp(escapeRegex(q.trim()), "i");
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("userId", "fullName email businessName")
        .populate({
          path: "subscriptionId",
          select: "planId",
          populate: { path: "planId", select: "name slug" },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: "payment_records_viewed",
      targetType: "payment",
      metadata: { page: pagination.page, status: status || "all" },
    });
    return res.status(200).json({
      success: true,
      data: {
        payments: payments.map((payment) => ({
          id: String(payment._id),
          transactionReference: payment.transactionReference,
          user: payment.userId
            ? {
                id: String(payment.userId._id),
                name: payment.userId.fullName,
                email: payment.userId.email,
                businessName: payment.userId.businessName || "",
              }
            : null,
          plan: payment.subscriptionId?.planId
            ? {
                id: String(payment.subscriptionId.planId._id),
                name: payment.subscriptionId.planId.name,
                slug: payment.subscriptionId.planId.slug,
              }
            : null,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          paymentProvider: payment.paymentProvider,
          status: payment.status,
          paidAt: payment.paidAt,
          verifiedAt: payment.verifiedAt,
          createdAt: payment.createdAt,
        })),
        pagination: paginationResult(
          pagination.page,
          pagination.limit,
          total
        ),
      },
    });
  } catch (error) {
    console.error("Super Admin payment list error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load payment records.",
    });
  }
};

export const getSuperAdminAnalytics = async (req, res) => {
  if (Object.keys(req.query).some((key) => !["from", "to"].includes(key))) {
    return invalidRequest(res, "Only from and to date filters are supported.");
  }
  const range = parseDateRange(req.query);
  if (!range) return invalidRequest(res, "Invalid date range. Maximum range is 366 days.");
  const match = { $gte: range.from, $lt: range.end };
  try {
    const [registrations, revenue, upgrades, cancellations, distribution] =
      await Promise.all([
        User.aggregate([
          { $match: { createdAt: match } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Payment.aggregate([
          {
            $match: {
              status: "paid",
              verifiedAt: { $ne: null },
              paidAt: match,
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
              amount: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        UserSubscription.aggregate([
          {
            $match: {
              activatedAt: match,
              priceAtPurchase: { $gt: 0 },
            },
          },
          {
            $lookup: {
              from: SubscriptionPlan.collection.name,
              localField: "planId",
              foreignField: "_id",
              as: "plan",
            },
          },
          { $unwind: "$plan" },
          { $match: { "plan.slug": { $ne: "free" } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$activatedAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        UserSubscription.aggregate([
          {
            $match: {
              status: { $in: ["cancelled", "cancel_at_period_end"] },
              updatedAt: match,
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        UserSubscription.aggregate([
          { $match: { isCurrent: true } },
          {
            $lookup: {
              from: SubscriptionPlan.collection.name,
              localField: "planId",
              foreignField: "_id",
              as: "plan",
            },
          },
          { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
          { $group: { _id: "$plan.slug", count: { $sum: 1 } } },
        ]),
      ]);
    return res.status(200).json({
      success: true,
      data: {
        range: {
          from: range.from.toISOString().slice(0, 10),
          to: range.to.toISOString().slice(0, 10),
        },
        registrations,
        revenue,
        upgrades,
        cancellations,
        distribution: Object.fromEntries(
          distribution.filter((entry) => entry._id).map((entry) => [entry._id, entry.count])
        ),
        currency: "PKR",
      },
    });
  } catch (error) {
    console.error("Super Admin analytics error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load platform analytics.",
    });
  }
};

export const listSuperAdminAuditLogs = async (req, res) => {
  const pagination = parsePagination(req.query);
  const { action } = req.query;
  if (
    !pagination ||
    Object.keys(req.query).some((key) => !["page", "limit", "action"].includes(key)) ||
    (action !== undefined &&
      !SuperAdminAuditLog.schema.path("action").enumValues.includes(action))
  ) {
    return invalidRequest(res, "Invalid audit log filter or pagination.");
  }
  try {
    const filter = action ? { action } : {};
    const [logs, total] = await Promise.all([
      SuperAdminAuditLog.find(filter)
        .populate("actorId", "fullName email")
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      SuperAdminAuditLog.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        activity: logs.map((log) => ({
          id: String(log._id),
          admin: log.actorId
            ? { name: log.actorId.fullName, email: log.actorId.email }
            : null,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId ? String(log.targetId) : null,
          reason: log.reason,
          metadata: log.metadata,
          createdAt: log.createdAt,
        })),
        pagination: paginationResult(
          pagination.page,
          pagination.limit,
          total
        ),
      },
    });
  } catch (error) {
    console.error("Super Admin audit list error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load Super Admin activity.",
    });
  }
};

export const getSuperAdminSettings = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      admin: {
        id: String(req.user._id),
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
      },
      currency: "PKR",
      paymentProviderConfigured: false,
      automaticRenewalsEnabled: false,
    },
  });
};
