import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  loginUser,
  superAdminLogin,
} from "../controllers/authcontroller.js";
import jwt from "jsonwebtoken";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/user.js";
import SuperAdminAuditLog from "../models/SuperAdminAuditLog.js";
import mongoose from "mongoose";
import { promoteExistingSuperAdmin } from "../scripts/promoteSuperAdmin.js";
import authRoutes from "../routes/authRoutes.js";
import superAdminRoutes from "../routes/superAdminRoutes.js";
import superAdminMiddleware from "../middleware/superAdminMiddleware.js";

test("Super Admin APIs are protected by authentication and role middleware", () => {
  const protection = superAdminRoutes.stack.find((layer) => !layer.route);
  assert.ok(protection);
  assert.equal(protection.handle.name, "authMiddleware");
  assert.equal(protection, superAdminRoutes.stack[0]);
  assert.equal(superAdminRoutes.stack[1].handle.name, "superAdminMiddleware");

  const paths = superAdminRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  assert.deepEqual(paths, [
    "get /overview",
    "get /users",
    "get /users/:userId",
    "patch /users/:userId/status",
    "patch /users/:userId/plan",
    "get /plans",
    "post /plans",
    "patch /plans/:planId",
    "get /subscriptions",
    "patch /subscriptions/:subscriptionId/status",
    "get /payments",
    "get /analytics",
    "get /activity",
    "get /settings",
  ]);
});

test("Super Admin role middleware rejects business users and accepts Super Admins", () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  superAdminMiddleware({ user: { role: "user" } }, response, () => {
    nextCalled = true;
  });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);

  superAdminMiddleware({ user: { role: "super_admin" } }, response, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test("Super Admin sign-in and logout use separate protected auth routes", () => {
  const login = authRoutes.stack.find(
    (layer) => layer.route?.path === "/super-admin/login"
  );
  const logout = authRoutes.stack.find(
    (layer) => layer.route?.path === "/super-admin/logout"
  );
  assert.ok(login);
  assert.ok(logout);
  assert.equal(login.route.stack.length, 1);
  assert.deepEqual(
    logout.route.stack.map((layer) => layer.name),
    ["authMiddleware", "superAdminMiddleware", "superAdminLogout"]
  );
});

test("business sign-in cannot be used to enter the Super Admin account", async (t) => {
  const originalFindOne = User.findOne;
  const originalCompare = bcrypt.compare;
  t.after(() => {
    User.findOne = originalFindOne;
    bcrypt.compare = originalCompare;
  });

  const user = {
    _id: "65a000000000000000000001",
    role: "super_admin",
    status: "active",
    password: "stored-hash",
  };
  User.findOne = () => ({ select: async () => user });
  bcrypt.compare = async () => true;
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await loginUser(
    { body: { email: "admin@example.com", password: "password" } },
    response
  );
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.token, undefined);
});

test("business accounts cannot authenticate through Super Admin sign-in", async (t) => {
  const originalFindOne = User.findOne;
  t.after(() => {
    User.findOne = originalFindOne;
  });

  User.findOne = () => ({
    select: async () => ({
      role: "user",
      password: "not-used",
    }),
  });
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await superAdminLogin(
    { body: { email: "user@example.com", password: "password" } },
    response
  );
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.token, undefined);
});

test("suspension and logout version changes invalidate authenticated sessions", async (t) => {
  const originalFindById = User.findById;
  const originalSecret = process.env.JWT_SECRET;
  t.after(() => {
    User.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });
  process.env.JWT_SECRET = "test-only-signing-secret";

  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  const token = jwt.sign(
    { userId: "65a000000000000000000001", authVersion: 1 },
    process.env.JWT_SECRET
  );
  User.findById = async () => ({ status: "active", authVersion: 2 });
  await authMiddleware(
    { headers: { authorization: `Bearer ${token}` } },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);

  const currentToken = jwt.sign(
    { userId: "65a000000000000000000001", authVersion: 2 },
    process.env.JWT_SECRET
  );
  User.findById = async () => ({ status: "suspended", authVersion: 2 });
  response.statusCode = null;
  await authMiddleware(
    { headers: { authorization: `Bearer ${currentToken}` } },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("Super Admin audit records reject update and delete queries", async () => {
  await assert.rejects(
    SuperAdminAuditLog.updateOne({}, { $set: { reason: "changed" } }).exec(),
    /immutable/
  );
  await assert.rejects(
    SuperAdminAuditLog.deleteOne({}).exec(),
    /immutable/
  );
});

test("seed promotion updates only the selected existing account and invalidates its sessions", async (t) => {
  const originals = {
    connect: mongoose.connect,
    disconnect: mongoose.disconnect,
    findOne: User.findOne,
    exists: User.exists,
    updateOne: User.updateOne,
    mongoUri: process.env.MONGO_URI,
  };
  t.after(() => {
    mongoose.connect = originals.connect;
    mongoose.disconnect = originals.disconnect;
    User.findOne = originals.findOne;
    User.exists = originals.exists;
    User.updateOne = originals.updateOne;
    if (originals.mongoUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originals.mongoUri;
  });

  process.env.MONGO_URI = "mongodb://test.invalid/orderdesk";
  const target = {
    _id: "65a000000000000000000010",
    role: "user",
    status: "active",
  };
  let selectedEmail;
  let updated;
  mongoose.connect = async () => ({});
  mongoose.disconnect = async () => {};
  User.findOne = (filter) => {
    selectedEmail = filter.email;
    return { select: async () => target };
  };
  User.exists = async (filter) => {
    assert.equal(filter.role, "super_admin");
    assert.deepEqual(filter._id, { $ne: target._id });
    return null;
  };
  User.updateOne = async (...args) => {
    updated = args;
    return { modifiedCount: 1 };
  };

  const result = await promoteExistingSuperAdmin("  Business@Example.com ");
  assert.equal(result.alreadySuperAdmin, false);
  assert.equal(selectedEmail, "business@example.com");
  assert.equal(updated[0]._id, target._id);
  assert.equal(updated[1].$set.role, "super_admin");
  assert.equal(updated[1].$inc.authVersion, 1);
});

test("seed promotion rejects absent accounts without assigning a role", async (t) => {
  const originals = {
    connect: mongoose.connect,
    disconnect: mongoose.disconnect,
    findOne: User.findOne,
    mongoUri: process.env.MONGO_URI,
  };
  t.after(() => {
    mongoose.connect = originals.connect;
    mongoose.disconnect = originals.disconnect;
    User.findOne = originals.findOne;
    if (originals.mongoUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originals.mongoUri;
  });

  process.env.MONGO_URI = "mongodb://test.invalid/orderdesk";
  mongoose.connect = async () => ({});
  mongoose.disconnect = async () => {};
  User.findOne = () => ({ select: async () => null });

  await assert.rejects(
    promoteExistingSuperAdmin("missing@example.com"),
    /No existing account matches/
  );
});
