import mongoose from "mongoose";
import dns from "node:dns";
import { validateMongoUri } from "./securityConfig.js";

const connectDB = async () => {
  const uri = validateMongoUri(process.env.MONGO_URI);
  const options = {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(uri, options);
    console.log("MongoDB connected successfully");
  } catch (error) {
    if (
      uri.startsWith("mongodb+srv://") &&
      typeof error.message === "string" &&
      /querySrv (?:ECONNREFUSED|ETIMEOUT)/i.test(error.message)
    ) {
      console.warn(
        "Local DNS failed SRV query. Retrying with public DNS servers (8.8.8.8, 1.1.1.1)..."
      );
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
      await mongoose.connect(uri, options);
      console.log("MongoDB connected successfully (via fallback DNS)");
      return;
    }
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;