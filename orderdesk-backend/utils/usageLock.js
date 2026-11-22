import { randomUUID } from "node:crypto";
import UsageLock from "../models/UsageLock.js";

export class UsageLockBusyError extends Error {
  constructor() {
    super("A record is currently being created for this account.");
    this.code = "USAGE_CHECK_BUSY";
  }
}

export async function acquireUsageLocks(userId, resources) {
  const acquired = [];
  let released = false;
  let renewal;

  const release = async () => {
    if (released) return;
    released = true;
    if (renewal) clearInterval(renewal);
    await Promise.all(
      acquired.map(({ resource, token }) =>
        UsageLock.deleteOne({ userId, resource, token })
      )
    );
  };

  try {
    for (const resource of [...new Set(resources)].sort()) {
      const token = randomUUID();
      const now = new Date();
      try {
        await UsageLock.findOneAndUpdate(
          {
            userId,
            resource,
            expiresAt: { $lte: now },
          },
          {
            $set: { token, expiresAt: new Date(now.getTime() + 60_000) },
            $setOnInsert: { userId, resource },
          },
          { upsert: true, new: true, runValidators: true }
        );
      } catch (error) {
        if (error.code === 11000) throw new UsageLockBusyError();
        throw error;
      }
      acquired.push({ resource, token });
    }

    renewal = setInterval(() => {
      Promise.all(
        acquired.map(({ resource, token }) =>
          UsageLock.updateOne(
            { userId, resource, token },
            { $set: { expiresAt: new Date(Date.now() + 60_000) } }
          )
        )
      ).catch((error) => {
        console.error("Subscription usage lock renewal failed:", error.message);
      });
    }, 20_000);
    renewal.unref();

    return release;
  } catch (error) {
    try {
      await release();
    } catch (releaseError) {
      console.error("Subscription usage lock release failed:", releaseError.message);
    }
    throw error;
  }
}
