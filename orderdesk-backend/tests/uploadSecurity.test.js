import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import cloudinary from "../config/cloudinary.js";
import User from "../models/user.js";
import { createUploadRouter } from "../routes/uploadRoutes.js";
import { createUploadRateLimiter } from "../middleware/uploadRateLimiter.js";

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
  return `http://127.0.0.1:${server.address().port}`;
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

const validImages = [
  {
    mimeType: "image/jpeg",
    filename: "product.jpg",
    bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  },
  {
    mimeType: "image/png",
    filename: "product.png",
    bytes: Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]),
  },
  {
    mimeType: "image/webp",
    filename: "product.webp",
    bytes: Buffer.from("RIFF\x04\x00\x00\x00WEBP"),
  },
];

test("product image uploads validate files, scope assets, and handle abuse safely", async (t) => {
  const originals = {
    findById: User.findById,
    uploadStream: cloudinary.uploader.upload_stream,
    jwtSecret: process.env.JWT_SECRET,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    consoleError: console.error,
  };
  const secret = randomBytes(32).toString("base64url");
  const user = {
    _id: "65a000000000000000000003",
    status: "active",
    authVersion: 0,
  };
  const uploads = [];
  let cloudinaryError;

  process.env.JWT_SECRET = secret;
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  User.findById = async () => user;
  cloudinary.uploader.upload_stream = (options, callback) => {
    uploads.push(options);
    return {
      end() {
        if (cloudinaryError) return callback(cloudinaryError);
        callback(null, {
          secure_url: "https://res.cloudinary.com/test-cloud/image/upload/product.jpg",
          public_id: `${options.folder}/${options.public_id}`,
        });
      },
    };
  };
  console.error = () => {};

  t.after(() => {
    User.findById = originals.findById;
    cloudinary.uploader.upload_stream = originals.uploadStream;
    console.error = originals.consoleError;
    for (const [name, value] of [
      ["JWT_SECRET", originals.jwtSecret],
      ["CLOUDINARY_CLOUD_NAME", originals.cloudName],
      ["CLOUDINARY_API_KEY", originals.apiKey],
      ["CLOUDINARY_API_SECRET", originals.apiSecret],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const token = jwt.sign(
    { userId: user._id, authVersion: user.authVersion },
    secret
  );
  const app = express();
  app.use(
    "/api/uploads",
    createUploadRouter({ rateLimiter: (_req, _res, next) => next() })
  );
  const baseUrl = await startTestServer(app, t);

  const sendUpload = async (file, authToken = token) => {
    const form = new FormData();
    if (file) {
      form.append(
        "image",
        new Blob([file.bytes], { type: file.mimeType }),
        file.filename
      );
    }
    return fetch(`${baseUrl}/api/uploads/product-image`, {
      method: "POST",
      headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
      body: form,
    });
  };

  await t.test("accepts JPEG, PNG, and WebP signatures on account-owned paths", async () => {
    for (const file of validImages) {
      const response = await sendUpload(file);
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(
        body.data.imageUrl,
        "https://res.cloudinary.com/test-cloud/image/upload/product.jpg"
      );
      assert.ok(body.data.publicId);
    }

    assert.equal(uploads.length, 3);
    for (const options of uploads) {
      assert.equal(options.folder, `orderdesk/users/${user._id}/products`);
      assert.match(
        options.public_id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      assert.deepEqual(options.allowed_formats, ["jpg", "png", "webp"]);
      assert.equal(options.overwrite, false);
    }
  });

  await t.test("rejects mismatched and unsupported image content", async () => {
    const mismatched = await sendUpload({
      mimeType: "image/jpeg",
      filename: "disguised.jpg",
      bytes: Buffer.from("not an image"),
    });
    assert.equal(mismatched.status, 400);

    const unsupported = await sendUpload({
      mimeType: "image/gif",
      filename: "animation.gif",
      bytes: Buffer.from("GIF89a"),
    });
    assert.equal(unsupported.status, 400);
    assert.equal(uploads.length, 3);
  });

  await t.test("rejects files larger than 5 MB", async () => {
    const bytes = Buffer.alloc(5 * 1024 * 1024 + 1);
    validImages[0].bytes.copy(bytes);
    const response = await sendUpload({
      mimeType: "image/jpeg",
      filename: "large.jpg",
      bytes,
    });
    assert.equal(response.status, 413);
  });

  await t.test("rejects unauthenticated uploads", async () => {
    const response = await sendUpload(validImages[0], null);
    assert.equal(response.status, 401);
  });

  await t.test("returns a safe error when Cloudinary fails", async () => {
    cloudinaryError = Object.assign(
      new Error("sensitive provider details"),
      { http_code: 500 }
    );
    const response = await sendUpload(validImages[0]);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.message, "Image upload failed. Please try again.");
    assert.equal(JSON.stringify(body).includes("sensitive"), false);
    cloudinaryError = undefined;
  });

  await t.test("rate limits repeated uploads per authenticated account", async () => {
    const limitedApp = express();
    limitedApp.post(
      "/upload",
      (req, _res, next) => {
        req.user = user;
        next();
      },
      createUploadRateLimiter({
        createStore: createMemoryRateLimitStore,
        limit: 1,
        windowMs: 60_000,
      }),
      (_req, res) => res.status(201).json({ success: true })
    );
    const limitedBaseUrl = await startTestServer(limitedApp, t);

    const first = await fetch(`${limitedBaseUrl}/upload`, { method: "POST" });
    const blocked = await fetch(`${limitedBaseUrl}/upload`, { method: "POST" });
    assert.equal(first.status, 201);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).code, "UPLOAD_RATE_LIMITED");
  });
});
