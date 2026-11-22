import { createHmac, randomBytes } from "node:crypto";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import MongoLoginRateLimitStore from "./mongoLoginRateLimitStore.js";

const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LIMIT = 8;
const IP_LIMIT = 30;
const RATE_LIMIT_KEY_SECRET =
  process.env.JWT_SECRET || randomBytes(32).toString("base64url");

const hashKey = (scope, value) =>
  createHmac("sha256", RATE_LIMIT_KEY_SECRET)
    .update(`${scope}:${value}`)
    .digest("hex");

const rateLimitResponse = (_req, res) =>
  res.status(429).json({
    success: false,
    code: "LOGIN_RATE_LIMITED",
    message: "Too many sign-in attempts. Please try again later.",
  });

const requestIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";

export function createLoginLimiters({
  createStore = () => new MongoLoginRateLimitStore(),
  ipLimit = IP_LIMIT,
  accountLimit = ACCOUNT_LIMIT,
  windowMs = WINDOW_MS,
} = {}) {
  const sharedOptions = {
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    passOnStoreError: false,
    handler: rateLimitResponse,
  };

  return {
    ipLoginLimiter: rateLimit({
      ...sharedOptions,
      limit: ipLimit,
      store: createStore(),
      keyGenerator: (req) =>
        hashKey("ip", ipKeyGenerator(requestIp(req))),
    }),
    accountLoginLimiter: rateLimit({
      ...sharedOptions,
      limit: accountLimit,
      store: createStore(),
      keyGenerator: (req) => {
        const email =
          typeof req.body?.email === "string"
            ? req.body.email.trim().toLowerCase().slice(0, 254)
            : "";
        const identity = email || `missing:${requestIp(req)}`;
        return hashKey("account", identity);
      },
    }),
  };
}

const { ipLoginLimiter, accountLoginLimiter } = createLoginLimiters();

export { ipLoginLimiter, accountLoginLimiter };
