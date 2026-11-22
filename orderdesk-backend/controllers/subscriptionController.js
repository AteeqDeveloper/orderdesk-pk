import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import UserSubscription from "../models/UserSubscription.js";
import {
  addBillingCycle,
  createPlanSnapshot,
  ensureFreeSubscription,
  getCurrentSubscription,
  getSubscriptionOverview,
  snapshotSubscriptionsBeforePlanEdit,
} from "../utils/subscriptionService.js";
import { writeSuperAdminAudit } from "../utils/superAdminAudit.js";

const ADMIN_PAYMENT_METHODS = new Set([
  "manual_bank_transfer",
  "manual_jazzcash",
  "manual_easypaisa",
]);
const EDITABLE_PLAN_FIELDS = new Set([
  "name",
  "description",
  "price",
  "billingCycle",
  "features",
  "limits",
  "isActive",
]);
const PLAN_LIMIT_FIELDS = new Set(["products", "customers", "ordersPerMonth"]);
const validReason = (reason) =>
  typeof reason === "string" && reason.trim().length >= 5 && reason.length <= 500;

const publicPlan = (plan) => {
  const result = typeof plan.toObject === "function" ? plan.toObject() : { ...plan };
  if (!result.priceConfigured) result.price = null;
  return result;
};

const toPayment = (payment) => ({
  id: String(payment._id),
  subscriptionId: String(payment.subscriptionId),
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  paymentMethod: payment.paymentMethod,
  paymentProvider: payment.paymentProvider,
  transactionReference: payment.transactionReference,
  paidAt: payment.paidAt,
  createdAt: payment.createdAt,
});

const toPublicSubscription = (subscription) => ({
  id: String(subscription._id),
  planId: String(subscription.planId),
  status: subscription.status,
  startDate: subscription.startDate,
  endDate: subscription.endDate,
  nextBillingDate: subscription.nextBillingDate,
  billingCycle: subscription.billingCycle,
  priceAtPurchase: subscription.priceAtPurchase,
  currency: subscription.currency,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  requestedAt: subscription.requestedAt,
  activatedAt: subscription.activatedAt,
  endedAt: subscription.endedAt,
});

const invalidRequest = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

export const getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({
      price: 1,
      name: 1,
    });
    return res.status(200).json({
      success: true,
      data: { plans: plans.map(publicPlan) },
    });
  } catch (error) {
    console.error("Get subscription plans error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load subscription plans.",
    });
  }
};

export const getAllSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({}).sort({ createdAt: 1 });
    return res.status(200).json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    console.error("Admin get subscription plans error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load subscription plans.",
    });
  }
};

export const getCurrentSubscriptionDetails = async (req, res) => {
  try {
    const overview = await getSubscriptionOverview(req.user._id);
    const pendingSubscription = await UserSubscription.findOne({
      userId: req.user._id,
      status: "pending_payment",
      isCurrent: false,
    }).sort({ createdAt: -1 });
    const pendingPayment = pendingSubscription
      ? await Payment.findOne({
          userId: req.user._id,
          subscriptionId: pendingSubscription._id,
        })
      : null;

    return res.status(200).json({
      success: true,
      data: {
        subscription: toPublicSubscription(overview.subscription),
        plan: publicPlan(overview.plan),
        usage: Object.fromEntries(
          Object.entries(overview.usage).map(([resource, usage]) => [
            resource,
            {
              ...usage,
              limit: overview.plan.limits?.[resource] ?? null,
            },
          ])
        ),
        pendingRequest: pendingSubscription
          ? {
              subscriptionId: String(pendingSubscription._id),
              planId: String(pendingSubscription.planId),
              status: pendingSubscription.status,
              payment: pendingPayment ? toPayment(pendingPayment) : null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get current subscription error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load your subscription.",
    });
  }
};

export const requestSubscription = async (req, res) => {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((key) => key !== "planId")
  ) {
    return invalidRequest(res, "Only planId may be provided.");
  }
  if (!isValidObjectId(req.body.planId)) {
    return invalidRequest(res, "A valid planId is required.");
  }

  let createdSubscription;
  try {
    const plan = await SubscriptionPlan.findOne({
      _id: req.body.planId,
      isActive: true,
    });
    if (!plan) return invalidRequest(res, "The selected plan is unavailable.", 404);
    if (plan.slug === "free") {
      return invalidRequest(res, "Your Free plan does not require an upgrade request.");
    }
    if (!plan.priceConfigured || plan.price <= 0) {
      return res.status(409).json({
        success: false,
        code: "PLAN_PRICE_NOT_CONFIGURED",
        message: "Pricing for this plan has not been configured yet.",
      });
    }

    const { subscription: current, plan: currentPlan } =
      await getCurrentSubscription(req.user._id);
    if (currentPlan._id.equals(plan._id)) {
      return invalidRequest(res, "You are already using this plan.", 409);
    }

    const existingRequest = await UserSubscription.findOne({
      userId: req.user._id,
      status: "pending_payment",
      isCurrent: false,
    }).sort({ createdAt: -1 });
    if (existingRequest) {
      if (existingRequest.planId.equals(plan._id)) {
        const existingPayment = await Payment.findOne({
          userId: req.user._id,
          subscriptionId: existingRequest._id,
        });
        return res.status(200).json({
          success: true,
          message: "This plan request is already pending payment verification.",
          data: {
            subscription: toPublicSubscription(existingRequest),
            payment: existingPayment ? toPayment(existingPayment) : null,
            paymentRequired: true,
            paymentProviderConfigured: false,
          },
        });
      }
      return invalidRequest(
        res,
        "Cancel your existing pending plan request before choosing another.",
        409
      );
    }

    const now = new Date();
    createdSubscription = await UserSubscription.create({
      userId: req.user._id,
      planId: plan._id,
      planSnapshot: createPlanSnapshot(plan),
      status: "pending_payment",
      isCurrent: false,
      startDate: now,
      billingCycle: plan.billingCycle,
      priceAtPurchase: plan.price,
      currency: plan.currency,
      paymentProvider: "unconfigured",
      requestedAt: now,
    });
    const payment = await Payment.create({
      userId: req.user._id,
      subscriptionId: createdSubscription._id,
      amount: plan.price,
      currency: plan.currency,
      status: "pending",
      paymentMethod: "unconfigured",
      paymentProvider: "unconfigured",
    });

    return res.status(201).json({
      success: true,
      message:
        "Upgrade request recorded. No payment has been taken; wait for verified payment instructions.",
      data: {
        subscription: toPublicSubscription(createdSubscription),
        payment: toPayment(payment),
        paymentRequired: true,
        paymentProviderConfigured: false,
      },
    });
  } catch (error) {
    if (createdSubscription) {
      try {
        await UserSubscription.deleteOne({
          _id: createdSubscription._id,
          userId: req.user._id,
          status: "pending_payment",
        });
      } catch (rollbackError) {
        console.error("Subscription request rollback failed:", rollbackError.message);
      }
    }
    if (error.code === 11000) {
      return invalidRequest(
        res,
        "A plan request is already being created for this account. Retry to view it.",
        409
      );
    }
    console.error("Create subscription request error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not create the subscription request.",
    });
  }
};

export const cancelSubscription = async (req, res) => {
  const body = req.body || {};
  if (
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !["subscriptionId", "reason"].includes(key))
  ) {
    return invalidRequest(res, "Only subscriptionId and reason may be provided.");
  }
  if (
    body.subscriptionId !== undefined &&
    !isValidObjectId(body.subscriptionId)
  ) {
    return invalidRequest(res, "Invalid subscriptionId.");
  }
  if (
    body.reason !== undefined &&
    (typeof body.reason !== "string" || body.reason.length > 500)
  ) {
    return invalidRequest(res, "Reason must be 500 characters or fewer.");
  }

  try {
    if (body.subscriptionId) {
      const pending = await UserSubscription.findOne({
        _id: body.subscriptionId,
        userId: req.user._id,
        status: "pending_payment",
        isCurrent: false,
      });
      if (!pending) {
        return invalidRequest(res, "Pending subscription request not found.", 404);
      }
      pending.status = "cancelled";
      pending.cancelReason = body.reason || "";
      pending.endedAt = new Date();
      await pending.save();
      await Payment.updateOne(
        { userId: req.user._id, subscriptionId: pending._id, status: "pending" },
        { $set: { status: "cancelled" } }
      );
      return res.status(200).json({
        success: true,
        message: "Pending subscription request cancelled.",
      });
    }

    const { subscription, plan } = await getCurrentSubscription(req.user._id);
    if (plan.slug === "free") {
      return invalidRequest(res, "The Free plan cannot be cancelled.", 409);
    }
    if (subscription.status === "cancel_at_period_end") {
      return res.status(200).json({
        success: true,
        message: "Cancellation is already scheduled.",
        data: { subscription: toPublicSubscription(subscription) },
      });
    }
    if (!["active", "past_due"].includes(subscription.status)) {
      return invalidRequest(res, "This subscription cannot be cancelled.", 409);
    }

    subscription.status = "cancel_at_period_end";
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelReason = body.reason || "";
    await subscription.save();
    return res.status(200).json({
      success: true,
      message: "Subscription will remain active until its current period ends.",
      data: { subscription: toPublicSubscription(subscription) },
    });
  } catch (error) {
    console.error("Cancel subscription error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not cancel the subscription.",
    });
  }
};

export const getPaymentHistory = async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (
    Object.keys(req.query).some((key) => !["page", "limit"].includes(key)) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return invalidRequest(res, "Invalid payment history pagination.");
  }

  try {
    const filter = { userId: req.user._id };
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        payments: payments.map(toPayment),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("Get payment history error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load payment history.",
    });
  }
};

export const getPaymentDetails = async (req, res) => {
  if (!isValidObjectId(req.params.paymentId)) {
    return invalidRequest(res, "Invalid payment ID.");
  }
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      userId: req.user._id,
    }).lean();
    if (!payment) return invalidRequest(res, "Payment not found.", 404);
    return res.status(200).json({
      success: true,
      data: { payment: toPayment(payment) },
    });
  } catch (error) {
    console.error("Get payment details error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load payment details.",
    });
  }
};

const validatePlanData = (body, { isUpdate = false, slug } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Plan data must be an object." };
  }
  const allowed = new Set([...EDITABLE_PLAN_FIELDS, ...(isUpdate ? [] : ["slug"])]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    return { error: "Plan contains unsupported fields." };
  }
  if (!isUpdate && (typeof body.slug !== "string" || !/^[a-z0-9-]{2,40}$/.test(body.slug))) {
    return { error: "Plan slug must use 2-40 lowercase letters, numbers, or hyphens." };
  }
  if (!isUpdate && (typeof body.name !== "string" || !body.name.trim())) {
    return { error: "Plan name is required." };
  }
  if (
    body.name !== undefined &&
    (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80)
  ) {
    return { error: "Plan name must be 1-80 characters." };
  }
  if (
    body.description !== undefined &&
    (typeof body.description !== "string" || body.description.length > 500)
  ) {
    return { error: "Plan description must be 500 characters or fewer." };
  }
  if (
    body.billingCycle !== undefined &&
    !["monthly", "yearly"].includes(body.billingCycle)
  ) {
    return { error: "billingCycle must be monthly or yearly." };
  }
  if (
    body.price !== undefined &&
    (typeof body.price !== "number" ||
      !Number.isFinite(body.price) ||
      body.price < 0 ||
      (body.price > 0 && body.price < 1))
  ) {
    return { error: "Price must be a non-negative PKR amount." };
  }
  if (body.features !== undefined) {
    if (
      !Array.isArray(body.features) ||
      body.features.length > 30 ||
      body.features.some(
        (feature) =>
          typeof feature !== "string" ||
          !feature.trim() ||
          feature.length > 120
      )
    ) {
      return { error: "Features must be an array of up to 30 short text values." };
    }
  }
  if (body.limits !== undefined) {
    if (
      !body.limits ||
      typeof body.limits !== "object" ||
      Array.isArray(body.limits) ||
      Object.keys(body.limits).some((key) => !PLAN_LIMIT_FIELDS.has(key))
    ) {
      return { error: "Plan limits contain unsupported fields." };
    }
    for (const [key, value] of Object.entries(body.limits)) {
      if (
        value !== null &&
        (!Number.isSafeInteger(value) || value < 0)
      ) {
        return { error: `${key} limit must be a non-negative whole number or null.` };
      }
    }
  }
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    return { error: "isActive must be true or false." };
  }
  if (slug === "free" && body.isActive === false) {
    return { error: "The Free plan must remain active." };
  }
  if (slug === "free" && body.price !== undefined && body.price !== 0) {
    return { error: "The Free plan must remain priced at zero PKR." };
  }

  const updates = { ...body };
  if (Object.hasOwn(body, "price")) {
    updates.priceConfigured = slug === "free" || body.price > 0;
  }
  updates.currency = "PKR";
  return { updates };
};

export const createSubscriptionPlan = async (req, res) => {
  const { reason, ...planData } = req.body || {};
  if (!validReason(reason)) {
    return invalidRequest(res, "A reason of 5-500 characters is required.");
  }
  const validated = validatePlanData(planData);
  if (validated.error) return invalidRequest(res, validated.error);
  try {
    const plan = await SubscriptionPlan.create({
      ...validated.updates,
      features: validated.updates.features || [],
      limits: validated.updates.limits || {
        products: null,
        customers: null,
        ordersPerMonth: null,
      },
      isActive: validated.updates.isActive ?? true,
    });
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: "plan_created",
      targetType: "plan",
      targetId: plan._id,
      reason: reason.trim(),
      metadata: { slug: plan.slug },
    });
    return res.status(201).json({ success: true, data: { plan } });
  } catch (error) {
    if (error.code === 11000) {
      return invalidRequest(res, "A plan with this slug already exists.", 409);
    }
    if (error.name === "ValidationError") {
      return invalidRequest(res, error.message);
    }
    console.error("Create subscription plan error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not create the subscription plan.",
    });
  }
};

export const updateSubscriptionPlan = async (req, res) => {
  if (!isValidObjectId(req.params.planId)) {
    return invalidRequest(res, "Invalid plan ID.");
  }
  const { reason, ...planData } = req.body || {};
  if (!validReason(reason)) {
    return invalidRequest(res, "A reason of 5-500 characters is required.");
  }
  try {
    const plan = await SubscriptionPlan.findById(req.params.planId);
    if (!plan) return invalidRequest(res, "Plan not found.", 404);
    const validated = validatePlanData(planData, {
      isUpdate: true,
      slug: plan.slug,
    });
    if (validated.error) return invalidRequest(res, validated.error);
    await snapshotSubscriptionsBeforePlanEdit(plan);
    const wasActive = plan.isActive;
    Object.assign(plan, validated.updates);
    await plan.save();
    const action = wasActive === plan.isActive
      ? "plan_updated"
      : plan.isActive
        ? "plan_activated"
        : "plan_deactivated";
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action,
      targetType: "plan",
      targetId: plan._id,
      reason: reason.trim(),
      metadata: { slug: plan.slug, changedFields: Object.keys(validated.updates) },
    });
    return res.status(200).json({ success: true, data: { plan } });
  } catch (error) {
    if (error.name === "ValidationError") {
      return invalidRequest(res, error.message);
    }
    console.error("Update subscription plan error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update the subscription plan.",
    });
  }
};

export const listAllSubscriptions = async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const status = req.query.status;
  const allowedStatuses = new Set([
    "pending_payment",
    "active",
    "cancel_at_period_end",
    "past_due",
    "failed",
    "cancelled",
    "expired",
  ]);
  if (
    Object.keys(req.query).some((key) => !["page", "limit", "status"].includes(key)) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (status !== undefined && !allowedStatuses.has(status))
  ) {
    return invalidRequest(res, "Invalid subscription list filter.");
  }

  try {
    const filter = status ? { status } : {};
    const [subscriptions, total] = await Promise.all([
      UserSubscription.find(filter)
        .populate("userId", "fullName email businessName")
        .populate("planId", "name slug price currency billingCycle")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserSubscription.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        subscriptions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List subscriptions error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load subscriptions.",
    });
  }
};

export const updateSubscriptionStatus = async (req, res) => {
  if (!isValidObjectId(req.params.subscriptionId)) {
    return invalidRequest(res, "Invalid subscription ID.");
  }
  const { status, reason = "" } = req.body || {};
  if (
    Object.keys(req.body || {}).some((key) => !["status", "reason"].includes(key)) ||
    !["cancelled", "expired", "past_due", "failed"].includes(status) ||
    !validReason(reason)
  ) {
    return invalidRequest(res, "Provide a supported status and optional reason.");
  }

  try {
    const subscription = await UserSubscription.findById(req.params.subscriptionId);
    if (!subscription) return invalidRequest(res, "Subscription not found.", 404);
    if (status === "past_due" && !subscription.isCurrent) {
      return invalidRequest(res, "Only a current subscription can be marked past due.", 409);
    }

    subscription.status = status;
    subscription.cancelReason = reason;
    subscription.adminNote = reason;
    if (status !== "past_due") {
      subscription.isCurrent = false;
      subscription.cancelAtPeriodEnd = false;
      subscription.endedAt = new Date();
    }
    await subscription.save();

    if (["cancelled", "failed", "expired"].includes(subscription.status)) {
      await Payment.updateOne(
        {
          subscriptionId: subscription._id,
          status: "pending",
        },
        {
          $set: {
            status: subscription.status === "failed" ? "failed" : "cancelled",
            failureReason: reason,
          },
        }
      );
    }
    if (subscription.userId && status !== "past_due") {
      await ensureFreeSubscription(subscription.userId);
    }
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: "subscription_status_changed",
      targetType: "subscription",
      targetId: subscription._id,
      reason: reason.trim(),
      metadata: { status, userId: String(subscription.userId) },
    });
    return res.status(200).json({
      success: true,
      data: { subscription },
    });
  } catch (error) {
    console.error("Admin subscription status update error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update subscription status.",
    });
  }
};

const activateVerifiedSubscription = async (payment, now) => {
  const subscription = await UserSubscription.findOne({
    _id: payment.subscriptionId,
    userId: payment.userId,
  });
  if (!subscription) throw new Error("The subscription request no longer exists");
  if (
    subscription.isCurrent &&
    ["active", "cancel_at_period_end"].includes(subscription.status)
  ) {
    return subscription;
  }
  if (subscription.status !== "pending_payment") {
    throw new Error("The subscription request is no longer pending");
  }

  const endDate = addBillingCycle(now, subscription.billingCycle);
  await UserSubscription.updateOne(
    { userId: payment.userId, isCurrent: true },
    {
      $set: {
        isCurrent: false,
        status: "expired",
        cancelAtPeriodEnd: false,
        endedAt: now,
      },
    }
  );
  const activated = await UserSubscription.findOneAndUpdate(
    {
      _id: subscription._id,
      userId: payment.userId,
      status: "pending_payment",
      isCurrent: false,
    },
    {
      $set: {
        status: "active",
        isCurrent: true,
        startDate: now,
        endDate,
        nextBillingDate: endDate,
        activatedAt: now,
        paymentProvider: "manual",
      },
    },
    { new: true, runValidators: true }
  );
  if (!activated) throw new Error("Subscription activation could not be completed");
  return activated;
};

export const verifyManualPayment = async (req, res) => {
  if (!isValidObjectId(req.params.paymentId)) {
    return invalidRequest(res, "Invalid payment ID.");
  }
  const { transactionReference, paymentMethod, reason } = req.body || {};
  if (
    Object.keys(req.body || {}).some(
      (key) => !["transactionReference", "paymentMethod", "reason"].includes(key)
    ) ||
    typeof transactionReference !== "string" ||
    !transactionReference.trim() ||
    transactionReference.trim().length > 160 ||
    !ADMIN_PAYMENT_METHODS.has(paymentMethod) ||
    !validReason(reason)
  ) {
    return invalidRequest(
      res,
      "A transaction reference and verified manual payment method are required."
    );
  }

  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return invalidRequest(res, "Payment not found.", 404);
    const subscriptionRequest = await UserSubscription.findOne({
      _id: payment.subscriptionId,
      userId: payment.userId,
    });
    if (!subscriptionRequest) {
      return invalidRequest(res, "The subscription request is no longer eligible for activation.", 409);
    }
    const alreadyCurrent =
      subscriptionRequest.isCurrent &&
      ["active", "cancel_at_period_end"].includes(subscriptionRequest.status);
    if (payment.status === "paid" && alreadyCurrent) {
      return res.status(200).json({
        success: true,
        message: "This payment was already verified and processed.",
        data: {
          payment: toPayment(payment),
          subscription: subscriptionRequest,
        },
      });
    }
    if (subscriptionRequest.status !== "pending_payment") {
      return invalidRequest(res, "The subscription request is no longer eligible for activation.", 409);
    }
    const normalizedReference = transactionReference.trim();
    if (
      payment.status === "paid" &&
      (payment.transactionReference !== normalizedReference ||
        payment.paymentMethod !== paymentMethod)
    ) {
      return invalidRequest(res, "This payment was already verified with different details.", 409);
    }
    if (payment.status !== "paid") {
      if (payment.status !== "pending") {
        return invalidRequest(res, "This payment cannot be verified.", 409);
      }
      const duplicateReference = await Payment.findOne({
        transactionReference: normalizedReference,
        _id: { $ne: payment._id },
      });
      if (duplicateReference) {
        return invalidRequest(res, "This transaction reference is already recorded.", 409);
      }
      await writeSuperAdminAudit({
        actorId: req.user._id,
        action: "payment_verification_attempted",
        targetType: "payment",
        targetId: payment._id,
        reason: reason.trim(),
        metadata: {
          amount: payment.amount,
          method: paymentMethod,
          transactionReference: normalizedReference,
        },
      });
      payment.status = "paid";
      payment.paymentMethod = paymentMethod;
      payment.paymentProvider = "manual";
      payment.transactionReference = normalizedReference;
      payment.paidAt = new Date();
      payment.verifiedAt = payment.paidAt;
      payment.verifiedBy = req.user._id;
      await payment.save();
    }

    const subscription = await activateVerifiedSubscription(payment, new Date());
    await writeSuperAdminAudit({
      actorId: req.user._id,
      action: "payment_verified",
      targetType: "payment",
      targetId: payment._id,
      reason: reason.trim(),
      metadata: {
        verification: true,
        amount: payment.amount,
        method: paymentMethod,
        transactionReference: normalizedReference,
      },
    });
    return res.status(200).json({
      success: true,
      message:
        "Payment is verified and the subscription is active. No automatic renewal is configured.",
      data: { payment: toPayment(payment), subscription },
    });
  } catch (error) {
    if (error.code === 11000) {
      return invalidRequest(res, "This transaction reference is already recorded.", 409);
    }
    console.error("Manual payment verification/activation error:", error.message);
    return res.status(500).json({
      success: false,
      message:
        "Payment verification was recorded, but subscription activation could not be completed. Retry the same verification details or contact support.",
    });
  }
};
