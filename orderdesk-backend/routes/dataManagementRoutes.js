import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  exportData,
  generateBackup,
  restoreBackup,
  validateBackup,
} from "../controllers/dataManagementController.js";

const router = express.Router();
const MAX_BACKUP_SIZE = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BACKUP_SIZE },
  fileFilter: (req, file, callback) => {
    if (!["application/json", "application/octet-stream"].includes(file.mimetype)) {
      const error = new Error("Upload a JSON backup file.");
      error.code = "INVALID_BACKUP_TYPE";
      return callback(error);
    }
    callback(null, true);
  },
});

const requireBackupFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Select a JSON backup file.",
    });
  }
  next();
};

router.use(authMiddleware);
router.get("/exports/:type", exportData);
router.get("/backup", generateBackup);
router.post("/backup/validate", upload.single("backup"), requireBackupFile, validateBackup);
router.post("/backup/restore", upload.single("backup"), requireBackupFile, restoreBackup);

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Backup files must be 10 MB or smaller."
          : "The uploaded backup could not be processed.",
    });
  }
  if (error.code === "INVALID_BACKUP_TYPE") {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error("Data management request failed:", error.message);
  return res.status(500).json({
    success: false,
    message: "The data management request failed.",
  });
});

export default router;
