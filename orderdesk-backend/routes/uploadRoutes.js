import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadProductImage } from "../controllers/uploadController.js";

const router = express.Router();
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error("Only JPG, PNG, and WebP images are allowed.");
      error.code = "UNSUPPORTED_IMAGE_TYPE";
      return callback(error);
    }

    callback(null, true);
  },
});

router.post(
  "/product-image",
  authMiddleware,
  upload.single("image"),
  uploadProductImage
);

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      message: tooLarge
        ? "Image must be 5 MB or smaller."
        : "The uploaded image could not be processed.",
    });
  }

  if (error.code === "UNSUPPORTED_IMAGE_TYPE") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Product image request failed:", error.message);
  return res.status(500).json({
    success: false,
    message: "Image upload failed. Please try again.",
  });
});

export default router;