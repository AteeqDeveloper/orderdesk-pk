import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

//initialize express app
const app = express();


// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/uploads", uploadRoutes);


// Root route
app.get("/", (req, res) => {
  res.json({
    message: "OrderDesk PK API is running",
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

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();