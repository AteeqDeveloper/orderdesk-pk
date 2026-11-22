import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { recordActivity } from "../utils/activityLog.js";

const notificationFields =
  "title message type relatedId relatedType relatedProductId isRead createdAt updatedAt";

const invalidQuery = (res, message) =>
  res.status(400).json({ success: false, message });

export const getNotifications = async (req, res) => {
  try {
    if (Object.keys(req.query).some((key) => key !== "limit")) {
      return invalidQuery(res, "Only the limit query parameter is supported");
    }

    let limit = 20;
    if (req.query.limit !== undefined) {
      if (
        typeof req.query.limit !== "string" ||
        !/^\d+$/.test(req.query.limit) ||
        Number(req.query.limit) < 1 ||
        Number(req.query.limit) > 50
      ) {
        return invalidQuery(res, "limit must be a whole number from 1 to 50");
      }
      limit = Number(req.query.limit);
    }

    const userId = req.user._id;
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select(notificationFields)
        .lean(),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error) {
    console.error("Get notifications error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch notifications",
    });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });
    return res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    console.error("Unread notification count error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch unread notification count",
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isRead: true } },
      { new: true, runValidators: true }
    )
      .select(notificationFields)
      .lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await recordActivity({
      userId: req.user._id,
      action: "notification_read",
      entityType: "notification",
      entityId: notification._id,
      description: "Notification marked as read",
    });

    return res.status(200).json({ success: true, data: { notification } });
  } catch (error) {
    console.error("Mark notification read error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update notification",
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    if (result.modifiedCount > 0) {
      await recordActivity({
        userId: req.user._id,
        action: "notification_read",
        entityType: "notification",
        description: "Notifications marked as read",
        metadata: { count: result.modifiedCount },
      });
    }
    return res.status(200).json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update notifications",
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await recordActivity({
      userId: req.user._id,
      action: "notification_deleted",
      entityType: "notification",
      entityId: notification._id,
      description: "Notification deleted",
    });

    return res.status(200).json({
      success: true,
      data: { deletedId: notification._id },
    });
  } catch (error) {
    console.error("Delete notification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not delete notification",
    });
  }
};
