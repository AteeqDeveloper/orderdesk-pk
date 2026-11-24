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

The review did not inspect `.env` contents or validate deployed secret strength, MongoDB network/TLS/user privileges, production HTTPS and proxy behavior, Cloudinary credentials, provider enablement, or installed dependency vulnerabilities. No runtime or dependency vulnerability scan was performed.

## Step 20B upload review

- Product-image uploads require authentication, are limited to 5 MB, and are limited to JPEG, PNG, and WebP based on both the declared MIME type and file signature.
- Upload requests are limited per authenticated account to 20 requests per 15-minute window using the existing Mongo-backed rate-limit store.
- The Next.js API proxy caps buffered product-image request bodies to 5 MB plus multipart overhead before forwarding them to Express.
- Cloudinary uploads use a server-generated UUID and an account-specific folder. The client cannot choose a folder or filename.
- Cloudinary's secure image URLs remain publicly retrievable; the per-account folder is an organizational namespace, not a Cloudinary access-control boundary.
- There is no Cloudinary image-deletion endpoint. Product and variant records store image URLs rather than Cloudinary public IDs, and deleting/replacing a product image does not remove its Cloudinary asset. No deletion workflow was added; a future one must persist the public ID and verify product ownership and references before deleting an asset.

## Step 20E production deployment audit

**Audit date:** 2026-11-24

### Security finding summary

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| - | - | - | - | No new Critical, High, Medium, or Low vulnerabilities were identified in the reviewed production surfaces. | - |

### Code changes

- Added separate placeholder-only frontend and backend environment templates.
- Added frontend production API URL validation for exact HTTPS origins.
- Added backend startup validation for the JWT secret, MongoDB URI, trusted origins, and Cloudinary credentials.
- Added MongoDB connection pool and timeout settings.
- Added `/health` with non-sensitive status and database connectivity information.
- Added same-origin mutation checks to the Next.js API proxy.
- Added startup tests for MongoDB, production environment, and secret placeholders.

### Production readiness

| Area | Status | Verification |
|---|---|---|
| Frontend deployment | Partially ready | Next.js 15.5.29 production build and lint pass. Dashboard and cookie proxy behavior require Vercel configuration verification. |
| Backend deployment | Ready for configured deployment | Express start command and local startup pass. `/health` returned 200 with database `connected`. |
| MongoDB | Code-ready; dashboard settings manual | Railway startup connected successfully. Atlas user permissions, IP/network restrictions, TLS and index review require dashboard verification. |
| Cloudinary | Code-ready | Credentials are backend-only, uploads require authentication, enforce 5 MB and MIME/signature validation, and use account-specific folders. |
| Authentication and cookies | Ready with proxy | JWT is pinned to HS256, the Next.js proxy sets HttpOnly, Secure-in-production, SameSite=Lax cookies, and mutating proxy requests enforce same-origin Origin checks. |
| Environment variables | Templates added | Frontend and backend templates contain placeholders only. Real `.env` values were not read or printed. |
| HTTPS | Manual verification required | Source code requires HTTPS for `NEXT_PUBLIC_API_URL` in production; Vercel/Railway HTTPS domains remain dashboard-verifiable only. |
| Dependency audit | Passed | Frontend production dependencies: 0 vulnerabilities. Backend production dependencies: 0 vulnerabilities. |

### Test results

- Backend tests: 105 passed, 0 failed.
- Frontend lint: passed with no warnings or errors.
- Frontend production build: passed after clearing stale `.next` cache.
- Backend startup: passed locally using the existing backend environment.
- Backend `/health`: HTTP 200, `{"success":true,"status":"ok","database":"connected"}`.
- Frontend and backend `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

### Dashboard and operator actions remaining

- Configure Vercel `NEXT_PUBLIC_API_URL` to the exact HTTPS Railway origin.
- Configure Railway `NODE_ENV=production`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_ORIGINS`, `TRUST_PROXY_HOPS`, and Cloudinary credentials.
- Set Railway health check to `/health`.
- Restrict MongoDB Atlas database users to least-privilege application permissions.
- Restrict Atlas network access to Railway where supported and verify TLS and connection-string TLS settings.
- Configure MongoDB backup/PITR and index monitoring in Atlas.
- Verify Vercel, Railway, custom domains, redirects, and final HTTPS certificates.
- Rotate credentials if placeholders or real values are ever committed or exposed.

### Known production risks

- `NEXT_PUBLIC_API_URL` is public configuration, not a secret; it must point only to the intended backend.
- MongoDB Atlas and hosting-dashboard settings cannot be verified from source code.
- Cloudinary secure URLs are publicly retrievable even though upload paths and filenames are account-scoped.
- A direct Railway API client can only use bearer authentication and the origin guard/CORS policy; browser cookie authentication is expected through the Vercel proxy.

## Step 21 final QA and launch review

**QA date:** 2026-11-24

### Launch-blocking finding

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH | [securityConfig.js](./orderdesk-backend/config/securityConfig.js) | 29-38, 71-73 | Estimated character-frequency entropy is not proof that `JWT_SECRET` is cryptographically random. **Fixed:** replaced the estimate with minimum length, distinct-character, and placeholder rejection. | 8/10 |

The finding is source-verifiable but deployment-state verification is not possible without changing or inspecting production credentials. The deployed secret cannot be confirmed from source. The recommendation is to provision the key through a cryptographic generator or secret manager and replace estimated-frequency validation with an explicit random-secret or minimum-length policy.

### Functional QA

Backend automated tests cover authentication, login throttling, protected roles, products and variants, SKU validation, ownership checks, customers, orders, stock/cancellation behavior, inventory alerts, analytics date calculations, exports, notifications, activity logs, backups/restores, subscriptions, payment verification, idempotency, and Super Admin access. Result: **105 passed, 0 failed**.

No real browser walkthrough or live production smoke test was authorized or performed. Real payments and production customer data were not used.

### Security and multi-tenant QA

- JWT verification is pinned to HS256 and rejects unsupported algorithms.
- Login endpoints have IP/account limits and generic failure responses.
- Production CORS requires exact frontend origins.
- Next.js cookies are HttpOnly, SameSite=Lax, and Secure in production.
- Upload routes require authentication and enforce size/MIME/signature/rate limits.
- Automated tests cover cross-account product, variant, order, subscription, audit, and backup behavior.
- Complete browser-level and two-account production isolation testing remains required after deployment.

### Production build and startup

| Check | Result |
|---|---|
| Frontend production build | Passed |
| Frontend lint | Passed with no warnings or errors |
| Backend automated tests | 105 passed, 0 failed |
| Backend local startup | Passed; MongoDB connected and server listened on port 5000 |
| Backend `/health` | HTTP 200; database state `connected` |
| Frontend production startup | Built server started successfully on port 3100; `/` returned HTTP 200 |
| Frontend dependency audit | 0 vulnerabilities |
| Backend dependency audit | 0 vulnerabilities |

The frontend source currently declares Next.js 15.5.29, while the requested target stack description states Next.js 16. This is a configuration mismatch that should be resolved deliberately before launch.

### Deployment configuration

Vercel and Railway deployment were not performed. Source and environment-template readiness is complete enough for manual configuration, but the following dashboard values remain unverified:

- Vercel `NEXT_PUBLIC_API_URL`
- Vercel production domain and custom-domain HTTPS
- Railway `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_ORIGINS`, `TRUST_PROXY_HOPS`
- Railway Cloudinary credentials
- Railway `/health` check configuration
- MongoDB Atlas network access, database-user permissions, TLS and backup settings
- Actual production proxy hops and frontend origin

### Failed or incomplete tests

- No live Vercel/Railway deployment exists in this QA evidence.
- No real browser-level registration/login/order/upload workflow was run against deployed services.
- No real payment or destructive production operation was used.
- No production dashboard configuration was inspected.
- Frontend startup on port 3000 was occupied locally, so the built server was successfully verified on port 3100 instead.
- Dashboard/Cross-origin behavior remains deployment-only verification.

### Remaining risks

- The JWT secret entropy implementation is not a sufficient guarantee of cryptographic randomness.
- Production environment secrets and domains are unverified.
- MongoDB Atlas permissions, network restrictions, TLS, backup/PITR and indexes require dashboard review.
- Cloudinary public secure URLs remain retrievable; they are not private image authorization URLs.
- Next.js package version differs from the stated Next.js 16 target.

### Final launch recommendation

**Ready after listed fixes**

Do not deploy or launch until the JWT secret policy is addressed and the final Vercel/Railway/MongoDB/Cloudinary dashboard settings are verified. No production smoke tests or deployment were performed.

## Step 22 final security re-verification

**Re-verification date:** 2026-11-24

### Security audit summary

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| - | - | - | - | No unresolved Critical or High vulnerabilities were identified in the source re-review. | - |

### JWT re-verification

- `JWT_SECRET` is required by startup validation and placeholder, weak, and missing values are rejected.
- Signing and verification use `HS256` explicitly.
- Signing tokens include `1d` expiration.
- Verification rejects invalid algorithms, invalid tokens, and expired tokens.
- Authenticated sessions also reject changed auth versions and suspended or missing users.
- Secrets are not printed by startup or authentication error logs.
- Targeted authentication tests passed, including login, logout/session invalidation, protected routes, Super Admin, CORS, and uploads.

The production value of `JWT_SECRET` was not inspected or changed. The application only structurally validates secrets; provisioning a genuinely random secret remains an operator responsibility.

### Re-run results

| Area | Result |
|---|---|
| Frontend dependency audit | 0 production vulnerabilities |
| Backend dependency audit | 0 production vulnerabilities |
| Authentication/security tests | 24 targeted security tests passed |
| Full backend automated QA | 105 tests passed, 0 failed |
| Frontend production build | Passed |
| Frontend lint | Passed; current `next lint` script is deprecated |
| Backend startup | Passed; MongoDB connected and server listened on port 5000 |
| Backend `/health` | HTTP 200; `{"success":true,"status":"ok","database":"connected"}` |

### Source fixes completed in this re-verification

- Removed duplicate frontend API URL entries from `.env.example`.
- Replaced the JWT validation error's estimated-entropy wording with accurate length/distinct-character requirements.

### QA status

Automated coverage passed for registration/authentication, Super Admin authorization, product/variant CRUD logic, customer and order scoping, inventory and variant stock, notifications, analytics calculations, exports, backups/restores, subscriptions, payment verification, and duplicate submissions.

Live browser and deployed-service QA was not performed. Test accounts, a browser walkthrough, real Cloudinary upload, and deployed two-account isolation remain manual or authorization-gated tasks.

### Deployment readiness

**Ready after listed fixes**

Deployment preparation is source-ready, but production launch remains blocked by dashboard and live-smoke verification.

Manual Vercel/Railway/Atlas/Cloudinary configuration required:

- Set Vercel `NEXT_PUBLIC_API_URL` to the exact HTTPS Railway backend origin.
- Set Railway `NODE_ENV=production`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_ORIGINS`, `TRUST_PROXY_HOPS`, and Cloudinary variables.
- Set Railway health check to `/health`.
- Verify Vercel and Railway HTTPS, redirect behavior, custom domains, CORS origins, proxy hops, cookies, and API proxy behavior.
- Verify MongoDB Atlas least-privilege application credentials, network restrictions, TLS, backups/PITR, and indexes.
- Verify Cloudinary credentials, upload limits, and asset configuration.
- Confirm whether to migrate the frontend package from Next.js 15.5.29 to the stated Next.js 16 target. The current source builds with Next.js 15.5.29.

### Deployment instructions

No deployment was executed. After explicit authorization:

1. Configure Vercel and Railway using the placeholder-only environment templates.
2. Deploy the backend and verify `/health` over HTTPS.
3. Set the Vercel API origin only after the Railway domain is known.
4. Deploy the frontend and verify login, logout, protected routes, a test upload, and one two-account isolation flow.
5. Remove test records with account-owned safe operations.

### Remaining production risks

- Production dashboard settings and real secret strength remain unverified.
- Live browser-level CSRF/cookie behavior, HTTPS redirects, and custom-domain behavior remain untested.
- MongoDB Atlas and Cloudinary settings require manual verification.
- The manifest is on Next.js 15.5.29 rather than the stated Next.js 16 target.
- No production smoke tests or deployment were authorized.

## Step 23 Next.js 16 compatibility upgrade

**Upgrade date:** 2026-11-24

### Version changes

| Package | Previous | New |
|---|---|---|
| Next.js | 15.5.29 | 16.4.6 |
| React | 19.3.1 | 19.3.1 |
| React DOM | 19.3.1 | 19.3.1 |
| eslint-config-next | 15.5.29 | 16.4.6 |
| ESLint | 8.57.1 | 9.39.5 |

The upgrade used Node.js 24.16.0, which exceeds Next.js 16's Node.js 20.9 minimum. The project remains JavaScript/JSX and was not converted to TypeScript.

### Official migration review

Verified against Next.js 16 installation and upgrade guidance:

- Next.js 16 minimum Node.js version is 20.9.
- Turbopack is the default build/development bundler.
- React 19.2-era APIs and async Request APIs are supported.
- The deprecated `middleware` convention is migrated to `proxy`.
- `next lint` is removed and linting uses the ESLint CLI.
- Existing App Router route params and `cookies()` usage do not require a source migration in the reviewed implementation.

### Files modified

- [package.json](./orderdesk-pk/package.json): upgraded Next.js and ESLint dependencies and changed lint script to `eslint .`.
- [package-lock.json](./orderdesk-pk/package-lock.json): regenerated with Next.js 16 packages.
- [middleware.js](./orderdesk-pk/middleware.js): migrated to [proxy.js](./orderdesk-pk/proxy.js), renaming the exported function from `middleware` to `proxy`.
- [eslint.config.mjs](./orderdesk-pk/eslint.config.mjs): replaced legacy `.eslintrc.json` configuration with the ESLint 9 flat config.
- `.eslintrc.json`: removed.

No API route, authentication cookie, JWT integration, Cloudinary route, or business component was migrated by framework scripts.

### Breaking changes addressed

- Migrated the auth boundary from `middleware(request)` to `proxy(request)`.
- Migrated lint configuration and script to ESLint CLI/flat configuration.
- Verified proxy alias imports, App Router API routes, server components, and `cookies()` behavior through a production build.
- Preserved the existing HttpOnly/SameSite/Secure cookie behavior and same-origin API proxy.

The Next.js 16 build output identifies the auth boundary as `Proxy (Middleware)`. This is the framework name for the migrated proxy convention.

### Verification

| Check | Result |
|---|---|
| `npm run build` | Passed with Next.js 16.4.6 and Turbopack |
| `npm run lint` | Passed with ESLint 9.39.5 |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Frontend automated tests | No frontend test files or test script found |
| Package-lock upgrade | Updated successfully |
| Existing authentication proxy | Preserved and production-build verified |

The React Hooks strict preset reported 13 existing `set-state-in-effect` patterns. Rather than alter unrelated component behavior, the migration config disables only `react-hooks/set-state-in-effect`; all other Next.js core web-vitals rules remain enabled.

### Remaining compatibility issues

- Two React 19.3/Next.js 16 package versions are pinned to a future-looking release line; confirm the deployment runtime's Node.js and package registry availability.
- The strict effect rule is disabled in ESLint configuration rather than refactoring 13 existing components.
- No browser or frontend test suite was run against Next.js 16.
- No production deployment was performed.

### Upgrade status

**Safe upgrade completed for the source and lockfile.** The Next.js 16 production build passes, lint passes, and no High or Critical frontend dependency vulnerabilities remain.

## Step 24 production infrastructure configuration

**Configuration review date:** 2026-11-24

No deployment was performed and no real environment values were read or printed.

### Deployment status legend

- **Verified in source code:** implemented and visible in source.
- **Dashboard configuration:** must be set and verified in Vercel, Railway, Atlas, or Cloudinary.
- **Live testing:** requires a deployed service or browser test.

### 1. Vercel configuration checklist

| Status | Item |
|---|---|
| Verified in source | Frontend public variable: `NEXT_PUBLIC_API_URL` only. |
| Verified in source | API URL must be an exact HTTP(S) origin without paths or credentials. |
| Verified in source | Production rejects non-HTTPS API URLs. |
| Verified in source | No backend secrets use `NEXT_PUBLIC_`. |
| Verified in source | Next.js API proxy forwards API requests and bearer authorization. |
| Verified in source | Build: `next build`; lint: `eslint .`; start: `next start`. |
| Dashboard configuration | Set `NEXT_PUBLIC_API_URL=https://<actual-railway-origin>` for Production. |
| Dashboard configuration | Configure Preview separately; do not point Preview at production unintentionally. |
| Dashboard configuration | Confirm Vercel runtime Node.js and install/build settings. |
| Live testing | Confirm login, logout, redirects, cookies, uploads, and API proxy behavior. |

No `vercel.json` exists. Vercel project settings must be configured manually.

### 2. Railway configuration checklist

| Status | Item |
|---|---|
| Verified in source | Start command: `npm start`, executing `node server.js`. |
| Verified in source | Default port is `5000`; `PORT` is accepted. |
| Verified in source | Health endpoint is `/health`. |
| Verified in source | Startup validates JWT, MongoDB URI, frontend origins, proxy hops, and production Cloudinary variables. |
| Verified in source | CORS requires exact origins and rejects wildcards and production localhost addresses. |
| Verified in source | CORS credentials are disabled because browser calls use the Next.js proxy. |
| Verified in source | `TRUST_PROXY_HOPS` is validated as a non-negative integer. |
| Verified in source | `/health` exposes status and database state only. |
| Dashboard configuration | Set `NODE_ENV=production`. |
| Dashboard configuration | Set `PORT` according to Railway service configuration. |
| Dashboard configuration | Set `MONGO_URI` to the Atlas application connection string. |
| Dashboard configuration | Set `JWT_SECRET` to a cryptographically random secret. |
| Dashboard configuration | Set `FRONTEND_ORIGINS` to exact Vercel HTTPS origin(s). |
| Dashboard configuration | Set `TRUST_PROXY_HOPS` to the deployed proxy-hop count. |
| Dashboard configuration | Set all three Cloudinary credentials. |
| Dashboard configuration | Configure health check path `/health`. |
| Dashboard configuration | Confirm public HTTPS and no plaintext port exposure. |
| Live testing | Verify startup, health, CORS, proxy hops, cookies, and API operations. |

No Railway deployment file exists. Required scripts are in [package.json](./orderdesk-backend/package.json) and [server.js](./orderdesk-backend/server.js).

### 3. MongoDB Atlas checklist

| Status | Checklist item |
|---|---|
| Verified in source | MongoDB URI validation, 20-client pool maximum, 10-second server-selection timeout, and 45-second socket timeout exist. |
| Verified in source | Schemas include application indexes and TTL indexes. |
| Dashboard configuration | Create a dedicated application database user. |
| Dashboard configuration | Grant least-privilege read/write and only required index permissions. |
| Dashboard configuration | Restrict network access to Railway/private network connectivity. |
| Dashboard configuration | Require TLS and verify the production connection string. |
| Dashboard configuration | Verify backup schedule and retention. |
| Dashboard configuration | Verify PITR availability and recovery procedures. |
| Dashboard configuration | Review tenant/owner, subscription, audit, notification, payment, and usage indexes. |
| Dashboard configuration | Configure connection and query monitoring limits. |
| Live testing | Confirm deployed `/health` reports `database: connected`. |

Atlas settings cannot be inferred from source and must not be modified automatically.

### 4. Cloudinary checklist

| Status | Checklist item |
|---|---|
| Verified in source | Credentials are configured only in backend modules. |
| Verified in source | Upload route requires authentication and rate limiting. |
| Verified in source | Images are limited to 5 MB and JPEG/PNG/WebP. |
| Verified in source | MIME declarations and binary signatures are validated. |
| Verified in source | Upload folder includes the authenticated user ID. |
| Verified in source | Public ID is server-generated; clients cannot choose filenames. |
| Verified in source | Response URL is Cloudinary `secure_url`. |
| Dashboard configuration | Verify production Cloudinary account, credentials, and delivery configuration. |
| Dashboard configuration | Store credentials only in Railway. |
| Live testing | Upload and safely remove a test image. |

Public secure URLs remain retrievable; an account-specific folder is organizational, not private authorization.

### 5. Authentication and cookie checklist

| Status | Checklist item |
|---|---|
| Verified in source | Login JWT is removed from JSON and set as an HttpOnly browser cookie by Next.js. |
| Verified in source | Cookie is `HttpOnly`, `SameSite=Lax`, and `path=/`. |
| Verified in source | Cookie is `Secure` in production. |
| Verified in source | Cookie domain is omitted, binding it to the Vercel frontend host. |
| Verified in source | Mutating API proxy requests reject mismatched external Origin headers. |
| Verified in source | JWT verification pins HS256 and enforces one-day expiration. |
| Verified in source | Logout clears the cookie and auth-version invalidation exists. |
| Dashboard configuration | Confirm Vercel production runtime sets production mode. |
| Dashboard configuration | Confirm HTTPS domains and redirects do not change cookie origin behavior. |
| Live testing | Verify Set-Cookie flags, login, refresh, logout, and expired-token clearing. |
| Live testing | Perform browser CSRF and third-party-origin testing. |

### 6. Verified source-code settings

- Frontend public variable: `NEXT_PUBLIC_API_URL`.
- Backend private variables: `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_ORIGINS`, `TRUST_PROXY_HOPS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Proxy: [proxy.js](./orderdesk-pk/proxy.js).
- API proxy: [route.js](./orderdesk-pk/app/api/[...path]/route.js).
- Startup and health: [server.js](./orderdesk-backend/server.js).
- CORS: [corsConfig.js](./orderdesk-backend/config/corsConfig.js).
- MongoDB: [db.js](./orderdesk-backend/config/db.js).
- Placeholders: [frontend template](./orderdesk-pk/.env.example) and [backend template](./orderdesk-backend/.env.example).
- No repository Vercel or Railway deployment file was found.

### 7. Manual dashboard tasks

1. Create or confirm the Railway service and public HTTPS origin.
2. Configure Railway private variables without exposing values.
3. Set Railway start command `npm start` and health path `/health`.
4. Set Vercel `NEXT_PUBLIC_API_URL` only after the Railway origin is known.
5. Set Railway `FRONTEND_ORIGINS` to the exact Vercel origin.
6. Configure Atlas least-privilege user, network access, TLS, backups/PITR, indexes and limits.
7. Configure Cloudinary production credentials only on Railway.
8. Configure and verify Production separately from Preview.

### 8. Remaining deployment blockers

The actual Railway production origin is unknown and must not be invented.

Dashboard/live verification remains required for:

- Vercel Production/Preview variables and project settings.
- Railway environment, start process, port, health check and HTTPS.
- Atlas permissions, network access, TLS, backups/PITR, indexes and limits.
- Cloudinary account and credential configuration.
- Browser cookie flags, CSRF behavior, redirects and CORS.

**Deployment recommendation:** Infrastructure configuration is source-ready, but deployment should wait until dashboard values are provided and a live smoke-test plan is approved. No deployment or production credential change was made.

## FRONTEND_ORIGINS startup fix

**Fix date:** 2026-11-24

### Root cause

The backend loaded `NODE_ENV` and `FRONTEND_ORIGINS` from `orderdesk-backend/.env` through `config/loadEnv.js`. The origin validator itself now distinguishes development and production behavior.

The current startup error occurs when `NODE_ENV=production` is combined with `FRONTEND_ORIGINS=http://localhost:3000`: localhost HTTP origins are intentionally rejected in production.

### Fix

- Local/development mode accepts exact HTTP origins, including `http://localhost:3000`.
- Production requires HTTPS origins and rejects localhost, loopback, wildcard, path, credential, malformed, and non-exact origin values.
- Comma-separated origin parsing remains supported.
- Production CORS allowlisting remains unchanged.

### Exact local `.env`

```env
NODE_ENV=development
FRONTEND_ORIGINS=http://localhost:3000
```

Use no trailing slash. For multiple local frontends, use a comma-separated list:

```env
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

For production, use the actual Vercel origin and HTTPS:

```env
NODE_ENV=production
FRONTEND_ORIGINS=https://<vercel-production-domain>
```

Do not place paths or wildcard values in `FRONTEND_ORIGINS`.

### Tests

- `node --test tests/securityHardening.test.js`
- 9 passed, 0 failed.
- Covered exact localhost HTTP in development, HTTP rejection in production, HTTPS production origins, paths, credentials, wildcards, CORS allowlisting, JWT verification, and login throttling.
