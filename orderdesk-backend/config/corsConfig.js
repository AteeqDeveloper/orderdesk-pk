const DEVELOPMENT_ORIGINS = ["http://localhost:3000"];
const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const ALLOWED_HEADERS = ["Accept", "Authorization", "Content-Type", "Idempotency-Key"];

export const validateOrigin = (value, isProduction) => {
  if (typeof value !== "string" || value.includes("*")) {
    throw new Error(
      "FRONTEND_ORIGINS must contain exact HTTP(S) origins without paths or wildcards."
    );
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("FRONTEND_ORIGINS must contain valid origin URLs.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== value ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    (isProduction &&
      (parsed.protocol !== "https:" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]"))
  ) {
    throw new Error(
      "FRONTEND_ORIGINS must contain exact HTTP(S) origins without paths or wildcards."
    );
  }
  return parsed.origin;
};

export function getTrustedFrontendOrigins(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const configured = env.FRONTEND_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!configured?.length) {
    if (isProduction) {
      throw new Error(
        "FRONTEND_ORIGINS must be configured before production startup."
      );
    }
    return DEVELOPMENT_ORIGINS;
  }

  return [...new Set(configured.map((origin) => validateOrigin(origin, isProduction)))];
}

export function createCorsOptions(allowedOrigins) {
  return {
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    credentials: false,
    optionsSuccessStatus: 204,
    maxAge: 600,
  };
}

export function createCorsOriginGuard(allowedOrigins) {
  const trustedOrigins = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get("Origin");
    if (!origin || trustedOrigins.has(origin)) return next();
    return res.status(403).json({
      success: false,
      message: "Origin is not allowed.",
    });
  };
}
