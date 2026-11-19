# Notifications

All notification APIs are mounted at `/api/notifications` and require the
existing bearer-token middleware. The Next.js proxy forwards the HttpOnly
`orderdesk_token` cookie as that bearer token.

## Endpoints

- `GET /api/notifications?limit=20` — recent notifications and unread count.
  `limit` is optional and must be from 1 to 50.
- `GET /api/notifications/unread-count` — unread total.
- `PATCH /api/notifications/:id/read` — mark one notification read.
- `PATCH /api/notifications/read-all` — mark the authenticated seller's
  unread notifications as read.
- `DELETE /api/notifications/:id` — delete one seller-owned notification.

Every query or mutation includes the authenticated `userId`; an ID belonging
to another seller returns 404. Invalid notification IDs return 400.

## Stock alerts and deduplication

Product and active-variant stock use their existing `lowStockThreshold`.
Positive stock at or below threshold is `low_stock`; zero is `out_of_stock`.
The notification is created on a transition into an alert state. When an alert
changes from low-stock to out-of-stock, the existing item alert is updated.
Returning to healthy stock marks the unread stock alert read. A unique
`userId`/dedupe-key index plus atomic upserts ensures one notification record
per seller/product or seller/variant, including concurrent stock changes.

Stock alerts are checked after initial product creation, product/variant stock
updates, manual stock adjustments, order stock deductions, and successful
order cancellation/restoration. Notification persistence failures are logged
without rolling back or misreporting a completed order or inventory operation.

Order status transitions generate one latest-status notification per order;
payment-only updates and unchanged statuses do not generate alerts. Status
notifications are sent to the order's seller.

No notification preference fields or UI are currently available; alert types
are enabled by default.
