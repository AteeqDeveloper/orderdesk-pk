import ActivityLog from "../models/ActivityLog.js";

export const recordActivity = async (activity) => {
  try {
    await ActivityLog.create(activity);
  } catch (error) {
    console.error("Activity log write failed:", error.message);
  }
};
