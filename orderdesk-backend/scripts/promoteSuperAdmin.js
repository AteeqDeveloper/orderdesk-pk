import "../config/loadEnv.js";
import mongoose from "mongoose";
import User from "../models/user.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

class SetupError extends Error {}

const isValidEmail = (email) =>
  typeof email === "string" &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function promoteExistingSuperAdmin(
  targetEmail = process.env.SUPER_ADMIN_EMAIL
) {
  const email =
    typeof targetEmail === "string" ? targetEmail.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    throw new SetupError("Set SUPER_ADMIN_EMAIL to a valid email address.");
  }
  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri) {
    throw new SetupError("MONGO_URI must be configured for this one-time setup.");
  }

  let connected = false;
  let result;
  let failure;
  try {
    await mongoose.connect(mongoUri);
    connected = true;

    const user = await User.findOne({ email }).select("_id role status");
    if (!user) {
      throw new SetupError("No existing account matches SUPER_ADMIN_EMAIL.");
    }
    if (user.role === "super_admin") {
      result = { alreadySuperAdmin: true };
    } else {
      if (user.status === "suspended") {
        throw new SetupError(
          "The target account is suspended. Reactivate it before promotion."
        );
      }
      if (!["user", "admin"].includes(user.role)) {
        throw new SetupError("The target account has an unsupported role.");
      }

      const anotherSuperAdmin = await User.exists({
        role: "super_admin",
        _id: { $ne: user._id },
      });
      if (anotherSuperAdmin) {
        throw new SetupError(
          "A different Super Admin account already exists; no account was changed."
        );
      }

      const update = await User.updateOne(
        {
          _id: user._id,
          role: user.role,
          status: { $ne: "suspended" },
        },
        {
          $set: { role: "super_admin" },
          $inc: { authVersion: 1 },
        },
        { runValidators: true }
      );
      if (update.modifiedCount !== 1) {
        throw new SetupError(
          "The target account changed during setup; no promotion was confirmed."
        );
      }
      result = { alreadySuperAdmin: false };
    }
  } catch (error) {
    failure =
      error instanceof SetupError
        ? error
        : new SetupError(
            "Database operation failed. Check backend configuration; sensitive error details were omitted."
          );
  } finally {
    if (connected || mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch {
        if (!failure) {
          failure = new SetupError(
            "Database disconnect failed; the role update may already have completed."
          );
        }
      }
    }
  }

  if (failure) throw failure;
  return result;
}

const run = async () => {
  try {
    const result = await promoteExistingSuperAdmin();
    console.log(
      result.alreadySuperAdmin
        ? "The target account is already a Super Admin. No changes were made."
        : "The existing account was promoted to Super Admin. Sign in again to continue."
    );
  } catch (error) {
    console.error(
      `Super Admin promotion failed: ${
        error instanceof SetupError
          ? error.message
          : "Unexpected failure; sensitive details were omitted."
      }`
    );
    process.exitCode = 1;
  }
};

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  await run();
}
