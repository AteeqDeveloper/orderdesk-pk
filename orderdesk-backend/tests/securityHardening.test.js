import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import UserSubscription from "../models/UserSubscription.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { loginUser, superAdminLogin } from "../controllers/authcontroller.js";
import {
  createCorsOptions,
  createCorsOriginGuard,
  getTrustedFrontendOrigins,
} from "../config/corsConfig.js";
import {
  JWT_ALGORITHM,
  parseTrustedProxyHops,
  validateJwtSecret,
} from "../config/securityConfig.js";
import { createLoginLimiters } from "../middleware/loginRateLimiter.js";

const makeResponse = () => ({
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
});

const startTestServer = async (app, t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
};

const createMemoryRateLimitStore = () => {
  const entries = new Map();
  let windowMs = 0;
  return {
    localKeys: true,
    init(options) {
      windowMs = options.windowMs;
    },
    async increment(key) {
      let entry = entries.get(key);
      if (!entry || entry.resetTime <= new Date()) {
        entry = { totalHits: 0, resetTime: new Date(Date.now() + windowMs) };
      }
      entry.totalHits += 1;
      entries.set(key, entry);
      return entry;
    },
    async decrement(key) {
      const entry = entries.get(key);
      if (entry) entry.totalHits = Math.max(0, entry.totalHits - 1);
    },
    async resetKey(key) {
      entries.delete(key);
    },
  };
};

test("login limiters enforce account and IP ceilings with expiring 429 lockouts", async (t) => {
  const { ipLoginLimiter, accountLoginLimiter } = createLoginLimiters({
    createStore: createMemoryRateLimitStore,
    ipLimit: 10,
    accountLimit: 2,
    windowMs: 1000,
  });
  const app = express();
  app.use(express.json());
  app.post(
    "/login",
    ipLoginLimiter,
    accountLoginLimiter,
    (req, res) => res.status(401).json({ success: false }),
  );
  const baseUrl = await startTestServer(app, t);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", password: "wrong" }),
    });
    assert.equal(response.status, 401);
  }
  const blocked = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", password: "wrong" }),
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  assert.deepEqual(await blocked.json(), {
    success: false,
    code: "LOGIN_RATE_LIMITED",
    message: "Too many sign-in attempts. Please try again later.",
  });

  await new Promise((resolve) => setTimeout(resolve, 1050));
  const afterWindow = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", password: "wrong" }),
  });
  assert.equal(afterWindow.status, 401);
});

test("production CORS requires exact configured origins and blocks untrusted origins", async (t) => {
  assert.throws(
    () => getTrustedFrontendOrigins({ NODE_ENV: "production" }),
    /FRONTEND_ORIGINS/
  );
  assert.throws(
    () =>
      getTrustedFrontendOrigins({
        NODE_ENV: "production",
        FRONTEND_ORIGINS: "*",
      }),
    /exact HTTP\(S\) origins/
  );
  assert.deepEqual(
    getTrustedFrontendOrigins({
      NODE_ENV: "production",
      FRONTEND_ORIGINS: "https://app.example.com,https://admin.example.com",
    }),
    ["https://app.example.com", "https://admin.example.com"]
  );

  const trustedOrigin = "https://app.example.com";
  const app = express();
  app.use(createCorsOriginGuard([trustedOrigin]));
  app.use(cors(createCorsOptions([trustedOrigin])));
  app.get("/health", (_req, res) => res.json({ success: true }));
  const baseUrl = await startTestServer(app, t);

  const trusted = await fetch(`${baseUrl}/health`, {
    headers: { Origin: trustedOrigin },
  });
  assert.equal(trusted.status, 200);
  assert.equal(
    trusted.headers.get("access-control-allow-origin"),
    trustedOrigin
  );
  assert.equal(trusted.headers.get("access-control-allow-credentials"), null);

  const preflight = await fetch(`${baseUrl}/health`, {
    method: "OPTIONS",
    headers: {
      Origin: trustedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(
    preflight.headers.get("access-control-allow-methods"),
    /PATCH/
  );
  assert.match(
    preflight.headers.get("access-control-allow-headers"),
    /Authorization/
  );

  const untrusted = await fetch(`${baseUrl}/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(untrusted.status, 403);
  assert.equal(untrusted.headers.get("access-control-allow-origin"), null);
});

test("JWT startup validation rejects missing, placeholder, and weak secrets", () => {
  assert.throws(() => validateJwtSecret(undefined), /JWT_SECRET/);
  assert.throws(() => validateJwtSecret("secret"), /JWT_SECRET/);
  assert.throws(() => validateJwtSecret("a".repeat(64)), /JWT_SECRET/);
  assert.equal(
    validateJwtSecret(randomBytes(32).toString("base64url")).length,
    43
  );
  assert.equal(parseTrustedProxyHops(undefined), 0);
  assert.equal(parseTrustedProxyHops("2"), 2);
  assert.throws(() => parseTrustedProxyHops("true"), /TRUST_PROXY_HOPS/);
});

test("JWT verification pins HS256 and rejects invalid algorithms", async (t) => {
  const originalFindById = User.findById;
  const originalSecret = process.env.JWT_SECRET;
  t.after(() => {
    User.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });
  const secret = randomBytes(32).toString("base64url");
  process.env.JWT_SECRET = secret;
  User.findById = async () => ({ status: "active", authVersion: 0 });

  const response = makeResponse();
  const invalidToken = jwt.sign(
    { userId: "65a000000000000000000001", authVersion: 0 },
    secret,
    { algorithm: "HS384" }
  );
  let nextCalled = false;
  await authMiddleware(
    { headers: { authorization: `Bearer ${invalidToken}` } },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);

  const validToken = jwt.sign(
    { userId: "65a000000000000000000001", authVersion: 0 },
    secret,
    { algorithm: JWT_ALGORITHM, expiresIn: "1d" }
  );
  response.statusCode = null;
  await authMiddleware(
    { headers: { authorization: `Bearer ${validToken}` } },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
});

test("normal login still issues an expiring HS256 token", async (t) => {
  const originals = {
    findOne: User.findOne,
    findSubscription: UserSubscription.findOne,
    compare: bcrypt.compare,
    secret: process.env.JWT_SECRET,
  };
  t.after(() => {
    User.findOne = originals.findOne;
    UserSubscription.findOne = originals.findSubscription;
    bcrypt.compare = originals.compare;
    if (originals.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.secret;
  });
  const secret = randomBytes(32).toString("base64url");
  process.env.JWT_SECRET = secret;
  const user = {
    _id: "65a000000000000000000002",
    fullName: "Business User",
    email: "person@example.com",
    role: "user",
    status: "active",
    authVersion: 3,
    password: "stored-hash",
  };
  User.findOne = () => ({ select: async () => user });
  UserSubscription.findOne = async () => ({ _id: "current-subscription" });
  bcrypt.compare = async () => true;
  const response = makeResponse();

  await loginUser(
    { body: { email: user.email, password: "correct password" } },
    response
  );
  assert.equal(response.statusCode, 200);
  const decoded = jwt.verify(response.body.token, secret, {
    algorithms: [JWT_ALGORITHM],
  });
  assert.equal(decoded.userId, user._id);
  assert.equal(decoded.authVersion, 3);
  assert.ok(decoded.exp > decoded.iat);
  assert.ok(decoded.exp - decoded.iat <= 24 * 60 * 60);
});

test("login failures do not reveal whether an account exists or may sign in", async (t) => {
  const originals = {
    findOne: User.findOne,
    compare: bcrypt.compare,
  };
  t.after(() => {
    User.findOne = originals.findOne;
    bcrypt.compare = originals.compare;
  });

  const attempt = async (user, passwordValid) => {
    User.findOne = () => ({ select: async () => user });
    bcrypt.compare = async () => passwordValid;
    const response = makeResponse();
    await loginUser(
      { body: { email: "person@example.com", password: "wrong" } },
      response
    );
    return { status: response.statusCode, body: response.body };
  };

  const missing = await attempt(null, false);
  const wrongPassword = await attempt(
    { password: "stored-hash", role: "user", status: "active" },
    false
  );
  const suspended = await attempt(
    { password: "stored-hash", role: "user", status: "suspended" },
    true
  );
  const wrongPortal = await attempt(
    { password: "stored-hash", role: "super_admin", status: "active" },
    true
  );
  assert.deepEqual(wrongPassword, missing);
  assert.deepEqual(suspended, missing);
  assert.deepEqual(wrongPortal, missing);
  assert.equal(missing.status, 401);
});

test("business accounts receive the same denial from Super Admin login", async (t) => {
  const originals = {
    findOne: User.findOne,
    compare: bcrypt.compare,
  };
  t.after(() => {
    User.findOne = originals.findOne;
    bcrypt.compare = originals.compare;
  });
  User.findOne = () => ({
    select: async () => ({
      role: "user",
      status: "active",
      password: "stored-hash",
    }),
  });
  bcrypt.compare = async () => true;
  const response = makeResponse();

  await superAdminLogin(
    { body: { email: "person@example.com", password: "correct password" } },
    response
  );
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, "Invalid email or password.");
});
