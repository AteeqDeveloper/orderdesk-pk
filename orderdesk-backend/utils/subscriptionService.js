import { DEFAULT_SUBSCRIPTION_PLANS } from "../config/subscriptionPlans.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import UserSubscription from "../models/UserSubscription.js";

export function createPlanSnapshot(plan) {
  const source = typeof plan.toObject === "function" ? plan.toObject() : plan;
  return {
    name: source.name,
    slug: source.slug,
    description: source.description || "",
    price: source.price,
    priceConfigured: Boolean(source.priceConfigured),
    currency: source.currency || "PKR",
    billingCycle: source.billingCycle,
    features: [...(source.features || [])],
    limits: {
      products: source.limits?.products ?? null,
      customers: source.limits?.customers ?? null,
      ordersPerMonth: source.limits?.ordersPerMonth ?? null,
    },
  };
}

export async function snapshotSubscriptionsBeforePlanEdit(plan) {
  const planSnapshot = createPlanSnapshot(plan);
  await UserSubscription.updateMany(
    {
      planId: plan._id,
      planSnapshot: { $exists: false },
      $or: [{ isCurrent: true }, { status: "pending_payment" }],
    },
    { $set: { planSnapshot } }
  );
}

export async function ensureDefaultSubscriptionPlans() {
  for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
    await SubscriptionPlan.updateOne(
      { slug: plan.slug },
      { $setOnInsert: plan },
      { upsert: true }
    );
  }
}

export async function ensureFreeSubscription(userId, now = new Date()) {
  const current = await UserSubscription.findOne({ userId, isCurrent: true });
  if (current) return current;

  const freePlan = await SubscriptionPlan.findOne({ slug: "free" });
  if (!freePlan || !freePlan.isActive) {
    throw new Error("The active Free subscription plan is not configured");
  }

  try {
    return await UserSubscription.create({
      userId,
      planId: freePlan._id,
      status: "active",
      isCurrent: true,
      startDate: now,
      billingCycle: freePlan.billingCycle,
      priceAtPurchase: 0,
      currency: "PKR",
      paymentProvider: "unconfigured",
      activatedAt: now,
      planSnapshot: createPlanSnapshot(freePlan),
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrentlyCreated = await UserSubscription.findOne({
      userId,
      isCurrent: true,
    });
    if (concurrentlyCreated) return concurrentlyCreated;
    throw error;
  }
}

export async function getCurrentSubscription(userId, now = new Date()) {
  let subscription = await UserSubscription.findOne({
    userId,
    isCurrent: true,
  }).sort({ createdAt: -1 });

  if (subscription?.endDate && subscription.endDate <= now) {
    await UserSubscription.updateOne(
      { _id: subscription._id, userId, isCurrent: true },
      {
        $set: {
          status: "expired",
          isCurrent: false,
          cancelAtPeriodEnd: false,
          endedAt: now,
        },
      }
    );
    subscription = null;
  }

  if (!subscription) {
    subscription = await ensureFreeSubscription(userId, now);
  }
  const storedPlan = await SubscriptionPlan.findById(subscription.planId);
  if (!storedPlan) throw new Error("The current subscription plan no longer exists");
  const plan = subscription.planSnapshot
    ? {
        ...storedPlan.toObject(),
        ...subscription.planSnapshot.toObject(),
        _id: storedPlan._id,
        isActive: storedPlan.isActive,
      }
    : storedPlan;
  return { subscription, plan };
}

export async function expireSubscriptions(now = new Date()) {
  const expiring = await UserSubscription.find({
    isCurrent: true,
    endDate: { $lte: now },
  })
    .select("_id userId")
    .lean();

  for (const subscription of expiring) {
    const result = await UserSubscription.updateOne(
      { _id: subscription._id, isCurrent: true },
      {
        $set: {
          status: "expired",
          isCurrent: false,
          cancelAtPeriodEnd: false,
          endedAt: now,
        },
      }
    );
    if (result.modifiedCount) {
      await ensureFreeSubscription(subscription.userId, now);
    }
  }
  return expiring.length;
}

export function addBillingCycle(start, billingCycle) {
  const result = new Date(start);
  if (billingCycle === "yearly") {
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCFullYear(result.getUTCFullYear() + 1);
    const lastDay = new Date(
      Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
    ).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
  }

  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function getMonthlyUsagePeriod(subscription, now = new Date()) {
  const anchor = subscription?.startDate
    ? new Date(subscription.startDate)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (Number.isNaN(anchor.getTime()) || anchor > now) {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }

  let monthOffset =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    anchor.getUTCMonth();
  let start = addBillingCycleByMonths(anchor, monthOffset);
  if (start > now) {
    monthOffset -= 1;
    start = addBillingCycleByMonths(anchor, monthOffset);
  }
  return {
    start,
    end: addBillingCycleByMonths(anchor, monthOffset + 1),
  };
}

function addBillingCycleByMonths(anchor, monthOffset) {
  const result = new Date(anchor);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + monthOffset);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function getUsageCounts(userId, subscription, now = new Date()) {
  const period = getMonthlyUsagePeriod(subscription, now);
  const [products, customers, orders] = await Promise.all([
    getUsageCount(userId, "products", subscription, now),
    getUsageCount(userId, "customers", subscription, now),
    getUsageCount(userId, "ordersPerMonth", subscription, now),
  ]);
  return {
    products: { current: products, period: null },
    customers: { current: customers, period: null },
    ordersPerMonth: {
      current: orders,
      period: { start: period.start, end: period.end },
    },
  };
}

export async function getUsageCount(userId, resource, subscription, now = new Date()) {
  if (resource === "products") return Product.countDocuments({ userId });
  if (resource === "customers") return Customer.countDocuments({ userId });
  const period = getMonthlyUsagePeriod(subscription, now);
  return Order.countDocuments({
    userId,
    $or: [
      { quotaCreatedAt: { $gte: period.start, $lt: period.end } },
      {
        quotaCreatedAt: { $exists: false },
        createdAt: { $gte: period.start, $lt: period.end },
      },
    ],
  });
}

export async function getUsageLimitViolation(
  userId,
  resource,
  plan,
  subscription,
  additionalRecords = 1,
  now = new Date()
) {
  if (!Number.isSafeInteger(additionalRecords) || additionalRecords < 0) {
    throw new Error("Requested usage must be a non-negative whole number");
  }
  if (additionalRecords === 0) return null;

  const limit = plan.limits?.[resource];
  if (limit === null || limit === undefined) return null;

  const currentUsage = await getUsageCount(userId, resource, subscription, now);
  if (currentUsage + additionalRecords <= limit) return null;

  return {
    resource,
    limit,
    currentUsage,
    requested: additionalRecords,
    plan: { name: plan.name, slug: plan.slug },
    upgradePath: "/dashboard/pricing",
  };
}

export async function getSubscriptionOverview(userId, now = new Date()) {
  const { subscription, plan } = await getCurrentSubscription(userId, now);
  const usage = await getUsageCounts(userId, subscription, now);
  return { subscription, plan, usage };
}
