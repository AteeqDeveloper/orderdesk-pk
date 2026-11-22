import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { JWT_ALGORITHM } from "../config/securityConfig.js";
import { ensureFreeSubscription } from "../utils/subscriptionService.js";
import { writeSuperAdminAudit } from "../utils/superAdminAudit.js";

let dummyPasswordHash;

const getDummyPasswordHash = () => {
    if (!dummyPasswordHash) {
        dummyPasswordHash = bcrypt.hash(randomBytes(32).toString("base64url"), 12);
    }
    return dummyPasswordHash;
};

const compareLoginPassword = async (password, passwordHash) => {
    if (passwordHash) return bcrypt.compare(password, passwordHash);
    return bcrypt.compare(password, await getDummyPasswordHash());
};

export const initializeAuthSecurity = async () => {
    await getDummyPasswordHash();
};

const hasValidLoginInput = (email, password) =>
    typeof email === "string" &&
    email.trim().length > 0 &&
    email.length <= 254 &&
    typeof password === "string" &&
    password.length > 0 &&
    password.length <= 1024;

const invalidCredentials = (res) =>
    res.status(401).json({
        success: false,
        message: "Invalid email or password.",
    });

const signToken = (user) =>
    jwt.sign(
        {
            userId: user._id.toString(),
            authVersion: user.authVersion || 0,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d", algorithm: JWT_ALGORITHM }
    );

const publicAuthUser = (user) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    businessName: user.businessName,
    role: user.role,
});

export const registerUser = async (req, res) => {
    try {
        const {
            fullName,
            email,
            password,
            businessName,
            phone,
        } = req.body;

        // Validate required fields
        if (
            typeof fullName !== "string" ||
            !fullName.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Full name, email and password are required",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters",
            });
        }

        // Check whether the email already exists
        const existingUser = await User.findOne({
            email: email.trim().toLowerCase(),
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            fullName,
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            businessName,
            phone,
        });

        try {
            await ensureFreeSubscription(user._id);
        } catch (subscriptionError) {
            console.error(
                "Free subscription assignment failed:",
                subscriptionError.message
            );
            await User.deleteOne({ _id: user._id });
            return res.status(503).json({
                success: false,
                message: "Account setup could not be completed. Please try again.",
            });
        }

        return res.status(201).json({
            success: true,
            message: "Account registered successfully",
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                businessName: user.businessName,
                phone: user.phone,
                role: user.role,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        // Validate input
        if (!hasValidLoginInput(email, password)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sign-in request.",
            });
        }

        // Find user and explicitly include password
        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+password");

        const isPasswordValid = await compareLoginPassword(
            password,
            user?.password
        );

        if (
            !user ||
            !isPasswordValid ||
            user.role === "super_admin" ||
            user.status === "suspended"
        ) {
            return invalidCredentials(res);
        }

        await ensureFreeSubscription(user._id);

        const token = signToken(user);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: publicAuthUser(user),
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const superAdminLogin = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!hasValidLoginInput(email, password)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sign-in request.",
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+password");
        const isPasswordValid = await compareLoginPassword(
            password,
            user?.password
        );
        if (
            !user ||
            user.role !== "super_admin" ||
            !isPasswordValid ||
            user.status === "suspended"
        ) {
            return invalidCredentials(res);
        }

        await writeSuperAdminAudit({
            actorId: user._id,
            action: "super_admin_login",
            targetType: "session",
            targetId: user._id,
        });
        return res.status(200).json({
            success: true,
            message: "Super Admin sign-in successful.",
            token: signToken(user),
            user: publicAuthUser(user),
        });
    } catch (error) {
        console.error("Super Admin login error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Super Admin sign-in could not be completed.",
        });
    }
};

export const superAdminLogout = async (req, res) => {
    try {
        await writeSuperAdminAudit({
            actorId: req.user._id,
            action: "super_admin_logout",
            targetType: "session",
            targetId: req.user._id,
        });
        await User.updateOne(
            { _id: req.user._id, role: "super_admin" },
            { $inc: { authVersion: 1 } }
        );
        return res.status(200).json({
            success: true,
            message: "Super Admin signed out.",
        });
    } catch (error) {
        console.error("Super Admin logout error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Super Admin sign-out could not be completed.",
        });
    }
};
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        businessName: req.user.businessName,
        phone: req.user.phone,
        role: req.user.role,
        status: req.user.status || "active",
      },
    });
  } catch (error) {
    console.error("Get current user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};