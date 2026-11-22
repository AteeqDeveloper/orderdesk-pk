import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import usageLimitMiddleware from "../middleware/usageLimitMiddleware.js";

import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
} from "../controllers/orderController.js";

const router = express.Router();

// Every order endpoint requires a valid JWT
router.use(authMiddleware);

router.post("/", usageLimitMiddleware("ordersPerMonth"), createOrder);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.patch("/:id", updateOrder);

export default router;