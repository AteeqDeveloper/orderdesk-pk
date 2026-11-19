import { apiRequest } from "@/lib/api";
import { buildAnalyticsQuery } from "@/lib/analytics";

export async function getAnalyticsOverview(filters, options) {
  const query = buildAnalyticsQuery(filters);
  const response = await apiRequest(`dashboard/analytics?${query}`, options);
  return response.data;
}
