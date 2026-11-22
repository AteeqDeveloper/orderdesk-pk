import Order from "../models/Order.js";
import {
  getCurrentSubscription,
  getUsageLimitViolation,
} from "../utils/subscriptionService.js";
import { acquireUsageLocks } from "../utils/usageLock.js";

const RESOURCE_LABELS = {
  products: "product",
  customers: "customer",
  ordersPerMonth: "monthly order",
};

const usageLimitMiddleware = (resource) => async (req, res, next) => {
  if (!Object.prototype.hasOwnProperty.call(RESOURCE_LABELS, resource)) {
    throw new Error(`Unknown subscription usage resource: ${resource}`);
  }
  let releaseLock;
  try {
    const { subscription, plan } = await getCurrentSubscription(req.user._id);
    const limit = plan.limits?.[resource];
    if (limit === null || limit === undefined) {
      req.subscription = subscription;
      req.subscriptionPlan = plan;
      return next();
    }

    if (resource === "ordersPerMonth") {
      const idempotencyKey =
        req.get?.("Idempotency-Key") || req.headers?.["idempotency-key"];
      if (
        typeof idempotencyKey === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          idempotencyKey
        ) &&
        (await Order.exists({ userId: req.user._id, idempotencyKey }))
      ) {
        return next();
      }
    }

    try {
      releaseLock = await acquireUsageLocks(req.user._id, [resource]);
    } catch (error) {
      if (error.code !== "USAGE_CHECK_BUSY") throw error;
      res.set("Retry-After", "1");
      return res.status(429).json({
        success: false,
        code: "USAGE_CHECK_BUSY",
        message: "Another record is being created. Please retry shortly.",
      });
    }

    let lockReleased = false;
    const release = () => {
      if (lockReleased) return;
      lockReleased = true;
      releaseLock().catch((error) => {
        console.error("Subscription usage lock release failed:", error.message);
      });
    };
    res.once("finish", release);
    res.once("close", release);

    const violation = await getUsageLimitViolation(
      req.user._id,
      resource,
      plan,
      subscription
    );
    if (violation) {
      release();
      return res.status(403).json({
        success: false,
        code: "PLAN_LIMIT_REACHED",
        message: `Your ${plan.name} plan allows ${limit} ${RESOURCE_LABELS[resource]} records. Upgrade your plan to continue.`,
        data: violation,
      });
    }

    req.subscription = subscription;
    req.subscriptionPlan = plan;
    return next();
  } catch (error) {
    if (releaseLock) {
      try {
        await releaseLock();
      } catch (releaseError) {
        console.error(
          "Subscription usage lock release failed:",
          releaseError.message
        );
      }
    }
    console.error("Subscription usage check failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not verify subscription usage.",
    });
  }
};

export default usageLimitMiddleware;
