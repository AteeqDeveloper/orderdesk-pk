import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import usageLimitMiddleware from "../middleware/usageLimitMiddleware.js";

import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

// All customer endpoints require authentication
router.use(authMiddleware);

router.post("/", usageLimitMiddleware("customers"), createCustomer);
router.get("/", getCustomers);
router.get("/:id", getCustomerById);
router.patch("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;