const PLACEHOLDER_PATTERN = /^(?:change-me|changeme|example|placeholder|https?:\/\/<[^>]+>)/i;

export function getApiUrl(env = process.env) {
  let apiUrl = env.NEXT_PUBLIC_API_URL?.trim();

  if (!apiUrl || PLACEHOLDER_PATTERN.test(apiUrl)) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_URL is missing or placeholder. Configure the backend URL in environment variables."
      );
    }
    return "http://localhost:5000";
  }

  // Automatically prepend https:// if protocol was omitted (e.g. backend.up.railway.app)
  if (!/^https?:\/\//i.test(apiUrl)) {
    apiUrl = apiUrl.startsWith("localhost") || apiUrl.startsWith("127.0.0.1")
      ? `http://${apiUrl}`
      : `https://${apiUrl}`;
  }

  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid HTTP(S) URL.");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be a valid HTTP(S) URL without credentials."
    );
  }

  if (
    env.NODE_ENV === "production" &&
    parsed.protocol !== "https:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  ) {
    throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production.");
  }

  // Returns exact origin (protocol + host + port), naturally stripping trailing slashes and /api paths
  return parsed.origin;
}
