# OrderDesk PK

OrderDesk PK is a Next.js App Router frontend backed by the Express API in `../orderdesk-backend` and MongoDB.

## Requirements

- Node.js 20 or newer
- MongoDB connection string configured in the backend environment
- Backend JWT secret configured in the backend environment

## Configure

Install each project independently:

```bash
cd orderdesk-backend
npm install
```

```bash
cd orderdesk-pk
npm install
```

Create `orderdesk-backend/.env` with `PORT`, `MONGO_URI`, and `JWT_SECRET`. Keep this file private and do not expose its values to the frontend.

Create `orderdesk-pk/.env.local` from `.env.example`. `NEXT_PUBLIC_API_URL` should point to the Express server, normally `http://localhost:5000`.

## Run locally

Start MongoDB, then run these commands in separate terminals:

```bash
cd orderdesk-backend
npm run dev
```

```bash
cd orderdesk-pk
npm run dev
```

Open `http://localhost:3000`.

The frontend stores the backend JWT in an HttpOnly, SameSite=Lax cookie and proxies authenticated requests through its same-origin `/api` route. The current backend uses stateless JWTs; logout clears the browser session cookie.

## Activity log API

The authenticated Express API records successful product, customer, order, inventory, variant, and notification changes. Audit entries are written by the backend; there are no public create, update, or delete endpoints for activity logs.

- `GET /api/activity-logs?page=1&limit=20` — newest-first list, with `total` and `pages` pagination values.
- `GET /api/activity-logs/:id` — fetch one entry belonging to the authenticated user.

The list endpoint returns `data.logs` and `data.pagination` (`page`, `limit`, `total`, `pages`), and supports `action`, `entityType`, `search`, `startDate`, and `endDate` filters. Date-only boundaries are interpreted in UTC, including the full end date. Supported entity types are `product`, `customer`, `order`, `inventory`, `variant`, and `notification`. All endpoints require the existing authenticated API session.
