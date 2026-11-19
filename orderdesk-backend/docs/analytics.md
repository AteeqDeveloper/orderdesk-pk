# Analytics API

All reporting endpoints are mounted under `/api/dashboard` and require the
existing bearer-token authentication middleware. Analytics queries are scoped
to the authenticated seller's `userId`; customer lookups are additionally
restricted to customers owned by that seller.

## Endpoints

- `GET /api/dashboard/analytics` — combined sales, order, product, customer,
  and inventory summary.
- `GET /api/dashboard/reports/sales` — sales totals and a zero-filled trend.
- `GET /api/dashboard/reports/orders` — status counts.
- `GET /api/dashboard/reports/products/top-selling` — top product/variant rows.
- `GET /api/dashboard/reports/customers` — customer counts and top completed
  spending customers.
- `GET /api/dashboard/reports/inventory` — current active inventory, low-stock,
  and out-of-stock entries.

The existing `GET /api/dashboard` response remains unchanged.

## Date parameters

Sales, orders, top-product, and customer reports accept either:

- `period=today|last7days|last30days|thisMonth`; or
- both `startDate=YYYY-MM-DD` and `endDate=YYYY-MM-DD` (inclusive).

The default period is `last30days`. Dates and bucket boundaries use UTC.
`interval=daily|weekly|monthly` selects the sales trend bucket size (default
`daily`; weekly buckets start Monday). `limit` on product and customer reports
is a whole number from 1 to 50 (default 5). Unknown parameters, invalid dates,
partial custom ranges, and reversed ranges return HTTP 400. Inventory analytics
is a current snapshot and accepts no query parameters.

Date filtering is based on order `createdAt` because orders do not record
delivery, payment, or refund timestamps. New-customer filtering uses customer
`createdAt`.

## Calculation rules

- `totalOrders` and each status count include every order created in the range,
  including cancelled and refunded orders.
- `deliveredSalesOrders` counts delivered, non-refunded orders;
  `paidOrders` and `unpaidOrders` count their respective payment statuses while
  excluding cancelled orders.
- `deliveredSales` is `totalAmount` for delivered orders whose payment status
  is not `refunded`. Delivered but unpaid orders are included because delivery
  and collection are separate states.
- `paidAmounts` and `unpaidAmounts` sum `totalAmount` for orders with the
  matching payment status, excluding cancelled orders. These measures are
  collections/balances, not sales, and can overlap delivered sales.
- `refundedAmounts` sums `totalAmount` for refunded orders and is reported
  separately; refunded orders are excluded from delivered sales and product
  sales. `cancelledOrderAmount` sums the total of cancelled orders separately.
- Top-product revenue sums stored item `lineTotal` snapshots, not order
  `totalAmount`; only delivered, non-refunded orders count. Product names
  and variant size/color/SKU come from order-item snapshots. Image URLs are
  looked up only on a product owned by the authenticated seller; deleted
  products have an empty image URL.
- Repeat customers are seller-owned customers with at least two delivered,
  non-refunded orders in the selected range. Highest completed spending sums
  `totalAmount` only for delivered, paid, non-refunded orders. The response
  contains customer ID and name only, not contact details.
- Inventory includes active products only. For products with variants, active
  variant records are the source of stock and cost; parent stock is not also
  counted. Products without variants use parent stock/cost. Low stock means
  positive stock at or below its threshold; zero or negative stock is
  out-of-stock. Inventory value is on-hand units multiplied by the applicable
  `costPrice` (schema-default cost is zero).

Money values use the stored numeric values without currency conversion or
rounding.

## Example response shapes

`GET /api/dashboard/reports/sales?period=last7days&interval=daily`:

```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2026-03-01",
      "endDate": "2026-03-07",
      "timezone": "UTC",
      "interval": "daily"
    },
    "totals": {
      "totalOrders": 8,
      "deliveredOrders": 4,
      "deliveredSalesOrders": 3,
      "paidOrders": 5,
      "unpaidOrders": 2,
      "cancelledOrders": 1,
      "deliveredSales": 12500,
      "paidAmounts": 9000,
      "unpaidAmounts": 3500,
      "refundedAmounts": 1000,
      "cancelledOrderAmount": 800
    },
    "trend": [
      {
        "date": "2026-03-01",
        "totalOrders": 0,
        "deliveredOrders": 0,
        "cancelledOrders": 0,
        "deliveredSales": 0,
        "paidAmounts": 0,
        "unpaidAmounts": 0,
        "refundedAmounts": 0,
        "cancelledOrderAmount": 0
      }
    ]
  }
}
```

`GET /api/dashboard/reports/products/top-selling` returns
`data.products[]` rows with `productId`, `variantId`, `name`, `imageUrl`,
`unitsSold`, `revenueGenerated`, and either a `{ size, color, sku }` variant
object or `null`; every product row also includes its order-item snapshot SKU.
Customer and inventory reports return the corresponding
counts and arrays described above.
