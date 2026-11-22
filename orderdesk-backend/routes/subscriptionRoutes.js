import express from "express";
import {
  cancelSubscription,
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getCurrentSubscriptionDetails,
  getPaymentDetails,
  getPaymentHistory,
  getSubscriptionPlans,
  listAllSubscriptions,
  requestSubscription,
  updateSubscriptionPlan,
  updateSubscriptionStatus,
  verifyManualPayment,
} from "../controllers/subscriptionController.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/plans", getSubscriptionPlans);
router.get("/current", getCurrentSubscriptionDetails);
router.post("/requests", requestSubscription);
router.post("/cancel", cancelSubscription);
router.get("/payments", getPaymentHistory);
router.get("/payments/:paymentId", getPaymentDetails);

router.use("/admin", adminMiddleware);
router.get("/admin/plans", getAllSubscriptionPlans);
router.post("/admin/plans", createSubscriptionPlan);
router.patch("/admin/plans/:planId", updateSubscriptionPlan);
router.get("/admin/subscriptions", listAllSubscriptions);
router.patch(
  "/admin/subscriptions/:subscriptionId/status",
  updateSubscriptionStatus
);
router.post("/admin/payments/:paymentId/verify", verifyManualPayment);

export default router;
