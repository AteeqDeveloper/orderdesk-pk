import test from "node:test";
import assert from "node:assert/strict";
import subscriptionRoutes from "../routes/subscriptionRoutes.js";
import productRoutes from "../routes/productRoutes.js";
import customerRoutes from "../routes/customerRoutes.js";
import orderRoutes from "../routes/orderRoutes.js";

test("subscription endpoints require authentication and expose user/admin operations", () => {
  assert.equal(subscriptionRoutes.stack[0].handle.name, "authMiddleware");
  const routes = subscriptionRoutes.stack
    .filter((layer) => layer.route)
    .map(
      (layer) =>
        `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`
    );
  assert.deepEqual(routes, [
    "get /plans",
    "get /current",
    "post /requests",
    "post /cancel",
    "get /payments",
    "get /payments/:paymentId",
    "get /admin/plans",
    "post /admin/plans",
    "patch /admin/plans/:planId",
    "get /admin/subscriptions",
    "patch /admin/subscriptions/:subscriptionId/status",
    "post /admin/payments/:paymentId/verify",
  ]);
  assert.ok(
    subscriptionRoutes.stack.some(
      (layer) => !layer.route && layer.handle.name === "adminMiddleware"
    )
  );
});

test("product, customer, and order creation routes include server-side quota checks", () => {
  for (const router of [productRoutes, customerRoutes, orderRoutes]) {
    const createRoute = router.stack.find(
      (layer) => layer.route?.path === "/" && layer.route.methods.post
    );
    assert.ok(createRoute);
    assert.equal(createRoute.route.stack.length, 2);
  }
});
