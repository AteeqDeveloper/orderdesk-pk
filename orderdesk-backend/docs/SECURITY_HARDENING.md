# Authentication and API security configuration

## Login throttling

`POST /api/auth/login` and `POST /api/auth/super-admin/login` share MongoDB-backed,
fixed-window limits: 8 attempts per normalized account and 30 per IP address in
15 minutes. Successful logins are not counted. Blocked requests receive HTTP 429
with a `Retry-After` header and a generic message. Counters expire automatically;
these limits do not permanently lock accounts. Account and IP identifiers are
HMAC-hashed before storage.

The IP limiter uses Express `req.ip`. If the backend is behind a reverse proxy,
set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops. It defaults to
`0`; do not set it to `true` or trust client-supplied forwarding headers.

## CORS

Set `FRONTEND_ORIGINS` in the backend deployment environment to a comma-separated
list of exact frontend origins, for example:

```text
FRONTEND_ORIGINS=https://app.example.com,https://admin.example.com
```

Use the actual deployed origin(s), without paths or trailing slashes. Production
startup fails if this variable is missing or contains a wildcard/invalid origin.
This repository only documents `http://localhost:3000` for development; it does
not identify the production frontend domain. Development uses that localhost
origin when `FRONTEND_ORIGINS` is unset. The API does not enable credentialed
CORS; the browser uses the same-origin Next.js API proxy, which forwards bearer
authorization to Express.

## JWT signing key

`JWT_SECRET` must be at least 32 UTF-8 bytes and pass a minimum estimated-entropy
check; common placeholder values are rejected. Generate a new value with Node:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Set the generated value only in the backend secret manager or private backend
environment. Never put it in frontend variables or source control. The backend
uses HS256 for signing and verification, and keeps the existing one-day token
expiration. Replacing the signing secret invalidates existing JWTs.
