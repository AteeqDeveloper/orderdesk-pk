import test from "node:test";
import assert from "node:assert/strict";
import ActivityLog from "../models/ActivityLog.js";
import {
  getActivityLogById,
  getActivityLogs,
} from "../controllers/activityLogController.js";
import activityLogRoutes from "../routes/activityLogRoutes.js";
import { recordActivity } from "../utils/activityLog.js";

const createResponse = () => ({
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

test("activity list scopes results and count to the user with filters and pagination", async (t) => {
  const originalFind = ActivityLog.find;
  const originalCountDocuments = ActivityLog.countDocuments;
  t.after(() => {
    ActivityLog.find = originalFind;
    ActivityLog.countDocuments = originalCountDocuments;
  });

  const userId = "65a000000000000000000001";
  let filter;
  let sort;
  let skip;
  let limit;
  ActivityLog.find = (query) => {
    filter = query;
    return {
      sort(value) {
        sort = value;
        return this;
      },
      skip(value) {
        skip = value;
        return this;
      },
      limit(value) {
        limit = value;
        return this;
      },
      lean: async () => [],
    };
  };
  ActivityLog.countDocuments = async (query) => {
    assert.deepEqual(query, filter);
    return 24;
  };

  const response = createResponse();
  await getActivityLogs(
    {
      user: { _id: userId },
      query: {
        page: "2",
        limit: "10",
        action: "product_updated",
        entityType: "product",
        search: "shirt [blue]",
        startDate: "2026-03-04",
        endDate: "2026-03-05",
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(filter.userId, userId);
  assert.equal(filter.action, "product_updated");
  assert.equal(filter.entityType, "product");
  assert.equal(filter.description.$regex, "shirt \\[blue\\]");
  assert.deepEqual(filter.createdAt, {
    $gte: new Date("2026-03-04T00:00:00.000Z"),
    $lte: new Date("2026-03-05T23:59:59.999Z"),
  });
  assert.deepEqual(sort, { createdAt: -1, _id: -1 });
  assert.equal(skip, 10);
  assert.equal(limit, 10);
  assert.deepEqual(response.body.data.pagination, {
    page: 2,
    limit: 10,
    total: 24,
    pages: 3,
  });
});

test("activity list rejects invalid dates without querying", async (t) => {
  const originalFind = ActivityLog.find;
  t.after(() => {
    ActivityLog.find = originalFind;
  });
  ActivityLog.find = () => {
    assert.fail("Invalid filters must not query activity logs");
  };

  const response = createResponse();
  await getActivityLogs(
    {
      user: { _id: "65a000000000000000000001" },
      query: { startDate: "2026-02-31" },
    },
    response
  );
  assert.equal(response.statusCode, 400);
});

test("activity detail lookup is scoped to the authenticated user", async (t) => {
  const originalFindOne = ActivityLog.findOne;
  t.after(() => {
    ActivityLog.findOne = originalFindOne;
  });

  let filter;
  ActivityLog.findOne = (query) => {
    filter = query;
    return { lean: async () => null };
  };
  const response = createResponse();
  await getActivityLogById(
    {
      params: { id: "65a000000000000000000002" },
      user: { _id: "65a000000000000000000001" },
    },
    response
  );

  assert.equal(filter.userId, "65a000000000000000000001");
  assert.equal(response.statusCode, 404);
});

test("activity routes expose only authenticated read methods", () => {
  const methods = activityLogRoutes.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods));
  assert.deepEqual(methods, ["get", "get"]);
  assert.equal(activityLogRoutes.stack[0].handle.name, "authMiddleware");
});

test("activity logging failures do not reject successful business operations", async (t) => {
  const originalCreate = ActivityLog.create;
  const originalConsoleError = console.error;
  t.after(() => {
    ActivityLog.create = originalCreate;
    console.error = originalConsoleError;
  });

  ActivityLog.create = async () => {
    throw new Error("database unavailable");
  };
  console.error = () => {};
  await assert.doesNotReject(
    recordActivity({
      userId: "65a000000000000000000001",
      action: "product_created",
      entityType: "product",
      description: "Product created",
    })
  );
});
