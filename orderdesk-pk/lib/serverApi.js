import { cookies } from "next/headers";
import { ApiError } from "@/lib/api";
import { getApiUrl } from "@/lib/apiUrl";

export async function serverApiRequest(path, options = {}) {
  const token = (await cookies()).get("orderdesk_token")?.value;
  if (!token) throw new ApiError("Please log in to continue.", 401);

  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/${path.replace(/^\/+/, "")}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || "The request could not be completed.", response.status);
  }

  return data;
}

export async function getServerUser() {
  try {
    const data = await serverApiRequest("auth/me");
    return data.user || null;
  } catch {
    return null;
  }
}