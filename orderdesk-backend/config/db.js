import mongoose from "mongoose";
import { validateMongoUri } from "./securityConfig.js";

const connectDB = async () => {
  try {
    await mongoose.connect(validateMongoUri(process.env.MONGO_URI), {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;