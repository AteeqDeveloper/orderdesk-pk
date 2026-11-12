import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getVariants,
  getVariantById,
  addVariant,
  updateVariant,
  deleteVariant,
} from "../controllers/productController.js";

const router = express.Router();

// All product routes require authentication
router.use(authMiddleware);

// Base product routes
router.post("/", createProduct);
router.get("/", getProducts);
router.get("/:id", getProductById);
router.patch("/:id", updateProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

// Variant routes for a product
router.post("/:id/variants", addVariant);
router.get("/:id/variants", getVariants);
router.get("/:id/variants/:variantId", getVariantById);
router.patch("/:id/variants/:variantId", updateVariant);
router.put("/:id/variants/:variantId", updateVariant);
router.delete("/:id/variants/:variantId", deleteVariant);

export default router;
