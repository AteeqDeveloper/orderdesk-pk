import test from "node:test";
import assert from "node:assert/strict";
import UsageLock from "../models/UsageLock.js";
import {
  acquireUsageLocks,
  UsageLockBusyError,
} from "../utils/usageLock.js";

const stubLockMethods = (t, { findOneAndUpdate, deleteOne }) => {
  const originals = [UsageLock.findOneAndUpdate, UsageLock.deleteOne];
  UsageLock.findOneAndUpdate = findOneAndUpdate;
  UsageLock.deleteOne = deleteOne;
  t.after(() => {
    UsageLock.findOneAndUpdate = originals[0];
    UsageLock.deleteOne = originals[1];
  });
};

test("usage lock acquisition is ordered and releases every acquired resource", async (t) => {
  const acquired = [];
  const released = [];
  stubLockMethods(t, {
    findOneAndUpdate: async (filter) => acquired.push(filter.resource),
    deleteOne: async (filter) => released.push(filter.resource),
  });

  const release = await acquireUsageLocks("account-1", [
    "ordersPerMonth",
    "products",
    "customers",
  ]);
  assert.deepEqual(acquired, ["customers", "ordersPerMonth", "products"]);
  await release();
  await release();
  assert.deepEqual(released, ["customers", "ordersPerMonth", "products"]);
});

test("usage lock contention releases partial acquisition and reports retryable state", async (t) => {
  const released = [];
  stubLockMethods(t, {
    findOneAndUpdate: async (filter) => {
      if (filter.resource === "products") {
        const duplicate = new Error("Duplicate lock key");
        duplicate.code = 11000;
        throw duplicate;
      }
    },
    deleteOne: async (filter) => released.push(filter.resource),
  });

  await assert.rejects(
    acquireUsageLocks("account-1", ["customers", "products"]),
    UsageLockBusyError
  );
  assert.deepEqual(released, ["customers"]);
});
