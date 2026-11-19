import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsQuery,
  getAnalyticsFilterError,
} from "../lib/analytics.js";

test("each supported preset maps to the backend period parameter", () => {
  for (const period of ["today", "last7days", "last30days", "thisMonth"]) {
    const query = new URLSearchParams(
      buildAnalyticsQuery({ period, interval: "daily" })
    );
    assert.equal(query.get("period"), period);
    assert.equal(query.get("interval"), "daily");
    assert.equal(query.has("startDate"), false);
  }
});

test("custom dates are sent as inclusive backend date parameters", () => {
  const query = new URLSearchParams(
    buildAnalyticsQuery({
      period: "custom",
      startDate: "2026-03-01",
      endDate: "2026-03-12",
      interval: "weekly",
    })
  );

  assert.equal(query.get("startDate"), "2026-03-01");
  assert.equal(query.get("endDate"), "2026-03-12");
  assert.equal(query.get("interval"), "weekly");
  assert.equal(query.has("period"), false);
});

test("invalid and incomplete custom ranges are rejected before making a request", () => {
  assert.match(
    getAnalyticsFilterError({
      period: "custom",
      startDate: "2026-03-01",
      endDate: "",
      interval: "daily",
    }),
    /both a start date and an end date/
  );
  assert.match(
    getAnalyticsFilterError({
      period: "custom",
      startDate: "2026-03-13",
      endDate: "2026-03-12",
      interval: "daily",
    }),
    /on or before/
  );
  assert.match(
    getAnalyticsFilterError({
      period: "custom",
      startDate: "2026-02-30",
      endDate: "2026-03-01",
      interval: "daily",
    }),
    /valid dates/
  );
  assert.match(
    getAnalyticsFilterError({
      period: "thisMonth",
      interval: "hourly",
    }),
    /valid chart interval/
  );
});
