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

## Backend capability notes

The API supports product and customer CRUD, order creation/read/status updates, inventory reads/stock adjustments, and dashboard statistics. Reports are derived from those API responses. The backend does not currently provide password reset, order deletion, product variants, or file uploads. Product image URLs remain supported.
