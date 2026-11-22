import express from "express";

import {
    registerUser,
    loginUser,
    getMe,
    superAdminLogin,
    superAdminLogout,
} from "../controllers/authcontroller.js";

import authMiddleware from "../middleware/authMiddleware.js";
import superAdminMiddleware from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/super-admin/login", superAdminLogin);
router.post(
    "/super-admin/logout",
    authMiddleware,
    superAdminMiddleware,
    superAdminLogout
);

// Protected route
router.get("/me", authMiddleware, getMe);

export default router;