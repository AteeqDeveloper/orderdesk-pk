import { apiRequest } from "@/lib/api";

export async function getNotifications(limit = 20) {
  const response = await apiRequest(`notifications?limit=${limit}`);
  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await apiRequest("notifications/unread-count");
  return response.data.count;
}

export async function markNotificationRead(notificationId) {
  const response = await apiRequest(`notifications/${notificationId}/read`, {
    method: "PATCH",
  });
  return response.data.notification;
}

export async function markAllNotificationsRead() {
  const response = await apiRequest("notifications/read-all", {
    method: "PATCH",
  });
  return response.data.modifiedCount;
}

export async function deleteNotification(notificationId) {
  await apiRequest(`notifications/${notificationId}`, { method: "DELETE" });
}
