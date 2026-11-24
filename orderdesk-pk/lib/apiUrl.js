const PLACEHOLDER_PATTERN = /^(?:change-me|changeme|example|placeholder|https?:\/\/<[^>]+>)/i;

export function getApiUrl(env = process.env) {
  const apiUrl = env.NEXT_PUBLIC_API_URL?.trim();

  if (!apiUrl || PLACEHOLDER_PATTERN.test(apiUrl)) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_URL is missing or placeholder. Configure the intended production backend URL."
      );
    }
    return "http://localhost:5000";
  }

  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid HTTP(S) URL.");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== apiUrl ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be an exact HTTP(S) origin without a path or credentials."
    );
  }

  if (env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production.");
  }

  return parsed.origin;
}
