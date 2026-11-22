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

## Data export and backups

The authenticated data management endpoints are:

- `GET /api/data-management/exports/:type?format=csv&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — streamed CSV for `products`, `customers`, `orders`, `inventory`, `variants`, `activity-logs`, or `sales-reports`. Both date boundaries are optional, but must be provided together; date-only bounds are inclusive UTC calendar dates. Currency columns are labeled and formatted in PKR. CSV formula-like values are escaped.
- `GET /api/data-management/backup` — streamed JSON backup.
- `POST /api/data-management/backup/validate` — multipart upload using the `backup` file field; validates the format, account owner, model data, and record relationships, then returns a preview.
- `POST /api/data-management/backup/restore` — multipart upload using the `backup` file field; validates again and performs a merge-only restore.

Backups use `format: "orderdesk-backup"` and `version: 1`, with `ownerId`, `createdAt`, business `settings`, and `products`, `customers`, and `orders` arrays. Product variant subdocuments and stock live inside product records; order customer/product/variant IDs and snapshots are retained. References that resolve to account records are checked for ownership and variant/product consistency. Since the existing app permits deleting products and customers while keeping order snapshots, historical order references that no longer resolve are preserved rather than recreated. Authentication credentials, user records, activity logs, and notifications are not in backups. Restore only accepts a backup whose `ownerId` matches the authenticated account, skips records already present by ID, never overwrites existing records, and fills only blank business name or phone settings. Conflicting cross-account references and SKU collisions are rejected. Uploaded backups are limited to 10 MB.

CSV is the only export format currently installed; Excel workbooks are not supported. Large CSV exports and backup generation use database cursors and stream through the API proxy.
