import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadRateLimiter from "../middleware/uploadRateLimiter.js";
import { uploadProductImage } from "../controllers/uploadController.js";
import { hasSupportedImageSignature } from "../utils/imageFileValidation.js";

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

function validateImageContent(req, res, next) {
  if (!req.file) return next();
  if (!hasSupportedImageSignature(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: "Only valid JPEG, PNG, and WebP images are allowed.",
    });
  }
  return next();
}

export function createUploadRouter({ rateLimiter = uploadRateLimiter } = {}) {
  const router = express.Router();

  router.post(
    "/product-image",
    authMiddleware,
    rateLimiter,
    upload.single("image"),
    validateImageContent,
    uploadProductImage
  );

  router.use((error, _req, res, next) => {
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

    if (error?.code === "UNSUPPORTED_IMAGE_TYPE") {
      return res.status(400).json({
        success: false,
        message: "Only JPEG, PNG, and WebP images are allowed.",
      });
    }

    console.error("Product image request failed:", error?.name || "Error");
    return res.status(500).json({
      success: false,
      message: "Image upload failed. Please try again.",
    });
  });

  return router;
}

const router = createUploadRouter();

export default router;