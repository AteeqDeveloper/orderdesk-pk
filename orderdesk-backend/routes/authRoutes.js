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
import {
    accountLoginLimiter,
    ipLoginLimiter,
} from "../middleware/loginRateLimiter.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", ipLoginLimiter, accountLoginLimiter, loginUser);
router.post(
    "/super-admin/login",
    ipLoginLimiter,
    accountLoginLimiter,
    superAdminLogin
);
router.post(
    "/super-admin/logout",
    authMiddleware,
    superAdminMiddleware,
    superAdminLogout
);

// Protected route
router.get("/me", authMiddleware, getMe);

export default router;