import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getInventory,
  getLowStockProducts,
  adjustStock,
  getInventorySummary,
} from "../controllers/inventoryController.js";

const router = express.Router();

// All inventory endpoints require login.
router.use(authMiddleware);

// Specific routes must come before /:id routes.
router.get("/summary", getInventorySummary);
router.get("/low-stock", getLowStockProducts);
router.get("/", getInventory);
router.patch("/:id/adjust", adjustStock);

export default router;