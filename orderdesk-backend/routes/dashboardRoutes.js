import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getDashboardStats } from "../controllers/dashboardController.js";
import {
  getAnalyticsOverview,
  getCustomerAnalytics,
  getInventoryAnalytics,
  getOrderAnalytics,
  getSalesAnalytics,
  getTopSellingProducts,
} from "../controllers/analyticsController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getDashboardStats);
router.get("/analytics", getAnalyticsOverview);
router.get("/reports/sales", getSalesAnalytics);
router.get("/reports/orders", getOrderAnalytics);
router.get("/reports/products/top-selling", getTopSellingProducts);
router.get("/reports/customers", getCustomerAnalytics);
router.get("/reports/inventory", getInventoryAnalytics);

export default router;