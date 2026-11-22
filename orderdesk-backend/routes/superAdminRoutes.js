import express from "express";
import {
  assignSuperAdminPlan,
  changeSuperAdminSubscriptionStatus,
  getSuperAdminAnalytics,
  getSuperAdminOverview,
  getSuperAdminSettings,
  getSuperAdminUser,
  listSuperAdminAuditLogs,
  listSuperAdminPayments,
  listSuperAdminSubscriptions,
  listSuperAdminUsers,
  setSuperAdminUserStatus,
} from "../controllers/superAdminController.js";
import {
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  updateSubscriptionPlan,
} from "../controllers/subscriptionController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import superAdminMiddleware from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.use(authMiddleware, superAdminMiddleware);

router.get("/overview", getSuperAdminOverview);
router.get("/users", listSuperAdminUsers);
router.get("/users/:userId", getSuperAdminUser);
router.patch("/users/:userId/status", setSuperAdminUserStatus);
router.patch("/users/:userId/plan", assignSuperAdminPlan);
router.get("/plans", getAllSubscriptionPlans);
router.post("/plans", createSubscriptionPlan);
router.patch("/plans/:planId", updateSubscriptionPlan);
router.get("/subscriptions", listSuperAdminSubscriptions);
router.patch(
  "/subscriptions/:subscriptionId/status",
  changeSuperAdminSubscriptionStatus
);
router.get("/payments", listSuperAdminPayments);
router.get("/analytics", getSuperAdminAnalytics);
router.get("/activity", listSuperAdminAuditLogs);
router.get("/settings", getSuperAdminSettings);

export default router;
