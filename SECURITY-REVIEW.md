# OrderDesk PK Security Review

**Review date:** 2026-11-22
**Scope:** Read-only review of the current frontend and backend security architecture. No `.env` values were read or included.

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | [authcontroller.js](./orderdesk-backend/controllers/authcontroller.js); [authRoutes.js](./orderdesk-backend/routes/authRoutes.js) | authcontroller.js: 97-173; authRoutes.js: 16-18 | Login endpoints lack throttling or lockout, increasing credential-stuffing and brute-force risk for business and Super Admin accounts. | 9/10 |
| 2 | ⚪ LOW | [server.js](./orderdesk-backend/server.js) | 27 | Default `cors()` allows requests from any origin. This broadens browser access; it does not by itself bypass the current bearer-token tenant checks. | 9/10 |
| 3 | ⚪ LOW | [authcontroller.js](./orderdesk-backend/controllers/authcontroller.js); [authMiddleware.js](./orderdesk-backend/middleware/authMiddleware.js); [server.js](./orderdesk-backend/server.js) | authcontroller.js: 8-16; authMiddleware.js: 27; server.js: 50-76 | JWT signing and verification assume `JWT_SECRET` is present and strong. Startup does not validate the secret, and verification does not pin an algorithm. The actual configured secret was not inspected. | 8/10 |

No Critical or High findings were reported in the reviewed scope.

## Verified controls

- Super Admin endpoints require authentication and a database-backed `super_admin` role check.
- Next.js middleware and the Super Admin server layout also restrict console routes by role.
- The authentication cookie is HttpOnly, SameSite=Lax, and Secure in production.
- Tenant-scoped queries were found in product, customer, order, notification, activity-log, subscription, and payment operations.
- Product/customer/order mutations require authentication and scope records to the authenticated user.
- Backup and image uploads have size limits and file filters; restore validates ownership and relationships and includes rollback handling.
- The Super Admin promotion script is a restricted operator-side script, not a public role-assignment API.

## Recommended fixes

1. Add per-IP and per-account login throttling, with progressive delay or temporary lockout for both login endpoints.
2. Restrict CORS to the deployed frontend origin and explicitly configure allowed methods and headers.
3. Validate required secrets at startup, reject placeholders or insufficiently strong JWT secrets, and explicitly configure the JWT verification algorithm.
4. Add secure HTTP response headers, such as a carefully configured Helmet policy.
5. Review Cloudinary upload authorization, signatures, and asset-path restrictions for user-controlled uploads.
6. Require provider signature verification and idempotency before enabling online payment activation or webhooks.

## Validation limits

The review did not inspect `.env` contents or validate deployed secret strength, MongoDB network/TLS/user privileges, production HTTPS and proxy behavior, Cloudinary credentials, provider enablement, or installed dependency vulnerabilities. No runtime or dependency vulnerability scan was performed. The supplied Step 20 request was truncated after “Prevent”, so the omitted implementation requirements were not inferred or acted upon.
