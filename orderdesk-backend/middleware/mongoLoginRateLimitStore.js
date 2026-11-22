import LoginRateLimit from "../models/LoginRateLimit.js";

export default class MongoLoginRateLimitStore {
  constructor(collection = LoginRateLimit.collection) {
    this.collection = collection;
    this.windowMs = 0;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async get(key) {
    const record = await this.collection.findOne({
      key,
      resetTime: { $gt: new Date() },
    });
    if (!record) return undefined;
    return { totalHits: record.totalHits, resetTime: record.resetTime };
  }

  async increment(key) {
    const now = new Date();
    const resetTime = new Date(now.getTime() + this.windowMs);
    const activeWindow = { $gt: ["$resetTime", now] };
    const updatePipeline = [
      {
        $set: {
          totalHits: {
            $cond: [
              activeWindow,
              { $add: [{ $ifNull: ["$totalHits", 0] }, 1] },
              1,
            ],
          },
          resetTime: { $cond: [activeWindow, "$resetTime", resetTime] },
        },
      },
    ];

    let record;
    try {
      record = await this.collection.findOneAndUpdate(
        { key },
        updatePipeline,
        { upsert: true, returnDocument: "after", includeResultMetadata: false }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await this.collection.findOneAndUpdate(
        { key },
        updatePipeline,
        { returnDocument: "after", includeResultMetadata: false }
      );
    }
    const updated = record?.value || record;
    if (!updated) throw new Error("Login rate-limit state could not be updated.");
    return { totalHits: updated.totalHits, resetTime: updated.resetTime };
  }

  async decrement(key) {
    await this.collection.updateOne(
      { key, totalHits: { $gt: 0 } },
      { $inc: { totalHits: -1 } }
    );
  }

  async resetKey(key) {
    await this.collection.deleteOne({ key });
  }
}
