import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getActivityLogById,
  getActivityLogs,
} from "../controllers/activityLogController.js";

const router = express.Router();

router.use(authMiddleware);
router.get("/", getActivityLogs);
router.get("/:id", getActivityLogById);

export default router;
