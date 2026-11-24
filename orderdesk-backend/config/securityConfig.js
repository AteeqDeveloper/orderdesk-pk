export const JWT_ALGORITHM = "HS256";

const PLACEHOLDER_SECRETS = new Set([
  "secret",
  "password",
  "changeme",
  "change-me",
  "your-secret",
  "your-secret-key",
  "jwt-secret",
  "development-secret",
  "example-secret",
  "test-secret",
]);

export function validateJwtSecret(secret) {
  const normalized = typeof secret === "string" ? secret.toLowerCase() : "";
  const uniqueCharacterCount =
    typeof secret === "string" ? new Set(secret).size : 0;
  if (
    typeof secret !== "string" ||
    secret.trim() !== secret ||
    Buffer.byteLength(secret, "utf8") < 32 ||
    PLACEHOLDER_SECRETS.has(normalized) ||
    uniqueCharacterCount < 16
  ) {
    throw new Error(
      "JWT_SECRET is missing or weak. Configure a cryptographically random secret with at least 32 bytes and at least 16 distinct characters."
    );
  }
  return secret;
}

export function parseTrustedProxyHops(value) {
  if (value === undefined || value.trim() === "") return 0;
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
  }
  const hops = Number(value);
  if (!Number.isSafeInteger(hops)) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
  }
  return hops;
}

export function validateMongoUri(value) {
  if (typeof value !== "string" || value.trim() !== value) {
    throw new Error("MONGO_URI is missing or invalid.");
  }

  const uri = value.trim();
  if (
    !/^mongodb(?:\+srv)?:\/\//.test(uri) ||
    /^(?:mongodb(?:\+srv)?:\/\/)?(?:<[^>]+>|change-me|example)/i.test(uri)
  ) {
    throw new Error("MONGO_URI is missing or invalid.");
  }
  return uri;
}

export function validateProductionEnvironment(env = process.env) {
  validateJwtSecret(env.JWT_SECRET);
  validateMongoUri(env.MONGO_URI);

  if (env.NODE_ENV === "production") {
    const required = [
      "FRONTEND_ORIGINS",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ];
    const missing = required.filter((name) => {
      const value = env[name]?.trim();
      return (
        !value ||
        /^(?:change-me|changeme|example|placeholder|your[_-].*)$/i.test(value)
      );
    });
    if (missing.length > 0) {
      throw new Error(
        `Production environment variables missing or placeholder: ${missing.join(", ")}`
      );
    }
  }
}
