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

const estimateEntropyBits = (value) => {
  const counts = new Map();
  for (const character of value) {
    counts.set(character, (counts.get(character) || 0) + 1);
  }
  let entropyPerCharacter = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropyPerCharacter -= probability * Math.log2(probability);
  }
  return entropyPerCharacter * value.length;
};

export function validateJwtSecret(secret) {
  if (
    typeof secret !== "string" ||
    secret.trim() !== secret ||
    Buffer.byteLength(secret, "utf8") < 32 ||
    PLACEHOLDER_SECRETS.has(secret.toLowerCase()) ||
    estimateEntropyBits(secret) < 128
  ) {
    throw new Error(
      "JWT_SECRET is missing or weak. Configure a cryptographically random secret with at least 32 bytes and 128 estimated bits of entropy."
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
