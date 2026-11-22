import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import {
  createCorsOptions,
  createCorsOriginGuard,
  getTrustedFrontendOrigins,
} from "./config/corsConfig.js";
import connectDB from "./config/db.js";
import LoginRateLimit from "./models/LoginRateLimit.js";
import { parseTrustedProxyHops, validateJwtSecret } from "./config/securityConfig.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import dataManagementRoutes from "./routes/dataManagementRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import { initializeAuthSecurity } from "./controllers/authcontroller.js";
import {
  ensureDefaultSubscriptionPlans,
  expireSubscriptions,
} from "./utils/subscriptionService.js";

//initialize express app
const app = express();
let startupConfigurationError;
let trustedFrontendOrigins = [];
let trustedProxyHops = 0;
try {
  trustedFrontendOrigins = getTrustedFrontendOrigins();
} catch (error) {
  startupConfigurationError = error;
}
try {
  trustedProxyHops = parseTrustedProxyHops(process.env.TRUST_PROXY_HOPS);
} catch (error) {
  startupConfigurationError ||= error;
}
app.set("trust proxy", trustedProxyHops);


// Middleware
app.use(createCorsOriginGuard(trustedFrontendOrigins));
app.use(cors(createCorsOptions(trustedFrontendOrigins)));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/data-management", dataManagementRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/super-admin", superAdminRoutes);


// Root route
app.get("/", (req, res) => {
  res.json({
    message: "OrderDesk PK API is running",
  });
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Request middleware failed:", error?.name || "UnknownError");
  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

const PORT = process.env.PORT || 5000;
const cloudinaryEnvVariables = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const startServer = async () => {
  try {
    validateJwtSecret(process.env.JWT_SECRET);
    if (startupConfigurationError) throw startupConfigurationError;
    await initializeAuthSecurity();

    const missingCloudinaryVariables = cloudinaryEnvVariables.filter((name) => {
      const val = process.env[name]?.trim();
      return (
        !val ||
        val === "your_cloud_name" ||
        val === "your_api_key" ||
        val === "your_api_secret"
      );
    });

    if (missingCloudinaryVariables.length > 0) {
      console.warn(
        `[Warning] Cloudinary credentials not configured (${missingCloudinaryVariables.join(
          ", "
        )}). Image upload endpoints will return 503 until configured in .env.`
      );
    }

    await connectDB();
    await LoginRateLimit.init();
    await ensureDefaultSubscriptionPlans();
    await expireSubscriptions();

    const subscriptionLifecycleTimer = setInterval(() => {
      expireSubscriptions().catch((error) => {
        console.error("Subscription expiration check failed:", error.message);
      });
    }, 5 * 60 * 1000);
    subscriptionLifecycleTimer.unref();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    const message = /^(JWT_SECRET|FRONTEND_ORIGINS|TRUST_PROXY_HOPS)/.test(
      error.message || ""
    )
      ? error.message
      : "Startup failed. Check backend configuration; sensitive details were omitted.";
    console.error("Failed to start server:", message);
    process.exit(1);
  }
};

startServer();