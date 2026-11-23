import { createHmac } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import MongoLoginRateLimitStore from "./mongoLoginRateLimitStore.js";

const WINDOW_MS = 15 * 60 * 1000;
const UPLOAD_LIMIT = 20;

export function createUploadRateLimiter({
  createStore = () => new MongoLoginRateLimitStore(),
  limit = UPLOAD_LIMIT,
  windowMs = WINDOW_MS,
} = {}) {
  return rateLimit({
    windowMs,
    limit,
    store: createStore(),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: false,
    keyGenerator: (req) =>
      createHmac("sha256", process.env.JWT_SECRET)
        .update(`upload:${req.user._id}`)
        .digest("hex"),
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        code: "UPLOAD_RATE_LIMITED",
        message: "Too many image uploads. Please try again later.",
      }),
  });
}

const uploadRateLimiter = createUploadRateLimiter();

export default uploadRateLimiter;
