import mongoose from "mongoose";

const loginRateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    totalHits: { type: Number, required: true, min: 0 },
    resetTime: { type: Date, required: true },
  },
  {
    collection: "login_rate_limits",
    versionKey: false,
    bufferCommands: false,
  }
);

loginRateLimitSchema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });

const LoginRateLimit = mongoose.model("LoginRateLimit", loginRateLimitSchema);

export default LoginRateLimit;
