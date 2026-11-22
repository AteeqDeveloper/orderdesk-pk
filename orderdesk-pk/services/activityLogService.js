import { apiRequest } from "@/lib/api";

export async function getActivityLogs(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  const response = await apiRequest(
    `activity-logs${query.size ? `?${query.toString()}` : ""}`
  );
  return response.data;
}
